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
function gradeWorksheet(data) {
      const isHardware = (data.labDataSource === 'hardware');
      let score = 0;
      const maxScore = 10;
      const feedback = [
        isHardware 
          ? '📌 โหมดการตรวจ: 🔌 อุปกรณ์จริง (Hardware Lab) - ปรับเกณฑ์ความคลาดเคลื่อนตามมาตรฐานอุปกรณ์จริง' 
          : '📌 โหมดการตรวจ: 🔬 ห้องทดลองจำลองเสมือน (Virtual Simulation)'
      ];

      // Diode Section (2 pts)
      let dPass = 0;
      if (data.d_pkg && data.d_pkg.includes('DO-41')) dPass++;
      if (data.d_vr && (data.d_vr.includes('50') || data.d_vr.includes('1000'))) dPass++;
      if (data.d_if && data.d_if.includes('1')) dPass++;
      if (data.d_vf && (data.d_vf.includes('1.1') || data.d_vf.includes('1.0'))) dPass++;
      let dScore = dPass >= 3 ? 2 : (dPass >= 1 ? 1 : 0);
      score += dScore;
      feedback.push(`[ตอนที่ 1] ข้อมูล Data Sheet ไดโอด: ได้ ${dScore} / 2 คะแนน (กรอกถูกต้อง ${dPass}/4 รายการ)`);

      // Transistor Section (2 pts)
      let tPass = 0;
      if (data.t_pkg && (data.t_pkg.includes('TO-92') || data.t_pkg.includes('TO-18'))) tPass++;
      if (data.t_vceo && (data.t_vceo.includes('45') || data.t_vceo.includes('25') || data.t_vceo.includes('30'))) tPass++;
      if (data.t_ic && (data.t_ic.includes('100') || data.t_ic.includes('800') || data.t_ic.includes('500'))) tPass++;
      if (data.t_hfe && (data.t_hfe.includes('110') || data.t_hfe.includes('100') || data.t_hfe.includes('200'))) tPass++;
      let tScore = tPass >= 3 ? 2 : (tPass >= 1 ? 1 : 0);
      score += tScore;
      feedback.push(`[ตอนที่ 2] ข้อมูล Data Sheet ทรานซิสเตอร์ BJT: ได้ ${tScore} / 2 คะแนน (กรอกถูกต้อง ${tPass}/4 รายการ)`);

      // MOSFET Section (2 pts)
      let mPass = 0;
      if (data.m_pkg && data.m_pkg.includes('TO-220')) mPass++;
      if (data.m_vds && (data.m_vds.includes('100') || data.m_vds.includes('50') || data.m_vds.includes('60'))) mPass++;
      if (data.m_id && (data.m_id.includes('33') || data.m_id.includes('28') || data.m_id.includes('19'))) mPass++;
      if (data.m_rds && (data.m_rds.includes('0.07') || data.m_rds.includes('0.04') || data.m_rds.includes('77'))) mPass++;
      let mScore = mPass >= 3 ? 2 : (mPass >= 1 ? 1 : 0);
      score += mScore;
      feedback.push(`[ตอนที่ 3] ข้อมูล Data Sheet เพาเวอร์มอสเฟต: ได้ ${mScore} / 2 คะแนน (กรอกถูกต้อง ${mPass}/4 รายการ)`);

      // Part 4: MCQ (4 pts)
      const ansQ1 = (data.q1Answer || data.q1 || '').trim().toUpperCase();
      const ansQ2 = (data.q2Answer || data.q2 || '').trim().toUpperCase();
      const ansQ3 = (data.q3Answer || data.q3 || '').trim().toUpperCase();
      const ansQ4 = (data.q4Answer || data.q4 || '').trim().toUpperCase();

      let qScore = 0;
      const q1Ok = (ansQ1 === 'B');
      const q2Ok = (ansQ2 === 'B');
      const q3Ok = (ansQ3 === 'A');
      const q4Ok = (ansQ4 === 'A');

      if (q1Ok) qScore++;
      if (q2Ok) qScore++;
      if (q3Ok) qScore++;
      if (q4Ok) qScore++;
      score += qScore;
      feedback.push(`\n[ตอนที่ 4] คำถามวัดความเข้าใจท้ายการทดลอง: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} / 4 คะแนน)`);
      feedback.push(`  ข้อ 1: ${q1Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ1 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 2: ${q2Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ2 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 3: ${q3Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ3 ? '✗ ไม่ถูกต้อง (เฉลย A)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 4: ${q4Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ4 ? '✗ ไม่ถูกต้อง (เฉลย A)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);

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

    function previewScoreBeforeSubmit() {
      const payload = getWorksheetPayload();
      const res = localGradeSimulator(payload);

      const overlay = document.getElementById('submission-overlay');
      const card = overlay.querySelector('.modal-card') || overlay.querySelector('.card');
      const spinner = document.getElementById('modal-spinner');
      const title = document.getElementById('modal-title');
      const body = document.getElementById('modal-body');
      const closeBtn = document.getElementById('modal-close-btn');
      const confirmBtn = document.getElementById('modal-confirm-submit-btn');

      if (card) {
        card.style.borderColor = 'var(--accent-cyan)';
        card.style.boxShadow = '0 0 35px rgba(56, 189, 248, 0.35)';
      }
      spinner.style.display = 'none';
      title.innerText = '🔍 ตรวจสอบคะแนนก่อนส่ง (Score Preview)';
      title.style.color = 'var(--accent-cyan)';

      let scoreColor = 'var(--accent-green)';
      if (res.score < 5) scoreColor = 'var(--accent-red)';
      else if (res.score < 7) scoreColor = 'var(--accent-yellow)';
      else if (res.score < 9) scoreColor = 'var(--accent-cyan)';

      const formattedFeedback = res.feedback.replace(/\n/g, '<br>');

      body.innerHTML = `
        <div style="background: rgba(56, 189, 248, 0.1); border: 1px dashed var(--accent-cyan); border-radius: 8px; padding: 10px 14px; margin-bottom: 15px; color: var(--accent-cyan); font-size: 13px; text-align: left;">
          ℹ️ <strong>โหมดทดลองตรวจคำตอบ:</strong> รายละเอียดคะแนนด้านล่างเป็นผลประเมินเบื้องต้น <u>ยังไม่ได้บันทึกส่ง</u> ข้อมูลเข้า Google Sheets ของผู้สอน
        </div>
        <div style="text-align: left; background: rgba(15,23,42,0.7); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin: 12px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 16px; font-weight: bold; color: var(--text-main);">คะแนนประเมินที่ได้:</span>
            <span style="font-size: 24px; font-weight: bold; color: ${scoreColor};">${res.score} / ${res.maxScore}</span>
          </div>
          <p style="font-size: 13px; font-weight: bold; margin-bottom: 12px; color: var(--accent-cyan);">
            ระดับผลการประเมิน: ${res.comment}
          </p>
          <hr style="border: 0; border-top: 1px solid var(--border-color); margin-bottom: 12px;">
          <p style="font-size: 12px; font-weight: bold; color: var(--text-muted); margin-bottom: 6px;">📋 รายละเอียดการตรวจสอบข้อคำตอบ:</p>
          <div style="font-size: 12px; font-family: 'Sarabun', sans-serif; line-height: 1.8; color: var(--text-main); max-height: 220px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">${formattedFeedback}</div>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">
          💡 หากต้องการแก้ไข สามารถกด <strong>"✏️ กลับไปแก้ไขคำตอบ"</strong> หรือกด <strong>"🚀 ยืนยันส่งใบงานจริง"</strong> ได้ทันที
        </p>
      `;

      closeBtn.innerText = '✏️ กลับไปแก้ไขคำตอบ';
      closeBtn.style.display = 'inline-block';
      if (confirmBtn) confirmBtn.style.display = 'inline-block';

      overlay.style.display = 'flex';
    }

    function confirmSubmitFromPreview() {
      closeModal();
      submitReportToGAS();
    }

    // --- SUBMISSION TO GOOGLE APPS SCRIPT ---
    function submitReportToGAS() {
      const payload = getWorksheetPayload();

      if (!payload.studentName || !payload.studentId || !payload.studentGroup || !payload.labDate) {
        alert('⚠️ กรุณากรอกข้อมูลส่วนตัว (ชื่อ-นามสกุล, รหัสนักศึกษา, กลุ่ม และวันที่) ให้ครบถ้วนก่อนส่งใบงาน!');
        switchTab('worksheet');
        document.getElementById('student-name')?.focus();
        return;
      }

      // Show Loading Modal
      const overlay = document.getElementById('submission-overlay');
      const card = overlay.querySelector('.modal-card') || overlay.querySelector('.card');
      const spinner = document.getElementById('modal-spinner');
      const title = document.getElementById('modal-title');
      const body = document.getElementById('modal-body');
      const closeBtn = document.getElementById('modal-close-btn');
      const confirmBtn = document.getElementById('modal-confirm-submit-btn');

      if (card) {
        card.style.borderColor = 'var(--accent-cyan)';
        card.style.boxShadow = '0 0 35px rgba(56, 189, 248, 0.35)';
      }
      overlay.style.display = 'flex';
      spinner.style.display = 'block';
      title.innerText = '🚀 กำลังส่งใบงานและตรวจคำตอบ...';
      title.style.color = 'var(--accent-cyan)';
      body.innerHTML = 'ระบบกำลังส่งข้อมูลไปยัง Google Apps Script และประมวลผลคะแนนอัตโนมัติ...';
      closeBtn.style.display = 'none';
      if (confirmBtn) confirmBtn.style.display = 'none';

      // Check if running inside Google Apps Script
      if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(onSuccessGrading)
      .withFailureHandler(onFailureGrading)
      .submitWorksheet(data);
  } else {
    const endpointUrl = typeof getSavedGasEndpoint === 'function' ? getSavedGasEndpoint() : '';
    if (endpointUrl && endpointUrl.startsWith('http')) {
      fetch(endpointUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      })
      .then(r => r.json())
      .then(res => {
        if (res && (res.status === 'success' || res.score !== undefined)) {
          onSuccessGrading(res);
        } else {
          throw new Error(res.message || 'Error recording submission');
        }
      })
      .catch(err => {
        console.warn('GAS Fetch failed, falling back to local simulation:', err);
        const localRes = localGradeSimulator(data);
        localRes.feedback = (localRes.feedback || '') + `\n\n⚠️ หมายเหตุ: บันทึกข้อมูลผ่าน Web App ไม่สำเร็จ (${err.message}) ระบบจึงทำการตรวจประเมินแบบจำลองในเครื่องให้แทน`;
        onSuccessGrading(localRes);
      });
    } else {
      setTimeout(() => {
        const localRes = localGradeSimulator(data);
        onSuccessGrading(localRes);
      }, 800);
    }
  }
}

/**
 * Appends the graded worksheet details into the Google Sheets database
 */
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
