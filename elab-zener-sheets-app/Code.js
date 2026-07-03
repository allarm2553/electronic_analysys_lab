/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs for Zener Lab.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: Zener Diode Characteristics')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Processes the student's lab report submission
 * Solves the expected results, auto-grades the worksheet, and appends to Google Sheets
 */
function submitWorksheet(data) {
  try {
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
 * Zener Diode Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  const cond = data.diodeCondition; // 'good', 'open', 'short'
  
  let score = 0;
  let maxScore = 10;
  let feedback = [];
  
  // --- PART 1: DIODE TESTING (Analog Multimeter, R x 10) ---
  // 1.1 Forward resistance (r-forward)
  const rFwdStr = (data.rForward || '').toString().trim();
  const rFwd = parseFloat(rFwdStr);
  let rFwdCorrect = false;
  if (cond === 'good') {
    // Expected forward: 100 - 200 ohms (simulator: 148 ohms)
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
    feedback.push("1.1 ความต้านทานไบอัสตรง: ไม่สอดคล้องกับสภาพซีเนอร์ไดโอด (" + (rFwdStr || 'ว่าง') + " Ω)");
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
    feedback.push("1.2 ความต้านทานไบอัสกลับ: ไม่สอดคล้องกับสภาพซีเนอร์ไดโอด (" + (rRevStr || 'ว่าง') + " Ω)");
  }
  
  // 1.3 Zener status selection
  const ansStatus = data.diodeStatus;
  if (ansStatus === cond) {
    score += 1;
    feedback.push("1.3 ระบุสรุปสภาพซีเนอร์ไดโอด: ถูกต้อง (" + (cond === 'good' ? 'ดี' : cond === 'open' ? 'ขาด' : 'ลัดวงจร') + ")");
  } else {
    feedback.push("1.3 ระบุสรุปสภาพซีเนอร์ไดโอด: ไม่ถูกต้อง (ระบุ: " + (ansStatus || 'ไม่ได้ระบุ') + " คาดหวัง: " + cond + ")");
  }
  
  // --- PART 2: ACTIVE CIRCUIT TESTING (12 Rows) ---
  const vinList = [0.0, 2.0, 4.0, 5.0, 5.8, 6.0, 6.2, 6.4, 6.6, 7.0, 8.0, 10.0];
  const submittedRows = data.part2Rows || [];
  let correctRowsCount = 0;
  
  for (let idx = 0; idx < 12; idx++) {
    const vin = vinList[idx];
    const sRow = submittedRows[idx] || { vr1: '', vd1: '', iCalc: '', iMeas: '' };
    
    const vr1 = parseFloat(sRow.vr1) || 0;
    const vd1 = parseFloat(sRow.vd1) || 0;
    const iCalc = parseFloat(sRow.iCalc) || 0;
    const iMeas = parseFloat(sRow.iMeas) || 0;
    
    // Compute expected values piecewise
    let expVR1 = 0;
    let expVD1 = vin;
    let expIz = 0;
    
    if (cond === 'open') {
      expVR1 = 0.0;
      expVD1 = vin;
      expIz = 0.0;
    } else if (cond === 'short') {
      expVR1 = vin;
      expVD1 = 0.0;
      expIz = vin; // since R = 1k, I = VR1/1k in mA
    } else {
      // cond === 'good'
      if (vin <= 6.2) {
        expVR1 = 0.0;
        expVD1 = vin;
        expIz = 0.0;
      } else {
        expVD1 = 6.22; // Zener Vz ~ 6.2V
        expVR1 = vin - expVD1;
        expIz = expVR1; // mA
      }
    }
    
    // Check tolerances (Simulation checking)
    const tolV = 0.25; // ±0.25V
    const tolI = 0.35; // ±0.35mA
    
    const simVr1Ok = Math.abs(vr1 - expVR1) <= tolV;
    const simVd1Ok = Math.abs(vd1 - expVD1) <= (cond === 'good' && vin > 5.8 && vin < 6.6 ? 0.45 : tolV);
    const simICalcOk = Math.abs(iCalc - vr1) <= 0.15; // Icalc must match VR1/1k
    const simIMeasOk = Math.abs(iMeas - expIz) <= tolI;
    
    const simRowOk = simVr1Ok && simVd1Ok && simICalcOk && simIMeasOk;
    
    // Physical circuit constraints checking (permits physical lab experimental values)
    let physicalRowOk = false;
    if (cond === 'good') {
      const kvlDiff = Math.abs((vr1 + vd1) - vin);
      const kvlOk = kvlDiff <= 0.8; // 0.8V tolerance for meter rounding
      
      const impliedRc = iCalc > 0 ? (vr1 / (iCalc * 1e-3)) : 0;
      const rcOk = impliedRc >= 600 && impliedRc <= 1300; // nominal 1k resistor
      
      const iCalcMeasDiff = Math.abs(iCalc - iMeas);
      const currentOk = iCalcMeasDiff <= 0.4;
      
      let zenerBehaviorOk = false;
      if (vin <= 5.0) {
        // Zener not in breakdown yet: Vr1 should be very small
        zenerBehaviorOk = vr1 <= 0.8 && vd1 >= vin - 0.8;
      } else if (vin >= 8.0) {
        // Zener in breakdown: Vd1 should stabilize in breakdown region (accept 4.8V to 7.5V)
        zenerBehaviorOk = vd1 >= 4.8 && vd1 <= 7.5 && vr1 >= (vin - vd1 - 0.8);
      } else {
        // Transition region: just accept it if KVL and current checks pass
        zenerBehaviorOk = true;
      }
      
      physicalRowOk = kvlOk && rcOk && currentOk && zenerBehaviorOk;
    } else if (cond === 'open') {
      physicalRowOk = Math.abs(vd1 - vin) <= 0.8 && vr1 === 0 && iCalc === 0 && iMeas === 0;
    } else if (cond === 'short') {
      physicalRowOk = Math.abs(vr1 - vin) <= 0.8 && vd1 <= 0.6 && Math.abs(iMeas - vin) <= 0.5;
    }
    
    if (simRowOk || physicalRowOk) {
      correctRowsCount++;
    }
  }
  
  // Award points based on correct rows
  let p2Score = 0;
  if (correctRowsCount >= 11) {
    p2Score = 7;
  } else if (correctRowsCount >= 8) {
    p2Score = 5;
  } else if (correctRowsCount >= 5) {
    p2Score = 3;
  } else if (correctRowsCount >= 2) {
    p2Score = 1;
  }
  
  score += p2Score;
  feedback.push("ตอนที่ 2 ตารางการรักษาระดับแรงดัน: ถูกต้อง " + correctRowsCount + " จาก 12 ระดับแรงดัน (ได้ " + p2Score + " / 7 คะแนน)");
  
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
      "Zener Condition", "Auto Score", "Evaluation", 
      "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#fed7aa") // orange accent for zener
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
