/**
 * Google Apps Script Backend for E-Lab 14: Power Amplifier & Emitter Follower Lab
 * Handles 10-point automated grading rubric, sheets logging, and real-time feedback.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ใบงานการทดลองที่ 14: วงจรขยายกำลังและวงจรกันชน (Power Amplifier)')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const grading = evaluateLab(data);
    logToSheet(data, grading);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      score: grading.score,
      maxScore: grading.maxScore,
      breakdown: grading.breakdown,
      feedback: grading.feedback
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function evaluateLab(data) {
  const isHardware = (data.labDataSource === 'hardware');
  const vcc = parseFloat(data.param_vcc) || 15;
  const vin = parseFloat(data.param_vin) || 10;
  const mode = data.circuitMode || 'fixed';
  
  // Theoretical calculations for 4Ω and 8Ω
  const vce_sat = 1.2;
  const vin_p = vin / 2;
  const vout_peak = Math.min(vin_p, vcc - vce_sat);
  
  // 4 Ohm
  const pout_4 = Math.pow(vout_peak, 2) / (2 * 4);
  const ip_4 = vout_peak / 4;
  const pdc_4 = (2 * vcc) * (2 * ip_4 / Math.PI + 0.025);
  const eff_4 = (pout_4 / pdc_4) * 100;
  const pd_4 = pdc_4 - pout_4;
  
  // 8 Ohm
  const pout_8 = Math.pow(vout_peak, 2) / (2 * 8);
  const ip_8 = vout_peak / 8;
  const pdc_8 = (2 * vcc) * (2 * ip_8 / Math.PI + 0.025);
  const eff_8 = (pout_8 / pdc_8) * 100;
  
  // Thermal
  const tj_hs = 28.0 + (pd_4 / 2) * (3.12 + 0.5 + 4.5);
  const tj_nohs = 28.0 + (pd_4 / 2) * 62.5;

  let score = 0;
  let feedback = [];
  let breakdown = { part1: 0, part2: 0, part3: 0 };

  // Part 1: Power & Efficiency (3 pts)
  let p1 = 0;
  const s_vp4 = parseFloat(data.ws_vp_4) || 0;
  const s_vp8 = parseFloat(data.ws_vp_8) || 0;
  const s_ip4 = parseFloat(data.ws_ip_4) || 0;
  const s_ip8 = parseFloat(data.ws_ip_8) || 0;
  const s_po4 = parseFloat(data.ws_pout_4) || 0;
  const s_po8 = parseFloat(data.ws_pout_8) || 0;
  const s_pdc4 = parseFloat(data.ws_pdc_4) || 0;
  const s_pdc8 = parseFloat(data.ws_pdc_8) || 0;
  const s_eff4 = parseFloat(data.ws_eff_4) || 0;
  const s_eff8 = parseFloat(data.ws_eff_8) || 0;

  if (Math.abs(s_vp4 - vout_peak) <= 0.6 && Math.abs(s_vp8 - vout_peak) <= 0.6) p1 += 0.5;
  if (Math.abs(s_ip4 - ip_4) <= 0.3 && Math.abs(s_ip8 - ip_8) <= 0.2) p1 += 0.5;
  if (Math.abs(s_po4 - pout_4) <= 0.7 && Math.abs(s_po8 - pout_8) <= 0.5) p1 += 1.0;
  if (Math.abs(s_pdc4 - pdc_4) <= 1.8 && Math.abs(s_pdc8 - pdc_8) <= 1.2) p1 += 0.5;
  if (Math.abs(s_eff4 - eff_4) <= 7.0 && Math.abs(s_eff8 - eff_8) <= 7.0) p1 += 0.5;
  breakdown.part1 = p1;
  score += p1;
  feedback.push(`ตอนที่ 1 (กำลังขับและประสิทธิภาพ 4Ω vs 8Ω): ${p1.toFixed(1)} / 3.0 คะแนน`);

  // Part 2: Thermal & Heatsink (3 pts)
  let p2 = 0;
  const s_pd_hs = parseFloat(data.ws_pd_hs) || 0;
  const s_tj_hs = parseFloat(data.ws_tj_hs) || 0;
  const s_tj_nohs = parseFloat(data.ws_tj_nohs) || 0;

  if (Math.abs(s_pd_hs - pd_4) <= 1.8) p2 += 1.0;
  if (Math.abs(s_tj_hs - tj_hs) <= 12.0 && Math.abs(s_tj_nohs - tj_nohs) <= 35.0) p2 += 1.0;
  if (data.ws_cross_ab === 'none' && data.ws_cross_b === 'yes') p2 += 1.0;
  breakdown.part2 = p2;
  score += p2;
  feedback.push(`ตอนที่ 2 (ความร้อน Heatsink และ Crossover): ${p2.toFixed(1)} / 3.0 คะแนน`);

  // Part 3: Multiple Choice (4 pts)
  let p3 = 0;
  if (data.q1 === 'b') p3 += 1.0;
  if (data.q2 === 'a') p3 += 1.0;
  if (data.q3 === 'b') p3 += 1.0;
  if (data.q4 === 'c') p3 += 1.0;
  breakdown.part3 = p3;
  score += p3;
  feedback.push(`ตอนที่ 3 (คำถามท้ายแล็บ): ${p3.toFixed(1)} / 4.0 คะแนน`);

  const modeLabel = mode === 'custom' ? 'โหมดกำหนดค่าเอง (Custom Dynamic)' : 'โหมดค่ามาตรฐาน (Fixed Preset)';
  feedback.push(`[ระบบโหมดการทดลอง]: ${modeLabel}`);

  return {
    score: score,
    maxScore: 10,
    breakdown: breakdown,
    feedback: feedback,
    comment: score >= 8 ? 'ยอดเยี่ยมมาก! เข้าใจการทำงานของภาคเพาเวอร์แอมป์และการระบายความร้อนเป็นอย่างดี' :
             score >= 5 ? 'ผ่านเกณฑ์ ควรทบทวนสูตรคำนวณกำลังงานและประสิทธิภาพเพิ่มเติม' :
             'ควรทบทวนการทดลองและปรึกษาอาจารย์ผู้สอนเพิ่มเติม'
  };
}

function logToSheet(data, grading) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Lab14_PowerAmp_Submissions');
  
  if (!sheet) {
    sheet = ss.insertSheet('Lab14_PowerAmp_Submissions');
    const headers = [
      'Timestamp', 'Email', 'ชื่อ-นามสกุล', 'รหัสนักศึกษา', 'กลุ่ม', 'วันที่', 'Lab Mode',
      'คะแนนรวม', 'เกณฑ์ประเมิน', 'โหมดวงจร', 'พารามิเตอร์ทดลอง',
      'Pout(4Ω)', 'Pout(8Ω)', 'Eff(4Ω)%', 'Tj(Heatsink)', 'Tj(NoHeatsink)',
      'Q1', 'Q2', 'Q3', 'Q4', 'ข้อสรุปผลการทดลอง'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontFamily('Sarabun')
      .setFontSize(10)
      .setFontWeight('bold')
      .setBackground('#1e293b')
      .setFontColor('#f8fafc')
      .setHorizontalAlignment('center');
  }

  const email = Session.getActiveUser().getEmail() || 'Anonymous / Web User';
  const paramSummary = `Vcc=±${data.param_vcc || 15}V, Vin=${data.param_vin || 10}Vpp, Pair=TIP31C/TIP32C`;

  var labModeText = (data.labDataSource === 'hardware')
    ? '🔌 ฮาร์ดแวร์จริง (' + (data.hwComponentModel || data.componentModel || 'TIP31C/TIP32C') + ')'
    : '🔬 ซิมูเลเตอร์ (' + (data.componentModel || 'TIP31C/TIP32C') + ')';
  const row = [
    new Date(),
    email,
    data.studentName || '',
    data.studentId || '',
    data.studentGroup || '',
    data.labDate || '',
    labModeText,
    grading.score + ' / ' + grading.maxScore,
    grading.comment || '',
    data.circuitMode === 'custom' ? 'Custom Dynamic' : 'Fixed Preset',
    paramSummary,
    data.ws_pout_4 || '',
    data.ws_pout_8 || '',
    data.ws_eff_4 || '',
    data.ws_tj_hs || '',
    data.ws_tj_nohs || '',
    data.q1 || '',
    data.q2 || '',
    data.q3 || '',
    data.q4 || '',
    data.conclusion || ''
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, row.length)
    .setFontFamily('Sarabun')
    .setFontSize(10)
    .setHorizontalAlignment('center');
}
