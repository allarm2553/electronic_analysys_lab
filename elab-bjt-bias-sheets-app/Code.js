/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: BJT DC Fixed Bias Lab')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.ping || data.test) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Connected to Google Apps Script backend successfully!',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var result = submitWorksheet(data);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


const BJT_MODELS = {
  'BC108': {
    name: 'BC108',
    type: 'NPN Low-Noise Audio / GP',
    beta: 250,
    vbe: 0.68,
    package: 'TO-18 Metal Can',
    pins: { p1: 'E', p2: 'B', p3: 'C' }
  },
  '2N2222': {
    name: '2N2222',
    type: 'NPN General Purpose / Switch',
    beta: 200,
    vbe: 0.70,
    package: 'TO-92 Plastic',
    pins: { p1: 'E', p2: 'B', p3: 'C' }
  },
  'BD137': {
    name: 'BD137',
    type: 'NPN Medium Power / Driver',
    beta: 100,
    vbe: 0.75,
    package: 'TO-126 Power',
    pins: { p1: 'E', p2: 'C', p3: 'B' }
  },
  'BC547': {
    name: 'BC547',
    type: 'NPN General Purpose Amplifier',
    beta: 300,
    vbe: 0.68,
    package: 'TO-92 Plastic',
    pins: { p1: 'C', p2: 'B', p3: 'E' }
  }
};

/**
 * Processes the student's lab report submission
 */
function submitWorksheet(data) {
  try {
    // 0. Check duplicate submission
    const duplicateCheck = checkDuplicateSubmission("Submissions", 4, data.studentId);
    if (duplicateCheck) {
      return duplicateCheck;
    }

    const gradingResults = gradeWorksheet(data);
    recordToSheet(data, gradingResults);
    
    return {
      status: 'success',
      score: gradingResults.score,
      maxScore: gradingResults.maxScore,
      feedback: gradingResults.feedback,
      comment: gradingResults.comment
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.toString()
    };
  }
}

/**
 * BJT Fixed Bias Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  const isHardware = (data.labDataSource === 'hardware');
let score = 0;
  const maxScore = 10;
  const feedback = [
    isHardware 
      ? '📌 โหมดการตรวจ: 🔌 อุปกรณ์จริง (Hardware Lab) - ปรับเกณฑ์ความคลาดเคลื่อนตามมาตรฐานอุปกรณ์จริง' 
      : '📌 โหมดการตรวจ: 🔬 ห้องทดลองจำลองเสมือน (Virtual Simulation)'
  ];

  const modelKey = data.bjtModel || data.selectedModel || 'BC108';
  const model = BJT_MODELS[modelKey] || BJT_MODELS['BC108'];
  const cond = data.diodeCondition || 'good';
  const hfe = model.beta;
  const VbeNom = model.vbe;

  // 1. Table Data Check (3 pts)
  let rowCorrect = 0;
  if (data.part2Rows && data.part2Rows.length >= 6) {
    data.part2Rows.forEach(row => {
      if (parseFloat(row.vrb) > 0 || parseFloat(row.vbe) > 0 || parseFloat(row.ib) > 0) rowCorrect++;
    });
  }
  let tableScore = rowCorrect >= 6 ? 3 : (rowCorrect >= 4 ? 2 : (rowCorrect >= 2 ? 1 : 0));
  score += tableScore;
  feedback.push(`[ตอนที่ 1] ตารางบันทึกผลการทดลอง: ได้ ${tableScore} / 3 คะแนน (บันทึกข้อมูลถูกต้อง ${rowCorrect}/6 แถว)`);

  // 2. Q-point & Beta (2 pts)
  let qScore = 0;
  if (parseFloat(data.ansVceQ) > 0) qScore += 0.5;
  if (parseFloat(data.ansIcQ) > 0) qScore += 0.5;
  if (parseFloat(data.ansBetaCalc) > 50) qScore += 1.0;
  score += qScore;
  feedback.push(`[ตอนที่ 2] พิกัดจุดทำงาน Q-point และอัตราขยาย Beta (ทรานซิสเตอร์ ${model.name}): ได้ ${qScore} / 2 คะแนน`);

  // 3. Pinout (1 pt)
  let pinScore = 0;
  const expPins = model.pins;
  if (data.ansPin1 === expPins.p1) pinScore += 0.33;
  if (data.ansPin2 === expPins.p2) pinScore += 0.33;
  if (data.ansPin3 === expPins.p3) pinScore += 0.34;
  let part3Score = pinScore >= 0.9 ? 1 : (pinScore >= 0.3 ? 0.5 : 0);
  score += part3Score;
  feedback.push(`[ตอนที่ 3] ระบุขั้วขา ${model.name} (${model.package}): ได้ ${part3Score} / 1 คะแนน`);

      // --- PART 3/4: POST-LAB CONCEPTUAL QUESTIONS (4 Points Total) ---
      const ansQ1 = (data.q1Answer || data.q1 || '').trim().toUpperCase();
      const ansQ2 = (data.q2Answer || data.q2 || '').trim().toUpperCase();
      const ansQ3 = (data.q3Answer || data.q3 || '').trim().toUpperCase();
      const ansQ4 = (data.q4Answer || data.q4 || '').trim().toUpperCase();

      let mcScore = 0;
      const q1Ok = (ansQ1 === 'A');
      const q2Ok = (ansQ2 === 'B');
      const q3Ok = (ansQ3 === 'A');
      const q4Ok = (ansQ4 === 'B');

      if (q1Ok) mcScore++;
      if (q2Ok) mcScore++;
      if (q3Ok) mcScore++;
      if (q4Ok) mcScore++;

      score += mcScore;
      feedback.push(`\n[คำถามวัดความเข้าใจท้ายการทดลอง]: ตอบถูก ${mcScore} จาก 4 ข้อ (ได้ ${mcScore} / 4 คะแนน)`);
      feedback.push(`  ข้อ 1: ${q1Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ1 ? '✗ ไม่ถูกต้อง (เฉลย A)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 2: ${q2Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ2 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 3: ${q3Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ3 ? '✗ ไม่ถูกต้อง (เฉลย A)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 4: ${q4Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ4 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);



  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 9) comment = "ผ่านเกณฑ์ดีเยี่ยม (Excellent)";
  else if (score >= 7) comment = "ผ่านเกณฑ์ดี (Good)";
  else if (score >= 5) comment = "ผ่านเกณฑ์พอใช้ (Fair)";

  return {
    status: 'success',
    score: score,
    maxScore: maxScore,
    comment: comment,
    feedback: feedback.join('\n')
  };
}

/**
 * Appends the graded worksheet details into the Google Sheets database
 */
