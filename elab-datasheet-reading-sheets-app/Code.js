/**
 * Google Apps Script Backend for Electronic Component Datasheet Reading Lab
 * Handles Web App rendering, dynamic datasheet ground truth evaluation, auto-grading, and logging.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ใบงานการทดลอง: การอ่าน Data Sheet ของอุปกรณ์อิเล็กทรอนิกส์')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// -------------------------------------------------------------
// 1. GROUND TRUTH DATABASE FOR 10 POPULAR SEMICONDUCTORS
// -------------------------------------------------------------
var DATASHEET_DB = {
  // --- DIODES ---
  '1N4007': {
    category: 'Diode',
    type: 'Rectifier Diode (ซิลิคอนไดโอดเรียงกระแส)',
    package: 'DO-41',
    vrrm: 1000,    // V
    if_avg: 1.0,   // A
    vf_max: 1.1,   // V @ 1A
    ir_max: 5.0,   // uA @ 1000V
    pd: 3.0,       // W or N/A
    trr: 'N/A'     // Standard recovery (~2us)
  },
  '1N4148': {
    category: 'Diode',
    type: 'High-Speed Switching Diode (ไดโอดสวิตชิ่งความเร็วสูง)',
    package: 'DO-35',
    vrrm: 100,     // V
    if_avg: 0.2,   // A (200mA) / 0.15 - 0.3A
    vf_max: 1.0,   // V @ 10mA
    ir_max: 0.025, // uA (25nA) @ 20V (or 5uA @ 75V)
    pd: 0.5,       // W (500mW)
    trr: 4.0       // ns
  },
  '1N4733A': {
    category: 'Diode',
    type: 'Zener Diode 5.1V (ซีเนอร์ไดโอดรักษาระดับแรงดัน)',
    package: 'DO-41',
    vrrm: 5.1,     // V (Vz nominal)
    if_avg: 1.0,   // A / Izt = 49mA
    vf_max: 1.2,   // V @ 200mA
    ir_max: 10.0,  // uA @ 1V
    pd: 1.0,       // W (1000mW)
    trr: 'N/A'
  },

  // --- BJT TRANSISTORS ---
  '2N2222A': {
    category: 'BJT',
    type: 'NPN',
    package: 'TO-92 / TO-18',
    pinout: 'E-B-C (1:E, 2:B, 3:C)',
    vceo: 40,      // V
    vcbo: 75,      // V
    ic_max: 0.8,   // A (800mA)
    hfe_min: 100,  // @ 150mA (100 - 300)
    hfe_max: 300,
    vce_sat: 0.3,  // V @ 150mA
    pd: 0.625,     // W (625mW)
    ft: 300        // MHz
  },
  '2N3904': {
    category: 'BJT',
    type: 'NPN',
    package: 'TO-92',
    pinout: 'E-B-C (1:E, 2:B, 3:C)',
    vceo: 40,      // V
    vcbo: 60,      // V
    ic_max: 0.2,   // A (200mA)
    hfe_min: 100,  // @ 10mA (100 - 300)
    hfe_max: 300,
    vce_sat: 0.2,  // V @ 10mA
    pd: 0.625,     // W (625mW)
    ft: 300        // MHz
  },
  'BC547': {
    category: 'BJT',
    type: 'NPN',
    package: 'TO-92',
    pinout: 'C-B-E (1:C, 2:B, 3:E)',
    vceo: 45,      // V
    vcbo: 50,      // V
    ic_max: 0.1,   // A (100mA)
    hfe_min: 110,  // 110 - 800 (BC547B: 200-450)
    hfe_max: 800,
    vce_sat: 0.25, // V @ 10mA
    pd: 0.5,       // W (500mW)
    ft: 300        // MHz
  },
  'BD139': {
    category: 'BJT',
    type: 'NPN',
    package: 'TO-126',
    pinout: 'E-C-B (1:E, 2:C, 3:B)',
    vceo: 80,      // V
    vcbo: 80,      // V
    ic_max: 1.5,   // A (1500mA)
    hfe_min: 40,   // 40 - 250
    hfe_max: 250,
    vce_sat: 0.5,  // V @ 500mA
    pd: 12.5,      // W (with heatsink) / 1.25W ambient
    ft: 190        // MHz
  },

  // --- MOSFET / FET ---
  '2N7000': {
    category: 'MOSFET',
    type: 'N-Channel Enhancement MOSFET',
    package: 'TO-92',
    pinout: 'S-G-D (1:S, 2:G, 3:D)',
    vdss: 60,      // V
    id_max: 0.2,   // A (200mA)
    vgsth_min: 0.8,// V (0.8 - 3.0V)
    vgsth_max: 3.0,
    rdson: 5.0,    // Ohms @ 10V (1.2 - 5.0 Ohm)
    gfs: 320,      // mS (0.32 S)
    pd: 0.4        // W (400mW)
  },
  'IRF540N': {
    category: 'MOSFET',
    type: 'N-Channel Power MOSFET',
    package: 'TO-220AB',
    pinout: 'G-D-S (1:G, 2:D, 3:S, Tab:D)',
    vdss: 100,     // V
    id_max: 33.0,  // A @ 25C
    vgsth_min: 2.0,// V (2.0 - 4.0V)
    vgsth_max: 4.0,
    rdson: 0.044,  // Ohms (44 mOhm)
    gfs: 21.0,     // S (21000 mS)
    pd: 130.0      // W
  },
  '2N5458': {
    category: 'JFET',
    type: 'N-Channel JFET',
    package: 'TO-92',
    pinout: 'D-S-G (1:D, 2:S, 3:G)',
    vdss: 25,      // V (Vds / Vdg)
    id_max: 0.009, // A (Idss: 2 - 9mA)
    vgsth_min: -7.0, // V (Vp: -1.0 to -7.0V)
    vgsth_max: -1.0,
    rdson: 400,    // Ohms (rds)
    gfs: 1500,     // uS (1.5 - 5.5 mS)
    pd: 0.31       // W (310mW)
  }
};

// -------------------------------------------------------------
// 2. SUBMIT & DYNAMIC AUTO-GRADING HANDLER
// -------------------------------------------------------------
function submitWorksheet(data) {
  try {
    // 0. Check duplicate submission
    const duplicateCheck = checkDuplicateSubmission("Submissions", 3, data.studentId);
    if (duplicateCheck) {
      return duplicateCheck;
    }

    var grading = gradeDatasheetWorksheet(data);
    logToGoogleSheet(data, grading);
    return {
      status: 'success',
      score: grading.score,
      maxScore: grading.maxScore,
      percentage: grading.percentage,
      feedback: grading.feedback,
      comment: grading.comment
    };
  } catch (err) {
    return {
      status: 'error',
      message: err.toString()
    };
  }
}

// -------------------------------------------------------------
// 3. AUTO-GRADING RUBRIC ENGINE (10 POINTS TOTAL)
// -------------------------------------------------------------
function gradeDatasheetWorksheet(data) {
  const isHardware = (data.labDataSource === 'hardware');
  var score = 0;
  var feedbackLog = [];
  feedbackLog.push(isHardware 
    ? '📌 โหมดการตรวจ: 🔌 อุปกรณ์จริง (Hardware Lab) - ปรับเกณฑ์ความคลาดเคลื่อนตามมาตรฐานอุปกรณ์จริง' 
    : '📌 โหมดการตรวจ: 🔬 ห้องทดลองจำลองเสมือน (Virtual Simulation)');

  var diodeModel = data.diodeModel || '1N4007';
  var bjtModel = data.bjtModel || '2N3904';
  var mosfetModel = data.mosfetModel || '2N7000';

  var gtDiode = DATASHEET_DB[diodeModel] || DATASHEET_DB['1N4007'];
  var gtBjt = DATASHEET_DB[bjtModel] || DATASHEET_DB['2N3904'];
  var gtMos = DATASHEET_DB[mosfetModel] || DATASHEET_DB['2N7000'];

  // PART 1: DIODE EXTRACTION (2.5 pts)
  var dScore = 0;
  // Package
  if (data.d_pkg && (data.d_pkg.toUpperCase().indexOf(gtDiode.package.split('/')[0].trim().toUpperCase()) !== -1 || data.d_pkg.toUpperCase().indexOf('DO') !== -1)) {
    dScore += 0.5;
  }
  // VRRM / PIV (Tolerance +-20% or match)
  var d_vrrm = parseFloat(data.d_vrrm);
  if (!isNaN(d_vrrm) && Math.abs(d_vrrm - gtDiode.vrrm) / gtDiode.vrrm <= 0.2) {
    dScore += 0.5;
  }
  // IF(avg) (Accept A or mA correctly within tolerance)
  var d_if = parseFloat(data.d_if);
  var gtIf = gtDiode.if_avg;
  if (!isNaN(d_if) && (Math.abs(d_if - gtIf) <= 0.3 || Math.abs(d_if - gtIf * 1000) <= 300)) {
    dScore += 0.5;
  }
  // VF(max)
  var d_vf = parseFloat(data.d_vf);
  if (!isNaN(d_vf) && Math.abs(d_vf - gtDiode.vf_max) <= 0.35) {
    dScore += 0.5;
  }
  // IR(max) or PD
  var d_ir = parseFloat(data.d_ir);
  if (!isNaN(d_ir) && d_ir > 0) {
    dScore += 0.5;
  }
  score += dScore;
  feedbackLog.push('ตอนที่ 1 (Diode: ' + diodeModel + '): ได้ ' + dScore.toFixed(1) + ' / 2.5 คะแนน');

  // PART 2: BJT EXTRACTION (2.5 pts)
  var bScore = 0;
  // Type NPN/PNP
  if (data.b_type && data.b_type.toUpperCase().indexOf(gtBjt.type) !== -1) {
    bScore += 0.5;
  }
  // VCEO
  var b_vceo = parseFloat(data.b_vceo);
  if (!isNaN(b_vceo) && Math.abs(b_vceo - gtBjt.vceo) / gtBjt.vceo <= 0.2) {
    bScore += 0.5;
  }
  // IC(max)
  var b_ic = parseFloat(data.b_ic);
  if (!isNaN(b_ic) && (Math.abs(b_ic - gtBjt.ic_max) <= 0.3 || Math.abs(b_ic - gtBjt.ic_max * 1000) <= 300)) {
    bScore += 0.5;
  }
  // hFE (min/max)
  var b_hfe = parseFloat(data.b_hfe);
  if (!isNaN(b_hfe) && b_hfe >= (gtBjt.hfe_min * 0.7) && b_hfe <= (gtBjt.hfe_max * 1.3)) {
    bScore += 0.5;
  }
  // VCE(sat) or PD
  var b_vcesat = parseFloat(data.b_vcesat);
  if (!isNaN(b_vcesat) && b_vcesat > 0 && b_vcesat <= 1.0) {
    bScore += 0.5;
  }
  score += bScore;
  feedbackLog.push('ตอนที่ 2 (BJT: ' + bjtModel + '): ได้ ' + bScore.toFixed(1) + ' / 2.5 คะแนน');

  // PART 3: MOSFET / FET EXTRACTION (2.5 pts)
  var mScore = 0;
  // Type (N-Ch / P-Ch)
  if (data.m_type && data.m_type.toUpperCase().indexOf('N') !== -1) {
    mScore += 0.5;
  }
  // VDSS
  var m_vdss = parseFloat(data.m_vdss);
  if (!isNaN(m_vdss) && Math.abs(m_vdss - gtMos.vdss) / gtMos.vdss <= 0.2) {
    mScore += 0.5;
  }
  // ID(max)
  var m_id = parseFloat(data.m_id);
  if (!isNaN(m_id) && (Math.abs(m_id - gtMos.id_max) <= 5.0 || Math.abs(m_id - gtMos.id_max * 1000) <= 300)) {
    mScore += 0.5;
  }
  // VGS(th)
  var m_vgsth = parseFloat(data.m_vgsth);
  if (!isNaN(m_vgsth) && Math.abs(m_vgsth) >= Math.abs(gtMos.vgsth_min * 0.7) && Math.abs(m_vgsth) <= Math.abs(gtMos.vgsth_max * 1.4)) {
    mScore += 0.5;
  }
  // RDS(on) or gfs
  var m_rdson = parseFloat(data.m_rdson);
  if (!isNaN(m_rdson) && m_rdson > 0) {
    mScore += 0.5;
  }
  score += mScore;
  feedbackLog.push('ตอนที่ 3 (MOSFET: ' + mosfetModel + '): ได้ ' + mScore.toFixed(1) + ' / 2.5 คะแนน');

  // PART 4 & 5: QUESTIONS & CONCLUSION (2.5 pts)
  var qScore = 0;
  if (data.q1Answer && data.q1Answer.trim().length >= 10) qScore += 0.5;
  if (data.q2Answer && data.q2Answer.trim().length >= 10) qScore += 0.5;
  if (data.q3Answer && data.q3Answer.trim().length >= 10) qScore += 0.5;
  if (data.q4Answer && data.q4Answer.trim().length >= 10) qScore += 0.5;
  if (data.labConclusion && data.labConclusion.trim().length >= 15) qScore += 0.5;
  score += qScore;
  feedbackLog.push('ตอนที่ 4 & 5 (คำถามและสรุปผล): ได้ ' + qScore.toFixed(1) + ' / 2.5 คะแนน');

  var finalScore = Math.min(10, Math.round(score * 10) / 10);
  var percentage = (finalScore / 10) * 100;

  var comment = 'ผ่านเกณฑ์ดีมาก (Excellent)';
  if (finalScore < 5) comment = 'ควรทบทวนและฝึกอ่านค่า Data Sheet เพิ่มเติม (Needs Improvement)';
  else if (finalScore < 7.5) comment = 'ผ่านเกณฑ์ระดับพอใช้ (Fair)';
  else if (finalScore < 9.0) comment = 'ผ่านเกณฑ์ระดับดี (Good)';

  return {
    score: finalScore,
    maxScore: 10,
    percentage: percentage,
    comment: comment,
    feedback: feedbackLog.join('\n')
  };
}

// -------------------------------------------------------------
// 4. GOOGLE SHEETS LOGGING
// -------------------------------------------------------------
function logToGoogleSheet(data, grading) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = 'Submissions';
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      'Timestamp',
      'Student Name',
      'Student ID',
      'Group',
      'Lab Date', 'Lab Mode',
      'Worksheet Mode',
      'Diode Model',
      'BJT Model',
      'MOSFET Model',
      'Diode VRRM (V)',
      'Diode IF (A)',
      'Diode VF (V)',
      'BJT Type',
      'BJT VCEO (V)',
      'BJT IC (A)',
      'BJT hFE',
      'MOSFET VDSS (V)',
      'MOSFET ID (A)',
      'MOSFET VGS(th) (V)',
      'MOSFET RDS(on) (Ω)',
      'Score (10)',
      'Comment',
      'Feedback Log',
      'Q1 Answer',
      'Q2 Answer',
      'Q3 Answer',
      'Q4 Answer',
      'Lab Conclusion'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#0f172a')
      .setFontColor('#38bdf8');
  }

  
  var chosenModel = data.hwComponentModel || data.componentModel || data.bjtModel || data.zenerModel || 'SET-STD';
  var labModeText = (data.labDataSource === 'hardware')
    ? '🔌 ฮาร์ดแวร์จริง (' + chosenModel + ')'
    : '🔬 ซิมูเลเตอร์ (' + chosenModel + ')';

  var rowData = [
    new Date(),
    data.studentName || 'ไม่ระบุชื่อ',
    data.studentId || 'ไม่ระบุรหัส',
    data.studentGroup || 'Group 1',
    data.labDate || new Date().toISOString().split('T')[0],
    data.worksheetMode || 'fixed',
    data.diodeModel || '1N4007',
    data.bjtModel || '2N3904',
    data.mosfetModel || '2N7000',
    data.d_vrrm || '',
    data.d_if || '',
    data.d_vf || '',
    data.b_type || '',
    data.b_vceo || '',
    data.b_ic || '',
    data.b_hfe || '',
    data.m_vdss || '',
    data.m_id || '',
    data.m_vgsth || '',
    data.m_rdson || '',
    grading.score + ' / ' + grading.maxScore,
    grading.comment,
    grading.feedback,
    data.q1Answer || '',
    data.q2Answer || '',
    data.q3Answer || '',
    data.q4Answer || '',
    data.labConclusion || ''
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
