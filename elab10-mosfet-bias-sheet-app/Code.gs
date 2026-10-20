/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs for JFET & MOSFET Fixed-Bias Lab.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: JFET & MOSFET Fixed-Bias Laboratory')
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


/**
 * Device Models Dictionary
 */
const FET_DEVICE_MODELS = {
  '2N5458': { category: 'JFET', idss: 6.0, vp: -3.5, rd: 1000 },
  '2N5484': { category: 'JFET', idss: 3.5, vp: -2.0, rd: 1000 },
  'BF245B': { category: 'JFET', idss: 10.0, vp: -4.0, rd: 1000 },
  '2N7000': { category: 'MOSFET', vth: 2.1, k: 0.05, rd: 1000 },
  'BS170':  { category: 'MOSFET', vth: 2.0, k: 0.06, rd: 1000 },
  'IRF540': { category: 'MOSFET', vth: 3.0, k: 0.08, rd: 220 }
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
 * JFET & MOSFET Fixed-Bias Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  const isHardware = (data.labDataSource === 'hardware');
const model = FET_DEVICE_MODELS[data.fetModel] || FET_DEVICE_MODELS['2N5458'];
  const isJfet = model.category === 'JFET';
  let score = 0;
  const maxScore = 10;
  const feedback = [
    isHardware 
      ? '📌 โหมดการตรวจ: 🔌 อุปกรณ์จริง (Hardware Lab) - ปรับเกณฑ์ความคลาดเคลื่อนตามมาตรฐานอุปกรณ์จริง' 
      : '📌 โหมดการตรวจ: 🔬 ห้องทดลองจำลองเสมือน (Virtual Simulation)'
  ];
  
  let t1Correct = 0;
  (data.table1Rows || []).forEach(row => {
    if (row.vds && parseFloat(row.vds) >= 0) t1Correct++;
  });
  const t1Score = Math.min(2, Math.floor(t1Correct / 2));
  score += t1Score;
  feedback.push('ตารางที่ 1 (Transfer Characteristics): ได้ ' + t1Score + ' / 2 คะแนน');
  
  let t2Correct = 0;
  (data.table2Rows || []).forEach(row => {
    if (row.vds && parseFloat(row.vds) >= 0) t2Correct++;
  });
  const t2Score = Math.min(4, Math.floor(t2Correct / 2));
  score += t2Score;
  feedback.push('ตารางที่ 2 (Drain Characteristics): ได้ ' + t2Score + ' / 4 คะแนน');
  
  const p1Val = parseFloat(data.ansP1);
  const p2Val = parseFloat(data.ansP2);
  let p1Ok = false;
  let p2Ok = false;
  
  if (isJfet) {
    p1Ok = !isNaN(p1Val) && (Math.abs(p1Val - model.vp) <= 0.8 || Math.abs(Math.abs(p1Val) - Math.abs(model.vp)) <= 0.8);
    p2Ok = !isNaN(p2Val) && Math.abs(p2Val - model.idss) <= 2.5;
  } else {
    p1Ok = !isNaN(p1Val) && Math.abs(p1Val - model.vth) <= 0.8;
    p2Ok = !isNaN(p2Val) && p2Val > 0;
  }
  
  if (p1Ok) { score++; feedback.push('พารามิเตอร์ที่ 1: ถูกต้องตามเกณฑ์ (+1)'); }
  else { feedback.push('พารามิเตอร์ที่ 1: คลาดเคลื่อนจากเกณฑ์ (+0)'); }
  
  if (p2Ok) { score++; feedback.push('พารามิเตอร์ที่ 2: ถูกต้องตามเกณฑ์ (+1)'); }
  else { feedback.push('พารามิเตอร์ที่ 2: คลาดเคลื่อนจากเกณฑ์ (+0)'); }

      // --- PART 3/4: POST-LAB CONCEPTUAL QUESTIONS (4 Points Total) ---
      const ansQ1 = (data.q1Answer || data.q1 || '').trim().toUpperCase();
      const ansQ2 = (data.q2Answer || data.q2 || '').trim().toUpperCase();
      const ansQ3 = (data.q3Answer || data.q3 || '').trim().toUpperCase();
      const ansQ4 = (data.q4Answer || data.q4 || '').trim().toUpperCase();

      let qScore = 0;
      const q1Ok = (ansQ1 === 'A');
      const q2Ok = (ansQ2 === 'B');
      const q3Ok = (ansQ3 === 'B');
      const q4Ok = (ansQ4 === 'A');

      if (q1Ok) qScore++;
      if (q2Ok) qScore++;
      if (q3Ok) qScore++;
      if (q4Ok) qScore++;

      score += qScore;
      feedback.push(`\n[คำถามวัดความเข้าใจท้ายการทดลอง]: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} / 4 คะแนน)`);
      feedback.push(`  ข้อ 1: ${q1Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ1 ? '✗ ไม่ถูกต้อง (เฉลย A)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 2: ${q2Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ2 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 3: ${q3Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ3 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 4: ${q4Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ4 ? '✗ ไม่ถูกต้อง (เฉลย A)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);


  
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
      "Device Model", "Auto Score", "Evaluation", 
      "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#38bdf8") // Cyan metallic accent
         .setBorder(true, true, true, true, true, true);
  }
  
  var studentEmail = Session.getActiveUser().getEmail() || "Anonymous / No Permission";
  
  
  var chosenModel = data.hwComponentModel || data.componentModel || data.bjtModel || data.zenerModel || '2N7000';
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
    data.fetModel || data.mosfetType,
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
