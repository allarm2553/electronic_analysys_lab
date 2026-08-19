/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Lab 10: BJT Small-Signal Analysis using Hybrid (h-Parameter) Model
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: การวิเคราะห์วงจรขยาย BJT ด้วยแบบจำลองไฮบริดพารามิเตอร์ (h-Parameter)')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Processes the student's lab report submission
 */
function submitWorksheet(data) {
  try {
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
 * BJT h-Parameter Small-Signal Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  let score = 0;
  const maxScore = 10;
  const feedback = [];
  
  // Nominal Circuit Constants
  const Vcc = 12.0;       // V
  const R1 = 33000;       // 33k ohms
  const R2 = 6800;        // 6.8k ohms
  const Rc = 2200;        // 2.2k ohms
  const Re = 560;         // 560 ohms
  const Beta = 200;       // Nominal Beta / hfe
  const Vbe = 0.70;       // V
  
  // Theoretical DC calculations (Voltage divider bias with exact Thevenin)
  const Vth = Vcc * (R2 / (R1 + R2)); // ~2.05 V
  const Rth = (R1 * R2) / (R1 + R2);  // ~5638 ohms
  const Ib = (Vth - Vbe) / (Rth + (Beta + 1) * Re); // A
  const Ie = (Beta + 1) * Ib;          // A
  const Ic = Beta * Ib;                // A
  const Ve = Ie * Re;                  // V (~1.22 V)
  const Vb = Ve + Vbe;                 // V (~1.92 V)
  const Vc = Vcc - Ic * Rc;            // V (~7.22 V)
  const Vce = Vc - Ve;                 // V (~6.00 V)
  const Ie_mA = Ie * 1000;             // mA (~2.18 mA)
  const re_calc = 26.0 / Ie_mA;        // ohms (~11.9 ohms)
  
  // Theoretical h-Parameters:
  const hfe_calc = Beta;               // 200
  const hie_calc = Beta * re_calc;     // ohms (~2380 ohms or 2.38 k-ohms)
  const hie_k = hie_calc / 1000;       // k-ohms (~2.38 k-ohms)
  
  // Theoretical AC calculations using Approximate h-Model (with CE Bypass):
  const Zi_calc = 1 / (1/R1 + 1/R2 + 1/hie_calc); // ohms (~1.61k ohms)
  const Zo_calc = Rc;                  // 2200 ohms (2.2k ohms)
  const Av_calc = (hfe_calc * Rc) / hie_calc; // magnitude (~184.8)
  
  // --- PART 1: DC OPERATING POINT & h-PARAMETERS EXTRACTION (3 Points) ---
  const sVb = parseFloat(data.dc_vb) || 0;
  const sVe = parseFloat(data.dc_ve) || 0;
  const sVc = parseFloat(data.dc_vc) || 0;
  const sIe = parseFloat(data.dc_ie) || 0;
  const sHfe = parseFloat(data.h_fe) || 0;
  const sHie = parseFloat(data.h_ie) || 0; // could be entered in k-ohms or ohms
  
  // Tolerances
  const vbOk = Math.abs(sVb - Vb) <= 0.35 || Math.abs(sVb - Vth) <= 0.35;
  const veOk = Math.abs(sVe - Ve) <= 0.35;
  const vcOk = Math.abs(sVc - Vc) <= 0.6;
  const ieOk = Math.abs(sIe - Ie_mA) <= 0.6;
  
  // h-parameter checks
  const hfeOk = Math.abs(sHfe - hfe_calc) <= 30;
  
  // Normalize student hie to k-ohms
  const studentHie_k = sHie > 50 ? sHie / 1000 : sHie;
  const hieOk = Math.abs(studentHie_k - hie_k) <= 0.5 || Math.abs(studentHie_k - (sHfe * 26 / sIe / 1000)) <= 0.4;
  
  let dcScore = (vbOk && veOk && vcOk && ieOk) ? 1 : (vbOk || veOk || vcOk ? 0.5 : 0);
  let hfeScore = hfeOk ? 1 : 0;
  let hieScore = hieOk ? 1 : 0;
  
  let part1Score = Math.round(dcScore + hfeScore + hieScore);
  score += part1Score;
  
  feedback.push(`[ตอนที่ 1] จุดทำงาน DC และการหาค่า h-Parameters: ได้ ${part1Score} / 3 คะแนน`);
  if (dcScore >= 1) feedback.push(`  ✓ จุดทำงานกระแสตรง (Vb, Ve, Vc, Ie) ถูกต้อง`);
  else feedback.push(`  ✗ จุดทำงานกระแสตรงคลาดเคลื่อน (Vb ~${Vb.toFixed(2)}V, Ve ~${Ve.toFixed(2)}V, Vc ~${Vc.toFixed(2)}V, Ie ~${Ie_mA.toFixed(2)}mA)`);
  if (hfeScore) feedback.push(`  ✓ ค่าอัตราขยายกระแส hfe ถูกต้อง (~${hfe_calc})`);
  else feedback.push(`  ✗ ค่า hfe คลาดเคลื่อน (กรอก ${sHfe}, คาดหวัง ~${hfe_calc})`);
  if (hieScore) feedback.push(`  ✓ ค่าความต้านทานอินพุต hie ถูกต้อง (~${hie_k.toFixed(2)} kΩ)`);
  else feedback.push(`  ✗ ค่า hie คลาดเคลื่อน (กรอก ${sHie}, คาดหวัง hie = hfe * re ≈ ${hie_k.toFixed(2)} kΩ)`);
  
  // --- PART 2: AC SMALL-SIGNAL PERFORMANCE VIA h-MODEL (3 Points) ---
  const sAv = Math.abs(parseFloat(data.ac_av) || 0);
  const sZi = parseFloat(data.ac_zi) || 0;
  const sZo = parseFloat(data.ac_zo) || 0;
  const sPhase = parseInt(data.ac_phase) || 0;
  
  const avOk = sAv >= 130 && sAv <= 240;
  const studentZi_k = sZi > 50 ? sZi / 1000 : sZi;
  const ziOk = studentZi_k >= 1.0 && studentZi_k <= 2.5;
  const studentZo_k = sZo > 50 ? sZo / 1000 : sZo;
  const zoOk = studentZo_k >= 1.7 && studentZo_k <= 2.7;
  const phaseOk = sPhase === 180;
  
  let part2Score = 0;
  if (avOk) part2Score += 1;
  if (ziOk && zoOk) part2Score += 1;
  else if (ziOk || zoOk) part2Score += 0.5;
  if (phaseOk) part2Score += 1;
  
  score += Math.round(part2Score);
  feedback.push(`[ตอนที่ 2] พารามิเตอร์วงจรขยายจากแบบจำลอง h-Model: ได้ ${Math.round(part2Score)} / 3 คะแนน`);
  if (avOk) feedback.push(`  ✓ อัตราขยายแรงดัน Av = (hfe * Rc) / hie ถูกต้อง (~${sAv.toFixed(1)} เท่า)`);
  else feedback.push(`  ✗ อัตราขยายแรงดัน Av คลาดเคลื่อน (กรอก ${sAv}, คาดหวัง ~${Av_calc.toFixed(1)} เท่า)`);
  if (ziOk) feedback.push(`  ✓ ความต้านทานอินพุต Zi ถูกต้อง (~${(Zi_calc/1000).toFixed(2)} kΩ)`);
  if (phaseOk) feedback.push(`  ✓ เฟสสัญญาณกลับ 180 องศา ถูกต้อง`);
  
  // --- PART 3: POST-LAB CONCEPTUAL ASSESSMENT (4 Points) ---
  const q1 = data.q1_choice; // Answer: 'b' (hie = beta * re)
  const q2 = data.q2_choice; // Answer: 'a' (hfe is forward current transfer ratio / Beta)
  const q3 = data.q3_choice; // Answer: 'c' (hoe is output admittance, 1/hoe is ro)
  const q4 = data.q4_choice; // Answer: 'b' (Approximate model neglects hre and hoe because hre is very small and 1/hoe is very large)
  
  let qScore = 0;
  if (q1 === 'b') qScore++;
  if (q2 === 'a') qScore++;
  if (q3 === 'c') qScore++;
  if (q4 === 'b') qScore++;
  
  score += qScore;
  feedback.push(`[ตอนที่ 3] คำถามวัดความเข้าใจท้ายการทดลอง: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} คะแนน)`);
  
  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 9) {
    comment = "ผ่านเกณฑ์ดีเยี่ยม (Excellent)";
  } else if (score >= 7) {
    comment = "ผ่านเกณฑ์ดี (Good)";
  } else if (score >= 5) {
    comment = "ผ่านเกณฑ์พอใช้ (Fair)";
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Submissions");
  
  if (!sheet) {
    sheet = ss.insertSheet("Submissions");
    const headers = [
      "Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date",
      "Auto Score", "Evaluation", 
      "DC Vb (V)", "DC Ve (V)", "DC Vc (V)", "DC Ie (mA)", 
      "Extracted hfe", "Extracted hie (kΩ)", 
      "Measured Av", "Measured Zi (kΩ)", "Measured Zo (kΩ)", "Phase (°)",
      "Q1 Ans", "Q2 Ans", "Q3 Ans", "Q4 Ans", "Feedback Summary", "Lab Conclusion"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#a855f7") // Purple accent for h-Parameter Lab
         .setFontColor("#ffffff")
         .setBorder(true, true, true, true, true, true);
  }
  
  const studentEmail = Session.getActiveUser().getEmail() || "Anonymous / Local User";
  
  const rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    grading.score + " / " + grading.maxScore,
    grading.comment,
    data.dc_vb,
    data.dc_ve,
    data.dc_vc,
    data.dc_ie,
    data.h_fe,
    data.h_ie,
    data.ac_av,
    data.ac_zi,
    data.ac_zo,
    data.ac_phase,
    data.q1_choice,
    data.q2_choice,
    data.q3_choice,
    data.q4_choice,
    grading.feedback,
    data.labConclusion
  ];
  sheet.appendRow(rowData);
  sheet.autoResizeColumns(1, rowData.length);
}
