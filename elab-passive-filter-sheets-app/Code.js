/**
 * Google Apps Script Backend for Passive Filter Lab (Low-Pass & High-Pass Filters)
 * Handles 10-point automated grading rubric, sheets logging, and real-time feedback.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ใบงานการทดลอง: วงจรกรองความถี่ต่ำและความถี่สูงแบบพาสซีฟ')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.ping) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'pong' })).setMimeType(ContentService.MimeType.JSON);
    }
    const result = submitWorksheet(data);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function submitWorksheet(data) {
  try {
    var duplicateCheck = checkDuplicateSubmission("Submissions", 4, data.studentId);
    if (duplicateCheck) return duplicateCheck;

    var gradingResults = gradeWorksheet(data);
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
      ? '📌 โหมดการตรวจ: 🔌 อุปกรณ์จริง (Hardware Lab) - ปรับเกณฑ์ความคลาดเคลื่อนตามมาตรฐานอุปกรณ์จริง' 
      : '📌 โหมดการตรวจ: 🔬 ห้องทดลองจำลองเสมือน (Virtual Simulation)'
  ];

  // --- PART 1: TABLE 1 - LOW-PASS FILTER (3.0 Points) ---
  let t1Pass = 0;
  if (data.t1Rows && Array.isArray(data.t1Rows)) {
    data.t1Rows.forEach(row => {
      // row has Vout, Av, dB, Phase
      if (Array.isArray(row)) {
        if (parseFloat(row[0]) > 0 || parseFloat(row[2]) !== 0) t1Pass++;
      } else if (parseFloat(row) > 0) {
        t1Pass++;
      }
    });
  }
  let t1Score = t1Pass >= 5 ? 3.0 : (t1Pass >= 3 ? 2.0 : (t1Pass >= 1 ? 1.0 : 0.0));
  score += t1Score;
  feedback.push(`[ตอนที่ 1] วงจรกรองความถี่ต่ำ RC (Low-Pass Filter): ได้ ${t1Score.toFixed(1)} / 3.0 คะแนน (บันทึกข้อมูล ${t1Pass}/6 จุดความถี่)`);

  // --- PART 2: TABLE 2 - HIGH-PASS FILTER (3.0 Points) ---
  let t2Pass = 0;
  if (data.t2Rows && Array.isArray(data.t2Rows)) {
    data.t2Rows.forEach(row => {
      if (Array.isArray(row)) {
        if (parseFloat(row[0]) > 0 || parseFloat(row[2]) !== 0) t2Pass++;
      } else if (parseFloat(row) > 0) {
        t2Pass++;
      }
    });
  }
  let t2Score = t2Pass >= 5 ? 3.0 : (t2Pass >= 3 ? 2.0 : (t2Pass >= 1 ? 1.0 : 0.0));
  score += t2Score;
  feedback.push(`[ตอนที่ 2] วงจรกรองความถี่สูง RC (High-Pass Filter): ได้ ${t2Score.toFixed(1)} / 3.0 คะแนน (บันทึกข้อมูล ${t2Pass}/6 จุดความถี่)`);

  // --- PART 3: POST-LAB CONCEPTUAL QUESTIONS (4.0 Points Total) ---
  const ansQ1 = (data.q1Answer || data.q1 || '').trim().toUpperCase();
  const ansQ2 = (data.q2Answer || data.q2 || '').trim().toUpperCase();
  const ansQ3 = (data.q3Answer || data.q3 || '').trim().toUpperCase();
  const ansQ4 = (data.q4Answer || data.q4 || '').trim().toUpperCase();

  let qScore = 0;
  const q1Ok = (ansQ1 === 'B'); // B: 0.707 เท่า หรือ -3 dB
  const q2Ok = (ansQ2 === 'C'); // C: -20 dB/decade หรือ -6 dB/octave
  const q3Ok = (ansQ3 === 'A'); // A: -45 องศา (เอาต์พุตล้าหลังอินพุต)
  const q4Ok = (ansQ4 === 'D'); // D: ลดค่า R ลงครึ่งหนึ่ง หรือลดค่า C ลงครึ่งหนึ่ง

  if (q1Ok) qScore += 1.0;
  if (q2Ok) qScore += 1.0;
  if (q3Ok) qScore += 1.0;
  if (q4Ok) qScore += 1.0;

  score += qScore;
  feedback.push(`\n[คำถามวัดความเข้าใจท้ายการทดลอง]: ตอบถูก ${qScore.toFixed(0)} จาก 4 ข้อ (ได้ ${qScore.toFixed(1)} / 4.0 คะแนน)`);
  feedback.push(`  ข้อ 1: ${q1Ok ? '✓ ถูกต้อง (+1.0 คะแนน)' : (ansQ1 ? '✗ ไม่ถูกต้อง (เฉลย B: 0.707 เท่า / -3dB)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
  feedback.push(`  ข้อ 2: ${q2Ok ? '✓ ถูกต้อง (+1.0 คะแนน)' : (ansQ2 ? '✗ ไม่ถูกต้อง (เฉลย C: -20 dB/decade)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
  feedback.push(`  ข้อ 3: ${q3Ok ? '✓ ถูกต้อง (+1.0 คะแนน)' : (ansQ3 ? '✗ ไม่ถูกต้อง (เฉลย A: -45 องศา)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);
  feedback.push(`  ข้อ 4: ${q4Ok ? '✓ ถูกต้อง (+1.0 คะแนน)' : (ansQ4 ? '✗ ไม่ถูกต้อง (เฉลย D: ลด R หรือ C ลงครึ่งหนึ่ง)' : '✗ ยังไม่ได้เลือกคำตอบ')}`);

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
    var headers = ["Timestamp", "Student Email", "Student Name", "Student ID", "Group", "Lab Date", "Lab Mode", "Cutoff Freq (fc)", "Score", "Evaluation", "Feedback", "Q1", "Q2", "Q3", "Q4", "Conclusion"];
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
    data.cutoffFreq || '',
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
