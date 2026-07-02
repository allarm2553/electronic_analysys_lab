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
 * BJT Fixed Bias Mathematical Solver & Auto-Grading Engine
 */
function gradeWorksheet(data) {
  const cond = data.diodeCondition; // 'good', 'open', 'short'
  
  let score = 0;
  let maxScore = 10;
  let feedback = [];
  
  // Nominal circuit values
  const Rb = 468400; // 468.4k ohms (measured)
  const Rc = 1012;   // 1012 ohms (measured)
  const hfe = 295;   // Beta
  const VbeNom = 0.675;
  
  // --- PART 1: MEASUREMENT TABLE (6 Rows) ---
  const vinList = [5.0, 6.0, 8.0, 10.0, 12.0, 15.0];
  const submittedRows = data.part2Rows || [];
  let correctRowsCount = 0;
  
  for (let idx = 0; idx < 6; idx++) {
    const vcc = vinList[idx];
    const sRow = submittedRows[idx] || { vrb: '', vbe: '', ib: '', vrc: '', vce: '', ic: '' };
    
    const vrb = parseFloat(sRow.vrb) || 0;
    const vbe = parseFloat(sRow.vbe) || 0;
    const ib = parseFloat(sRow.ib) || 0;
    const vrc = parseFloat(sRow.vrc) || 0;
    const vce = parseFloat(sRow.vce) || 0;
    const ic = parseFloat(sRow.ic) || 0;
    
    // Compute expected values
    let expIb = 0;   // A
    let expIc = 0;   // A
    let expVbe = 0;  // V
    let expVce = 0;  // V
    let expVrb = 0;  // V
    let expVrc = 0;  // V
    
    if (cond === 'open') {
      expVbe = vcc;
      expVce = vcc;
    } else if (cond === 'short') {
      expVbe = VbeNom;
      if (vcc > expVbe) {
        expIb = (vcc - expVbe) / Rb;
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
        expVbe = 0.65 + 0.015 * Math.log(1 + ibApprox * 1e6);
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
    
    // Tolerances
    const tolV = 0.15; // V
    const tolIb = 2.0; // uA
    const tolIc = 0.2; // mA
    
    const expIb_uA = expIb * 1e6;
    const expIc_mA = expIc * 1e3;
    
    const vrbOk = Math.abs(vrb - expVrb) <= tolV;
    const vbeOk = Math.abs(vbe - expVbe) <= tolV;
    const ibOk = Math.abs(ib - expIb_uA) <= tolIb;
    const vrcOk = Math.abs(vrc - expVrc) <= tolV;
    const vceOk = Math.abs(vce - expVce) <= tolV;
    const icOk = Math.abs(ic - expIc_mA) <= tolIc;
    
    if (vrbOk && vbeOk && ibOk && vrcOk && vceOk && icOk) {
      correctRowsCount++;
    }
  }
  
  // 6 rows correct = 6 points, etc.
  score += correctRowsCount;
  feedback.push(`ตารางบันทึกผลการทดลอง: ถูกต้อง ${correctRowsCount} จาก 6 แถวระดับแรงดัน (ได้ ${correctRowsCount} คะแนน)`);
  
  // --- PART 2: Q-POINT & BETA CALCULATIONS (at Vcc = 12.0 V) ---
  if (cond === 'good') {
    const ansVceQ = parseFloat(data.ansVceQ) || 0;
    const ansIcQ = parseFloat(data.ansIcQ) || 0;
    const ansBeta = parseFloat(data.ansBetaCalc) || 0;
    
    // Expected at Vcc = 12V: Vce ≈ 4.79V, Ic ≈ 7.21mA, Beta ≈ 300
    const vceQOk = Math.abs(ansVceQ - 4.79) <= 0.25;
    const icQOk = Math.abs(ansIcQ - 7.21) <= 0.3;
    const betaOk = Math.abs(ansBeta - 300) <= 20;
    
    if (vceQOk) {
      score += 1;
      feedback.push("พิกัด Vce,Q (เอาต์พุต Q-point): ถูกต้อง (~4.79 V)");
    } else {
      feedback.push(`พิกัด Vce,Q: ไม่ถูกต้อง (กรอก ${ansVceQ} V คาดหวัง ~4.79 V)`);
    }
    
    if (icQOk) {
      score += 1;
      feedback.push("พิกัด Ic,Q (เอาต์พุต Q-point): ถูกต้อง (~7.21 mA)");
    } else {
      feedback.push(`พิกัด Ic,Q: ไม่ถูกต้อง (กรอก ${ansIcQ} mA คาดหวัง ~7.21 mA)`);
    }
    
    if (betaOk) {
      score += 1;
      feedback.push("คำนวณอัตราขยายกระแส Beta (β): ถูกต้อง (~300 เท่า)");
    } else {
      feedback.push(`คำนวณอัตราขยายกระแส Beta: ไม่ถูกต้อง (กรอก ${ansBeta} เท่า คาดหวัง ~300)`);
    }
  } else {
    // Faulty BJT gets auto-credited for calculation to prevent unfair grading
    score += 3;
    feedback.push("การหาจุด Q-point และคำนวณอัตราขยาย: ผ่านการประเมิน (เนื่องจากอุปกรณ์ชำรุด)");
  }
  
  // --- PART 3: BC108 PINOUT IDENTIFICATION ---
  const p1 = data.ansPin1; // E
  const p2 = data.ansPin2; // B
  const p3 = data.ansPin3; // C
  
  if (p1 === 'E' && p2 === 'B' && p3 === 'C') {
    score += 1;
    feedback.push("ระบุขั้วตำแหน่งขา BC108: ถูกต้อง (1=Emitter, 2=Base, 3=Collector)");
  } else {
    feedback.push(`ระบุขั้วตำแหน่งขา BC108: ไม่ถูกต้อง (กรอก 1=${p1}, 2=${p2}, 3=${p3} คาดหวัง 1=E, 2=B, 3=C)`);
  }
  
  let comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (score >= 9) {
    comment = "ผ่านเกณฑ์ดีมาก (Excellent)";
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
 * Appends the graded worksheet details into the Google Sheets database
 */
function recordToSheet(data, grading) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Submissions");
  
  if (!sheet) {
    sheet = ss.insertSheet("Submissions");
    var headers = [
      "Timestamp", "Student Name", "Student ID", "Group", "Lab Date",
      "Condition", "Auto Score", "Evaluation", 
      "Feedback Summary", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Conclusion"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#fef08a") // Yellow metallic accent for gold can BC108
         .setBorder(true, true, true, true, true, true);
  }
  
  var rowData = [
    new Date(),
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
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
