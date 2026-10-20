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
 * Helper to extract circuit parameters from submitted worksheet data
 */
function getWsParamsFromData(data) {
  const isRlConn = (data.param_rl_connected !== false && data.param_rl_connected !== 'false' && data.param_rl_connected !== '0');
  return {
    vcc: parseFloat(data.param_vcc) || 12,
    r1: (parseFloat(data.param_r1) || 33) * 1000,
    r2: (parseFloat(data.param_r2) || 6.8) * 1000,
    rc1: (parseFloat(data.param_rc1) || 3.3) * 1000,
    re1: parseFloat(data.param_re1) || 680,
    r5: (parseFloat(data.param_r5) || 33) * 1000,
    r6: (parseFloat(data.param_r6) || 6.8) * 1000,
    rc2: (parseFloat(data.param_rc2) || 2.2) * 1000,
    re2: parseFloat(data.param_re2) || 560,
    rl: (parseFloat(data.param_rl) || 10) * 1000,
    rlConnected: isRlConn,
    beta: parseFloat(data.param_beta) || 200,
    ceBypass: true
  };
}

/**
 * 2-Stage Multi-Stage BJT Cascade Mathematical Solver
 */
function calcCircuit(p) {
  const vcc = p.vcc || 12;
  const r1 = p.r1 || 33000, r2 = p.r2 || 6800;
  const rc1 = p.rc1 || 3300, re1 = p.re1 || 680;
  const r5 = p.r5 || 33000, r6 = p.r6 || 6800;
  const rc2 = p.rc2 || 2200, re2 = p.re2 || 560;
  const rl = p.rl || 10000;
  const beta = p.beta || 200;
  const ceBypass = p.ceBypass !== false;
  const isLoaded = (p.rlConnected !== false && p.rlConnected !== 'false');
  const vbe = 0.70;
  
  // Stage 1 DC
  const vth1 = vcc * r2 / (r1 + r2);
  const rth1 = (r1 * r2) / (r1 + r2);
  let ib1 = Math.max(0, (vth1 - vbe) / (rth1 + (beta + 1) * re1));
  const ie1 = (beta + 1) * ib1, ic1 = beta * ib1;
  const ve1 = ie1 * re1, vb1 = ve1 + (ib1 > 0 ? vbe : 0);
  const vc1 = Math.max(0, vcc - ic1 * rc1), vce1 = vc1 - ve1;
  const ie1mA = ie1 * 1000, re1c = ie1mA > 0 ? 26 / ie1mA : 9999;
  
  // Stage 2 DC
  const vth2 = vcc * r6 / (r5 + r6);
  const rth2 = (r5 * r6) / (r5 + r6);
  let ib2 = Math.max(0, (vth2 - vbe) / (rth2 + (beta + 1) * re2));
  const ie2 = (beta + 1) * ib2, ic2 = beta * ib2;
  const ve2 = ie2 * re2, vb2 = ve2 + (ib2 > 0 ? vbe : 0);
  const vc2 = Math.max(0, vcc - ic2 * rc2), vce2 = vc2 - ve2;
  const ie2mA = ie2 * 1000, re2c = ie2mA > 0 ? 26 / ie2mA : 9999;
  
  // AC
  const zb2 = ceBypass ? beta * re2c : beta * (re2c + re2);
  const zi2 = 1 / (1 / r5 + 1 / r6 + 1 / zb2);
  const rC1eff = (rc1 * zi2) / (rc1 + zi2);
  const av1 = -(rC1eff / (re1c + re1));
  const rC2eff = isLoaded ? ((rc2 * rl) / (rc2 + rl)) : rc2;
  const av2 = ceBypass ? -(rC2eff / re2c) : -(rC2eff / (re2c + re2));
  const av_total = av1 * av2;
  const zb1 = beta * (re1c + re1);
  const zi1 = 1 / (1 / r1 + 1 / r2 + 1 / zb1);
  
  return {
    vb1, ve1, vc1, vce1, ie1mA, re1c,
    vb2, ve2, vc2, vce2, ie2mA, re2c,
    av1, av2, av_total, zi: zi1 / 1000,
    rC1eff, rC2eff, zb1, zb2, zi2,
    rlConnected: isLoaded
  };
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
 * 2-Stage Multi-Stage BJT Amplifier Small-Signal Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  let score = 0;
  const fb = [];
  const tol = (v, ref, pct, abs) => Math.abs(v - ref) <= Math.max(abs, Math.abs(ref) * pct);
  const p = getWsParamsFromData(data);
  const res = calcCircuit(p);
  
  fb.push('[โหมด]: ' + (data.circuitMode === 'custom' ? 'Custom Dynamic' : 'Fixed Preset'));
  
  // Part 1 Stage 1 (1.5 pts)
  const vb1Ok = tol(+data.dc1_vb, res.vb1, 0.15, 0.35);
  const ve1Ok = tol(+data.dc1_ve, res.ve1, 0.15, 0.35);
  const vc1Ok = tol(+data.dc1_vc, res.vc1, 0.15, 0.6);
  const ie1Ok = tol(+data.dc1_ie, res.ie1mA, 0.18, 0.4);
  const re1Ok = tol(+data.dc1_re, res.re1c, 0.20, 3);
  let s1 = 0;
  if (vb1Ok && ve1Ok && vc1Ok) s1 += 0.5;
  if (ie1Ok) s1 += 0.5;
  if (re1Ok) s1 += 0.5;
  score += s1;
  fb.push('\n[ตอนที่ 1] Stage 1 DC: ' + s1 + ' / 1.5 คะแนน');
  fb.push('  ' + (vb1Ok && ve1Ok && vc1Ok ? '✓' : '✗') + ' VB1/VE1/VC1');
  fb.push('  ' + (ie1Ok ? '✓' : '✗') + ' IE1');
  fb.push('  ' + (re1Ok ? '✓' : '✗') + ' re1');
  
  // Part 1 Stage 2 (1.5 pts)
  const vb2Ok = tol(+data.dc2_vb, res.vb2, 0.15, 0.35);
  const ve2Ok = tol(+data.dc2_ve, res.ve2, 0.15, 0.35);
  const vc2Ok = tol(+data.dc2_vc, res.vc2, 0.15, 0.6);
  const ie2Ok = tol(+data.dc2_ie, res.ie2mA, 0.18, 0.4);
  const re2Ok = tol(+data.dc2_re, res.re2c, 0.20, 3);
  let s2 = 0;
  if (vb2Ok && ve2Ok && vc2Ok) s2 += 0.5;
  if (ie2Ok) s2 += 0.5;
  if (re2Ok) s2 += 0.5;
  score += s2;
  fb.push('\n[ตอนที่ 1] Stage 2 DC: ' + s2 + ' / 1.5 คะแนน');
  fb.push('  ' + (vb2Ok && ve2Ok && vc2Ok ? '✓' : '✗') + ' VB2/VE2/VC2');
  fb.push('  ' + (ie2Ok ? '✓' : '✗') + ' IE2');
  fb.push('  ' + (re2Ok ? '✓' : '✗') + ' re2');
  
  // Part 2 AC (3 pts: 0.6 each)
  const av1Ok = tol(Math.abs(+data.ac_av1), Math.abs(res.av1), 0.30, 0.5);
  const av2Ok = tol(Math.abs(+data.ac_av2), Math.abs(res.av2), 0.30, 5);
  const avtOk = tol(Math.abs(+data.ac_avtotal), Math.abs(res.av_total), 0.30, 20);
  const ziOk = tol(+data.ac_zi, res.zi, 0.40, 0.5);
  const phOk = (data.ac_phase === '0' || data.ac_phase === '0° (In-Phase)' || data.ac_phase === '0°');
  let ac = 0;
  if (av1Ok) ac += 0.6;
  if (av2Ok) ac += 0.6;
  if (avtOk) ac += 0.6;
  if (ziOk) ac += 0.6;
  if (phOk) ac += 0.6;
  score += ac;
  fb.push('\n[ตอนที่ 2] AC: ' + ac.toFixed(1) + ' / 3 คะแนน');
  fb.push('  ' + (av1Ok ? '✓' : '✗') + ' Av1');
  fb.push('  ' + (av2Ok ? '✓' : '✗') + ' Av2');
  fb.push('  ' + (avtOk ? '✓' : '✗') + ' Av_total');
  fb.push('  ' + (ziOk ? '✓' : '✗') + ' Zi');
  fb.push('  ' + (phOk ? '✓' : '✗') + ' เฟส 0° (In-Phase)');
  
  // Part 3 MCQ (4 pts: 1 each)
  const ans = { q1: 'c', q2: 'b', q3: 'c', q4: 'd' };
  let qs = 0;
  ['q1', 'q2', 'q3', 'q4'].forEach(q => {
    const userAns = data[q + '_choice'] || data[q] || data[q + 'Answer'];
    if (userAns === ans[q]) qs++;
  });
  score += qs;
  fb.push('\n[ตอนที่ 3] คำถาม: ตอบถูก ' + qs + '/4 ข้อ (' + qs + ' คะแนน)');
  
  score = Math.round(score * 10) / 10;
  let comment = 'ต้องปรับปรุงแก้ไข';
  if (score >= 9) comment = 'ผ่านเกณฑ์ดีเยี่ยม (Excellent)';
  else if (score >= 7) comment = 'ผ่านเกณฑ์ดี (Good)';
  else if (score >= 5) comment = 'ผ่านเกณฑ์พอใช้ (Fair)';
  
  return { status: 'success', score, maxScore: 10, feedback: fb.join('\n'), comment };
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
  const isRlConn = (data.param_rl_connected !== false && data.param_rl_connected !== 'false');
  const rlSummaryText = isRlConn ? (data.param_rl || 10) + 'k' : 'ปลดออก (No-Load)';
  const paramSummary = 'Vcc=' + (data.param_vcc || 12) + 'V, R1=' + (data.param_r1 || 33) + 'k, R2=' + (data.param_r2 || 6.8) + 'k, RC1=' + (data.param_rc1 || 3.3) + 'k, RE1=' + (data.param_re1 || 680) + 'Ω, R5=' + (data.param_r5 || 33) + 'k, R6=' + (data.param_r6 || 6.8) + 'k, RC2=' + (data.param_rc2 || 2.2) + 'k, RE2=' + (data.param_re2 || 560) + 'Ω, RL=' + rlSummaryText + ', β=' + (data.param_beta || 200);
  
  var chosenModel = data.hwComponentModel || data.componentModel || data.bjtModel || data.zenerModel || '2N3904x2';
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
    data.q1_choice || data.q1,
    data.q2_choice || data.q2,
    data.q3_choice || data.q3,
    data.q4_choice || data.q4,
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