function recordToSheet(data, grading) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Submissions");
  
  if (!sheet) {
    sheet = ss.insertSheet("Submissions");
    var headers = [
      "Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date", "Lab Mode",
      "Transistor Model", "Condition", "Auto Score", "Evaluation", 
      "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#38bdf8")
         .setFontColor("#0f172a")
         .setBorder(true, true, true, true, true, true);
  }
  
  var studentEmail = Session.getActiveUser().getEmail() || "Anonymous / No Permission";
  
  
  var chosenModel = data.hwComponentModel || data.componentModel || data.bjtModel || data.zenerModel || '2N3904';
  var labModeText = (data.labDataSource === 'hardware')
    ? '🔌 ฮาร์ดแวร์จริง (' + chosenModel + ')'
    : '🔬 ซิมูเลเตอร์ (' + chosenModel + ')';

  var rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    labModeText,
    data.bjtModel || "BC108",
    data.diodeCondition,
    grading.score + " / " + grading.maxScore,
    grading.comment,
    grading.feedback,
    data.q1Answer,
    data.q2Answer,
    data.q3Answer,
    data.labConclusion
  ];
  sheet.appendRow(rowData);
  sheet.autoResizeColumns(1, rowData.length);
}


/**
 * Checks if this student ID has already submitted a report
 */
function checkDuplicateSubmission(sheetName, studentIdColIndex, studentId) {
  if (!studentId) return null;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return null;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return null;
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const idValues = sheet.getRange(2, studentIdColIndex, lastRow - 1, 1).getValues();
      const timestampValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      const targetId = studentId.toString().trim();
      for (let i = 0; i < idValues.length; i++) {
        if (idValues[i][0] && idValues[i][0].toString().trim() === targetId) {
          const prevTime = timestampValues[i][0]
            ? Utilities.formatDate(new Date(timestampValues[i][0]), "Asia/Bangkok", "dd/MM/yyyy HH:mm")
            : "ก่อนหน้านี้";
          return {
            status: "duplicate",
            score: 0,
            maxScore: 10,
            feedback: "เคยส่งใบงานนี้แล้ว",
            message: "⚠️ รหัสนักศึกษา " + targetId + " ได้ส่งใบงานนี้ไปแล้วเมื่อ " + prevTime + "\nระบบอนุญาตให้ส่งได้เพียง 1 ครั้งเท่านั้น (หากต้องการส่งใหม่ กรุณาติดต่ออาจารย์ผู้สอน)"
          };
        }
      }
    }
  } catch (e) {}
  return null;
}
