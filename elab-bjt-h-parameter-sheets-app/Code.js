/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Lab 10: BJT Small-Signal Analysis using Hybrid (h-Parameter) Model
 * Handles HTML page serving, form submissions, dynamic mathematical auto-grading, and Google Sheets DB logs.
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
 * BJT h-Parameter Dynamic Small-Signal Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  let score = 0;
  const maxScore = 10;
  const feedback = [];
  
  // Parameter Mode and Values (Dynamic from client or Default Fixed)
  const mode = data.param_mode || 'fixed';
  const Vcc = parseFloat(data.param_vcc) || 12.0;       // V
  const R1 = (parseFloat(data.param_r1) || 33.0) * 1000; // ohms
  const R2 = (parseFloat(data.param_r2) || 6.8) * 1000;  // ohms
  const Rc = (parseFloat(data.param_rc) || 2.2) * 1000;  // ohms
  const Re = parseFloat(data.param_re) || 560;          // ohms
  const Beta = parseFloat(data.param_beta) || 200;      // Nominal Beta / hfe
  const Vbe = 0.70;                                      // V
  
  // Theoretical DC calculations (Voltage divider bias with exact Thevenin)
  const Vth = Vcc * (R2 / (R1 + R2));
  const Rth = (R1 * R2) / (R1 + R2);
  let Ib = (Vth - Vbe) / (Rth + (Beta + 1) * Re);
  if (Ib < 0) Ib = 0;
  
  const Ie = (Beta + 1) * Ib;
  const Ic = Beta * Ib;
  const Ve = Ie * Re;
  const Vb = Ve + (Ib > 0 ? Vbe : 0);
  const Vc = Math.max(0, Vcc - Ic * Rc);
  const Vce = Vc - Ve;
  const Ie_mA = Ie * 1000;
  const re_calc = Ie_mA > 0 ? (26.0 / Ie_mA) : 9999;
  
  // Theoretical h-Parameters:
  const hfe_calc = Beta;
  const hie_calc = Beta * re_calc;     // ohms
  const hie_k = hie_calc / 1000;       // k-ohms
  
  // Theoretical AC calculations using Approximate h-Model (with CE Bypass):
  const Zi_calc = 1 / (1/R1 + 1/R2 + 1/hie_calc); // ohms
  const Zo_calc = Rc;                              // ohms
  const Av_calc = hie_calc > 0 ? ((hfe_calc * Rc) / hie_calc) : 0; // magnitude
  
  const modeLabel = mode === 'custom' ? 'โหมดกำหนดค่าเอง (Custom)' : 'โหมดค่ามาตรฐาน (Fixed)';
  feedback.push(`[ระบบโหมดการทดลอง]: ${modeLabel}`);
  
  // --- PART 1: DC BIAS POINT & h-PARAMETERS (3 Points) ---
  const sVb = parseFloat(data.dc_vb) || 0;
  const sVe = parseFloat(data.dc_ve) || 0;
  const sVc = parseFloat(data.dc_vc) || 0;
  const sIe = parseFloat(data.dc_ie) || 0;
  const sHfe = parseFloat(data.h_fe) || 0;
  const sHie = parseFloat(data.h_ie) || 0;
  
  // Tolerances
  const vbTol = Math.max(0.35, Vb * 0.15);
  const veTol = Math.max(0.35, Ve * 0.15);
  const vcTol = Math.max(0.60, Vc * 0.15);
  const ieTol = Math.max(0.40, Ie_mA * 0.18);
  
  const vbOk = Math.abs(sVb - Vb) <= vbTol || Math.abs(sVb - Vth) <= vbTol;
  const veOk = Math.abs(sVe - Ve) <= veTol;
  const vcOk = Math.abs(sVc - Vc) <= vcTol;
  const ieOk = Math.abs(sIe - Ie_mA) <= ieTol;
  
  // h-parameter checks
  const hfeTol = Math.max(30, hfe_calc * 0.20);
  const hfeOk = Math.abs(sHfe - hfe_calc) <= hfeTol;
  
  // Normalize student hie to k-ohms
  const studentHie_k = sHie > 50 ? sHie / 1000 : sHie;
  const studentCalculatedHie_k = (sIe > 0 && sHfe > 0) ? (sHfe * 26.0 / sIe / 1000) : hie_k;
  const hieTol = Math.max(0.45, hie_k * 0.25);
  const hieOk = Math.abs(studentHie_k - hie_k) <= hieTol || Math.abs(studentHie_k - studentCalculatedHie_k) <= Math.max(0.35, studentCalculatedHie_k * 0.20);
  
  let dcScore = (vbOk && veOk && vcOk && ieOk) ? 1 : (vbOk || veOk || vcOk ? 0.5 : 0);
  let hfeScore = hfeOk ? 1 : 0;
  let hieScore = hieOk ? 1 : 0;
  
  let part1Score = Math.round(dcScore + hfeScore + hieScore);
  score += part1Score;
  
  feedback.push(`\n[ตอนที่ 1] จุดทำงาน DC และการหาค่า h-Parameters: ได้ ${part1Score} / 3 คะแนน`);
  if (dcScore >= 1) feedback.push(`  ✓ จุดทำงานกระแสตรง (Vb, Ve, Vc, Ie): ถูกต้องตามเกณฑ์`);
  else feedback.push(`  ✗ จุดทำงานกระแสตรง: ค่าอยู่นอกเกณฑ์ความถูกต้อง`);
  if (hfeScore) feedback.push(`  ✓ ค่าอัตราขยายกระแส hfe: ถูกต้องตามเกณฑ์`);
  else feedback.push(`  ✗ ค่าอัตราขยายกระแส hfe: คลาดเคลื่อนจากเกณฑ์`);
  if (hieScore) feedback.push(`  ✓ ค่าความต้านทานอินพุต hie: ถูกต้องตามเกณฑ์`);
  else feedback.push(`  ✗ ค่าความต้านทานอินพุต hie: คลาดเคลื่อนจากเกณฑ์`);
  
  // --- PART 2: AC SMALL-SIGNAL PERFORMANCE VIA h-MODEL (3 Points) ---
  const sAv = Math.abs(parseFloat(data.ac_av) || 0);
  const sZi = parseFloat(data.ac_zi) || 0;
  const sZo = parseFloat(data.ac_zo) || 0;
  const sPhase = parseInt(data.ac_phase) || 0;
  
  const avMin = Av_calc * 0.70;
  const avMax = Av_calc * 1.30;
  const avOk = sAv >= avMin && sAv <= avMax;
  
  const studentZi_k = sZi > 50 ? sZi / 1000 : sZi;
  const zi_k_expected = Zi_calc / 1000;
  const ziOk = Math.abs(studentZi_k - zi_k_expected) <= Math.max(0.6, zi_k_expected * 0.40);
  
  const studentZo_k = sZo > 50 ? sZo / 1000 : sZo;
  const zo_k_expected = Zo_calc / 1000;
  const zoOk = Math.abs(studentZo_k - zo_k_expected) <= Math.max(0.6, zo_k_expected * 0.35);
  const phaseOk = sPhase === 180;
  
  let part2Score = 0;
  if (avOk) part2Score += 1;
  if (ziOk && zoOk) part2Score += 1;
  else if (ziOk || zoOk) part2Score += 0.5;
  if (phaseOk) part2Score += 1;
  
  score += Math.round(part2Score);
  feedback.push(`\n[ตอนที่ 2] พารามิเตอร์วงจรขยายจากแบบจำลอง h-Model: ได้ ${Math.round(part2Score)} / 3 คะแนน`);
  if (avOk) feedback.push(`  ✓ อัตราขยายแรงดัน Av: ถูกต้องตามเกณฑ์`);
  else feedback.push(`  ✗ อัตราขยายแรงดัน Av: คลาดเคลื่อนจากเกณฑ์`);
  if (ziOk) feedback.push(`  ✓ ความต้านทานอินพุต Zi: ถูกต้องตามเกณฑ์`);
  if (phaseOk) feedback.push(`  ✓ เฟสสัญญาณกลับ 180 องศา: ถูกต้อง`);
  
  // --- PART 3: POST-LAB CONCEPTUAL ASSESSMENT (4 Points) ---
  const q1 = data.q1_choice; // Answer: 'b' (hie = beta * re)
  const q2 = data.q2_choice; // Answer: 'a' (hfe is forward current transfer ratio / Beta)
  const q3 = data.q3_choice; // Answer: 'c' (hoe is output admittance, 1/hoe is ro)
  const q4 = data.q4_choice; // Answer: 'b' (Approximate model neglects hre and hoe)
  
  let qScore = 0;
  if (q1 === 'b') qScore++;
  if (q2 === 'a') qScore++;
  if (q3 === 'c') qScore++;
  if (q4 === 'b') qScore++;
  
  score += qScore;
  feedback.push(`\n[ตอนที่ 3] คำถามวัดความเข้าใจท้ายการทดลอง: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} คะแนน)`);
  
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
      "Auto Score", "Evaluation", "Circuit Mode", "Circuit Params",
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
  const paramSummary = `Vcc=${data.param_vcc || 12}V, R1=${data.param_r1 || 33}k, R2=${data.param_r2 || 6.8}k, Rc=${data.param_rc || 2.2}k, RE=${data.param_re || 560}Ω, hfe=${data.param_beta || 200}`;
  
  const rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    grading.score + " / " + grading.maxScore,
    grading.comment,
    data.param_mode === 'custom' ? 'Custom Dynamic' : 'Fixed Preset',
    paramSummary,
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
