/**
 * MOSFET Pinout & Characteristics Lab - GAS Backend Controller & Auto-Grading Engine
 * Google Apps Script backend for elab-mosfet-pinout-sheets-app
 */

function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('ใบงานการทดลองที่ 5: การหาตำแหน่งขาและทดสอบ MOSFET (IRF540 & IRF9540)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handle student submission and perform auto-grading
 */
function submitWorksheet(data) {
  try {
    // 1. Initialize Grading Parameters
    let scorePart1 = 0; // Table 1 (IRF540) - 2 points
    let scorePart2 = 0; // Table 2 (IRF9540) - 2 points
    let scorePart3 = 0; // Table 3 (Triggering) - 4 points
    let scorePart4 = 0; // Part 4 (Pins & Type ID) - 2 points
    
    let feedbackDetails = [];

    // 2. Grade Table 1: IRF540 N-Ch measurement (6 rows)
    // Expected: Only Row 5 (Black 3, Red 2) is "up" (diode conducts). All others are "down" (OL).
    const t1Expected = ['down', 'down', 'down', 'down', 'down', 'up'];
    let t1Correct = 0;
    
    if (data.part1Rows && data.part1Rows.length === 6) {
      for (let i = 0; i < 6; i++) {
        if (data.part1Rows[i].deflect === t1Expected[i]) {
          t1Correct++;
        }
      }
    }
    scorePart1 = (t1Correct / 6) * 2;
    feedbackDetails.push(`ตารางที่ 1 (หาขา IRF540): ถูกต้อง ${t1Correct} จาก 6 แถว (ได้ ${scorePart1.toFixed(2)} คะแนน)`);

    // 3. Grade Table 2: IRF9540 P-Ch measurement (6 rows)
    // Expected: Only Row 3 (Black 2, Red 3) is "up" (diode conducts). All others are "down" (OL).
    const t2Expected = ['down', 'down', 'down', 'up', 'down', 'down'];
    let t2Correct = 0;
    
    if (data.part2Rows && data.part2Rows.length === 6) {
      for (let i = 0; i < 6; i++) {
        if (data.part2Rows[i].deflect === t2Expected[i]) {
          t2Correct++;
        }
      }
    }
    scorePart2 = (t2Correct / 6) * 2;
    feedbackDetails.push(`ตารางที่ 2 (หาขา IRF9540): ถูกต้อง ${t2Correct} จาก 6 แถว (ได้ ${scorePart2.toFixed(2)} คะแนน)`);

    // 4. Grade Table 3: Gate Triggering & Discharge Test (6 steps)
    // Expected:
    // Step 0 (IRF540 trigger): down (OL)
    // Step 1 (IRF540 ON): up (conducting)
    // Step 2 (IRF540 OFF): down (OL)
    // Step 3 (IRF9540 trigger): down (OL)
    // Step 4 (IRF9540 ON): up (conducting)
    // Step 5 (IRF9540 OFF): down (OL)
    const t3Expected = ['down', 'up', 'down', 'down', 'up', 'down'];
    let t3Correct = 0;
    
    if (data.part3Rows && data.part3Rows.length === 6) {
      for (let i = 0; i < 6; i++) {
        if (data.part3Rows[i].deflect === t3Expected[i]) {
          t3Correct++;
        }
      }
    }
    scorePart3 = (t3Correct / 6) * 4;
    feedbackDetails.push(`ตารางที่ 3 (การทดสอบกระตุ้นเกต): ถูกต้อง ${t3Correct} จาก 6 ขั้นตอน (ได้ ${scorePart3.toFixed(2)} คะแนน)`);

    // 5. Grade Part 4: Pin Mapping & Type Identification
    // Expected: Pin 1 = G, Pin 2 = D, Pin 3 = S. Model 1 = n-ch, Model 2 = p-ch.
    let t4Correct = 0;
    if (data.ansPin1 === 'G') t4Correct++;
    if (data.ansPin2 === 'D') t4Correct++;
    if (data.ansPin3 === 'S') t4Correct++;
    if (data.ansModel1Type === 'n-ch') t4Correct++;
    if (data.ansModel2Type === 'p-ch') t4Correct++;
    
    scorePart4 = (t4Correct / 5) * 2;
    feedbackDetails.push(`ส่วนระบุขาและชนิดสาร: ถูกต้อง ${t4Correct} จาก 5 คำถาม (ได้ ${scorePart4.toFixed(2)} คะแนน)`);

    // 6. Calculate Total Score
    const totalScore = scorePart1 + scorePart2 + scorePart3 + scorePart4;
    const finalScore = Number(totalScore.toFixed(1));
    
    // Evaluate summary comment
    let comment = 'ต้องปรับปรุงแก้ไข (Need Improvement)';
    if (finalScore >= 9.0) {
      comment = 'ดีเยี่ยม (Excellent)';
    } else if (finalScore >= 7.0) {
      comment = 'ดีมาก (Very Good)';
    } else if (finalScore >= 5.0) {
      comment = 'ผ่านเกณฑ์ขั้นต่ำ (Pass)';
    }

    // 7. Write to Google Sheet Database
    const sheet = getOrCreateSubmissionsSheet();
    const timestamp = new Date();
    
    // Append row
    sheet.appendRow([
      timestamp,
      data.studentName,
      "'" + data.studentId, // Prepend quote to preserve ID format as text
      data.studentGroup,
      data.labDate,
      finalScore,
      Number(scorePart1.toFixed(2)),
      Number(scorePart2.toFixed(2)),
      Number(scorePart3.toFixed(2)),
      Number(scorePart4.toFixed(2)),
      data.q1Answer,
      data.q2Answer,
      data.q3Answer,
      data.labConclusion,
      comment
    ]);

    return {
      status: 'success',
      score: finalScore,
      maxScore: 10,
      comment: comment,
      feedback: feedbackDetails.join('\n')
    };

  } catch (err) {
    return {
      status: 'error',
      message: err.toString()
    };
  }
}

/**
 * Open Spreadsheet and get or create Submissions sheet styled in Teal
 */
function getOrCreateSubmissionsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Submissions');
  
  if (!sheet) {
    sheet = ss.insertSheet('Submissions');
    
    // Define Headers
    const headers = [
      'Timestamp (วันเวลาที่ส่ง)',
      'ชื่อ-นามสกุลนักศึกษา',
      'รหัสนักศึกษา',
      'กลุ่มเรียน / ตอนเรียน',
      'วันที่ทำการทดลอง',
      'คะแนนรวม (10 คะแนน)',
      'คะแนนตารางที่ 1 (2 คะแนน)',
      'คะแนนตารางที่ 2 (2 คะแนน)',
      'คะแนนตารางที่ 3 (4 คะแนน)',
      'คะแนนส่วนระบุขา (2 คะแนน)',
      'คำถามท้ายการทดลอง ข้อ 1',
      'คำถามท้ายการทดลอง ข้อ 2',
      'คำถามท้ายการทดลอง ข้อ 3',
      'สรุปผลการทดลอง',
      'เกณฑ์ประเมินการตรวจ'
    ];
    
    sheet.appendRow(headers);
    
    // Style headers (Teal Theme representing MOSFET/FET styling)
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0f766e') // Dark Teal background
               .setFontColor('#ffffff')  // White text
               .setFontWeight('bold')
               .setHorizontalAlignment('center')
               .setFontFamily('Sarabun');
               
    sheet.setFrozenRows(1);
    
    // Auto-adjust column widths
    for (let col = 1; col <= headers.length; col++) {
      sheet.autoResizeColumn(col);
    }
  }
  return sheet;
}
