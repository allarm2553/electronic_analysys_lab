/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs for JFET & MOSFET Fixed-Bias Lab.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: JFET & MOSFET Fixed-Bias Laboratory')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Device Models Dictionary
 */
const FET_DEVICE_MODELS = {
  '2N5458': { category: 'JFET', idss: 6.0, vp: -3.5, rd: 1000 },
  '2N5484': { category: 'JFET', idss: 3.5, vp: -2.0, rd: 1000 },
  'BF245B': { category: 'JFET', idss: 10.0, vp: -4.0, rd: 1000 },
  '2N7000': { category: 'MOSFET', vth: 2.1, k: 0.05, rd: 1000 },
  'BS170':  { category: 'MOSFET', vth: 2.0, k: 0.06, rd: 1000 },
  'IRF540': { category: 'MOSFET', vth: 3.0, k: 0.08, rd: 220 }
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
 * JFET & MOSFET Fixed-Bias Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  const modelName = data.fetModel || data.mosfetType || '2N5458';
  const model = FET_DEVICE_MODELS[modelName] || FET_DEVICE_MODELS['2N5458'];
  const isJfet = model.category === 'JFET';
  
  let score = 0;
  let maxScore = 10;
  let feedback = [];
  
  // --- PART 1: Table 1 - Transfer Characteristics (Vds constant) ---
  const submittedT1 = data.table1Rows || [];
  let t1Correct = 0;
  
  for (let i = 0; i < submittedT1.length; i++) {
    const sRow = submittedT1[i] || { vgs: '', vds: '', id: '', state: '' };
    const vgs = parseFloat(sRow.vgs) || 0;
    const vds = parseFloat(sRow.vds) || 0;
    const id = parseFloat(sRow.id) || 0;
    
    const exp = solveFetFixedBias(modelName, 10.0, vgs);
    
    const tolV = 0.35;
    const tolI = 0.8; // mA
    
    const simVdsOk = Math.abs(vds - exp.vds) <= tolV;
    const simIdOk = Math.abs(id - exp.id) <= tolI;
    
    // KVL Check: VDS + ID*RD = VDD
    const kvlDiff = Math.abs((10.0 - vds) - (id / 1000) * model.rd);
    const kvlOk = kvlDiff <= 1.2;
    
    let physicalOk = false;
    if (isJfet) {
      if (vgs <= model.vp) {
        physicalOk = id <= 0.2;
      } else {
        physicalOk = id >= 0 && vds <= 10.0;
      }
    } else {
      if (vgs <= model.vth) {
        physicalOk = id <= 0.2;
      } else {
        physicalOk = id >= 0 && vds <= 10.0;
      }
    }
    
    if ((simVdsOk && simIdOk) || (kvlOk && physicalOk)) {
      t1Correct++;
    }
  }
  
  const t1Score = Math.min(4, Math.floor(t1Correct / 2));
  score += t1Score;
  feedback.push('ตารางที่ 1 (Transfer Characteristics): ถูกต้อง ' + t1Correct + ' จาก ' + submittedT1.length + ' แถว (ได้ ' + t1Score + ' / 4 คะแนน)');
  
  // --- PART 2: Table 2 - Drain Characteristics (Vgs constant) ---
  const submittedT2 = data.table2Rows || [];
  let t2Correct = 0;
  const nominalVgs = isJfet ? (model.vp / 2) : (model.vth + 1.0);
  
  for (let i = 0; i < submittedT2.length; i++) {
    const sRow = submittedT2[i] || { vdd: '', vds: '', id: '', state: '' };
    const vdd = parseFloat(sRow.vdd) || 0;
    const vds = parseFloat(sRow.vds) || 0;
    const id = parseFloat(sRow.id) || 0;
    
    const exp = solveFetFixedBias(modelName, vdd, nominalVgs);
    
    const tolV = 0.4;
    const tolI = 0.8;
    
    const simVdsOk = Math.abs(vds - exp.vds) <= tolV;
    const simIdOk = Math.abs(id - exp.id) <= tolI;
    
    const kvlDiff = Math.abs((vdd - vds) - (id / 1000) * model.rd);
    const kvlOk = kvlDiff <= 1.2;
    
    if ((simVdsOk && simIdOk) || (kvlOk && id >= 0 && vds <= vdd + 0.5)) {
      t2Correct++;
    }
  }
  
  const t2Score = Math.min(4, Math.floor(t2Correct / 2));
  score += t2Score;
  feedback.push('ตารางที่ 2 (Drain Characteristics): ถูกต้อง ' + t2Correct + ' จาก ' + submittedT2.length + ' แถว (ได้ ' + t2Score + ' / 4 คะแนน)');
  
  // --- PART 3: Device Parameters ---
  const p1Val = parseFloat(data.ansP1) || 0;
  const p2Val = parseFloat(data.ansP2) || 0;
  
  let p1Ok = false;
  let p2Ok = false;
  
  if (isJfet) {
    p1Ok = Math.abs(p1Val - model.vp) <= 0.8 || Math.abs(Math.abs(p1Val) - Math.abs(model.vp)) <= 0.8;
    p2Ok = Math.abs(p2Val - model.idss) <= 2.5;
  } else {
    p1Ok = Math.abs(p1Val - model.vth) <= 0.8;
    p2Ok = p2Val > 0 && p2Val < 200;
  }
  
  if (p1Ok) {
    score += 1;
    feedback.push('พารามิเตอร์ที่ 1 (' + (isJfet ? 'แรงดันพินช์ออฟ VP' : 'แรงดันขีดเริ่ม Vth') + '): ถูกต้องตามเกณฑ์');
  } else {
    feedback.push('พารามิเตอร์ที่ 1 (' + (isJfet ? 'แรงดันพินช์ออฟ VP' : 'แรงดันขีดเริ่ม Vth') + '): คลาดเคลื่อนจากเกณฑ์');
  }
  
  if (p2Ok) {
    score += 1;
    feedback.push('พารามิเตอร์ที่ 2 (' + (isJfet ? 'กระแสอิ่มตัวสูงสุด IDSS' : 'ค่าคงที่การนำกระแส k') + '): ถูกต้องตามเกณฑ์');
  } else {
    feedback.push('พารามิเตอร์ที่ 2 (' + (isJfet ? 'กระแสอิ่มตัวสูงสุด IDSS' : 'ค่าคงที่การนำกระแส k') + '): คลาดเคลื่อนจากเกณฑ์');
  }
  
  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 9) {
    comment = "ผ่านเกณฑ์ดีเยี่ยม (Excellent)";
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
 * Analytical JFET & MOSFET Fixed-Bias solver helper
 */
function solveFetFixedBias(modelName, Vdd, Vgs) {
  const model = FET_DEVICE_MODELS[modelName] || FET_DEVICE_MODELS['2N5458'];
  const rd = model.rd;
  const vdd = Math.max(0, Vdd);
  
  if (model.category === 'JFET') {
    const idss = model.idss; // mA
    const vp = model.vp;     // negative V, e.g. -3.5
    const vgs = Math.min(0, Vgs);
    
    if (vgs <= vp) {
      return { id: 0, vds: vdd, vrd: 0, state: 'Cutoff' };
    }
    
    const vdsPinch = Math.abs(vp) - Math.abs(vgs);
    const idSat = idss * Math.pow(1 - (vgs / vp), 2); // mA
    const vdsSat = vdd - (idSat / 1000) * rd;
    
    if (vdsSat >= vdsPinch) {
      return {
        id: parseFloat(idSat.toFixed(3)),
        vds: parseFloat(Math.max(0, vdsSat).toFixed(3)),
        vrd: parseFloat(((idSat / 1000) * rd).toFixed(3)),
        state: 'Saturation'
      };
    } else {
      const beta = (idss / 1000) / (vp * vp);
      const a = beta * rd;
      const b = -(2 * beta * rd * (Math.abs(vp) - Math.abs(vgs)) + 1);
      const c = vdd;
      const disc = b * b - 4 * a * c;
      if (disc < 0) {
        return { id: parseFloat(idSat.toFixed(3)), vds: 0.1, vrd: parseFloat(vdd.toFixed(3)), state: 'Ohmic' };
      }
      const vds = (-b - Math.sqrt(disc)) / (2 * a);
      const idA = beta * (2 * (Math.abs(vp) - Math.abs(vgs)) * vds - vds * vds);
      const id_mA = idA * 1000;
      return {
        id: parseFloat(Math.max(0, id_mA).toFixed(3)),
        vds: parseFloat(Math.max(0, vds).toFixed(3)),
        vrd: parseFloat((vdd - vds).toFixed(3)),
        state: 'Ohmic'
      };
    }
  } else {
    // MOSFET
    const vth = model.vth;
    const k = model.k; // A/V^2
    const vgs = Math.max(0, Vgs);
    
    if (vgs <= vth) {
      return { id: 0, vds: vdd, vrd: 0, state: 'Cutoff' };
    }
    
    const vdsSat = vgs - vth;
    const idSatA = k * Math.pow(vgs - vth, 2);
    const vdsCalculated = vdd - idSatA * rd;
    
    if (vdsCalculated >= vdsSat) {
      return {
        id: parseFloat((idSatA * 1000).toFixed(3)),
        vds: parseFloat(Math.max(0, vdsCalculated).toFixed(3)),
        vrd: parseFloat((idSatA * rd).toFixed(3)),
        state: 'Saturation'
      };
    } else {
      const a = k * rd;
      const b = -(2 * k * rd * (vgs - vth) + 1);
      const c = vdd;
      const disc = b * b - 4 * a * c;
      if (disc < 0) {
        return { id: parseFloat((idSatA * 1000).toFixed(3)), vds: 0.1, vrd: parseFloat(vdd.toFixed(3)), state: 'Triode' };
      }
      const vds = (-b - Math.sqrt(disc)) / (2 * a);
      const idA = k * (2 * (vgs - vth) * vds - vds * vds);
      return {
        id: parseFloat(Math.max(0, idA * 1000).toFixed(3)),
        vds: parseFloat(Math.max(0, vds).toFixed(3)),
        vrd: parseFloat((vdd - vds).toFixed(3)),
        state: 'Triode'
      };
    }
  }
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
      "Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date",
      "Device Model", "Auto Score", "Evaluation", 
      "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#38bdf8") // Cyan metallic accent
         .setBorder(true, true, true, true, true, true);
  }
  
  var studentEmail = Session.getActiveUser().getEmail() || "Anonymous / No Permission";
  
  var rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    data.fetModel || data.mosfetType,
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
