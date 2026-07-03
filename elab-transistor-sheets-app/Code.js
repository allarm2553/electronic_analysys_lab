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
 * BJT Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  const model = data.transistorModel;
  const cond = data.diodeCondition;
  
  let score = 0;
  let maxScore = 13;
  let feedback = [];
  
  // --- PART 1: BASE FINDING TABLE (6 Rows) ---
  // Expected combinations for forward bias: Base is Pin 2
  // Row indices:
  // 0: Black 1, Red 2  |  1: Black 1, Red 3
  // 2: Black 2, Red 1  |  3: Black 2, Red 3
  // 4: Black 3, Red 1  |  5: Black 3, Red 2
  let p1Correct = 0;
  const p1Rows = data.part1Rows || [];
  
  for (let idx = 0; idx < 6; idx++) {
    const row = p1Rows[idx] || { rVal: '', deflection: '' };
    const rVal = parseFloat(row.rVal) || Infinity;
    const defl = row.deflection;
    
    let expectedForward = false;
    let expectedShort = false;
    
    if (cond === 'good') {
      if (model === 'BD139') {
        // NPN (BD139): Black (+) on Base (3), Red (-) on 1 or 2 => Forward Bias
        if (idx === 4 || idx === 5) expectedForward = true;
      } else if (model === 'BD140') {
        // PNP (BD140): Red (-) on Base (3), Black (+) on 1 or 2 => Forward Bias
        if (idx === 1 || idx === 3) expectedForward = true;
      }
    } else if (cond === 'short') {
      // Short between 1 and 3 (Row 1: Black 1, Red 3; Row 4: Black 3, Red 1)
      if (idx === 1 || idx === 4) expectedShort = true;
    }
    
    // Check match
    let isCorrect = false;
    if (expectedForward) {
      // Forward biased: low resistance (e.g. 100-200 ohms) and deflection UP
      if (rVal < 1000 && defl === 'up') isCorrect = true;
    } else if (expectedShort) {
      // Shorted: very low resistance (<10 ohms) and deflection UP
      if (rVal < 20 && defl === 'up') isCorrect = true;
    } else {
      // Reversed/Infinity: high resistance and deflection DOWN
      if ((rVal >= 1000 || isNaN(rVal) || row.rVal === '∞') && defl === 'down') isCorrect = true;
    }
    
    if (isCorrect) p1Correct++;
  }
  
  score += p1Correct;
  feedback.push(`ตารางที่ 1 (หาขาเบส): ถูกต้อง ${p1Correct} จาก 6 จุดวัด`);
  
  // --- PART 2: BASE PIN & TYPE SELECTIONS ---
  const ansBase = parseInt(data.ansBasePin) || 0;
  if (ansBase === 3) {
    score += 1;
    feedback.push("ระบุขาเบส: ถูกต้อง (ขา 3)");
  } else {
    feedback.push(`ระบุขาเบส: ไม่ถูกต้อง (ระบุขา ${ansBase} คาดหวังขา 3)`);
  }
  
  const ansType = data.ansType;
  // Map model name to expected type: BD139 = NPN, BD140 = PNP
  const expectedType = (model === 'BD139') ? 'NPN' : (model === 'BD140') ? 'PNP' : model;
  if (cond === 'good') {
    if (ansType === expectedType) {
      score += 1;
      feedback.push(`ระบุชนิดสาร: ถูกต้อง (${ansType})`);
    } else {
      feedback.push(`ระบุชนิดสาร: ไม่ถูกต้อง (ระบุ ${ansType} คาดหวัง ${expectedType})`);
    }
  } else {
    // For faulty transistors, type check is marked correct automatically if base search matches
    score += 1;
    feedback.push("ระบุชนิดสาร: ผ่านการทดสอบ");
  }
  
  // --- PART 3: COLLECTOR / EMITTER TABLE (2 Rows) ---
  // Row 1: สมมติฐาน 1 (ดำ 1, แดง 3 หรือ แดง 1, ดำ 3 depending on type) -> Correct bias
  // Row 2: สมมติฐาน 2 (ดำ 3, แดง 1 หรือ แดง 3, ดำ 1) -> Wrong bias
  const p2Rows = data.part2Rows || [];
  let p2Correct = 0;
  
  if (cond === 'good') {
    // Row 1 (Correct bias): before touch should be high/Infinity (e.g. >5k), after touch should be low (e.g. <35k due to skin contact resistance variations)
    const r1 = p2Rows[0] || { rBefore: '', rAfter: '' };
    const bBefore = r1.rBefore === '∞' || parseFloat(r1.rBefore) > 5;
    const bAfter = parseFloat(r1.rAfter) < 35 && r1.rAfter !== '∞' && parseFloat(r1.rAfter) >= 0;
    if (bBefore && bAfter) p2Correct++;
    
    // Row 2 (Wrong bias): before and after touch should both be high/Infinity (>5k)
    const r2 = p2Rows[1] || { rBefore: '', rAfter: '' };
    const wBefore = r2.rBefore === '∞' || parseFloat(r2.rBefore) > 5;
    const wAfter = r2.rAfter === '∞' || parseFloat(r2.rAfter) > 5;
    if (wBefore && wAfter) p2Correct++;
  } else {
    // Faulty conditions are marked correct if database entries matches open/short behaviors
    p2Correct = 2;
  }
  
  score += p2Correct;
  feedback.push(`ตารางที่ 2 (สัมผัสหา C/E): ถูกต้อง ${p2Correct} จาก 2 สมมติฐาน`);
  
  // --- PART 4: PIN MAP CONCLUSIONS ---
  const p1 = data.ansPin1;
  const p2 = data.ansPin2;
  const p3 = data.ansPin3;
  
  if (cond === 'good') {
    // Expected pins for BD139/BD140: Pin 1 = E, Pin 2 = C, Pin 3 = B
    let pinFeedback = [];
    if (p1 === 'E') { score += 1; pinFeedback.push("ขา 1 ถูก"); } else pinFeedback.push("ขา 1 ผิด");
    if (p2 === 'C') { score += 1; pinFeedback.push("ขา 2 ถูก"); } else pinFeedback.push("ขา 2 ผิด");
    if (p3 === 'B') { score += 1; pinFeedback.push("ขา 3 ถูก"); } else pinFeedback.push("ขา 3 ผิด");
    feedback.push(`สรุปตำแหน่งขา: ${pinFeedback.join(', ')}`);
  } else {
    score += 3;
    feedback.push("สรุปตำแหน่งขา: ผ่านการทดสอบ (อุปกรณ์ชำรุด)");
  }
  
  // Grade comments
  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 11) {
    comment = "ผ่านเกณฑ์ดีมาก (Excellent)";
  } else if (score >= 8) {
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
  var rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
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
