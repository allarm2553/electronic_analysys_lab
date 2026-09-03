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

      const mode = data.circuitMode || 'fixed';
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
      const Vce = Vc - Ve;
      const Ie_mA = Ie * 1000;
      const re_calc = Ie_mA > 0 ? (26.0 / Ie_mA) : 9999;

      const Zb_bypassed = Beta * re_calc;
      const Zi_bypassed = 1 / (1/R1 + 1/R2 + 1/Zb_bypassed);
      const Av_bypassed = re_calc > 0 ? (Rc / re_calc) : 0;

      const Zb_unbypassed = Beta * (re_calc + Re);
      const Zi_unbypassed = 1 / (1/R1 + 1/R2 + 1/Zb_unbypassed);
      const Av_unbypassed = Rc / (re_calc + Re);

      feedback.push(`[โหมดการทดลอง]: ${mode === 'custom' ? 'โหมดกำหนดค่าเอง (Custom)' : 'โหมดค่ามาตรฐาน (Fixed)'}`);

      // Part 1: DC & re (3 pts)
      const sVb = parseFloat(data.dc_vb) || 0;
      const sVe = parseFloat(data.dc_ve) || 0;
      const sVc = parseFloat(data.dc_vc) || 0;
      const sVce = parseFloat(data.dc_vce) || 0;
      const sIe = parseFloat(data.dc_ie) || 0;
      const sRe = parseFloat(data.dc_re) || 0;

      const vbOk = Math.abs(sVb - Vb) <= Math.max(0.35, Vb * 0.15) || Math.abs(sVb - Vth) <= Math.max(0.35, Vth * 0.15);
      const veOk = Math.abs(sVe - Ve) <= Math.max(0.35, Ve * 0.15);
      const vcOk = Math.abs(sVc - Vc) <= Math.max(0.60, Vc * 0.15);
      const vceOk = Math.abs(sVce - Vce) <= Math.max(0.70, Math.abs(Vce) * 0.15) || Math.abs(sVce - (sVc - sVe)) <= 0.35;
      const ieOk = Math.abs(sIe - Ie_mA) <= Math.max(0.40, Ie_mA * 0.18);

      let studentImpliedRe = sIe > 0 ? (26.0 / sIe) : re_calc;
      const reOk = Math.abs(sRe - re_calc) <= Math.max(3.0, re_calc * 0.20) || Math.abs(sRe - studentImpliedRe) <= Math.max(2.5, studentImpliedRe * 0.18);

      let dcVoltagesScore = (vbOk && veOk && vcOk && vceOk) ? 1 : 0;
      let dcCurrentScore = ieOk ? 1 : 0;
      let reScore = reOk ? 1 : 0;
      let part1Score = dcVoltagesScore + dcCurrentScore + reScore;
      score += part1Score;

      feedback.push(`\n[ตอนที่ 1] จุดทำงาน DC และค่า re: ได้ ${part1Score} / 3 คะแนน`);
      if (dcVoltagesScore) feedback.push(`  ✓ แรงดันไฟตรง (Vb, Ve, Vc, Vce): ถูกต้องตามเกณฑ์`);
      else feedback.push(`  ✗ แรงดันไฟตรง: ค่าอยู่นอกเกณฑ์ความถูกต้อง`);
      if (dcCurrentScore) feedback.push(`  ✓ กระแสอิมิตเตอร์ Ie: ถูกต้องตามเกณฑ์`);
      else feedback.push(`  ✗ กระแสอิมิตเตอร์ Ie: คลาดเคลื่อนจากเกณฑ์`);
      if (reScore) feedback.push(`  ✓ ค่าความต้านทานไดนามิก re: ถูกต้องตามเกณฑ์`);
      else feedback.push(`  ✗ ค่าความต้านทานไดนามิก re: คลาดเคลื่อนจากเกณฑ์`);

      // Part 2: AC Performance (Bypassed & Unbypassed) (3 pts)
      const sAv_byp = Math.abs(parseFloat(data.ac_av_bypassed) || 0);
      const sZi_byp = parseFloat(data.ac_zi_bypassed) || 0;
      const sPhase_byp = parseInt(data.ac_phase_bypassed) || 0;
      const avBypOk = sAv_byp >= (Av_bypassed * 0.70) && sAv_byp <= (Av_bypassed * 1.30);
      const ziByp_k = sZi_byp > 50 ? sZi_byp / 1000 : sZi_byp;
      const ziBypOk = Math.abs(ziByp_k - (Zi_bypassed/1000)) <= Math.max(0.6, (Zi_bypassed/1000) * 0.40);
      const phaseBypOk = sPhase_byp === 180;

      const sAv_unbyp = Math.abs(parseFloat(data.ac_av_unbypassed) || 0);
      const sZi_unbyp = parseFloat(data.ac_zi_unbypassed) || 0;
      const sPhase_unbyp = parseInt(data.ac_phase_unbypassed) || 0;
      const avUnbypOk = sAv_unbyp >= (Av_unbypassed * 0.70) && sAv_unbyp <= (Av_unbypassed * 1.30);
      const ziUnbyp_k = sZi_unbyp > 50 ? sZi_unbyp / 1000 : sZi_unbyp;
      const ziUnbypOk = Math.abs(ziUnbyp_k - (Zi_unbypassed/1000)) <= Math.max(0.6, (Zi_unbypassed/1000) * 0.40);
      const phaseUnbypOk = sPhase_unbyp === 180;

      let bypScore = (avBypOk ? 0.5 : 0) + (ziBypOk ? 0.5 : 0) + (phaseBypOk ? 0.5 : 0);
      let unbypScore = (avUnbypOk ? 0.5 : 0) + (ziUnbypOk ? 0.5 : 0) + (phaseUnbypOk ? 0.5 : 0);
      let part2Score = Math.round(bypScore + unbypScore);
      score += part2Score;

      feedback.push(`\n[ตอนที่ 2] พารามิเตอร์สัญญาณ AC (มี/ไม่มี CE): ได้ ${part2Score} / 3 คะแนน`);
      if (avBypOk) feedback.push(`  ✓ อัตราขยายกรณีมี CE: ถูกต้องตามเกณฑ์`);
      else feedback.push(`  ✗ อัตราขยายกรณีมี CE: คลาดเคลื่อนจากเกณฑ์`);
      if (avUnbypOk) feedback.push(`  ✓ อัตราขยายกรณีไม่มี CE: ถูกต้องตามเกณฑ์`);
      else feedback.push(`  ✗ อัตราขยายกรณีไม่มี CE: คลาดเคลื่อนจากเกณฑ์`);

      // Part 3: MCQ (4 pts)
      const ansQ1 = (data.q1_choice || data.q1Answer || data.q1 || '').trim().toLowerCase();
      const ansQ2 = (data.q2_choice || data.q2Answer || data.q2 || '').trim().toLowerCase();
      const ansQ3 = (data.q3_choice || data.q3Answer || data.q3 || '').trim().toLowerCase();
      const ansQ4 = (data.q4_choice || data.q4Answer || data.q4 || '').trim().toLowerCase();

      let qScore = 0;
      const q1Ok = (ansQ1 === 'b');
      const q2Ok = (ansQ2 === 'c');
      const q3Ok = (ansQ3 === 'a');
      const q4Ok = (ansQ4 === 'b');

      if (q1Ok) qScore++;
      if (q2Ok) qScore++;
      if (q3Ok) qScore++;
      if (q4Ok) qScore++;
      score += qScore;
      feedback.push(`\n[ตอนที่ 3] คำถามท้ายการทดลอง: ตอบถูก ${qScore} จาก 4 ข้อ (ได้ ${qScore} / 4 คะแนน)`);
      feedback.push(`  ข้อ 1: ${q1Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ1 ? '✗ ไม่ถูกต้อง (เฉลย B)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
      feedback.push(`  ข้อ 2: ${q2Ok ? '✓ ถูกต้อง (+1 คะแนน)' : (ansQ2 ? '✗ ไม่ถูกต้อง (เฉลย C)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
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
      const card = overlay.querySelector('.card');
      const spinner = document.getElementById('modal-spinner');
      const title = document.getElementById('modal-title');
      const body = document.getElementById('modal-body');
      const closeBtn = document.getElementById('modal-close-btn');
      const confirmBtn = document.getElementById('modal-confirm-submit-btn');

      card.style.borderColor = 'var(--accent-cyan)';
      card.style.boxShadow = '0 0 35px rgba(56, 189, 248, 0.35)';
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
      confirmBtn.style.display = 'inline-block';

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
      const card = overlay.querySelector('.card');
      const spinner = document.getElementById('modal-spinner');
      const title = document.getElementById('modal-title');
      const body = document.getElementById('modal-body');
      const closeBtn = document.getElementById('modal-close-btn');
      const confirmBtn = document.getElementById('modal-confirm-submit-btn');

      card.style.borderColor = 'var(--accent-cyan)';
      card.style.boxShadow = '0 0 35px rgba(56, 189, 248, 0.35)';
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
