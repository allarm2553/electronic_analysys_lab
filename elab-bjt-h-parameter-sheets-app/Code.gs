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
 * BJT h-Parameter Dynamic Small-Signal Mathematical Solver & Auto-Grading Engine
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

      const mode = data.param_mode || 'fixed';
      const Vcc = parseFloat(data.param_vcc) || 12.0;
      const R1 = (parseFloat(data.param_r1) || 33.0) * 1000;
      const R2 = (parseFloat(data.param_r2) || 6.8) * 1000;
      const Rc = (parseFloat(data.param_rc) || 2.2) * 1000;
      const Re = parseFloat(data.param_re) || 560;
      const Beta = parseFloat(data.param_beta) || 200;
      const Vbe = 0.70;

      const Vth = Vcc * (R2 / (R1 + R2));
      const Rth = (R1 * R2) / (R1 + R2);
      let Ib = (Vth - Vbe) / (Rth + (Beta + 1) * Re);
      if (Ib < 0) Ib = 0;

      const Ie = (Beta + 1) * Ib;
      const Ic = Beta * Ib;
      const Ve = Ie * Re;
      const Vb = Ve + (Ib > 0 ? Vbe : 0);
      const Vc = Math.max(0, Vcc - Ic * Rc);
      const Ie_mA = Ie * 1000;
      const re_calc = Ie_mA > 0 ? (26.0 / Ie_mA) : 9999;

      const hfe_calc = Beta;
      const hie_calc = Beta * re_calc;
      const hie_k = hie_calc / 1000;
      const Zi_calc = 1 / (1/R1 + 1/R2 + 1/hie_calc);
      const Zo_calc = Rc;
      const Av_calc = hie_calc > 0 ? ((hfe_calc * Rc) / hie_calc) : 0;

      const modeLabel = mode === 'custom' ? 'โหมดกำหนดค่าเอง (Custom)' : 'โหมดค่ามาตรฐาน (Fixed)';
      feedback.push(`[ระบบโหมดการทดลอง]: ${modeLabel}`);

      // Part 1: DC & h-parameters
      const sVb = parseFloat(data.dc_vb) || 0;
      const sVe = parseFloat(data.dc_ve) || 0;
      const sVc = parseFloat(data.dc_vc) || 0;
      const sIe = parseFloat(data.dc_ie) || 0;
      const sHfe = parseFloat(data.h_fe) || 0;
      const sHie = parseFloat(data.h_ie) || 0;

      const vbOk = Math.abs(sVb - Vb) <= Math.max(0.35, Vb * 0.15) || Math.abs(sVb - Vth) <= Math.max(0.35, Vth * 0.15);
      const veOk = Math.abs(sVe - Ve) <= Math.max(0.35, Ve * 0.15);
      const vcOk = Math.abs(sVc - Vc) <= Math.max(0.60, Vc * 0.15);
      const ieOk = Math.abs(sIe - Ie_mA) <= Math.max(0.40, Ie_mA * 0.18);

      const hfeOk = Math.abs(sHfe - hfe_calc) <= Math.max(30, hfe_calc * 0.20);
      const studentHie_k = sHie > 50 ? sHie / 1000 : sHie;
      const studentCalculatedHie_k = (sIe > 0 && sHfe > 0) ? (sHfe * 26.0 / sIe / 1000) : hie_k;
      const hieOk = Math.abs(studentHie_k - hie_k) <= Math.max(0.45, hie_k * 0.25) || Math.abs(studentHie_k - studentCalculatedHie_k) <= Math.max(0.35, studentCalculatedHie_k * 0.20);

      let dcScore = (vbOk && veOk && vcOk && ieOk) ? 1 : 0;
      let hfeScore = hfeOk ? 1 : 0;
      let hieScore = hieOk ? 1 : 0;
      let part1Score = dcScore + hfeScore + hieScore;
      score += part1Score;

      feedback.push(`\n[ตอนที่ 1] จุดทำงาน DC และการหาค่า h-Parameters: ได้ ${part1Score} / 3 คะแนน`);
      if (dcScore) feedback.push(`  ✓ จุดทำงานกระแสตรง (Vb, Ve, Vc, Ie): ถูกต้องตามเกณฑ์`);
      else feedback.push(`  ✗ จุดทำงานกระแสตรง: ค่าอยู่นอกเกณฑ์ความถูกต้อง`);
      if (hfeScore) feedback.push(`  ✓ ค่าอัตราขยายกระแส hfe: ถูกต้องตามเกณฑ์`);
      else feedback.push(`  ✗ ค่าอัตราขยายกระแส hfe: คลาดเคลื่อนจากเกณฑ์`);
      if (hieScore) feedback.push(`  ✓ ค่าความต้านทานอินพุต hie: ถูกต้องตามเกณฑ์`);
      else feedback.push(`  ✗ ค่าความต้านทานอินพุต hie: คลาดเคลื่อนจากเกณฑ์`);

      // Part 2: AC Performance via h-Model
      const sAv = Math.abs(parseFloat(data.ac_av) || 0);
      const sZi = parseFloat(data.ac_zi) || 0;
      const sZo = parseFloat(data.ac_zo) || 0;
      const sPhase = parseInt(data.ac_phase) || 0;

      const avOk = sAv >= (Av_calc * 0.70) && sAv <= (Av_calc * 1.30);
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

      // Part 3: Post-lab questions
      let qScore = 0;
      if (data.q1_choice === 'b') qScore++;
      if (data.q2_choice === 'a') qScore++;
      if (data.q3_choice === 'c') qScore++;
      if (data.q4_choice === 'b') qScore++;
      score += qScore;
      feedback.push(`\n[ตอนที่ 3] คำถามวัดความเข้าใจท้ายการทดลอง: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} / 4 คะแนน)`);

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

    // --- DATA HELPER ---
    function getWorksheetSubmissionData() {
      const name = document.getElementById('student-name')?.value.trim() || '';
      const id = document.getElementById('student-id')?.value.trim() || '';
      const group = document.getElementById('student-group')?.value.trim() || '';
      const date = document.getElementById('lab-date')?.value || '';

      const q1Val = document.querySelector('input[name="q1"]:checked')?.value || '';
      const q2Val = document.querySelector('input[name="q2"]:checked')?.value || '';
      const q3Val = document.querySelector('input[name="q3"]:checked')?.value || '';
      const q4Val = document.querySelector('input[name="q4"]:checked')?.value || '';

      const p = getActiveWorksheetParams();

      return {
        studentName: name,
        studentId: id,
        studentGroup: group,
        labDate: date,
        param_mode: WS_STATE.mode,
        param_vcc: p.vcc,
        param_r1: p.r1,
        param_r2: p.r2,
        param_rc: p.rc,
        param_re: p.re,
        param_beta: p.beta,
        dc_vb: document.getElementById('dc-vb')?.value.trim() || '',
        dc_ve: document.getElementById('dc-ve')?.value.trim() || '',
        dc_vc: document.getElementById('dc-vc')?.value.trim() || '',
        dc_ie: document.getElementById('dc-ie')?.value.trim() || '',
        h_fe: document.getElementById('h-fe')?.value.trim() || '',
        h_ie: document.getElementById('h-ie')?.value.trim() || '',
        ac_av: document.getElementById('ac-av')?.value.trim() || '',
        ac_zi: document.getElementById('ac-zi')?.value.trim() || '',
        ac_zo: document.getElementById('ac-zo')?.value.trim() || '',
        ac_phase: document.getElementById('ac-phase')?.value || '',
        q1Answer: q1Val,
        q2Answer: q2Val,
        q3Answer: q3Val,
        q4Answer: q4Val,
        q1: q1Val,
        q2: q2Val,
        q3: q3Val,
        q4: q4Val,
        q1_choice: q1Val,
        q2_choice: q2Val,
        q3_choice: q3Val,
        q4_choice: q4Val,
        labConclusion: document.getElementById('lab-conclusion')?.value.trim() || ''
      };
    }

    // --- PREVIEW SCORE BEFORE SUBMISSION ---

/**
 * Appends the graded worksheet details into the Google Sheets database
 */
function recordToSheet(data, grading) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Submissions");
  
  if (!sheet) {
    sheet = ss.insertSheet("Submissions");
    const headers = [
      "Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date", "Lab Mode",
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
  
  
  var chosenModel = data.hwComponentModel || data.componentModel || data.bjtModel || data.zenerModel || '2N3904';
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
