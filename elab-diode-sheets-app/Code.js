/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs for Diode Lab.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: Diode Characteristics')
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

/**
 * Diode Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  const isHardware = (data.labDataSource === 'hardware');
  const cond = data.diodeCondition || 'good';
  const dir = data.diodeDirection || 'forward';
  const diodeModel = (data.hwDiodeModel || data.diodeModel || '1N4001').toUpperCase();
  const isSchottky = (diodeModel.indexOf('5819') !== -1 || diodeModel.indexOf('SCHOTTKY') !== -1);

  let score = 0;
  const maxScore = 10;
  const feedback = [];

  feedback.push(isHardware 
    ? `📌 โหมดการตรวจ: 🔌 อุปกรณ์จริง (Hardware Lab - เบอร์ ${data.hwDiodeModel || '1N4001'})` 
    : `📌 โหมดการตรวจ: 🔬 ห้องทดลองจำลองเสมือน (${data.diodeModel || '1N4001'})`);

  // --- PART 1: DIODE TESTING (3 Points) ---
  const rFwdStr = (data.rForward || '').toString().trim();
  const rFwd = parseFloat(rFwdStr);
  let rFwdCorrect = false;
  if (cond === 'good') {
    if (isHardware) {
      if (isSchottky) {
        if ((rFwd >= 10 && rFwd <= 300) || (rFwd >= 0.20 && rFwd <= 0.55)) rFwdCorrect = true;
      } else {
        if ((rFwd >= 20 && rFwd <= 500) || (rFwd >= 0.40 && rFwd <= 0.85)) rFwdCorrect = true;
      }
    } else {
      if (isSchottky) {
        if (rFwd >= 50 && rFwd <= 110) rFwdCorrect = true;
      } else {
        if (rFwd >= 100 && rFwd <= 200) rFwdCorrect = true;
      }
    }
  } else if (cond === 'open') {
    if (rFwdStr === '' || rFwdStr === '∞' || isNaN(rFwd) || rFwd > 50000) rFwdCorrect = true;
  } else if (cond === 'short') {
    if (rFwd >= 0 && rFwd <= (isHardware ? 10 : 5)) rFwdCorrect = true;
  }

  const rRevStr = (data.rReverse || '').toString().trim();
  const rRev = parseFloat(rRevStr);
  let rRevCorrect = false;
  if (cond === 'good' || cond === 'open') {
    if (rRevStr === '' || rRevStr === '∞' || isNaN(rRev) || rRev > 50000) rRevCorrect = true;
  } else if (cond === 'short') {
    if (rRev >= 0 && rRev <= (isHardware ? 10 : 5)) rRevCorrect = true;
  }

  const statusCorrect = (data.diodeStatus === cond);

  let p1CorrectCount = 0;
  if (rFwdCorrect) p1CorrectCount++;
  if (rRevCorrect) p1CorrectCount++;
  if (statusCorrect) p1CorrectCount++;
  let p1Score = p1CorrectCount >= 3 ? 2 : (p1CorrectCount >= 1 ? 1 : 0);
  score += p1Score;
  feedback.push(`[ตอนที่ 1] ทดสอบไดโอดด้วยโอห์มมิเตอร์: ได้ ${p1Score} / 2 คะแนน (ไบอัสตรง: ${rFwdCorrect ? 'ถูกต้อง' : 'นอกเกณฑ์'}, ไบอัสกลับ: ${rRevCorrect ? 'ถูกต้อง' : 'นอกเกณฑ์'}, สรุปสภาพ: ${statusCorrect ? 'ถูกต้อง' : 'ไม่ถูกต้อง'})`);

  // --- PART 2: CIRCUIT TESTING (4 Points) ---
  let expectedLed = (dir === 'forward' && cond === 'good') ? 'on' : 'off';
  const ledCorrect = (data.ledState === expectedLed);

  const vD = parseFloat(data.vD) || 0;
  let expectedVD = 0;
  if (cond === 'good') {
    if (isSchottky) {
      expectedVD = (dir === 'forward') ? 0.36 : 5.0;
    } else {
      expectedVD = (dir === 'forward') ? (diodeModel.indexOf('4007') !== -1 ? 0.68 : (diodeModel.indexOf('4148') !== -1 ? 0.63 : 0.65)) : 5.0;
    }
  }
  else if (cond === 'open') expectedVD = 5.0;
  else if (cond === 'short') expectedVD = 0.0;
  const tolVD = isHardware ? 0.50 : 0.35;
  const vdCorrect = Math.abs(vD - expectedVD) <= tolVD;

  const vR = parseFloat(data.vR) || 0;
  let expectedVR = 0;
  if (cond === 'good') expectedVR = (dir === 'forward') ? (isSchottky ? 2.75 : 2.40) : 0.0;
  else if (cond === 'open') expectedVR = 0.0;
  else if (cond === 'short') expectedVR = (dir === 'forward') ? 3.05 : 0.0;
  const tolVR = isHardware ? 1.05 : 0.70;
  const vrCorrect = Math.abs(vR - expectedVR) <= tolVR;

  const vLed = parseFloat(data.vLed) || 0;
  let expectedVLED = (dir === 'forward' && (cond === 'good' || cond === 'short')) ? 1.95 : 0.0;
  const tolVLED = isHardware ? 0.65 : 0.50;
  const vledCorrect = Math.abs(vLed - expectedVLED) <= tolVLED;

  const vSum = parseFloat(data.vSum) || 0;
  const tolVSum = isHardware ? 0.75 : 0.50;
  const tolKVL = isHardware ? 0.40 : 0.25;
  const kvlCorrect = Math.abs(vSum - 5.0) <= tolVSum && Math.abs(vSum - (vD + vR + vLed)) <= tolKVL;

  const iCalc = parseFloat(data.iCalc) || 0;
  const rVal = (isHardware && data.hwR1Measured) ? parseFloat(data.hwR1Measured) : 1000;
  const expectedICalc = (vR / rVal) * 1000; // mA
  const tolICalc = isHardware ? 0.35 : 0.20;
  const icalcCorrect = Math.abs(iCalc - expectedICalc) <= tolICalc;

  const iMeas = parseFloat(data.iMeas) || 0;
  const tolIMeas = isHardware ? 0.85 : 0.50;
  const imeasCorrect = Math.abs(iMeas - expectedICalc) <= tolIMeas;

  let p2ItemCorrect = 0;
  if (ledCorrect) p2ItemCorrect++;
  if (vdCorrect) p2ItemCorrect++;
  if (vrCorrect) p2ItemCorrect++;
  if (vledCorrect) p2ItemCorrect++;
  if (kvlCorrect) p2ItemCorrect++;
  if (icalcCorrect) p2ItemCorrect++;
  if (imeasCorrect) p2ItemCorrect++;

  let p2Score = p2ItemCorrect >= 6 ? 4 : (p2ItemCorrect >= 4 ? 3 : (p2ItemCorrect >= 2 ? 2 : (p2ItemCorrect >= 1 ? 1 : 0)));
  score += p2Score;
  feedback.push(`[ตอนที่ 2] วงจรไบแอสและวัดค่าทางไฟฟ้า: ได้ ${p2Score} / 4 คะแนน (ผ่าน ${p2ItemCorrect} / 7 รายการ)`);

  // --- PART 3: QUESTIONS & CONCLUSION (3 Points) ---
  // --- PART 3/4: POST-LAB CONCEPTUAL QUESTIONS (4 Points Total) ---
      const ansQ1 = (data.q1Answer || data.q1 || '').trim().toUpperCase();
      const ansQ2 = (data.q2Answer || data.q2 || '').trim().toUpperCase();
      const ansQ3 = (data.q3Answer || data.q3 || '').trim().toUpperCase();
      const ansQ4 = (data.q4Answer || data.q4 || '').trim().toUpperCase();

      let qScore = 0;
      const q1Ok = (ansQ1 === 'B');
      const q2Ok = (ansQ2 === 'A');
      const q3Ok = (ansQ3 === 'B');
      const q4Ok = (ansQ4 === 'A');

      if (q1Ok) qScore++;
      if (q2Ok) qScore++;
      if (q3Ok) qScore++;
      if (q4Ok) qScore++;

      score += qScore;
      feedback.push(`
[คำถามวัดความเข้าใจท้ายการทดลอง]: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} / 4 คะแนน)`);
      feedback.push(`  ข้อ 1: ${q1Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ1 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 2: ${q2Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ2 ? '✗ ไม่ถูกต้อง (เฉลย A)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
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
  // Opens the sheet associated with this Apps Script project
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Submissions");
  
  // If the sheet doesn't exist, create it with headers
  if (!sheet) {
    sheet = ss.insertSheet("Submissions");
    var headers = [
      "Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date",
      "Lab Mode", "Diode Condition", "Diode Direction", "Auto Score", "Evaluation", 
      "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#0284c7")
         .setFontColor("#ffffff")
         .setBorder(true, true, true, true, true, true);
  } else {
    // Auto-migrate schema if "Lab Mode" header is missing
    try {
      var headerVals = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
      if (headerVals.indexOf("Lab Mode") === -1 && headerVals.length >= 7) {
        sheet.insertColumnBefore(7);
        sheet.getRange(1, 7).setValue("Lab Mode").setFontWeight("bold").setBackground("#0284c7").setFontColor("#ffffff");
      }
    } catch (e) {}
  }
  
  // Automatically retrieve active user email (works in same-domain Google Workspace)
  var studentEmail = Session.getActiveUser().getEmail() || "Anonymous / No Permission";
  
  var chosenModel = data.hwDiodeModel || data.diodeModel || '1N4001';
  var labModeText = (data.labDataSource === 'hardware')
    ? '🔌 ฮาร์ดแวร์จริง (' + chosenModel + ')'
    : '🔬 ซิมูเลเตอร์ (' + chosenModel + ')';

  // Append raw submission row
  var rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    labModeText,
    data.diodeCondition,
    data.diodeDirection,
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
