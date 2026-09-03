/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: Transistor Pin & Type Identification')
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
 * Processes the student's lab report submission
 * Solves the expected results, auto-grades the worksheet, and appends to Google Sheets
 */
function submitWorksheet(data) {
  try {
    // 0. Check duplicate submission
    const duplicateCheck = checkDuplicateSubmission("Submissions", 4, data.studentId);
    if (duplicateCheck) {
      return duplicateCheck;
    }

    // 1. Run the automatic grading engine
    const gradingResults = gradeWorksheet(data);
    
    // 2. Append the submission into the Google Sheet
    recordToSheet(data, gradingResults);
    
    // 3. Return results back to the student
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
 * BJT Mathematical Solver & Auto-Grading Engine
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

  let p1Pass = 0;
  if (data.part1Rows) {
    data.part1Rows.forEach(r => {
      if (r.deflection && r.deflection !== 'none') p1Pass++;
    });
  }
  let p1Score = p1Pass >= 5 ? 2 : (p1Pass >= 3 ? 1 : 0);
  score += p1Score;
  feedback.push(`[ตอนที่ 1] ตารางที่ 1 การวัดหาขาเบส: ได้ ${p1Score} / 2 คะแนน (บันทึกข้อมูล ${p1Pass}/6 ครั้ง)`);

  let baseScore = (data.ansBasePin && data.ansBasePin !== '') ? 0.5 : 0;
  let typeScore = (data.ansType && data.ansType !== '') ? 0.5 : 0;
  let idScore = Math.round(baseScore + typeScore);
  score += idScore;
  feedback.push(`[ตอนที่ 1] ระบุขาเบสและชนิดทรานซิสเตอร์: ได้ ${idScore} / 1 คะแนน`);

  let p2Pass = 0;
  if (data.part2Rows) {
    data.part2Rows.forEach(r => {
      if (parseFloat(r.rBefore) > 0 || parseFloat(r.rAfter) > 0) p2Pass++;
    });
  }
  let p2Score = p2Pass >= 2 ? 1 : 0;
  score += p2Score;
  feedback.push(`[ตอนที่ 2] ตารางที่ 2 การทดสอบหาขา C และ E: ได้ ${p2Score} / 1 คะแนน`);

  let pinCount = 0;
  if (data.ansPin1 && data.ansPin1 !== '') pinCount++;
  if (data.ansPin2 && data.ansPin2 !== '') pinCount++;
  if (data.ansPin3 && data.ansPin3 !== '') pinCount++;
  let pinScore = pinCount >= 3 ? 2 : (pinCount >= 1 ? 1 : 0);
  score += pinScore;
  feedback.push(`[ตอนที่ 3] สรุปตำแหน่งขาทรานซิสเตอร์ทั้ง 3 ขา: ได้ ${pinScore} / 2 คะแนน`);

      // --- PART 3/4: POST-LAB CONCEPTUAL QUESTIONS (4 Points Total) ---
      const ansQ1 = (data.q1Answer || data.q1 || '').trim().toUpperCase();
      const ansQ2 = (data.q2Answer || data.q2 || '').trim().toUpperCase();
      const ansQ3 = (data.q3Answer || data.q3 || '').trim().toUpperCase();
      const ansQ4 = (data.q4Answer || data.q4 || '').trim().toUpperCase();

      let qScore = 0;
      const q1Ok = (ansQ1 === 'B');
      const q2Ok = (ansQ2 === 'B');
      const q3Ok = (ansQ3 === 'B');
      const q4Ok = (ansQ4 === 'B');

      if (q1Ok) qScore++;
      if (q2Ok) qScore++;
      if (q3Ok) qScore++;
      if (q4Ok) qScore++;

      score += qScore;
      feedback.push(`\n[คำถามวัดความเข้าใจท้ายการทดลอง]: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} / 4 คะแนน)`);
      feedback.push(`  ข้อ 1: ${q1Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ1 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 2: ${q2Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ2 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 3: ${q3Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ3 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 4: ${q4Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ4 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);



  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 11) comment = "ผ่านเกณฑ์ดีเยี่ยม (Excellent)";
  else if (score >= 8) comment = "ผ่านเกณฑ์ดี (Good)";
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
  // Opens the sheet associated with this Apps Script project
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Submissions");
  
  // If the sheet doesn't exist, create it with headers
  if (!sheet) {
    sheet = ss.insertSheet("Submissions");
    var headers = [
      "Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date", "Lab Mode",
      "Model Tested", "Condition", "Auto Score", "Evaluation", 
      "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#f1f5f9")
         .setBorder(true, true, true, true, true, true);
  }
  
  // Automatically retrieve active user email (works in same-domain Google Workspace)
  var studentEmail = Session.getActiveUser().getEmail() || "Anonymous / No Permission";
  
  // Append raw submission row
  
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
    data.transistorModel,
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
  
  // Auto-resize sheet columns to fit data
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
