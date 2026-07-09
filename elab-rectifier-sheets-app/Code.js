/**
 * Google Apps Script Web App - Backend Controller (Code.js)
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: Half-Wave Rectifier Circuit')
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
 * Half-Wave Rectifier Auto-Grading Engine
 */
function gradeWorksheet(data) {
  let score = 0;
  let maxScore = 13; // 4 (Table 1) + 6 (Table 2) + 3 (Questions)
  let feedback = [];
  
  // --- PART 1: TABLE 1 (DMM Readings - 4 Rows) ---
  const t1 = data.t1Rows || [];
  
  // Row 0: V_in AC Vrms. Correct = 12.0V (allow 11.8 - 12.2)
  const v1 = parseFloat(t1[0]) || 0;
  if (v1 >= 11.8 && v1 <= 12.2) {
    score++;
    feedback.push("V_in AC: ถูกต้อง");
  } else {
    feedback.push(`V_in AC: ไม่ถูกต้อง (กรอก ${v1} คาดหวัง ~12.0 V)`);
  }
  
  // Row 1: V_load DC. Correct = 5.18V (allow 5.0 - 5.3)
  const v2 = parseFloat(t1[1]) || 0;
  if (v2 >= 5.0 && v2 <= 5.3) {
    score++;
    feedback.push("V_load DC: ถูกต้อง");
  } else {
    feedback.push(`V_load DC: ไม่ถูกต้อง (กรอก ${v2} คาดหวัง ~5.18 V)`);
  }
  
  // Row 2: I_load DC. Correct = 5.18mA (allow 5.0 - 5.3)
  const c1 = parseFloat(t1[2]) || 0;
  if (c1 >= 5.0 && c1 <= 5.3) {
    score++;
    feedback.push("I_load DC: ถูกต้อง");
  } else {
    feedback.push(`I_load DC: ไม่ถูกต้อง (กรอก ${c1} คาดหวัง ~5.18 mA)`);
  }
  
  // Row 3: V_diode forward. Correct = 0.70V (allow 0.65 - 0.75)
  const vd = parseFloat(t1[3]) || 0;
  if (vd >= 0.65 && vd <= 0.75) {
    score++;
    feedback.push("V_diode Forward: ถูกต้อง");
  } else {
    feedback.push(`V_diode Forward: ไม่ถูกต้อง (กรอก ${vd} คาดหวัง ~0.70 V)`);
  }
  
  // --- PART 2: TABLE 2 (Scope Readings - 6 Rows) ---
  const t2 = data.t2Rows || [];
  
  // Row 0: Ch1 Vpp. Correct = 33.9V (allow 33.0 - 34.8)
  const s1 = parseFloat(t2[0]) || 0;
  if (s1 >= 33.0 && s1 <= 34.8) {
    score++;
    feedback.push("Ch1 Vpp: ถูกต้อง");
  } else {
    feedback.push(`Ch1 Vpp: ไม่ถูกต้อง (กรอก ${s1} คาดหวัง ~33.9 V)`);
  }
  
  // Row 1: Ch1 Vrms. Correct = 12.0V (allow 11.8 - 12.2)
  const s2 = parseFloat(t2[1]) || 0;
  if (s2 >= 11.8 && s2 <= 12.2) {
    score++;
    feedback.push("Ch1 Vrms: ถูกต้อง");
  } else {
    feedback.push(`Ch1 Vrms: ไม่ถูกต้อง (กรอก ${s2} คาดหวัง ~12.0 V)`);
  }
  
  // Row 2: Ch2 Vmax. Correct = 16.3V (allow 15.9 - 16.6)
  const s3 = parseFloat(t2[2]) || 0;
  if (s3 >= 15.9 && s3 <= 16.6) {
    score++;
    feedback.push("Ch2 Vmax: ถูกต้อง");
  } else {
    feedback.push(`Ch2 Vmax: ไม่ถูกต้อง (กรอก ${s3} คาดหวัง ~16.3 V)`);
  }
  
  // Row 3: Ch2 Vdc. Correct = 5.18V (allow 5.0 - 5.3)
  const s4 = parseFloat(t2[3]) || 0;
  if (s4 >= 5.0 && s4 <= 5.3) {
    score++;
    feedback.push("Ch2 Vdc: ถูกต้อง");
  } else {
    feedback.push(`Ch2 Vdc: ไม่ถูกต้อง (กรอก ${s4} คาดหวัง ~5.18 V)`);
  }
  
  // Row 4: Ch2 Vrms. Correct = 8.13V (allow 7.9 - 8.3)
  const s5 = parseFloat(t2[4]) || 0;
  if (s5 >= 7.9 && s5 <= 8.3) {
    score++;
    feedback.push("Ch2 Vrms: ถูกต้อง");
  } else {
    feedback.push(`Ch2 Vrms: ไม่ถูกต้อง (กรอก ${s5} คาดหวัง ~8.13 V)`);
  }
  
  // Row 5: Period. Correct = 20.0ms (allow 19.5 - 20.5)
  const s6 = parseFloat(t2[5]) || 0;
  if (s6 >= 19.5 && s6 <= 20.5) {
    score++;
    feedback.push("Period: ถูกต้อง");
  } else {
    feedback.push(`Period: ไม่ถูกต้อง (กรอก ${s6} คาดหวัง ~20.0 ms)`);
  }
  
  // --- PART 3: POST-LAB QUESTIONS (3 Rows) ---
  if (data.q1 === 'A') {
    score++;
    feedback.push("คำถามข้อที่ 1: ถูกต้อง (ก)");
  } else {
    feedback.push("คำถามข้อที่ 1: ไม่ถูกต้อง");
  }
  
  if (data.q2 === 'A') {
    score++;
    feedback.push("คำถามข้อที่ 2: ถูกต้อง (ก)");
  } else {
    feedback.push("คำถามข้อที่ 2: ไม่ถูกต้อง");
  }
  
  if (data.q3 === 'B') {
    score++;
    feedback.push("คำถามข้อที่ 3: ถูกต้อง (ข)");
  } else {
    feedback.push("คำถามข้อที่ 3: ไม่ถูกต้อง");
  }
  
  // Grade comment
  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 11) {
    comment = "ผ่านเกณฑ์ดีมาก (Excellent)";
  } else if (score >= 8) {
    comment = "ผ่านเกณฑ์ดี (Good)";
  } else if (score >= 6) {
    comment = "ผ่านเกณฑ์ขั้นต่ำ (Pass)";
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
      "Auto Score", "Evaluation", "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#38bdf8")
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
    grading.score + " / " + grading.maxScore,
    grading.comment,
    grading.feedback,
    data.q1,
    data.q2,
    data.q3,
    data.labConclusion
  ];
  sheet.appendRow(rowData);
  
  // Auto-resize sheet columns to fit data
  sheet.autoResizeColumns(1, rowData.length);
}
