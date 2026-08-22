/**
 * Google Apps Script Backend for Lab 10: FET/MOSFET Small-Signal Analysis & gm Model
 * Handles dynamic auto-grading, mathematical solver, and Google Sheets database logging.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ใบงานการทดลองที่ 10: แบบจำลองสัญญาณขนาดเล็กของ FET/MOSFET')
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

  // --- PART 1: DC BIAS OPERATING POINT (3 Points) ---
  const s_vg = parseFloat(data.dc_vg) || 0;
  const s_vs = parseFloat(data.dc_vs) || 0;
  const s_vgs = parseFloat(data.dc_vgs) || 0;
  const s_id = parseFloat(data.dc_id) || 0;
  const s_vd = parseFloat(data.dc_vd) || 0;
  const s_vds = parseFloat(data.dc_vds) || 0;

  const tolV = 0.35;
  const tolI = 0.40;

  const vgOk = Math.abs(s_vg - th.VG) <= tolV;
  const vsOk = Math.abs(s_vs - th.VS) <= tolV;
  const vgsOk = Math.abs(s_vgs - th.VGS) <= tolV;
  const idOk = Math.abs(s_id - th.ID) <= tolI;
  const vdOk = Math.abs(s_vd - th.VD) <= tolV;
  const vdsOk = Math.abs(s_vds - th.VDS) <= tolV;

  const dcPassCount = [vgOk, vsOk, vgsOk, idOk, vdOk, vdsOk].filter(Boolean).length;
  let p1Score = 0;
  if (dcPassCount >= 5) p1Score = 3;
  else if (dcPassCount >= 3) p1Score = 2;
  else if (dcPassCount >= 1) p1Score = 1;

  score += p1Score;
  feedback.push(`[โมเดล: ${fetModel} | โหมด: ${mode === 'fixed' ? 'Fixed Preset' : 'Custom Dynamic'}]`);
  feedback.push(`ตอนที่ 1 (DC Operating Point): ถูกต้อง ${dcPassCount}/6 จุดวัด (ได้ ${p1Score}/3 คะแนน) [ทฤษฎี: VG=${th.VG.toFixed(2)}V, VS=${th.VS.toFixed(2)}V, VGS=${th.VGS.toFixed(2)}V, ID=${th.ID.toFixed(2)}mA, VDS=${th.VDS.toFixed(2)}V]`);

  // --- PART 2: SMALL-SIGNAL gm & IMPEDANCES (3 Points) ---
  const s_gm0 = parseFloat(data.ac_gm0) || 0;
  const s_gm = parseFloat(data.ac_gm) || 0;
  const s_zi = parseFloat(data.ac_zi) || 0;
  const s_zo = parseFloat(data.ac_zo) || 0;

  const gm0Ok = Math.abs(s_gm0 - th.gm0) <= 0.40;
  const gmOk = Math.abs(s_gm - th.gm) <= 0.40;
  const ziOk = Math.abs(s_zi - th.Zi) <= (th.Zi * 0.25);
  const zoOk = Math.abs(s_zo - th.Zo) <= (th.Zo * 0.25);

  const gmPassCount = [gm0Ok, gmOk, ziOk, zoOk].filter(Boolean).length;
  let p2Score = 0;
  if (gmPassCount >= 3) p2Score = 3;
  else if (gmPassCount >= 2) p2Score = 2;
  else if (gmPassCount >= 1) p2Score = 1;

  score += p2Score;
  feedback.push(`ตอนที่ 2 (แบบจำลอง gm & อิมพีแดนซ์): ถูกต้อง ${gmPassCount}/4 ค่า (ได้ ${p2Score}/3 คะแนน) [ทฤษฎี: gm0=${th.gm0.toFixed(2)}mS, gm=${th.gm.toFixed(2)}mS, Zi=${th.Zi.toFixed(1)}kΩ, Zo=${th.Zo.toFixed(2)}kΩ]`);

  // --- PART 3: AC VOLTAGE GAIN Av & PHASE (3 Points) ---
  const s_av_bypassed = Math.abs(parseFloat(data.ac_av_bypassed) || 0);
  const s_av_unbypassed = Math.abs(parseFloat(data.ac_av_unbypassed) || 0);
  const s_phase_bypassed = parseInt(data.ac_phase_bypassed) || 0;
  const s_phase_unbypassed = parseInt(data.ac_phase_unbypassed) || 0;

  const expAvBypassed = Math.abs(th.Av_bypassed);
  const expAvUnbypassed = Math.abs(th.Av_unbypassed);

  const avBypassedOk = Math.abs(s_av_bypassed - expAvBypassed) <= (expAvBypassed * 0.35) || (s_av_bypassed > 0 && Math.abs(s_av_bypassed - (th.gm * parseFloat(params.rd))) <= 1.5);
  const avUnbypassedOk = Math.abs(s_av_unbypassed - expAvUnbypassed) <= (expAvUnbypassed * 0.35) || (s_av_unbypassed > 0 && Math.abs(s_av_unbypassed - expAvUnbypassed) <= 0.8);
  const phaseBypassedOk = s_phase_bypassed === 180;
  const phaseUnbypassedOk = s_phase_unbypassed === 180;

  const avPassCount = [avBypassedOk, avUnbypassedOk, phaseBypassedOk, phaseUnbypassedOk].filter(Boolean).length;
  let p3Score = 0;
  if (avPassCount >= 3) p3Score = 3;
  else if (avPassCount >= 2) p3Score = 2;
  else if (avPassCount >= 1) p3Score = 1;

  score += p3Score;
  feedback.push(`ตอนที่ 3 (อัตราขยายแรงดัน Av และเฟส): ถูกต้อง ${avPassCount}/4 รายการ (ได้ ${p3Score}/3 คะแนน) [ทฤษฎี: Av(มี CS)=${expAvBypassed.toFixed(2)}, Av(ไม่มี CS)=${expAvUnbypassed.toFixed(2)}, เฟสกลับ 180°]`);

  // --- PART 4: QUESTIONS & CONCLUSION (1 Point) ---
  const q1 = (data.q1Answer || '').trim();
  const q2 = (data.q2Answer || '').trim();
  const q3 = (data.q3Answer || '').trim();
  const conc = (data.labConclusion || '').trim();

  let p4Score = 0;
  if (q1.length > 5 && q2.length > 5 && q3.length > 5 && conc.length > 10) {
    p4Score = 1;
    feedback.push("คำถามท้ายการทดลองและสรุปผล: ครบถ้วนสมบูรณ์ (ได้ 1/1 คะแนน)");
  } else {
    feedback.push("คำถามท้ายการทดลองและสรุปผล: ยังตอบไม่ครบถ้วน (ได้ 0/1 คะแนน)");
  }
  score += p4Score;

  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 9) comment = "ผ่านเกณฑ์ดีมาก (Excellent)";
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
      "FET Model", "Circuit Mode", "Vdd (V)", "R1 (kΩ)", "R2 (kΩ)", "RD (kΩ)", "RS (kΩ)", "IDSS (mA)", "Vp (V)",
      "Auto Score", "Evaluation", "Feedback Summary",
      "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#bae6fd") // sky blue accent for FET small-signal
         .setBorder(true, true, true, true, true, true);
  }

  const studentEmail = Session.getActiveUser().getEmail() || "Anonymous / No Permission";

  const rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    data.fetModel || '2N5458',
    data.circuitMode || 'fixed',
    data.param_vdd,
    data.param_r1,
    data.param_r2,
    data.param_rd,
    data.param_rs,
    data.param_idss,
    data.param_vp,
    grading.score + " / " + grading.maxScore,
    grading.comment,
    grading.feedback,
    data.q1Answer,
    data.q2Answer,
    data.q3Answer,
    data.labConclusion
  ];

  sheet.appendRow(rowData);
  sheet.autoResizeColumns(1, rowData.length);
}
