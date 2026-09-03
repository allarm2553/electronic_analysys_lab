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
  const cond = data.diodeCondition || 'good'; // 'good', 'open', 'short'
  const dir = data.diodeDirection || 'forward';   // 'forward', 'reverse'
  const isHardware = (data.labDataSource === 'hardware');
  
  let score = 0;
  let maxScore = 10;
  let feedback = [];
  
  if (isHardware) {
    feedback.push("📌 โหมดการทดลอง: 🔌 อุปกรณ์จริง (Hardware Lab) - ปรับเกณฑ์ความคลาดเคลื่อนตามมาตรฐานอุปกรณ์จริง");
    if (data.hwDiodeModel) {
      feedback.push("   (เบอร์ไดโอดจริง: " + data.hwDiodeModel + ", R1 วัดได้: " + (data.hwR1Measured || 1000) + " Ω)");
    }
  } else {
    feedback.push("📌 โหมดการทดลอง: 🔬 ห้องทดลองจำลองเสมือน (Virtual Simulation)");
  }
  
  const diodeModel = (data.hwDiodeModel || data.diodeModel || '1N4001').toUpperCase();
  const isSchottky = (diodeModel.indexOf('5819') !== -1 || diodeModel.indexOf('SCHOTTKY') !== -1);

  // --- PART 1: DIODE TESTING (Analog Multimeter) ---
  // 1.1 Forward resistance (r-forward)
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
    // Expected: Infinity / empty / text '∞' / very high
    if (rFwdStr === '' || rFwdStr === '∞' || isNaN(rFwd) || rFwd > 50000) rFwdCorrect = true;
  } else if (cond === 'short') {
    // Expected: very low, < 10 ohms in hardware, < 5 ohms in simulator
    if (rFwd >= 0 && rFwd <= (isHardware ? 10 : 5)) rFwdCorrect = true;
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
    if (rRevStr === '' || rRevStr === '∞' || isNaN(rRev) || rRev > 50000) rRevCorrect = true;
  } else if (cond === 'short') {
    // Expected: very low, < 10 ohms in hardware, < 5 ohms in simulator
    if (rRev >= 0 && rRev <= (isHardware ? 10 : 5)) rRevCorrect = true;
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
    if (isSchottky) {
      expectedVD = (dir === 'forward') ? 0.36 : 5.0; // 1N5819 Schottky (~0.36V)
    } else {
      // Silicon diodes: 1N4007 (~0.68V), 1N4148 (~0.63V), 1N4001 (~0.65V)
      expectedVD = (dir === 'forward') ? ((diodeModel.indexOf('1N4007') !== -1 || diodeModel.indexOf('4007') !== -1) ? 0.68 : ((diodeModel.indexOf('1N4148') !== -1 || diodeModel.indexOf('4148') !== -1) ? 0.63 : 0.65)) : 5.0;
    }
  } else if (cond === 'open') {
    expectedVD = 5.0;
  } else if (cond === 'short') {
    expectedVD = 0.0;
  }
  const tolVD = isHardware ? 0.50 : 0.35;
  if (Math.abs(vD - expectedVD) <= tolVD) {
    score += 1;
    feedback.push("2.2 แรงดัน VD: ถูกต้องตามเกณฑ์ (" + vD.toFixed(2) + " V)");
  } else {
    feedback.push("2.2 แรงดัน VD: ค่าอยู่นอกเกณฑ์ความถูกต้อง (" + vD.toFixed(2) + " V)");
  }
  
  // 2.3 Voltage drop VR
  const vR = parseFloat(data.vR) || 0;
  let expectedVR = 0;
  if (cond === 'good') {
    expectedVR = (dir === 'forward') ? (isSchottky ? 2.75 : 2.40) : 0.0;
  } else if (cond === 'open') {
    expectedVR = 0.0;
  } else if (cond === 'short') {
    expectedVR = (dir === 'forward') ? 3.05 : 0.0;
  }
  const tolVR = isHardware ? 1.05 : 0.70;
  if (Math.abs(vR - expectedVR) <= tolVR) {
    score += 1;
    feedback.push("2.3 แรงดัน VR: ถูกต้องตามเกณฑ์ (" + vR.toFixed(2) + " V)");
  } else {
    feedback.push("2.3 แรงดัน VR: ค่าอยู่นอกเกณฑ์ความถูกต้อง (" + vR.toFixed(2) + " V)");
  }
  
  // 2.4 Voltage drop VLED
  const vLed = parseFloat(data.vLed) || 0;
  let expectedVLED = 0;
  if (cond === 'good') {
    expectedVLED = (dir === 'forward') ? 1.95 : 0.0;
  } else if (cond === 'open') {
    expectedVLED = 0.0;
  } else if (cond === 'short') {
    expectedVLED = (dir === 'forward') ? 1.95 : 0.0;
  }
  const tolVLED = isHardware ? 0.65 : 0.50;
  if (Math.abs(vLed - expectedVLED) <= tolVLED) {
    score += 1;
    feedback.push("2.4 แรงดัน VLED: ถูกต้องตามเกณฑ์ (" + vLed.toFixed(2) + " V)");
  } else {
    feedback.push("2.4 แรงดัน VLED: ค่าอยู่นอกเกณฑ์ความถูกต้อง (" + vLed.toFixed(2) + " V)");
  }
  
  // 2.5 Kirchhoff's Voltage Law (Vsum = VD + VR + VLED)
  const vSum = parseFloat(data.vSum) || 0;
  const expectedVSum = 5.0; // Input supply
  const tolVSum = isHardware ? 0.75 : 0.50;
  const tolKVL = isHardware ? 0.40 : 0.25;
  const isKvlValid = Math.abs(vSum - expectedVSum) <= tolVSum && Math.abs(vSum - (vD + vR + vLed)) <= tolKVL;
  if (isKvlValid) {
    score += 1;
    feedback.push("2.5 ผลรวมแรงดัน (KVL): ถูกต้องตามเกณฑ์ (" + vSum.toFixed(2) + " V)");
  } else {
    feedback.push("2.5 ผลรวมแรงดัน (KVL): ไม่สอดคล้องหรือคำนวณคลาดเคลื่อน (" + vSum.toFixed(2) + " V)");
  }
  
  // 2.6 Calculated Current Icalc = VR / R
  const iCalc = parseFloat(data.iCalc) || 0;
  const rVal = (isHardware && data.hwR1Measured) ? parseFloat(data.hwR1Measured) : 1000;
  const expectedICalc = (vR / rVal) * 1000; // in mA
  const tolICalc = isHardware ? 0.35 : 0.20;
  if (Math.abs(iCalc - expectedICalc) <= tolICalc) {
    score += 1;
    feedback.push("2.6 กระแสคำนวณ Icalc: ถูกต้องตามเกณฑ์ (" + iCalc.toFixed(2) + " mA)");
  } else {
    feedback.push("2.6 กระแสคำนวณ Icalc: คำนวณคลาดเคลื่อนจากเกณฑ์ (" + iCalc.toFixed(2) + " mA)");
  }
  
  // 2.7 Measured Current Imeas
  const iMeas = parseFloat(data.iMeas) || 0;
  let expectedIMeas = expectedICalc;
  const tolIMeas = isHardware ? 0.85 : 0.50;
  if (Math.abs(iMeas - expectedIMeas) <= tolIMeas) {
    score += 1;
    feedback.push("2.7 กระแสวัดจริง Imeas: ถูกต้องตามเกณฑ์ (" + iMeas.toFixed(2) + " mA)");
  } else {
    feedback.push("2.7 กระแสวัดจริง Imeas: ค่าอยู่นอกเกณฑ์ความถูกต้อง (" + iMeas.toFixed(2) + " mA)");
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
