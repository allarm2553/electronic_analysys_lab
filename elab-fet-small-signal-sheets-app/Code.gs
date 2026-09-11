/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Lab 10: FET/MOSFET Small-Signal Analysis using gm Model
 * Handles HTML page serving, form submissions, dynamic mathematical auto-grading, and Google Sheets DB logs.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: การวิเคราะห์วงจรขยาย FET/MOSFET ด้วยแบบจำลองทรานส์คอนดักแทนซ์ (gm-Model)')
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
 * Solves the DC operating point and AC parameters of the FET amplifier
 */
function solveFetCircuit(p) {
  const Vdd = parseFloat(p.vdd) || 18.0;
  const R1 = (parseFloat(p.r1) || 2200.0) * 1000; // ohms
  const R2 = (parseFloat(p.r2) || 270.0) * 1000;  // ohms
  const Rd = (parseFloat(p.rd) || 2.2) * 1000;    // ohms
  const Rs = (parseFloat(p.rs) || 1.0) * 1000;    // ohms
  const Idss = (parseFloat(p.idss) || 6.0) / 1000;// A
  const Vp = parseFloat(p.vp) || -3.5;           // V
  const absVp = Math.abs(Vp);
  const rd = 40000;                               // ohms internal rd

  // Gate voltage from voltage divider
  const VG = Vdd * (R2 / (R1 + R2));

  // Solve ID using Shockley equation: ID = IDSS * (1 - (VG - ID*Rs)/Vp)^2
  let low = 0;
  let high = Idss;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const Vgs = VG - (mid * Rs);
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

  const ID = low; // A
  const ID_mA = ID * 1000;
  const VS = ID * Rs;
  const VGS = VG - VS;
  const VD = Math.max(0, Vdd - (ID * Rd));
  const VDS = VD - VS;

  // Transconductance gm0 and gm
  const gm0 = (2 * Idss) / absVp; // S
  const gm = gm0 * (1 - (VGS / Vp)); // S
  const gm0_mS = gm0 * 1000;
  const gm_mS = gm * 1000;

  // Impedances and Gains
  const Zi = 1 / (1/R1 + 1/R2); // ohms
  const Zo = (Rd * rd) / (Rd + rd); // ohms
  const Av_bypassed = gm * Zo; // magnitude
  const Av_unbypassed = (gm * Rd) / (1 + (gm * Rs)); // magnitude

  return {
    VG, VS, VGS, ID: ID_mA, VD, VDS,
    gm0: gm0_mS, gm: gm_mS,
    Zi_k: Zi / 1000,
    Zo_k: Zo / 1000,
    Av_bypassed, Av_unbypassed
  };
}

