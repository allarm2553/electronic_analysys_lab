/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs for MOSFET Bias Lab.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: MOSFET Biasing Lab')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Processes the student's lab report submission
 */
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

/**
 * MOSFET Biasing Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  const mType = data.mosfetType || 'IRF540'; // 'IRF540' (N-ch), 'IRF9540' (P-ch)
  const isNch = mType === 'IRF540';
  
  let score = 0;
  let maxScore = 10;
  let feedback = [];
  
  // Circuit specifications
  const R_D = 220; // 220 Ohms
  const Vth = 3.0; // 3.0V nominal threshold voltage
  const K = 1.25e-3; // 1.25 mA/V^2
  
  // --- PART 1: Table 1 - Transfer Characteristics (Vds = 10V constant) ---
  const vgsList1 = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0];
  const submittedT1 = data.table1Rows || [];
  let t1Correct = 0;
  
  for (let i = 0; i < vgsList1.length; i++) {
    const vgs_input = vgsList1[i];
    const sRow = submittedT1[i] || { vgs: '', vd: '', id: '', state: '' };
    
    const vgs = parseFloat(sRow.vgs) || 0;
    const vds = parseFloat(sRow.vds) || 0;
    const id = parseFloat(sRow.id) || 0;
    
    // Check 1: Check against simulation values
    const exp = solveMosfet(10.0, vgs_input, isNch);
    
    const tolV = 0.25; // Relaxed from 0.15V
    const tolI = 0.6; // mA, relaxed from 0.5
    
    const simVgsOk = Math.abs(vgs - (isNch ? vgs_input : -vgs_input)) <= tolV;
    const simVdsOk = Math.abs(vds - exp.vds) <= tolV;
    const simIdOk = Math.abs(id - exp.id) <= tolI;
    
    const simRowOk = simVgsOk && simVdsOk && simIdOk;
    
    // Check 2: Check against physical MOSFET loop constraints
    let physicalRowOk = false;
    const vgs_abs = Math.abs(vgs);
    const vds_abs = Math.abs(vds);
    const id_abs = Math.abs(id);
    
    const kvlDiff = Math.abs((10.0 - vds_abs) - id_abs * 0.22); // RD = 220 ohms -> 0.22 V/mA
    const kvlOk = kvlDiff <= 1.0; // 1.0V meter error margin
    
    let mosfetBehaviorOk = false;
    if (vgs_abs <= 2.0) {
      // Cutoff
      mosfetBehaviorOk = id_abs <= 0.5 && Math.abs(vds_abs - 10.0) <= 1.0;
    } else {
      // Conducting (Saturation or Triode)
      mosfetBehaviorOk = id_abs >= 0.0 && vds_abs <= 10.0;
    }
    
    physicalRowOk = kvlOk && mosfetBehaviorOk && (vgs_abs >= vgs_input - 0.25 && vgs_abs <= vgs_input + 0.25);
    
    if (simRowOk || physicalRowOk) {
      t1Correct++;
    }
  }
  
  // Table 1: 8 rows correct -> 4 points (0.5 point per row)
  const t1Score = Math.floor(t1Correct / 2); // Cap at 4
  score += t1Score;
  feedback.push(`ตารางที่ 1 (Transfer Characteristics): ถูกต้อง ${t1Correct} จาก 8 แถว (ได้ ${t1Score} คะแนน)`);
  
  // --- PART 2: Table 2 - Drain Characteristics (Vgs = 5V constant) ---
  const vddList2 = [0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0];
  const submittedT2 = data.table2Rows || [];
  let t2Correct = 0;
  
  for (let i = 0; i < vddList2.length; i++) {
    const vdd_input = vddList2[i];
    const sRow = submittedT2[i] || { vds: '', id: '', state: '' };
    
    const vds = parseFloat(sRow.vds) || 0;
    const id = parseFloat(sRow.id) || 0;
    
    // Check 1: Check against simulation values
    const exp = solveMosfet(vdd_input, 5.0, isNch);
    
    const tolV = 0.25; // Relaxed from 0.15V
    const tolI = 0.6; // mA, relaxed from 0.5
    
    const simVdsOk = Math.abs(vds - exp.vds) <= tolV;
    const simIdOk = Math.abs(id - exp.id) <= tolI;
    
    const simRowOk = simVdsOk && simIdOk;
    
    // Check 2: Check against physical MOSFET loop constraints
    let physicalRowOk = false;
    const vds_abs = Math.abs(vds);
    const id_abs = Math.abs(id);
    
    const kvlDiff = Math.abs((vdd_input - vds_abs) - id_abs * 0.22); // RD = 220 ohms -> 0.22 V/mA
    const kvlOk = kvlDiff <= 1.0;
    
    let mosfetBehaviorOk = false;
    if (vdd_input <= 1.5) {
      mosfetBehaviorOk = id_abs <= 2.0 && vds_abs <= vdd_input;
    } else {
      mosfetBehaviorOk = id_abs >= 0.0 && vds_abs <= vdd_input;
    }
    
    physicalRowOk = kvlOk && mosfetBehaviorOk;
    
    if (simRowOk || physicalRowOk) {
      t2Correct++;
    }
  }
  
  // Table 2: 8 rows correct -> 4 points (0.5 point per row)
  const t2Score = Math.floor(t2Correct / 2); // Cap at 4
  score += t2Score;
  feedback.push(`ตารางที่ 2 (Drain Characteristics): ถูกต้อง ${t2Correct} จาก 8 แถว (ได้ ${t2Score} คะแนน)`);
  
  // --- PART 3: Threshold & Transconductance Parameters ---
  const ansVth = Math.abs(parseFloat(data.ansVth) || 0);
  const ansK = parseFloat(data.ansK) || 0;
  
  // Nominal Vth = 3.0V (allows 2.0V to 4.0V), Nominal K = 1.25 mA/V^2 (allows 0.8 to 1.8)
  const vthOk = ansVth >= 2.0 && ansVth <= 4.0;
  const kOk = ansK >= 0.8 && ansK <= 1.8;
  
  if (vthOk) {
    score += 1;
    feedback.push(`แรงดันขีดเริ่ม Vth: ถูกต้อง (${ansVth} V)`);
  } else {
    feedback.push(`แรงดันขีดเริ่ม Vth: ไม่ถูกต้อง (กรอก ${ansVth} V คาดหวังช่วง 2.0 - 4.0 V)`);
  }
  
  if (kOk) {
    score += 1;
    feedback.push(`ค่าคงที่การนำกระแส K: ถูกต้อง (${ansK} mA/V^2)`);
  } else {
    feedback.push(`ค่าคงที่การนำกระแส K: ไม่ถูกต้อง (กรอก ${ansK} mA/V^2 คาดหวังช่วง 0.8 - 1.8)`);
  }
  
  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 9) {
    comment = "ผ่านเกณฑ์ดีเยี่ยม (Excellent)";
  } else if (score >= 7) {
    comment = "ผ่านเกณฑ์ดี (Good)";
  }
  
  return {
    score: score,
    maxScore: maxScore,
    feedback: feedback.join('\n'),
    comment: comment
  };
}

/**
 * Analytical MOSFET solver helper
 */
