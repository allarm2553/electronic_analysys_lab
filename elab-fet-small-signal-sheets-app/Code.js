/**
 * Google Apps Script Backend for Lab 10: FET/MOSFET Small-Signal Analysis & gm Model
 * Handles dynamic auto-grading, mathematical solver, and Google Sheets database logging.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ใบงานการทดลองที่ 10: แบบจำลองสัญญาณขนาดเล็กของ FET/MOSFET (gm-Model)')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

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

function solveFetDCOperatingPoint(p) {
  const Vdd = parseFloat(p.vdd) || 18.0;
  const R1 = parseFloat(p.r1) || 2200.0; // kOhms
  const R2 = parseFloat(p.r2) || 270.0;  // kOhms
  const RD = parseFloat(p.rd) || 2.2;    // kOhms
  const RS = parseFloat(p.rs) || 1.0;    // kOhms
  const Idss = parseFloat(p.idss) || 6.0;// mA
  const Vp = parseFloat(p.vp) || -3.5;   // V (negative for N-channel JFET)
  const absVp = Math.abs(Vp);

  // Thevenin Gate Voltage
  const VG = Vdd * (R2 / (R1 + R2));

  // Solve ID from Shockley + Self Bias loadline: ID = Idss * (1 - (VG - ID * RS)/Vp)^2
  let low = 0;
  let high = Idss;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const Vgs = VG - (mid * RS); // V
    if (Vgs <= Vp) {
      high = mid;
      continue;
    }
    const Id_calc = Idss * Math.pow(1 - (Vgs / Vp), 2);
    if (Id_calc > mid) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const ID = low; // mA
  const VS = ID * RS;
  const VGS = VG - VS;
  const VD = Vdd - (ID * RD);
  const VDS = VD - VS;

  // Transconductance (gm0 and gm)
  const gm0 = (2 * Idss) / absVp; // mS
  const gm = gm0 * (1 - (VGS / Vp)); // mS

  // Input & Output Impedance
  const Zi = (R1 * R2) / (R1 + R2); // kOhms
  const rd = 40.0; // kOhms default
  const Zo = (RD * rd) / (RD + rd); // kOhms

  // Voltage Gains
  // 1. With CS (Bypassed)
  const Av_bypassed = -gm * Zo;
  // 2. Without CS (Unbypassed)
  const Av_unbypassed = (-gm * RD) / (1 + (gm * RS));

  return {
    VG, VS, VGS, ID, VD, VDS,
    gm0, gm, Zi, Zo,
    Av_bypassed, Av_unbypassed
  };
}

function gradeWorksheet(data) {
  let score = 0;
  const maxScore = 10;
  const feedback = [];

  const mode = data.circuitMode || 'fixed';
  const fetModel = data.fetModel || '2N5458';

  const params = {
    vdd: data.param_vdd,
    r1: data.param_r1,
    r2: data.param_r2,
    rd: data.param_rd,
    rs: data.param_rs,
    idss: data.param_idss,
    vp: data.param_vp
  };

  const th = solveFetDCOperatingPoint(params);

  const modeLabel = mode === 'custom' ? 'โหมดกำหนดค่าเอง (Custom Dynamic)' : 'โหมดค่ามาตรฐาน (Fixed Preset)';
  feedback.push(`[ระบบโหมดการทดลอง]: ${modeLabel} (เบอร์ FET: ${fetModel})`);
  feedback.push(`  (พารามิเตอร์: VDD=${params.vdd}V, R1=${params.r1}k, R2=${params.r2}k, RD=${params.rd}k, RS=${params.rs}k, IDSS=${params.idss}mA, VP=${params.vp}V)`);

  // --- PART 1: DC BIAS & gm EXTRACTION (3 Points) ---
  const s_vg = parseFloat(data.dc_vg) || 0;
  const s_vs = parseFloat(data.dc_vs) || 0;
  const s_vgs = parseFloat(data.dc_vgs) || 0;
  const s_id = parseFloat(data.dc_id) || 0;
  const s_vd = parseFloat(data.dc_vd) || 0;
  const s_vds = parseFloat(data.dc_vds) || 0;
  const s_gm0 = parseFloat(data.ac_gm0) || 0;
  const s_gm = parseFloat(data.ac_gm) || 0;

  const tolV = 0.35;
  const tolI = 0.40;

  const vgOk = Math.abs(s_vg - th.VG) <= tolV;
  const vsOk = Math.abs(s_vs - th.VS) <= tolV;
  const vgsOk = Math.abs(s_vgs - th.VGS) <= tolV;
  const idOk = Math.abs(s_id - th.ID) <= tolI;
  const vdOk = Math.abs(s_vd - th.VD) <= tolV;
  const vdsOk = Math.abs(s_vds - th.VDS) <= tolV;
  const gm0Ok = Math.abs(s_gm0 - th.gm0) <= 0.40;
  const gmOk = Math.abs(s_gm - th.gm) <= 0.40;

  const dcPassCount = [vgOk, vsOk, vgsOk, idOk, vdOk, vdsOk, gm0Ok, gmOk].filter(Boolean).length;
  let p1Score = 0;
  if (dcPassCount >= 7) p1Score = 3;
  else if (dcPassCount >= 4) p1Score = 2;
  else if (dcPassCount >= 2) p1Score = 1;

  score += p1Score;
  feedback.push(`\n[ตอนที่ 1] จุดทำงาน DC และค่าความนำข้าม gm: ได้ ${p1Score} / 3 คะแนน (ถูกต้อง ${dcPassCount}/8 ค่า)`);
  feedback.push(`  (ทฤษฎี: VG=${th.VG.toFixed(2)}V, VS=${th.VS.toFixed(2)}V, VGS=${th.VGS.toFixed(2)}V, ID=${th.ID.toFixed(2)}mA, VDS=${th.VDS.toFixed(2)}V, gm0=${th.gm0.toFixed(2)}mS, gm=${th.gm.toFixed(2)}mS)`);

  // --- PART 2: AC SMALL-SIGNAL PERFORMANCE (3 Points) ---
  const s_av_bypassed = Math.abs(parseFloat(data.ac_av_bypassed) || 0);
  const s_av_unbypassed = Math.abs(parseFloat(data.ac_av_unbypassed) || 0);
  const s_zi_bypassed = parseFloat(data.ac_zi_bypassed) || 0;
  const s_zo_bypassed = parseFloat(data.ac_zo_bypassed) || 0;
  const s_phase_bypassed = parseInt(data.ac_phase_bypassed) || 0;
  const s_phase_unbypassed = parseInt(data.ac_phase_unbypassed) || 0;

  const expAvBypassed = Math.abs(th.Av_bypassed);
  const expAvUnbypassed = Math.abs(th.Av_unbypassed);

  const avBypassedOk = Math.abs(s_av_bypassed - expAvBypassed) <= (expAvBypassed * 0.35) || (s_av_bypassed > 0 && Math.abs(s_av_bypassed - (th.gm * parseFloat(params.rd))) <= 1.5);
  const avUnbypassedOk = Math.abs(s_av_unbypassed - expAvUnbypassed) <= (expAvUnbypassed * 0.35) || (s_av_unbypassed > 0 && Math.abs(s_av_unbypassed - expAvUnbypassed) <= 0.8);
  const ziOk = Math.abs(s_zi_bypassed - th.Zi) <= (th.Zi * 0.30);
  const zoOk = Math.abs(s_zo_bypassed - th.Zo) <= (th.Zo * 0.30);
  const phaseBypassedOk = s_phase_bypassed === 180;
  const phaseUnbypassedOk = s_phase_unbypassed === 180;

  const acPassCount = [avBypassedOk, avUnbypassedOk, ziOk, zoOk, phaseBypassedOk, phaseUnbypassedOk].filter(Boolean).length;
  let p2Score = 0;
  if (acPassCount >= 5) p2Score = 3;
  else if (acPassCount >= 3) p2Score = 2;
  else if (acPassCount >= 1) p2Score = 1;

  score += p2Score;
  feedback.push(`\n[ตอนที่ 2] การทดสอบวงจรขยายสัญญาณ AC: ได้ ${p2Score} / 3 คะแนน (ถูกต้อง ${acPassCount}/6 ค่า)`);
  feedback.push(`  (ทฤษฎี: Av(มี CS)=${expAvBypassed.toFixed(2)}, Av(ไม่มี CS)=${expAvUnbypassed.toFixed(2)}, Zi=${th.Zi.toFixed(1)}kΩ, Zo=${th.Zo.toFixed(2)}kΩ, เฟสกลับ 180°)`);

  // --- PART 3: POST-LAB CONCEPTUAL ASSESSMENT (4 Points) ---
  const q1 = (data.q1Answer || '').trim().toLowerCase();
  const q2 = (data.q2Answer || '').trim().toLowerCase();
  const q3 = (data.q3Answer || '').trim().toLowerCase();
  const q4 = (data.q4Answer || '').trim().toLowerCase();

  let qScore = 0;
  const q1Correct = q1 === 'a';
  const q2Correct = q2 === 'b';
  const q3Correct = q3 === 'a';
  const q4Correct = q4 === 'b';

  if (q1Correct) qScore++;
  if (q2Correct) qScore++;
  if (q3Correct) qScore++;
  if (q4Correct) qScore++;

  score += qScore;
  feedback.push(`\n[ตอนที่ 3] คำถามวัดความเข้าใจท้ายการทดลอง: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} คะแนน)`);
  feedback.push(`  ข้อ 1 (ความหมายและสูตรคำนวณ gm): ${q1Correct ? '✓ ถูกต้อง' : '✗ ไม่ถูกต้อง (เฉลย ก.)'}`);
  feedback.push(`  ข้อ 2 (ค่าความนำข้ามสูงสุด gm0): ${q2Correct ? '✓ ถูกต้อง' : '✗ ไม่ถูกต้อง (เฉลย ข.)'}`);
  feedback.push(`  ข้อ 3 (ผลของการบายพาส CS ขนาน RS): ${q3Correct ? '✓ ถูกต้อง' : '✗ ไม่ถูกต้อง (เฉลย ก.)'}`);
  feedback.push(`  ข้อ 4 (ข้อได้เปรียบเด่น FET ด้าน Zi เทียบ BJT): ${q4Correct ? '✓ ถูกต้อง' : '✗ ไม่ถูกต้อง (เฉลย ข.)'}`);

  // Evaluation Comment
  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 9) comment = "ผ่านเกณฑ์ดีเยี่ยม (Excellent)";
  else if (score >= 7) comment = "ผ่านเกณฑ์ดี (Good)";
  else if (score >= 5) comment = "ผ่านเกณฑ์พอใช้ (Fair)";

  return {
    score,
    maxScore,
    feedback: feedback.join('\n'),
    comment
  };
}

function recordToSheet(data, grading) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Submissions");

  if (!sheet) {
    sheet = ss.insertSheet("Submissions");
    const headers = [
      "Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date",
      "Auto Score", "Evaluation", "Circuit Mode", "Circuit Params",
      "DC VG (V)", "DC VS (V)", "DC VGS (V)", "DC ID (mA)", "DC VD (V)", "DC VDS (V)",
      "Extracted gm0 (mS)", "Extracted gm (mS)",
      "Av (Bypassed)", "Av (Unbypassed)", "Zi (kΩ)", "Zo (kΩ)", "Phase (°)",
      "Q1 Ans", "Q2 Ans", "Q3 Ans", "Q4 Ans", "Feedback Summary", "Lab Conclusion"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#38bdf8")
         .setFontColor("#000000")
         .setBorder(true, true, true, true, true, true);
  }

  const studentEmail = Session.getActiveUser().getEmail() || "Anonymous / Local User";
  const paramSummary = `VDD=${data.param_vdd}V, R1=${data.param_r1}k, R2=${data.param_r2}k, RD=${data.param_rd}k, RS=${data.param_rs}k, IDSS=${data.param_idss}mA, VP=${data.param_vp}V (Model: ${data.fetModel || '2N5458'})`;

  const rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    grading.score + " / " + grading.maxScore,
    grading.comment,
    data.circuitMode === 'custom' ? 'Custom Dynamic' : 'Fixed Preset',
    paramSummary,
    data.dc_vg,
    data.dc_vs,
    data.dc_vgs,
    data.dc_id,
    data.dc_vd,
    data.dc_vds,
    data.ac_gm0,
    data.ac_gm,
    data.ac_av_bypassed,
    data.ac_av_unbypassed,
    data.ac_zi_bypassed,
    data.ac_zo_bypassed,
    data.ac_phase_bypassed,
    data.q1Answer,
    data.q2Answer,
    data.q3Answer,
    data.q4Answer,
    grading.feedback,
    data.labConclusion
  ];

  sheet.appendRow(rowData);
  sheet.autoResizeColumns(1, rowData.length);
}
