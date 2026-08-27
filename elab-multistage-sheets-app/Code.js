/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Lab 13: Multi-Stage BJT Amplifier Analysis (2-Stage CE-CE Cascade)
 * Handles HTML page serving, form submissions, dynamic mathematical auto-grading, and Google Sheets DB logs.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: วงจรขยายสัญญาณหลายภาค (Multi-Stage BJT Amplifier)')
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
 * 2-Stage Multi-Stage BJT Amplifier Small-Signal Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  let score = 0;
  const maxScore = 10;
  const feedback = [];
  
  // Circuit Parameters
  const mode = data.circuitMode || 'fixed';
  const Vcc = parseFloat(data.param_vcc) || 12.0;
  const R1 = (parseFloat(data.param_r1) || 33.0) * 1000;
  const R2 = (parseFloat(data.param_r2) || 6.8) * 1000;
  const Rc1 = (parseFloat(data.param_rc1) || 3.3) * 1000;
  const Re1 = parseFloat(data.param_re1) || 680;

  const R5 = (parseFloat(data.param_r5) || 33.0) * 1000;
  const R6 = (parseFloat(data.param_r6) || 6.8) * 1000;
  const Rc2 = (parseFloat(data.param_rc2) || 2.2) * 1000;
  const Re2 = parseFloat(data.param_re2) || 560;
  const Rl = (parseFloat(data.param_rl) || 10.0) * 1000;
  const Beta = parseFloat(data.param_beta) || 200;
  const Vbe = 0.70;

  // --- Stage 1 DC Calculations (Unbypassed CE) ---
  const Vth1 = Vcc * (R2 / (R1 + R2));
  const Rth1 = (R1 * R2) / (R1 + R2);
  let Ib1 = (Vth1 - Vbe) / (Rth1 + (Beta + 1) * Re1);
  if (Ib1 < 0) Ib1 = 0;
  const Ie1 = (Beta + 1) * Ib1;
  const Ic1 = Beta * Ib1;
  const Ve1 = Ie1 * Re1;
  const Vb1 = Ve1 + (Ib1 > 0 ? Vbe : 0);
  const Vc1 = Math.max(0, Vcc - Ic1 * Rc1);
  const Vce1 = Vc1 - Ve1;
  const Ie1_mA = Ie1 * 1000;
  const re1_calc = Ie1_mA > 0 ? (26.0 / Ie1_mA) : 9999;

  // --- Stage 2 DC Calculations (Bypassed CE2) ---
  const Vth2 = Vcc * (R6 / (R5 + R6));
  const Rth2 = (R5 * R6) / (R5 + R6);
  let Ib2 = (Vth2 - Vbe) / (Rth2 + (Beta + 1) * Re2);
  if (Ib2 < 0) Ib2 = 0;
  const Ie2 = (Beta + 1) * Ib2;
  const Ic2 = Beta * Ib2;
  const Ve2 = Ie2 * Re2;
  const Vb2 = Ve2 + (Ib2 > 0 ? Vbe : 0);
  const Vc2 = Math.max(0, Vcc - Ic2 * Rc2);
  const Vce2 = Vc2 - Ve2;
  const Ie2_mA = Ie2 * 1000;
  const re2_calc = Ie2_mA > 0 ? (26.0 / Ie2_mA) : 9999;

  // --- AC Small-Signal Calculations ---
  const Zb2 = Beta * re2_calc;
  const Zi2 = 1 / (1 / R5 + 1 / R6 + 1 / Zb2);
  const Rc1_eff = (Rc1 * Zi2) / (Rc1 + Zi2);
  const Av1 = -(Rc1_eff / (re1_calc + Re1));

  const Rc2_eff = (Rc2 * Rl) / (Rc2 + Rl);
  const Av2 = -(Rc2_eff / re2_calc);
  const Av_total = Av1 * Av2;

  const Zb1 = Beta * (re1_calc + Re1);
  const Zi1 = 1 / (1 / R1 + 1 / R2 + 1 / Zb1);
  const Zi_k = Zi1 / 1000;

  const modeLabel = mode === 'custom' ? 'โหมดกำหนดค่าเอง (Custom Dynamic)' : 'โหมดค่ามาตรฐาน (Fixed Preset)';
  feedback.push(`[ระบบโหมดการทดลอง]: ${modeLabel}`);

  // --- PART 1: DC OPERATING POINTS (3 Points) ---
  // Stage 1 DC (1.5 pts)
  const sVb1 = parseFloat(data.dc1_vb) || 0;
  const sVe1 = parseFloat(data.dc1_ve) || 0;
  const sVc1 = parseFloat(data.dc1_vc) || 0;
  const sIe1 = parseFloat(data.dc1_ie) || 0;
  const sRe1 = parseFloat(data.dc1_re) || 0;

  const vb1Ok = Math.abs(sVb1 - Vb1) <= Math.max(0.35, Vb1 * 0.15);
  const ve1Ok = Math.abs(sVe1 - Ve1) <= Math.max(0.35, Ve1 * 0.15);
  const vc1Ok = Math.abs(sVc1 - Vc1) <= Math.max(0.60, Vc1 * 0.15);
  const ie1Ok = Math.abs(sIe1 - Ie1_mA) <= Math.max(0.40, Ie1_mA * 0.18);
  const re1Ok = Math.abs(sRe1 - re1_calc) <= Math.max(3.0, re1_calc * 0.20);

  let s1 = 0;
  if (vb1Ok && ve1Ok && vc1Ok) s1 += 0.5;
  if (ie1Ok) s1 += 0.5;
  if (re1Ok) s1 += 0.5;
  score += s1;

  feedback.push(`\n[ตอนที่ 1] Stage 1 DC (Unbypassed): ได้ ${s1} / 1.5 คะแนน`);
  feedback.push(`  ${vb1Ok && ve1Ok && vc1Ok ? '✓' : '✗'} แรงดันไฟตรง VB1, VE1, VC1`);
  feedback.push(`  ${ie1Ok ? '✓' : '✗'} กระแสอิมิตเตอร์ IE1`);
  feedback.push(`  ${re1Ok ? '✓' : '✗'} ความต้านทานไดนามิก re1`);

  // Stage 2 DC (1.5 pts)
  const sVb2 = parseFloat(data.dc2_vb) || 0;
  const sVe2 = parseFloat(data.dc2_ve) || 0;
  const sVc2 = parseFloat(data.dc2_vc) || 0;
  const sIe2 = parseFloat(data.dc2_ie) || 0;
  const sRe2 = parseFloat(data.dc2_re) || 0;

  const vb2Ok = Math.abs(sVb2 - Vb2) <= Math.max(0.35, Vb2 * 0.15);
  const ve2Ok = Math.abs(sVe2 - Ve2) <= Math.max(0.35, Ve2 * 0.15);
  const vc2Ok = Math.abs(sVc2 - Vc2) <= Math.max(0.60, Vc2 * 0.15);
  const ie2Ok = Math.abs(sIe2 - Ie2_mA) <= Math.max(0.40, Ie2_mA * 0.18);
  const re2Ok = Math.abs(sRe2 - re2_calc) <= Math.max(3.0, re2_calc * 0.20);

  let s2 = 0;
  if (vb2Ok && ve2Ok && vc2Ok) s2 += 0.5;
  if (ie2Ok) s2 += 0.5;
  if (re2Ok) s2 += 0.5;
  score += s2;

  feedback.push(`\n[ตอนที่ 1] Stage 2 DC (Bypassed): ได้ ${s2} / 1.5 คะแนน`);
  feedback.push(`  ${vb2Ok && ve2Ok && vc2Ok ? '✓' : '✗'} แรงดันไฟตรง VB2, VE2, VC2`);
  feedback.push(`  ${ie2Ok ? '✓' : '✗'} กระแสอิมิตเตอร์ IE2`);
  feedback.push(`  ${re2Ok ? '✓' : '✗'} ความต้านทานไดนามิก re2`);

  // --- PART 2: AC PERFORMANCE PARAMETERS (3 Points: 0.6 each) ---
  const sAv1 = Math.abs(parseFloat(data.ac_av1) || 0);
  const sAv2 = Math.abs(parseFloat(data.ac_av2) || 0);
  const sAvTotal = Math.abs(parseFloat(data.ac_avtotal) || 0);
  const sZi = parseFloat(data.ac_zi) || 0;
  const sPhase = String(data.ac_phase || '');

  const av1Ok = Math.abs(sAv1 - Math.abs(Av1)) <= Math.max(0.5, Math.abs(Av1) * 0.30);
  const av2Ok = Math.abs(sAv2 - Math.abs(Av2)) <= Math.max(5.0, Math.abs(Av2) * 0.30);
  const avTotalOk = Math.abs(sAvTotal - Math.abs(Av_total)) <= Math.max(20.0, Math.abs(Av_total) * 0.30);
  const ziOk = Math.abs(sZi - Zi_k) <= Math.max(0.5, Zi_k * 0.40);
  const phaseOk = sPhase === '0';

  let acScore = 0;
  if (av1Ok) acScore += 0.6;
  if (av2Ok) acScore += 0.6;
  if (avTotalOk) acScore += 0.6;
  if (ziOk) acScore += 0.6;
  if (phaseOk) acScore += 0.6;

  score += acScore;
  feedback.push(`\n[ตอนที่ 2] พารามิเตอร์สัญญาณ AC รวม: ได้ ${acScore.toFixed(1)} / 3 คะแนน`);
  feedback.push(`  ${av1Ok ? '✓' : '✗'} อัตราขยายภาค 1 (Av1)`);
  feedback.push(`  ${av2Ok ? '✓' : '✗'} อัตราขยายภาค 2 (Av2)`);
  feedback.push(`  ${avTotalOk ? '✓' : '✗'} อัตราขยายรวม (Av_total = Av1 × Av2)`);
  feedback.push(`  ${ziOk ? '✓' : '✗'} อิมพีแดนซ์อินพุต (Zi)`);
  feedback.push(`  ${phaseOk ? '✓' : '✗'} เฟสสัญญาณเอาต์พุต 0° (In-Phase)`);

  // --- PART 3: POST-LAB CONCEPTUAL ASSESSMENT (4 Points) ---
  const q1 = data.q1Answer || data.q1_choice; // Key: 'c' (Av1 * Av2)
  const q2 = data.q2Answer || data.q2_choice; // Key: 'b' (0 deg in-phase)
  const q3 = data.q3Answer || data.q3_choice; // Key: 'c' (RL reduces Av)
  const q4 = data.q4Answer || data.q4_choice; // Key: 'd' (C3 blocks DC, passes AC)

  let qScore = 0;
  if (q1 === 'c') qScore++;
  if (q2 === 'b') qScore++;
  if (q3 === 'c') qScore++;
  if (q4 === 'd') qScore++;

  score += qScore;
  feedback.push(`\n[ตอนที่ 3] คำถามท้ายการทดลอง: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} / 4 คะแนน)`);

  score = Math.round(score * 10) / 10;
  let comment = 'ต้องปรับปรุงแก้ไขใบงาน';
  if (score >= 9) comment = 'ผ่านเกณฑ์ดีเยี่ยม (Excellent)';
  else if (score >= 7) comment = 'ผ่านเกณฑ์ดี (Good)';
  else if (score >= 5) comment = 'ผ่านเกณฑ์พอใช้ (Fair)';

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
  let sheet = ss.getSheetByName('Submissions');
  
  if (!sheet) {
    sheet = ss.insertSheet('Submissions');
    const headers = [
      'Timestamp', 'Student Email', 'Student Name', 'Student ID', 'Group', 'Lab Date',
      'Auto Score', 'Evaluation', 'Circuit Mode', 'Circuit Params',
      'Stage1 VB', 'Stage1 VE', 'Stage1 VC', 'Stage1 VCE', 'Stage1 IE (mA)', 'Stage1 re (Ω)',
      'Stage2 VB', 'Stage2 VE', 'Stage2 VC', 'Stage2 VCE', 'Stage2 IE (mA)', 'Stage2 re (Ω)',
      'Av1', 'Av2', 'Av(total)', 'Zi (kΩ)', 'Phase (°)',
      'Q1 Ans', 'Q2 Ans', 'Q3 Ans', 'Q4 Ans', 'Feedback Summary', 'Lab Conclusion'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#0284c7')
         .setFontColor('#ffffff')
         .setBorder(true, true, true, true, true, true);
  }
  
  const studentEmail = Session.getActiveUser().getEmail() || 'Anonymous / Local User';
  const paramSummary = `Vcc=${data.param_vcc || 12}V, R1=${data.param_r1 || 33}k, R2=${data.param_r2 || 6.8}k, RC1=${data.param_rc1 || 3.3}k, RE1=${data.param_re1 || 680}Ω, R5=${data.param_r5 || 33}k, R6=${data.param_r6 || 6.8}k, RC2=${data.param_rc2 || 2.2}k, RE2=${data.param_re2 || 560}Ω, RL=${data.param_rl || 10}k, β=${data.param_beta || 200}`;
  
  const rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    grading.score + ' / ' + grading.maxScore,
    grading.comment,
    data.circuitMode === 'custom' ? 'Custom Dynamic' : 'Fixed Preset',
    paramSummary,
    data.dc1_vb,
    data.dc1_ve,
    data.dc1_vc,
    data.dc1_vce,
    data.dc1_ie,
    data.dc1_re,
    data.dc2_vb,
    data.dc2_ve,
    data.dc2_vc,
    data.dc2_vce,
    data.dc2_ie,
    data.dc2_re,
    data.ac_av1,
    data.ac_av2,
    data.ac_avtotal,
    data.ac_zi,
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