function solveMosfet(Vdd, Vgs, isNch) {
  const R_D = 220; // 220 Ohms
  const Vth = 3.0; // 3.0V
  const K = 1.25e-3; // 1.25 mA/V^2
  
  const vgs = Math.abs(Vgs);
  const vdd = Math.abs(Vdd);
  
  if (vgs < Vth) {
    return { id: 0, vds: vdd, state: 'Cutoff' };
  }
  
  const idSat = K * Math.pow(vgs - Vth, 2);
  const vdsSat = vdd - idSat * R_D;
  
  if (vdsSat >= vgs - Vth) {
    return {
      id: parseFloat((idSat * 1000).toFixed(3)),
      vds: parseFloat((isNch ? vdsSat : -vdsSat).toFixed(3)),
      state: 'Saturation'
    };
  } else {
    const a = R_D * K;
    const b = -(2 * R_D * K * (vgs - Vth) + 1);
    const c = vdd;
    
    const disc = b * b - 4 * a * c;
    if (disc < 0) {
      return { id: parseFloat((idSat * 1000).toFixed(3)), vds: 0.1, state: 'Triode' };
    }
    
    const vds = (-b - Math.sqrt(disc)) / (2 * a);
    const id = K * (2 * (vgs - Vth) * vds - vds * vds);
    
    return {
      id: parseFloat((id * 1000).toFixed(3)),
      vds: parseFloat((isNch ? vds : -vds).toFixed(3)),
      state: 'Triode'
    };
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
      "Condition", "Auto Score", "Evaluation", 
      "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#38bdf8") // Cyan metallic accent for MOSFET
         .setBorder(true, true, true, true, true, true);
  }
  
  // Automatically retrieve active user email (works in same-domain Google Workspace)
  var studentEmail = Session.getActiveUser().getEmail() || "Anonymous / No Permission";
  
  var rowData = [
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    data.mosfetType,
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
