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
  const cond = data.diodeCondition; // 'good', 'open', 'short'
  const dir = data.diodeDirection;   // 'forward', 'reverse'
  
  let score = 0;
  let maxScore = 10;
  let feedback = [];
  
  // --- PART 1: DIODE TESTING (Analog Multimeter) ---
  // 1.1 Forward resistance (r-forward)
  const rFwdStr = (data.rForward || '').toString().trim();
  const rFwd = parseFloat(rFwdStr);
  let rFwdCorrect = false;
  if (cond === 'good') {
    // Expected forward: 100 - 200 ohms (simulator: 152 ohms)
    if (rFwd >= 100 && rFwd <= 200) rFwdCorrect = true;
  } else if (cond === 'open') {
    // Expected: Infinity / empty / text '∞' / very high
    if (rFwdStr === '' || rFwdStr === '∞' || isNaN(rFwd) || rFwd > 100000) rFwdCorrect = true;
  } else if (cond === 'short') {
    // Expected: very low, e.g. < 5 ohms (simulator: 0.8 ohms)
    if (rFwd >= 0 && rFwd <= 5) rFwdCorrect = true;
  }
  
  if (rFwdCorrect) {
    score += 1;
    feedback.push("1.1 ความต้านทานไบอัสตรง: ถูกต้อง");
  } else {
    feedback.push("1.1 ความต้านทานไบอัสตรง: ไม่สอดคล้องกับสภาพไดโอด (" + (rFwdStr || 'ว่าง') + " Ω)");
  }
  
  // 1.2 Reverse resistance (r-reverse)
  const rRevStr = (data.rReverse || '').toString().trim();
  const rRev = parseFloat(rRevStr);
  let rRevCorrect = false;
  if (cond === 'good' || cond === 'open') {
    // Expected: Infinity / empty / text '∞' / very high
    if (rRevStr === '' || rRevStr === '∞' || isNaN(rRev) || rRev > 100000) rRevCorrect = true;
  } else if (cond === 'short') {
    // Expected: very low, < 5 ohms (simulator: 0.8 ohms)
    if (rRev >= 0 && rRev <= 5) rRevCorrect = true;
  }
  
  if (rRevCorrect) {
    score += 1;
    feedback.push("1.2 ความต้านทานไบอัสกลับ: ถูกต้อง");
  } else {
    feedback.push("1.2 ความต้านทานไบอัสกลับ: ไม่สอดคล้องกับสภาพไดโอด (" + (rRevStr || 'ว่าง') + " Ω)");
  }
  
  // 1.3 Diode status selection
  const ansStatus = data.diodeStatus;
  if (ansStatus === cond) {
    score += 1;
    feedback.push("1.3 ระบุสรุปสภาพไดโอด: ถูกต้องตามเกณฑ์");
  } else {
    feedback.push("1.3 ระบุสรุปสภาพไดโอด: ไม่ถูกต้อง");
  }
  
  // --- PART 2: DIODE CIRCUIT TESTING ---
  // 2.1 LED State
  const ansLed = data.ledState; // 'on', 'off'
  let expectedLed = 'off';
  if (dir === 'forward' && cond === 'good') {
    expectedLed = 'on';
  }
  if (ansLed === expectedLed) {
    score += 1;
    feedback.push("2.1 สถานะการส่องสว่างของ LED: ถูกต้องตามเกณฑ์");
  } else {
    feedback.push("2.1 สถานะการส่องสว่างของ LED: ไม่ถูกต้อง");
  }
  
  // 2.2 Voltage drop VD
  const vD = parseFloat(data.vD) || 0;
  let expectedVD = 0;
  if (cond === 'good') {
    if (dir === 'forward') {
      expectedVD = 0.65; // ~ 0.65V
    } else {
      expectedVD = 5.0; // ~ 5V
    }
  } else if (cond === 'open') {
    expectedVD = 5.0;
  } else if (cond === 'short') {
    expectedVD = 0.0;
  }
  const tolVD = 0.35;
  if (Math.abs(vD - expectedVD) <= tolVD) {
    score += 1;
    feedback.push("2.2 แรงดัน VD: ถูกต้องตามเกณฑ์");
  } else {
    feedback.push("2.2 แรงดัน VD: ค่าอยู่นอกเกณฑ์ความถูกต้อง");
  }
  
  // 2.3 Voltage drop VR
  const vR = parseFloat(data.vR) || 0;
  let expectedVR = 0;
  if (cond === 'good') {
    if (dir === 'forward') {
      expectedVR = 5.0 - expectedVD - 1.95; // ~ 2.4V
    } else {
      expectedVR = 0.0;
    }
  } else if (cond === 'open') {
    expectedVR = 0.0;
  } else if (cond === 'short') {
    if (dir === 'forward') {
      expectedVR = 5.0 - 1.95; // ~ 3.0V
    } else {
      expectedVR = 0.0;
    }
  }
  const tolVR = 0.70;
  if (Math.abs(vR - expectedVR) <= tolVR) {
    score += 1;
    feedback.push("2.3 แรงดัน VR: ถูกต้องตามเกณฑ์");
  } else {
    feedback.push("2.3 แรงดัน VR: ค่าอยู่นอกเกณฑ์ความถูกต้อง");
  }
  
  // 2.4 Voltage drop VLED
  const vLed = parseFloat(data.vLed) || 0;
  let expectedVLED = 0;
  if (cond === 'good') {
    if (dir === 'forward') {
      expectedVLED = 1.95; // ~ 1.95V
    } else {
      expectedVLED = 0.0;
    }
  } else if (cond === 'open') {
    expectedVLED = 0.0;
  } else if (cond === 'short') {
    if (dir === 'forward') {
      expectedVLED = 1.95;
    } else {
      expectedVLED = 0.0;
    }
  }
  const tolVLED = 0.50;
  if (Math.abs(vLed - expectedVLED) <= tolVLED) {
    score += 1;
    feedback.push("2.4 แรงดัน VLED: ถูกต้องตามเกณฑ์");
  } else {
    feedback.push("2.4 แรงดัน VLED: ค่าอยู่นอกเกณฑ์ความถูกต้อง");
  }
  
  // 2.5 Kirchhoff's Voltage Law (Vsum = VD + VR + VLED)
  const vSum = parseFloat(data.vSum) || 0;
  const expectedVSum = 5.0; // Input supply
  const tolVSum = 0.50;
  const isKvlValid = Math.abs(vSum - expectedVSum) <= tolVSum && Math.abs(vSum - (vD + vR + vLed)) <= 0.25;
  if (isKvlValid) {
    score += 1;
    feedback.push("2.5 ผลรวมแรงดัน (KVL): ถูกต้องตามเกณฑ์");
  } else {
    feedback.push("2.5 ผลรวมแรงดัน (KVL): ไม่สอดคล้องหรือคำนวณคลาดเคลื่อน");
  }
  
  // 2.6 Calculated Current Icalc = VR / 1kOhm
  const iCalc = parseFloat(data.iCalc) || 0;
  const expectedICalc = vR; // in mA (R = 1k, I = VR/1)
  const tolICalc = 0.20;
  if (Math.abs(iCalc - expectedICalc) <= tolICalc) {
    score += 1;
    feedback.push("2.6 กระแสคำนวณ Icalc: ถูกต้องตามเกณฑ์");
  } else {
    feedback.push("2.6 กระแสคำนวณ Icalc: คำนวณคลาดเคลื่อนจากเกณฑ์");
  }
  
  // 2.7 Measured Current Imeas
  const iMeas = parseFloat(data.iMeas) || 0;
  let expectedIMeas = expectedICalc;
  const tolIMeas = 0.50;
  if (Math.abs(iMeas - expectedIMeas) <= tolIMeas) {
    score += 1;
    feedback.push("2.7 กระแสวัดจริง Imeas: ถูกต้องตามเกณฑ์");
  } else {
    feedback.push("2.7 กระแสวัดจริง Imeas: ค่าอยู่นอกเกณฑ์ความถูกต้อง");
  }
  
  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 9) {
    comment = "ผ่านเกณฑ์ดีมาก (Excellent)";
  } else if (score >= 7) {
    comment = "ผ่านเกณฑ์ดี (Good)";
  }
  
  return {
    score: score,
    maxScore: maxScore,
    feedback: feedback.join('\n'),
    comment: comment
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
      "Diode Condition", "Diode Direction", "Auto Score", "Evaluation", 
      "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#e2e8f0")
         .setBorder(true, true, true, true, true, true);
  }
  
  // Automatically retrieve active user email (works in same-domain Google Workspace)
  var studentEmail = Session.getActiveUser().getEmail() || "Anonymous / No Permission";
  
  // Append raw submission row
  var rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
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