/**
 * FET gm-Model Dynamic Small-Signal Mathematical Solver & Auto-Grading Engine
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

      const mode = data.circuitMode || 'fixed';
      const Vdd = parseFloat(data.param_vdd) || 20.0;
      const Rd = (parseFloat(data.param_rd) || 2.2) * 1000;
      const Rs = (parseFloat(data.param_rs) || 1.0) * 1000;
      const Rg = (parseFloat(data.param_rg) || 1.0) * 1000000;
      const Idss = (parseFloat(data.param_idss) || 10.0) / 1000;
      const Vp = parseFloat(data.param_vp) || -4.0;
      const rd_val = (parseFloat(data.param_rd_internal) || 50.0) * 1000;

      // Solve DC: Vgs = -Id * Rs, Id = Idss * (1 - Vgs/Vp)^2
      let a = Rs * Rs * Idss / (Vp * Vp);
      let b = -(1 + 2 * Rs * Idss / -Vp);
      let c_val = Idss;
      let disc = b * b - 4 * a * c_val;
      let Id_sol = 0;
      if (disc >= 0) {
        let Id1 = (-b - Math.sqrt(disc)) / (2 * a);
        let Id2 = (-b + Math.sqrt(disc)) / (2 * a);
        let Vgs1 = -Id1 * Rs;
        let Vgs2 = -Id2 * Rs;
        if (Vgs1 <= 0 && Vgs1 >= Vp) Id_sol = Id1;
        else if (Vgs2 <= 0 && Vgs2 >= Vp) Id_sol = Id2;
      }
      const Vgs_sol = -Id_sol * Rs;
      const Vds_sol = Vdd - Id_sol * (Rd + Rs);
      const gm0 = (2 * Idss) / Math.abs(Vp);
      const gm_sol = gm0 * (1 - Vgs_sol / Vp);
      const Id_mA = Id_sol * 1000;
      const gm_mS = gm_sol * 1000;

      const Av_byp = -gm_sol * Rd;
      const Av_unbyp = -gm_sol * Rd / (1 + gm_sol * Rs);
      const Zi_val = Rg / 1000000; // in MΩ

      feedback.push(`[โหมดการทดลอง]: ${mode === 'custom' ? 'โหมดกำหนดค่าเอง (Custom)' : 'โหมดค่ามาตรฐาน (Fixed)'}`);

      // Part 1: DC & gm (3 pts)
      const sVgs = parseFloat(data.dc_vgs) || 0;
      const sId = parseFloat(data.dc_id) || 0;
      const sVds = parseFloat(data.dc_vds) || 0;
      const sGm = parseFloat(data.dc_gm) || 0;

      const vgsOk = Math.abs(sVgs - Vgs_sol) <= Math.max(0.40, Math.abs(Vgs_sol) * 0.20);
      const idOk = Math.abs(sId - Id_mA) <= Math.max(0.40, Id_mA * 0.20);
      const vdsOk = Math.abs(sVds - Vds_sol) <= Math.max(0.80, Math.abs(Vds_sol) * 0.20);
      const gmOk = Math.abs(sGm - gm_mS) <= Math.max(0.50, gm_mS * 0.25);

      let p1Pass = (vgsOk ? 1 : 0) + (idOk ? 1 : 0) + (vdsOk ? 1 : 0) + (gmOk ? 1 : 0);
      let part1Score = p1Pass >= 4 ? 3 : (p1Pass >= 2 ? 2 : (p1Pass >= 1 ? 1 : 0));
      score += part1Score;
      feedback.push(`\n[ตอนที่ 1] จุดทำงาน DC และค่าความนำข้าม gm: ได้ ${part1Score} / 3 คะแนน`);

      // Part 2: AC Performance (3 pts)
      const sAv_byp = Math.abs(parseFloat(data.ac_av_bypassed) || 0);
      const sAv_unbyp = Math.abs(parseFloat(data.ac_av_unbypassed) || 0);
      const sZi = parseFloat(data.ac_zi_bypassed || data.ac_zi) || 0;

      const avBypOk = sAv_byp >= Math.abs(Av_byp) * 0.70 && sAv_byp <= Math.abs(Av_byp) * 1.30;
      const avUnbypOk = sAv_unbyp >= Math.abs(Av_unbyp) * 0.70 && sAv_unbyp <= Math.abs(Av_unbyp) * 1.30;
      const ziOk = sZi >= (Zi_val * 0.5) && sZi <= (Zi_val * 1.5);

      let p2Pass = (avBypOk ? 1 : 0) + (avUnbypOk ? 1 : 0) + (ziOk ? 1 : 0);
      let part2Score = p2Pass >= 3 ? 3 : (p2Pass >= 2 ? 2 : (p2Pass >= 1 ? 1 : 0));
      score += part2Score;
      feedback.push(`\n[ตอนที่ 2] พารามิเตอร์สัญญาณ AC (Av, Zi, Zo): ได้ ${part2Score} / 3 คะแนน`);

      // Part 3: MCQ (4 pts)
      const ansQ1 = (data.q1_choice || data.q1Answer || data.q1 || '').trim().toLowerCase();
      const ansQ2 = (data.q2_choice || data.q2Answer || data.q2 || '').trim().toLowerCase();
      const ansQ3 = (data.q3_choice || data.q3Answer || data.q3 || '').trim().toLowerCase();
      const ansQ4 = (data.q4_choice || data.q4Answer || data.q4 || '').trim().toLowerCase();

      let qScore = 0;
      const q1Ok = (ansQ1 === 'a');
      const q2Ok = (ansQ2 === 'b');
      const q3Ok = (ansQ3 === 'a');
      const q4Ok = (ansQ4 === 'b');

      if (q1Ok) qScore++;
      if (q2Ok) qScore++;
      if (q3Ok) qScore++;
      if (q4Ok) qScore++;
      score += qScore;
      feedback.push(`\n[ตอนที่ 3] คำถามท้ายการทดลอง: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} / 4 คะแนน)`);
      feedback.push(`  ข้อ 1: ${q1Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ1 ? '✗ ไม่ถูกต้อง (เฉลย A)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 2: ${q2Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ2 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 3: ${q3Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ3 ? '✗ ไม่ถูกต้อง (เฉลย A)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 4: ${q4Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ4 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);

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

    // --- SUBMISSION & AUTO-GRADING HANDLER ---
    function submitReportToGAS() {
      const payload = getWorksheetPayload();

      if (!payload.studentName || !payload.studentId || !payload.studentGroup || !payload.labDate) {
        alert('⚠️ กรุณากรอกข้อมูลส่วนตัว (ชื่อ-นามสกุล, รหัสนักศึกษา, กลุ่มเรียน และวันที่) ให้ครบถ้วนก่อนส่งใบงาน!');
        switchTab('tab-worksheet');
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
function recordToSheet(data, grading) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Submissions");

  if (!sheet) {
    sheet = ss.insertSheet("Submissions");
    const headers = [
      "Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date", "Lab Mode",
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

  
  var chosenModel = data.hwComponentModel || data.componentModel || data.bjtModel || data.zenerModel || '2N5458';
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
