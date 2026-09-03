/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Lab 9: BJT Small-Signal Analysis using re Model
 * Handles HTML page serving, form submissions, dynamic mathematical auto-grading, and Google Sheets DB logs.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: การวิเคราะห์วงจรขยาย BJT ด้วยแบบจำลอง re')
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
 */
function submitWorksheet(data) {
  try {
    // 0. Check duplicate submission
    const duplicateCheck = checkDuplicateSubmission("Submissions", 4, data.studentId);
    if (duplicateCheck) {
      return duplicateCheck;
    }

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
 * BJT re-Model Dynamic Small-Signal Mathematical Solver & Auto-Grading Engine
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
  
  // Parameter Mode and Values (Dynamic from client or Default Fixed)
  const mode = data.circuitMode || data.param_mode || 'fixed';
  const Vcc = parseFloat(data.param_vcc) || 12.0;       // V
  const R1 = (parseFloat(data.param_r1) || 33.0) * 1000; // ohms
  const R2 = (parseFloat(data.param_r2) || 6.8) * 1000;  // ohms
  const Rc = (parseFloat(data.param_rc) || 2.2) * 1000;  // ohms
  const Re = parseFloat(data.param_re) || 560;          // ohms
  const Beta = parseFloat(data.param_beta) || 200;      // Nominal Beta
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
  
  // Theoretical AC calculations
  // Case A: With CE (Bypassed)
  const Zb_bypassed = Beta * re_calc;
  const Zi_bypassed = 1 / (1/R1 + 1/R2 + 1/Zb_bypassed); // ohms
  const Zo_bypassed = Rc;                                // ohms
  const Av_bypassed = re_calc > 0 ? (Rc / re_calc) : 0;  // magnitude
  
  // Case B: Without CE (Unbypassed)
  const Zb_unbypassed = Beta * (re_calc + Re);
  const Zi_unbypassed = 1 / (1/R1 + 1/R2 + 1/Zb_unbypassed); // ohms
  const Zo_unbypassed = Rc;                                  // ohms
  const Av_unbypassed = Rc / (re_calc + Re);                 // magnitude
  
  const modeLabel = mode === 'custom' ? 'โหมดกำหนดค่าเอง (Custom Dynamic)' : 'โหมดค่ามาตรฐาน (Fixed Preset)';
  feedback.push(`[ระบบโหมดการทดลอง]: ${modeLabel}`);
  
  // --- PART 1: DC OPERATING POINT & re CALCULATION (3 Points) ---
  const sVb = parseFloat(data.dc_vb) || 0;
  const sVe = parseFloat(data.dc_ve) || 0;
  const sVc = parseFloat(data.dc_vc) || 0;
  const sVce = parseFloat(data.dc_vce) || 0;
  const sIe = parseFloat(data.dc_ie) || 0;
  const sRe = parseFloat(data.dc_re) || 0;
  
  // Tolerances for DC values
  const vbTol = Math.max(0.35, Vb * 0.15);
  const veTol = Math.max(0.35, Ve * 0.15);
  const vcTol = Math.max(0.60, Vc * 0.15);
  const vceTol = Math.max(0.70, Math.abs(Vce) * 0.15);
  const ieTol = Math.max(0.40, Ie_mA * 0.18);
  
  const vbOk = Math.abs(sVb - Vb) <= vbTol || Math.abs(sVb - Vth) <= vbTol;
  const veOk = Math.abs(sVe - Ve) <= veTol;
  const vcOk = Math.abs(sVc - Vc) <= vcTol;
  const vceOk = Math.abs(sVce - Vce) <= vceTol || Math.abs(sVce - (sVc - sVe)) <= 0.35;
  const ieOk = Math.abs(sIe - Ie_mA) <= ieTol;
  
  const studentCalculatedRe = sIe > 0 ? (26.0 / sIe) : re_calc;
  const reTol = Math.max(3.0, re_calc * 0.20);
  const reOk = Math.abs(sRe - re_calc) <= reTol || Math.abs(sRe - studentCalculatedRe) <= Math.max(2.5, studentCalculatedRe * 0.18);
  
  let dcVoltagesScore = (vbOk && veOk && vcOk && vceOk) ? 1 : 0;
  let dcCurrentScore = ieOk ? 1 : 0;
  let reScore = reOk ? 1 : 0;
  
  let part1Score = dcVoltagesScore + dcCurrentScore + reScore;
  score += part1Score;
  
  feedback.push(`\n[ตอนที่ 1] จุดทำงาน DC และค่า re: ได้ ${part1Score} / 3 คะแนน`);
  if (dcVoltagesScore) {
    feedback.push(`  ✓ แรงดันไฟตรง (Vb, Ve, Vc, Vce): ถูกต้องตามเกณฑ์`);
  } else {
    feedback.push(`  ✗ แรงดันไฟตรง: ค่าอยู่นอกเกณฑ์ความถูกต้อง`);
  }
  if (dcCurrentScore) {
    feedback.push(`  ✓ กระแสอิมิตเตอร์ Ie: ถูกต้องตามเกณฑ์`);
  } else {
    feedback.push(`  ✗ กระแสอิมิตเตอร์ Ie: คลาดเคลื่อนจากเกณฑ์`);
  }
  if (reScore) {
    feedback.push(`  ✓ ค่าความต้านทานไดนามิก re: ถูกต้องตามเกณฑ์`);
  } else {
    feedback.push(`  ✗ ค่าความต้านทานไดนามิก re: คลาดเคลื่อนจากเกณฑ์`);
  }
  
  // --- PART 2: AC PERFORMANCE COMPARISON (3 Points Total) ---
  // Case A: With CE (Bypassed) (1.5 Points)
  const sAv_byp = Math.abs(parseFloat(data.ac_av_bypassed) || 0);
  const sZi_byp = parseFloat(data.ac_zi_bypassed) || 0;
  const sPhase_byp = parseInt(data.ac_phase_bypassed) || 0;
  
  const avBypMin = Av_bypassed * 0.70;
  const avBypMax = Av_bypassed * 1.30;
  const avBypOk = sAv_byp >= avBypMin && sAv_byp <= avBypMax;
  
  const ziByp_k_expected = Zi_bypassed / 1000;
  const ziByp_k = sZi_byp > 50 ? sZi_byp / 1000 : sZi_byp;
  const ziBypOk = Math.abs(ziByp_k - ziByp_k_expected) <= Math.max(0.6, ziByp_k_expected * 0.40);
  const phaseBypOk = sPhase_byp === 180;
  
  let part2A_Score = 0;
  if (avBypOk) part2A_Score += 0.75;
  if (ziBypOk && phaseBypOk) part2A_Score += 0.75;
  else if (ziBypOk || phaseBypOk) part2A_Score += 0.5;
  
  // Case B: Without CE (Unbypassed) (1.5 Points)
  const sAv_unbyp = Math.abs(parseFloat(data.ac_av_unbypassed) || 0);
  const sZi_unbyp = parseFloat(data.ac_zi_unbypassed) || 0;
  const sPhase_unbyp = parseInt(data.ac_phase_unbypassed) || 0;
  
  const avUnbypMin = Av_unbypassed * 0.70;
  const avUnbypMax = Av_unbypassed * 1.30;
  const avUnbypOk = sAv_unbyp >= avUnbypMin && sAv_unbyp <= avUnbypMax;
  
  const ziUnbyp_k_expected = Zi_unbypassed / 1000;
  const ziUnbyp_k = sZi_unbyp > 50 ? sZi_unbyp / 1000 : sZi_unbyp;
  const ziUnbypOk = Math.abs(ziUnbyp_k - ziUnbyp_k_expected) <= Math.max(1.0, ziUnbyp_k_expected * 0.40);
  const phaseUnbypOk = sPhase_unbyp === 180;
  
  let part2B_Score = 0;
  if (avUnbypOk) part2B_Score += 0.75;
  if (ziUnbypOk && phaseUnbypOk) part2B_Score += 0.75;
  else if (ziUnbypOk || phaseUnbypOk) part2B_Score += 0.5;
  
  let part2Total = Math.round(part2A_Score + part2B_Score);
  score += part2Total;
  
  feedback.push(`\n[ตอนที่ 2] การทดสอบวงจร AC (มี CE vs ไม่มี CE): ได้ ${part2Total} / 3 คะแนน`);
  if (avBypOk) feedback.push(`  ✓ อัตราขยาย Av (มี CE): ถูกต้องตามเกณฑ์`);
  else feedback.push(`  ✗ อัตราขยาย Av (มี CE): คลาดเคลื่อนจากเกณฑ์`);
  if (avUnbypOk) feedback.push(`  ✓ อัตราขยาย Av (ไม่มี CE): ถูกต้องตามเกณฑ์`);
  else feedback.push(`  ✗ อัตราขยาย Av (ไม่มี CE): คลาดเคลื่อนจากเกณฑ์`);
  if (phaseBypOk && phaseUnbypOk) feedback.push(`  ✓ เฟสสัญญาณ: ถูกต้องทั้งสองสภาวะ (กลับเฟส 180°)`);
  
  // --- PART 3: POST-LAB QUESTIONS & CONCEPTUAL ASSESSMENT (4 Points) ---
  const q1 = data.q1Answer || data.q1_choice; // Answer key: 'b'
  const q2 = data.q2Answer || data.q2_choice; // Answer key: 'c'
  const q3 = data.q3Answer || data.q3_choice; // Answer key: 'a'
  const q4 = data.q4Answer || data.q4_choice; // Answer key: 'b'
  
  let qScore = 0;
  if (q1 === 'b') qScore++;
  if (q2 === 'c') qScore++;
  if (q3 === 'a') qScore++;
  if (q4 === 'b') qScore++;
  
  score += qScore;
  feedback.push(`\n[ตอนที่ 3] คำถามวัดความเข้าใจท้ายการทดลอง: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} / 4 คะแนน)`);
  
  let comment = 'ต้องปรับปรุงแก้ไขใบงาน';
  if (score >= 9) {
    comment = 'ผ่านเกณฑ์ดีเยี่ยม (Excellent)';
  } else if (score >= 7) {
    comment = 'ผ่านเกณฑ์ดี (Good)';
  } else if (score >= 5) {
    comment = 'ผ่านเกณฑ์พอใช้ (Fair)';
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
  let sheet = ss.getSheetByName('Submissions');
  
  if (!sheet) {
    sheet = ss.insertSheet('Submissions');
    const headers = [
      'Timestamp', 'Student Email', 'Student Name', 'Student ID', 'Group', 'Lab Date', 'Lab Mode',
      'Auto Score', 'Evaluation', 'Circuit Mode', 'Transistor Model', 'Circuit Params',
      'DC Vb (V)', 'DC Ve (V)', 'DC Vc (V)', 'DC Vce (V)', 'DC Ie (mA)', 'Calc re (Ω)',
      'Av (with CE)', 'Zi (with CE)', 'Av (no CE)', 'Zi (no CE)',
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
  const paramSummary = `Vcc=${data.param_vcc || 12}V, R1=${data.param_r1 || 33}k, R2=${data.param_r2 || 6.8}k, Rc=${data.param_rc || 2.2}k, RE=${data.param_re || 560}Ω, β=${data.param_beta || 200}`;
  
  
  var chosenModel = data.hwComponentModel || data.componentModel || data.bjtModel || data.zenerModel || '2N2222';
  var labModeText = (data.labDataSource === 'hardware')
    ? '🔌 ฮาร์ดแวร์จริง (' + chosenModel + ')'
    : '🔬 ซิมูเลเตอร์ (' + chosenModel + ')';

  const rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    labModeText,
    grading.score + ' / ' + grading.maxScore,
    grading.comment,
    data.circuitMode === 'custom' || data.param_mode === 'custom' ? 'Custom Dynamic' : 'Fixed Preset',
    data.bjtModel || '2N2222',
    paramSummary,
    data.dc_vb,
    data.dc_ve,
    data.dc_vc,
    data.dc_vce,
    data.dc_ie,
    data.dc_re,
    data.ac_av_bypassed,
    data.ac_zi_bypassed,
    data.ac_av_unbypassed,
    data.ac_zi_unbypassed,
    data.q1Answer || data.q1_choice,
    data.q2Answer || data.q2_choice,
    data.q3Answer || data.q3_choice,
    data.q4Answer || data.q4_choice,
    grading.feedback,
    data.labConclusion
  ];
  sheet.appendRow(rowData);
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
