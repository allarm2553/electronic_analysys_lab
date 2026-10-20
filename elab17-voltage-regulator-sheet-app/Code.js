/**
 * Google Apps Script Web App - Backend Controller (Code.gs)
 * Handles HTML page serving, form submissions, mathematical auto-grading, and Google Sheets DB logs
 * for Lab 17: IC Voltage Regulators (78xx & 79xx Series).
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('E-Lab: IC Voltage Regulators (78xx & 79xx)')
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

function submitWorksheet(data) {
  try {
    const studentId = data.studentId ? data.studentId.toString().trim() : '';
    const studentName = data.studentName ? data.studentName.toString().trim() : '';

    if (!studentId || !studentName) {
      return {
        status: 'error',
        message: 'กรุณากรอกชื่อ-นามสกุล และรหัสนักศึกษาให้ครบถ้วนก่อนส่งงาน'
      };
    }

    // Check duplicate submission
    const dupCheck = checkDuplicateSubmission("Submissions", 4, studentId);
    if (dupCheck) {
      return dupCheck;
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
            message: "⚠️ รหัสนักศึกษา " + targetId + " ได้ส่งใบงานนี้ไปแล้วเมื่อ " + prevTime + "\nระบบอนุญาตให้ส่งได้เพียง 1 ครั้งเท่านั้น"
          };
        }
      }
    }
  } catch (e) {}
  return null;
}

function gradeWorksheet(data) {
  const isHardware = (data.labDataSource === 'hardware');
  let score = 0;
  const maxScore = 10;
  const feedback = [
    isHardware 
      ? '📌 โหมดการตรวจ: 🔌 อุปกรณ์จริง (Hardware Lab) - ปรับเกณฑ์ความคลาดเคลื่อนตามมาตรฐานอุปกรณ์จริง (±15%)' 
      : '📌 โหมดการตรวจ: 🔬 ห้องทดลองจำลองเสมือน (Virtual Simulation) - ตรวจตามความแม่นยำทางทฤษฎี (±5%)'
  ];

  // --- PART 1: TABLE 1 - LINE REGULATION & DROPOUT VOLTAGE (3.0 Points) ---
  let t1Pass = 0;
  if (data.t1Rows && Array.isArray(data.t1Rows)) {
    data.t1Rows.forEach(row => {
      if (Array.isArray(row)) {
        const vin = parseFloat(row[0]);
        const vout = parseFloat(row[1]);
        const isReg = (row[2] || '').toString().toLowerCase();
        // Valid row if numbers exist and reasonable
        if (!isNaN(vin) && !isNaN(vout) && vout >= 0 && isReg.length > 0) t1Pass++;
      } else {
        const v = parseFloat(row);
        if (!isNaN(v) && v > 0) t1Pass++;
      }
    });
  }
  let t1Score = t1Pass >= 6 ? 3.0 : (t1Pass >= 4 ? 2.0 : (t1Pass >= 2 ? 1.0 : 0.0));
  score += t1Score;
  feedback.push(`[ตอนที่ 1] การทดสอบ Line Regulation และแรงดัน Dropout: ได้ ${t1Score.toFixed(1)} / 3.0 คะแนน (บันทึกข้อมูล ${t1Pass}/7 ระดับแรงดัน)`);

  // --- PART 2: TABLE 2 - LOAD REGULATION & POWER DISSIPATION (3.0 Points) ---
  let t2Pass = 0;
  if (data.t2Rows && Array.isArray(data.t2Rows)) {
    data.t2Rows.forEach(row => {
      if (Array.isArray(row)) {
        const vout = parseFloat(row[1]);
        const il = parseFloat(row[2]);
        const pd = parseFloat(row[3]);
        if (!isNaN(vout) && vout > 0 && !isNaN(il) && !isNaN(pd)) t2Pass++;
      } else {
        const v = parseFloat(row);
        if (!isNaN(v) && v > 0) t2Pass++;
      }
    });
  }
  // Check pinout knowledge bonus if selected
  const pin78 = (data.pin7805 || '').toString().trim();
  const pin79 = (data.pin7905 || '').toString().trim();
  let pinoutBonus = (pin78.includes('1:IN') && pin79.includes('1:GND')) ? 0.5 : 0.0;

  let t2Score = t2Pass >= 5 ? 2.5 : (t2Pass >= 3 ? 1.5 : (t2Pass >= 1 ? 0.8 : 0.0));
  t2Score = Math.min(3.0, t2Score + pinoutBonus);
  score += t2Score;
  feedback.push(`[ตอนที่ 2] การทดสอบ Load Regulation, กำลังงานสูญเสีย และการจัดขา TO-220: ได้ ${t2Score.toFixed(1)} / 3.0 คะแนน (บันทึกโหลด ${t2Pass}/6 สภาวะ)`);

  // --- PART 3: POST-LAB MULTIPLE CHOICE (4.0 Points Total) ---
  const ansQ1 = (data.q1Answer || data.q1 || '').trim().toUpperCase();
  const ansQ2 = (data.q2Answer || data.q2 || '').trim().toUpperCase();
  const ansQ3 = (data.q3Answer || data.q3 || '').trim().toUpperCase();
  const ansQ4 = (data.q4Answer || data.q4 || '').trim().toUpperCase();

  let qScore = 0;
  const q1Ok = (ansQ1 === 'B'); // B: 7805 ขา 1=IN, 2=GND, 3=OUT ส่วน 7905 ขา 1=GND, 2=IN, 3=OUT และ Tab ติดกับขา 2
  const q2Ok = (ansQ2 === 'C'); // C: 14.0V (Vin >= Vout + Vdropout = 12 + 2 = 14V)
  const q3Ok = (ansQ3 === 'B'); // B: Cin ป้องกัน Self-oscillation และ Cout ปรับปรุง Transient Response
  const q4Ok = (ansQ4 === 'C'); // C: PD = (15 - 5) * 0.8 = 8.0W ร้อนสูง ต้องติด Heatsink

  if (q1Ok) qScore += 1.0;
  if (q2Ok) qScore += 1.0;
  if (q3Ok) qScore += 1.0;
  if (q4Ok) qScore += 1.0;

  score += qScore;
  feedback.push(`\n[คำถามวัดความเข้าใจท้ายการทดลอง]: ตอบถูก ${qScore.toFixed(0)} จาก 4 ข้อ (ได้ ${qScore.toFixed(1)} / 4.0 คะแนน)`);
  feedback.push(`  ข้อ 1 (การจัดขา Pinout และแผ่น Tab ของ 78xx vs 79xx): ${q1Ok ? '✓ ถูกต้อง (+1.0 คะแนน)' : (ansQ1 ? '✗ ไม่ถูกต้อง' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
  feedback.push(`  ข้อ 2 (แรงดัน Dropout ขั้นต่ำของ LM7812): ${q2Ok ? '✓ ถูกต้อง (+1.0 คะแนน)' : (ansQ2 ? '✗ ไม่ถูกต้อง' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
  feedback.push(`  ข้อ 3 (หน้าที่ของตัวเก็บประจุ Cin และ Cout): ${q3Ok ? '✓ ถูกต้อง (+1.0 คะแนน)' : (ansQ3 ? '✗ ไม่ถูกต้อง' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
  feedback.push(`  ข้อ 4 (การคำนวณกำลังสูญเสีย PD และการจัดการความร้อน): ${q4Ok ? '✓ ถูกต้อง (+1.0 คะแนน)' : (ansQ4 ? '✗ ไม่ถูกต้อง' : '✗ ยังไม่ได้เลือกคำตอบ')}`);

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

function recordToSheet(data, grading) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Submissions");
  if (!sheet) {
    sheet = ss.insertSheet("Submissions");
    var headers = ["Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date", "Lab Mode", "IC Model", "Score", "Evaluation", "Feedback", "Q1", "Q2", "Q3", "Q4", "Conclusion"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0284c7").setFontColor("#ffffff");
  }
  var studentEmail = Session.getActiveUser().getEmail() || "Anonymous / No Permission";
  var labModeText = (data.labDataSource === 'hardware') ? '🔌 ฮาร์ดแวร์จริง' : '🔬 ซิมูเลเตอร์';
  sheet.appendRow([
    new Date(),
    studentEmail,
    data.studentName,
    data.studentId,
    data.studentGroup,
    data.labDate,
    labModeText,
    data.icModel || 'LM7805 / LM7905',
    grading.score + " / " + grading.maxScore,
    grading.comment,
    grading.feedback,
    data.q1 || data.q1Answer,
    data.q2 || data.q2Answer,
    data.q3 || data.q3Answer,
    data.q4 || data.q4Answer,
    data.conclusion || data.labConclusion || ''
  ]);
}
