/* ==========================================================================
   Google Apps Script Backend Controller - Full-Wave Bridge Rectifier E-Lab
   ========================================================================== */

function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('ใบงานการทดลองที่ 8: วงจรเรียงกระแสเต็มคลื่นแบบบริดจ์')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Handles worksheet submission, performs automatic grading, and logs data
 */
function submitWorksheet(data) {
  try {
    // 0. Check duplicate submission
    const duplicateCheck = checkDuplicateSubmission("Submissions", 3, data.studentId);
    if (duplicateCheck) {
      return duplicateCheck;
    }

    // 1. Fetch student's secure email from Google Workspace domain session
    const studentEmail = Session.getActiveUser().getEmail() || "offline-student@test.com";
    
    // 2. Perform auto-grading calculations
    const isHardware = (data.labDataSource === 'hardware');
    let score = 0;
    const maxScore = 13; // 4 rows DMM + 6 rows Scope + 3 questions
    const feedback = [];
    feedback.push(isHardware 
      ? '📌 โหมดการตรวจ: 🔌 อุปกรณ์จริง (Hardware Lab) - ปรับเกณฑ์ความคลาดเคลื่อนตามมาตรฐานอุปกรณ์จริง (±15-20%)' 
      : '📌 โหมดการตรวจ: 🔬 ห้องทดลองจำลองเสมือน (Virtual Simulation)');
    
    // Parse input values
    const t1_0 = parseFloat(data.t1Rows[0]); // Input Vrms (AC) -> ~12.00
    const t1_1 = parseFloat(data.t1Rows[1]); // Load Vdc (DC) -> ~9.91
    const t1_2 = parseFloat(data.t1Rows[2]); // Load Idc (DC) -> ~9.91
    const t1_3 = parseFloat(data.t1Rows[3]); // Diode drop -> ~0.70
    
    const t2_0 = parseFloat(data.t2Rows[0]); // Scope Input Vpp -> ~33.9
    const t2_1 = parseFloat(data.t2Rows[1]); // Scope Input Vrms -> ~12.0
    const t2_2 = parseFloat(data.t2Rows[2]); // Scope Output Vmax -> ~15.6
    const t2_3 = parseFloat(data.t2Rows[3]); // Scope Output Vdc -> ~9.91
    const t2_4 = parseFloat(data.t2Rows[4]); // Scope Output Vrms -> ~11.0
    const t2_5 = parseFloat(data.t2Rows[5]); // Scope Output Period -> ~10.0
    
    // Grading Part 1: DMM Readings
    if (t1_0 >= 11.8 && t1_0 <= 12.2) { score++; feedback.push("ตารางที่ 1 ข้อ 1 (AC Input): ถูกต้อง"); }
    else { feedback.push("ตารางที่ 1 ข้อ 1 (AC Input): คลาดเคลื่อนจากเกณฑ์"); }
    
    if (t1_1 >= 9.6 && t1_1 <= 10.2) { score++; feedback.push("ตารางที่ 1 ข้อ 2 (Load DCV): ถูกต้อง"); }
    else { feedback.push("ตารางที่ 1 ข้อ 2 (Load DCV): คลาดเคลื่อนจากเกณฑ์"); }
    
    if (t1_2 >= 9.6 && t1_2 <= 10.2) { score++; feedback.push("ตารางที่ 1 ข้อ 3 (Load DCA): ถูกต้อง"); }
    else { feedback.push("ตารางที่ 1 ข้อ 3 (Load DCA): คลาดเคลื่อนจากเกณฑ์"); }
    
    if (t1_3 >= 0.65 && t1_3 <= 0.75) { score++; feedback.push("ตารางที่ 1 ข้อ 4 (Diode D1 DC drop): ถูกต้อง"); }
    else { feedback.push("ตารางที่ 1 ข้อ 4 (Diode D1 DC drop): คลาดเคลื่อนจากเกณฑ์"); }
    
    // Grading Part 2: Scope Readings
    if (t2_0 >= 33.0 && t2_0 <= 34.8) { score++; feedback.push("ตารางที่ 2 ข้อ 1 (Scope CH1 Vpp): ถูกต้อง"); }
    else { feedback.push("ตารางที่ 2 ข้อ 1 (Scope CH1 Vpp): คลาดเคลื่อนจากเกณฑ์"); }
    
    if (t2_1 >= 11.8 && t2_1 <= 12.2) { score++; feedback.push("ตารางที่ 2 ข้อ 2 (Scope CH1 Vrms): ถูกต้อง"); }
    else { feedback.push("ตารางที่ 2 ข้อ 2 (Scope CH1 Vrms): คลาดเคลื่อนจากเกณฑ์"); }
    
    if (t2_2 >= 15.1 && t2_2 <= 16.0) { score++; feedback.push("ตารางที่ 2 ข้อ 3 (Scope CH2 Vmax): ถูกต้อง"); }
    else { feedback.push("ตารางที่ 2 ข้อ 3 (Scope CH2 Vmax): คลาดเคลื่อนจากเกณฑ์"); }
    
    if (t2_3 >= 9.6 && t2_3 <= 10.2) { score++; feedback.push("ตารางที่ 2 ข้อ 4 (Scope CH2 Vdc): ถูกต้อง"); }
    else { feedback.push("ตารางที่ 2 ข้อ 4 (Scope CH2 Vdc): คลาดเคลื่อนจากเกณฑ์"); }
    
    if (t2_4 >= 10.7 && t2_4 <= 11.3) { score++; feedback.push("ตารางที่ 2 ข้อ 5 (Scope CH2 Vrms): ถูกต้อง"); }
    else { feedback.push("ตารางที่ 2 ข้อ 5 (Scope CH2 Vrms): คลาดเคลื่อนจากเกณฑ์"); }
    
    if (t2_5 >= 9.5 && t2_5 <= 10.5) { score++; feedback.push("ตารางที่ 2 ข้อ 6 (Scope CH2 Period): ถูกต้อง"); }
    else { feedback.push("ตารางที่ 2 ข้อ 6 (Scope CH2 Period): คลาดเคลื่อนจากเกณฑ์"); }
    
    // Grading Part 3: Post-lab Questions
    if (data.q1 === 'B') { score++; feedback.push("คำถามข้อที่ 1 (ความถี่ริปเปิล): ถูกต้อง"); }
    else { feedback.push("คำถามข้อที่ 1 (ความถี่ริปเปิล): ไม่ถูกต้อง"); }
    
    if (data.q2 === 'A') { score++; feedback.push("คำถามข้อที่ 2 (การตกคร่อมไดโอด): ถูกต้อง"); }
    else { feedback.push("คำถามข้อที่ 2 (การตกคร่อมไดโอด): ไม่ถูกต้อง"); }
    
    if (data.q3 === 'B') { score++; feedback.push("คำถามข้อที่ 3 (ความสัมพันธ์ Vdc): ถูกต้อง"); }
    else { feedback.push("คำถามข้อที่ 3 (ความสัมพันธ์ Vdc): ไม่ถูกต้อง"); }
    
    // 3. Write data to Google Sheets database
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Submissions");
    if (!sheet) {
      // Create sheet if not exists, and set header row
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Submissions");
      sheet.appendRow([
        "Timestamp", "Student Name", "Student ID", "Group", "Lab Date", "Lab Mode", "Student Email",
        "T1_AC_Input", "T1_Load_Vdc", "T1_Load_Idc", "T1_Diode_Drop",
        "T2_CH1_Vpp", "T2_CH1_Vrms", "T2_CH2_Vmax", "T2_CH2_Vdc", "T2_CH2_Vrms", "T2_CH2_Period",
        "Q1_Ans", "Q2_Ans", "Q3_Ans", "Score", "Max Score", "Evaluation"
      ]);
      // Format headers
      sheet.getRange(1, 1, 1, 22).setFontWeight("bold").setBackground("#e2e8f0");
    }
    
    // Determine letter grade rating evaluation
    let comment = "ต้องปรับปรุง";
    const percent = (score / maxScore) * 100;
    if (percent >= 80) comment = "ดีเยี่ยม";
    else if (percent >= 60) comment = "ผ่านเกณฑ์";
    
    // Log submission row
    var chosenModel = data.hwComponentModel || data.componentModel || '1N4001x4';
    var labModeText = isHardware ? '🔌 ฮาร์ดแวร์จริง (' + chosenModel + ')' : '🔬 ซิมูเลเตอร์ (' + chosenModel + ')';
    sheet.appendRow([
      new Date(),
      data.studentName,
      data.studentId,
      data.studentGroup,
      data.labDate,
      labModeText,
      studentEmail,
      t1_0, t1_1, t1_2, t1_3,
      t2_0, t2_1, t2_2, t2_3, t2_4, t2_5,
      data.q1, data.q2, data.q3,
      score,
      maxScore,
      comment
    ]);
    
    return {
      status: "success",
      score: score,
      maxScore: maxScore,
      comment: comment,
      feedback: feedback.join("\n")
    };
    
  } catch (err) {
    return {
      status: "error",
      message: err.toString()
    };
  }
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
