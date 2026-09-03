/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: BJT DC Fixed Bias Lab')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

const BJT_MODELS = {
  'BC108': {
    name: 'BC108',
    type: 'NPN Low-Noise Audio / GP',
    beta: 250,
    vbe: 0.68,
    package: 'TO-18 Metal Can',
    pins: { p1: 'E', p2: 'B', p3: 'C' }
  },
  '2N2222': {
    name: '2N2222',
    type: 'NPN General Purpose / Switch',
    beta: 200,
    vbe: 0.70,
    package: 'TO-92 Plastic',
    pins: { p1: 'E', p2: 'B', p3: 'C' }
  },
  'BD137': {
    name: 'BD137',
    type: 'NPN Medium Power / Driver',
    beta: 100,
    vbe: 0.75,
    package: 'TO-126 Power',
    pins: { p1: 'E', p2: 'C', p3: 'B' }
  },
  'BC547': {
    name: 'BC547',
    type: 'NPN General Purpose Amplifier',
    beta: 300,
    vbe: 0.68,
    package: 'TO-92 Plastic',
    pins: { p1: 'C', p2: 'B', p3: 'E' }
  }
};

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
 * BJT Fixed Bias Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  const isHardware = (data.labDataSource === 'hardware');
const cond = data.diodeCondition || 'good'; // 'good', 'open', 'short'
  const modelKey = data.bjtModel || data.selectedModel || 'BC108';
  const model = BJT_MODELS[modelKey] || BJT_MODELS['BC108'];
  
  let score = 0;
  let maxScore = 10;
  const feedback = [
    isHardware 
      ? '📌 โหมดการตรวจ: 🔌 อุปกรณ์จริง (Hardware Lab) - ปรับเกณฑ์ความคลาดเคลื่อนตามมาตรฐานอุปกรณ์จริง' 
      : '📌 โหมดการตรวจ: 🔬 ห้องทดลองจำลองเสมือน (Virtual Simulation)'
  ];
  
  // Nominal circuit values
  const Rb = 468400; // 468.4k ohms (measured)
  const Rc = 1012;   // 1012 ohms (measured)
  const hfe = model.beta;
  const VbeNom = model.vbe;
  
  // --- PART 1: MEASUREMENT TABLE (6 Rows) ---
  const vinList = [5.0, 6.0, 8.0, 10.0, 12.0, 15.0];
  const submittedRows = data.part2Rows || [];
  let correctRowsCount = 0;
  
  // Track student's entries for Vcc = 12.0 V to check calculations in Part 2
  let student12V_vce = null;
  let student12V_ic = null;
  let student12V_ib = null;
  
  for (let idx = 0; idx < 6; idx++) {
    const vcc = vinList[idx];
    const sRow = submittedRows[idx] || { vrb: '', vbe: '', ib: '', vrc: '', vce: '', ic: '' };
    
    const vrb = parseFloat(sRow.vrb) || 0;
    const vbe = parseFloat(sRow.vbe) || 0;
    const ib = parseFloat(sRow.ib) || 0;
    const vrc = parseFloat(sRow.vrc) || 0;
    const vce = parseFloat(sRow.vce) || 0;
    const ic = parseFloat(sRow.ic) || 0;
    
    if (idx === 4) { // Vcc = 12.0 V
      student12V_vce = vce;
      student12V_ic = ic;
      student12V_ib = ib;
    }
    
    // --- CHECK 1: Theoretical simulation values ---
    let expVrb = 0, expVbe = 0, expIb = 0, expVrc = 0, expVce = 0, expIc = 0;
    
    if (cond === 'open') {
      expVbe = vcc;
      expVce = vcc;
    } else if (cond === 'short') {
      if (vcc > VbeNom) {
        expVbe = VbeNom;
        expIb = (vcc - VbeNom) / Rb;
        expVrb = vcc - expVbe;
      } else {
        expVbe = vcc;
      }
      expIc = vcc / Rc;
      expVrc = vcc;
      expVce = 0.0;
    } else {
      // 'good'
      if (vcc <= VbeNom) {
        expVbe = vcc;
        expVce = vcc;
      } else {
        const ibApprox = (vcc - VbeNom) / Rb;
        expVbe = VbeNom + 0.015 * Math.log(1 + ibApprox * 1e6);
        expVbe = Math.min(expVbe, vcc - 0.01);
        
        expIb = (vcc - expVbe) / Rb;
        expVrb = vcc - expVbe;
        
        const icActive = hfe * expIb;
        const icSat = (vcc - 0.2) / Rc;
        
        if (icActive < icSat) {
          expIc = icActive;
          expVce = vcc - expIc * Rc;
          expVrc = expIc * Rc;
        } else {
          expIc = icSat;
          expVce = 0.2;
          expVrc = vcc - expVce;
        }
      }
    }
    
    const tolV = 0.35; // Tolerance
    const tolIb = 5.0; // uA
    const tolIc = 0.5; // mA
    
    const expIb_uA = expIb * 1e6;
    const expIc_mA = expIc * 1e3;
    
    const simVrbOk = Math.abs(vrb - expVrb) <= tolV;
    const simVbeOk = Math.abs(vbe - expVbe) <= tolV;
    const simIbOk = Math.abs(ib - expIb_uA) <= tolIb;
    const simVrcOk = Math.abs(vrc - expVrc) <= tolV;
    const simVceOk = Math.abs(vce - expVce) <= tolV;
    const simIcOk = Math.abs(ic - expIc_mA) <= tolIc;
    
    const simRowOk = simVrbOk && simVbeOk && simIbOk && simVrcOk && simVceOk && simIcOk;
    
    // --- CHECK 2: Physical circuit laws (KVL/Ohm's Law) ---
    let physicalRowOk = false;
    
    if (cond === 'good') {
      const kvlBaseDiff = Math.abs((vrb + vbe) - vcc);
      const kvlCollectorDiff = Math.abs((vrc + vce) - vcc);
      
      const impliedRb = ib > 0 ? (vrb / (ib * 1e-6)) : 0;
      const impliedRc = ic > 0 ? (vrc / (ic * 1e-3)) : 0;
      
      const rbOk = impliedRb >= 250000 && impliedRb <= 700000;
      const rcOk = impliedRc >= 500 && impliedRc <= 1500;
      
      const kvlBaseOk = kvlBaseDiff <= 1.2;
      const kvlCollectorOk = kvlCollectorDiff <= 1.2;
      
      const ibPos = ib >= 0;
      const icPos = ic >= 0;
      const vbeRange = vbe >= 0.1 && vbe <= 1.0;
      
      let bjtBehaviorOk = false;
      const betaImplied = ib > 0 ? (ic * 1e-3) / (ib * 1e-6) : 0;
      
      if (vce <= 0.8) {
        bjtBehaviorOk = betaImplied <= 700 && betaImplied > 0;
      } else {
        bjtBehaviorOk = betaImplied >= 50 && betaImplied <= 700;
      }
      
      physicalRowOk = kvlBaseOk && kvlCollectorOk && rbOk && rcOk && ibPos && icPos && vbeRange && bjtBehaviorOk;
    } else if (cond === 'open') {
      physicalRowOk = Math.abs(vbe - vcc) <= 1.0 && Math.abs(vce - vcc) <= 1.0 && ib === 0 && ic === 0;
    } else if (cond === 'short') {
      const impliedRc = ic > 0 ? (vcc / (ic * 1e-3)) : 0;
      const rcOk = impliedRc >= 500 && impliedRc <= 1500;
      physicalRowOk = Math.abs(vce - 0) <= 0.6 && rcOk && Math.abs(vrc - vcc) <= 1.0;
    }
    
    if (simRowOk || physicalRowOk) {
      correctRowsCount++;
    }
  }
  
  score += correctRowsCount;
  feedback.push(`ตารางบันทึกผลการทดลอง (${model.name}): ถูกต้อง ${correctRowsCount} จาก 6 แถวระดับแรงดัน (ได้ ${correctRowsCount} คะแนน)`);
  
  // --- PART 2: Q-POINT & BETA CALCULATIONS (at Vcc = 12.0 V) ---
  if (cond === 'good') {
    const ansVceQ = parseFloat(data.ansVceQ) || 0;
    const ansIcQ = parseFloat(data.ansIcQ) || 0;
    const ansBeta = parseFloat(data.ansBetaCalc) || 0;
    
    // Theoretical targets for the active model
    const expIb12 = (12.0 - VbeNom) / Rb;
    const expIc12 = Math.min(hfe * expIb12, (12.0 - 0.2) / Rc) * 1e3;
    const expVce12 = 12.0 - (expIc12 * 1e-3) * Rc;
    
    let targetVce = expVce12;
    let targetIc = expIc12;
    let targetBeta = hfe;
    
    if (student12V_vce !== null && student12V_ic !== null && student12V_ib !== null && student12V_ib > 0) {
      targetVce = student12V_vce;
      targetIc = student12V_ic;
      targetBeta = (student12V_ic * 1000) / student12V_ib;
    }
    
    const vceQOk = Math.abs(ansVceQ - targetVce) <= 0.6;
    const icQOk = Math.abs(ansIcQ - targetIc) <= 0.6;
    const betaOk = Math.abs(ansBeta - targetBeta) <= 50;
    
    if (vceQOk) {
      score += 1;
      feedback.push(`✓ พิกัด Vce,Q (เอาต์พุต Q-point): ถูกต้องตามเกณฑ์`);
    } else {
      feedback.push(`✗ พิกัด Vce,Q: คลาดเคลื่อนจากเกณฑ์`);
    }
    
    if (icQOk) {
      score += 1;
      feedback.push(`✓ พิกัด Ic,Q (เอาต์พุต Q-point): ถูกต้องตามเกณฑ์`);
    } else {
      feedback.push(`✗ พิกัด Ic,Q: คลาดเคลื่อนจากเกณฑ์`);
    }
    
    if (betaOk) {
      score += 1;
      feedback.push(`✓ คำนวณอัตราขยายกระแส Beta (β = ${targetBeta.toFixed(0)}): ถูกต้องตามเกณฑ์`);
    } else {
      feedback.push(`✗ คำนวณอัตราขยายกระแส Beta: คลาดเคลื่อนจากเกณฑ์`);
    }
  } else {
    score += 3;
    feedback.push("การหาจุด Q-point และคำนวณอัตราขยาย: ผ่านการประเมิน (เนื่องจากอุปกรณ์ชำรุด)");
  }
  
  // --- PART 3: BJT PINOUT IDENTIFICATION ---
  const p1 = data.ansPin1;
  const p2 = data.ansPin2;
  const p3 = data.ansPin3;
  const expP = model.pins;
  
  if (p1 === expP.p1 && p2 === expP.p2 && p3 === expP.p3) {
    score += 1;
    feedback.push(`✓ ระบุขั้วตำแหน่งขา ${model.name} (${model.package}): ถูกต้อง (1:${p1}, 2:${p2}, 3:${p3})`);
  } else {
    feedback.push(`✗ ระบุขั้วตำแหน่งขา ${model.name} (${model.package}): ไม่ถูกต้อง (เฉลยคือ 1:${expP.p1}, 2:${expP.p2}, 3:${expP.p3})`);
  }
  
  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 9) {
    comment = "ผ่านเกณฑ์ดีมาก (Excellent)";
  } else if (score >= 7) {
    comment = "ผ่านเกณฑ์ดี (Good)";
  } else if (score >= 5) {
    comment = "ผ่านเกณฑ์พอใช้ (Fair)";
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Submissions");
  
  if (!sheet) {
    sheet = ss.insertSheet("Submissions");
    var headers = [
      "Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date", "Lab Mode",
      "Transistor Model", "Condition", "Auto Score", "Evaluation", 
      "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#38bdf8")
         .setFontColor("#0f172a")
         .setBorder(true, true, true, true, true, true);
  }
  
  var studentEmail = Session.getActiveUser().getEmail() || "Anonymous / No Permission";
  
  
  var chosenModel = data.hwComponentModel || data.componentModel || data.bjtModel || data.zenerModel || '2N3904';
  var labModeText = (data.labDataSource === 'hardware')
    ? '🔌 ฮาร์ดแวร์จริง (' + chosenModel + ')'
    : '🔬 ซิมูเลเตอร์ (' + chosenModel + ')';

  var rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    labModeText,
    data.bjtModel || "BC108",
    data.diodeCondition,
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
