/**
 * =========================================================================
 * 🌟 Electronic Circuit Analysis E-Labs — Universal Master Backend (Master_Code.gs)
 * ระบบรวมศูนย์ส่งคะแนนทุกใบงานเข้าสู่ Google Sheets ไฟล์เดียว แยกแท็บอัตโนมัติ 17 แล็บ
 * ออกแบบตามมาตรฐานสถาปัตยกรรม Google Apps Script จากโปรเจกต์ IoT-LAB
 * =========================================================================
 * 
 * 💡 คุณสมบัติเด่นของระบบ:
 * 1. รวมคะแนนทั้ง 17 ใบงานการทดลองลงใน Google Sheets ไฟล์เดียว
 * 2. คัดแยกข้อมูลคะแนนลงในแท็บเฉพาะของแต่ละใบงานโดยอัตโนมัติ (Lab 1 - Lab 17)
 * 3. มีแท็บ "📊 สรุปคะแนนรวม 17 แล็บ" อยู่ที่หน้าแรก (Index 0) สรุปคะแนนสะสมของนักศึกษาทุกคนแบบ Real-Time
 * 4. รองรับระบบตรวจคะแนนมาตรฐาน 10.0 คะแนนเต็มของแต่ละแล็บ พร้อมเกณฑ์ประเมินและ Feedback รายข้อ
 * 5. ป้องกันการส่งซ้ำแยกตามรายใบงาน (Anti-Duplicate Submission per Tab) โดยนักศึกษายังคงส่งแล็บอื่นๆ ได้อิสระ
 * 6. มีหน้า Diagnostics Web App (doGet) ตรวจสอบการเชื่อมต่อชีตและสถานะแท็บทั้ง 17 แล็บได้ทันที 1-Click
 */

// =========================================================================
// ⚙️ การตั้งค่า Google Spreadsheet ปลายทาง
// =========================================================================
// หากเปิดสคริปต์นี้จากเมนู "ส่วนขยาย > Apps Script" ภายใน Google Sheet โดยตรง สามารถเว้นว่างไว้ได้
// หากสร้างเป็น Standalone Script ให้นำ Spreadsheet ID หรือ URL เต็มของ Google Sheet มาวางที่นี่:
var TARGET_SPREADSHEET_ID = "";

function getTargetSpreadsheet() {
  if (typeof TARGET_SPREADSHEET_ID !== 'undefined' && TARGET_SPREADSHEET_ID && TARGET_SPREADSHEET_ID.trim().length > 0) {
    var rawId = TARGET_SPREADSHEET_ID.trim();
    if (rawId.indexOf('http') !== -1) {
      var match = rawId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) rawId = match[1];
    }
    try {
      return SpreadsheetApp.openById(rawId);
    } catch (e) {
      console.warn("ไม่สามารถเปิดตาม TARGET_SPREADSHEET_ID ได้:", e);
    }
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    return null;
  }
}

// =========================================================================
// 📑 ทะเบียนข้อมูลใบงานทั้ง 17 แล็บ (Master Lab Registry)
// =========================================================================
var LAB_REGISTRY = {
  "elab1-diode-sheet-app": {
    num: 1,
    name: "Lab 1: คุณสมบัติของไดโอด",
    sheetName: "Lab 1 - ไดโอด",
    color: "#3b82f6",
    title: "คุณสมบัติของไดโอด (Diode Characteristics)"
  },
  "elab2-zener-sheet-app": {
    num: 2,
    name: "Lab 2: ซีเนอร์ไดโอด",
    sheetName: "Lab 2 - ซีเนอร์ไดโอด",
    color: "#06b6d4",
    title: "วงจรรักษาระดับแรงดันด้วยซีเนอร์ไดโอด (Zener Regulator)"
  },
  "elab3-rectifier-sheet-app": {
    num: 3,
    name: "Lab 3: เรียงกระแสครึ่งคลื่น",
    sheetName: "Lab 3 - เรียงกระแสครึ่งคลื่น",
    color: "#0ea5e9",
    title: "วงจรเรียงกระแสแบบครึ่งคลื่น (Half-wave Rectifier)"
  },
  "elab4-bridge-rectifier-sheet-app": {
    num: 4,
    name: "Lab 4: บริดจ์เร็กติไฟเออร์",
    sheetName: "Lab 4 - บริดจ์เร็กติไฟเออร์",
    color: "#6366f1",
    title: "วงจรเรียงกระแสเต็มคลื่นแบบบริดจ์และการกรองกระแส (Bridge Rectifier & Filter)"
  },
  "elab5-transistor-sheet-app": {
    num: 5,
    name: "Lab 5: คุณลักษณะ BJT",
    sheetName: "Lab 5 - คุณลักษณะ BJT",
    color: "#8b5cf6",
    title: "การตรวจสอบขาและลักษณะสมบัติเอาต์พุต BJT (BJT Curves)"
  },
  "elab6-bjt-bias-sheet-app": {
    num: 6,
    name: "Lab 6: การจัดไบอัส BJT",
    sheetName: "Lab 6 - การจัดไบอัส BJT",
    color: "#a855f7",
    title: "การจัดไบอัสกระแสตรงทรานซิสเตอร์ (BJT DC Biasing & Load Line)"
  },
  "elab7-bjt-re-model-sheet-app": {
    num: 7,
    name: "Lab 7: BJT re-Model",
    sheetName: "Lab 7 - BJT re-Model",
    color: "#d946ef",
    title: "การวิเคราะห์วงจรขยายด้วยแบบจำลอง re (BJT re-Model)"
  },
  "elab8-bjt-h-parameter-sheet-app": {
    num: 8,
    name: "Lab 8: BJT h-Parameter",
    sheetName: "Lab 8 - BJT h-Parameter",
    color: "#ec4899",
    title: "การวิเคราะห์วงจรขยายด้วยแบบจำลอง h-Parameter (BJT h-Parameter)"
  },
  "elab9-mosfet-pinout-sheet-app": {
    num: 9,
    name: "Lab 9: MOSFET Pinout",
    sheetName: "Lab 9 - MOSFET Pinout",
    color: "#f43f5e",
    title: "การระบุตำแหน่งขาและลักษณะสมบัติของมอสเฟต (MOSFET Pinout & Testing)"
  },
  "elab10-mosfet-bias-sheet-app": {
    num: 10,
    name: "Lab 10: การจัดไบอัส MOSFET",
    sheetName: "Lab 10 - การจัดไบอัส MOSFET",
    color: "#ef4444",
    title: "การจัดไบอัสคงที่ของ JFET และ MOSFET (MOSFET Biasing)"
  },
  "elab11-fet-small-signal-sheet-app": {
    num: 11,
    name: "Lab 11: FET Small-Signal",
    sheetName: "Lab 11 - FET Small-Signal",
    color: "#f97316",
    title: "แบบจำลองสัญญาณขนาดเล็กของ FET/MOSFET (FET Small-Signal)"
  },
  "elab12-datasheet-reading-sheet-app": {
    num: 12,
    name: "Lab 12: Data Sheet",
    sheetName: "Lab 12 - Data Sheet",
    color: "#f59e0b",
    title: "การอ่าน Data Sheet ของอุปกรณ์อิเล็กทรอนิกส์ (Datasheet Reading)"
  },
  "elab13-multistage-sheet-app": {
    num: 13,
    name: "Lab 13: ขยายหลายภาค",
    sheetName: "Lab 13 - ขยายหลายภาค",
    color: "#eab308",
    title: "วงจรขยายสัญญาณหลายภาคแบบต่อคู่ความจุ (Multistage Amplifier)"
  },
  "elab14-power-amp-sheet-app": {
    num: 14,
    name: "Lab 14: ขยายกำลัง",
    sheetName: "Lab 14 - ขยายกำลัง",
    color: "#84cc16",
    title: "วงจรขยายกำลังและวงจรกันชน (Power Amplifier)"
  },
  "elab15-passive-filter-sheet-app": {
    num: 15,
    name: "Lab 15: วงจรกรองพาสซีฟ",
    sheetName: "Lab 15 - วงจรกรองพาสซีฟ",
    color: "#10b981",
    title: "วงจรกรองความถี่ต่ำและความถี่สูงแบบพาสซีฟ (Passive Filters)"
  },
  "elab16-negative-feedback-sheet-app": {
    num: 16,
    name: "Lab 16: ป้อนกลับลบ",
    sheetName: "Lab 16 - ป้อนกลับลบ",
    color: "#14b8a6",
    title: "วงจรขยายแบบป้อนกลับลบ (Negative Feedback)"
  },
  "elab17-voltage-regulator-sheet-app": {
    num: 17,
    name: "Lab 17: ไอซีเร็กกูเลเตอร์",
    sheetName: "Lab 17 - ไอซีเร็กกูเลเตอร์",
    color: "#0284c7",
    title: "วงจรรักษาระดับแรงดันด้วยไอซีเร็กกูเลเตอร์ 78xx และ 79xx (IC Regulators)"
  }
};

// =========================================================================
// 🌐 GET Handler (Diagnostics & Verification Page)
// =========================================================================
function doGet(e) {
  var ss = getTargetSpreadsheet();
  var ssName = ss ? ss.getName() : 'ยังไม่ได้เชื่อมต่อ Google Sheet';
  var ssUrl = ss ? ss.getUrl() : '#';

  if (e && e.parameter && (e.parameter.action === 'testConnection' || e.parameter.action === 'ping' || e.parameter.format === 'json')) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      type: 'master',
      message: 'เชื่อมต่อ Universal Master Google Apps Script สำเร็จพร้อมใช้งาน!',
      spreadsheetName: ssName,
      spreadsheetUrl: ssUrl,
      totalSupportedLabs: Object.keys(LAB_REGISTRY).length
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var labsListHtml = Object.keys(LAB_REGISTRY).map(function(k) {
    var item = LAB_REGISTRY[k];
    return '<span style="display:inline-block;background:' + item.color + '22;border:1px solid ' + item.color + '66;color:#f8fafc;padding:0.25rem 0.65rem;border-radius:6px;margin:0.2rem;font-size:0.8rem;font-weight:500;">' +
      'Lab ' + item.num + ': ' + item.sheetName + '</span>';
  }).join(' ');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>E-Lab Universal Master Web App - พร้อมใช้งาน</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Sarabun:wght@400;500;600&display=swap" rel="stylesheet">' +
    '<style>' +
    'body{font-family:"Sarabun",system-ui,-apple-system,sans-serif;background:#090d16;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1.5rem;box-sizing:border-box;}' +
    '.card{background:#0f172a;border:1px solid rgba(56,189,248,0.3);padding:2.25rem 2rem;border-radius:18px;text-align:center;max-width:720px;box-shadow:0 20px 40px rgba(0,0,0,0.6);}' +
    '.badge{background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.4);padding:0.4rem 1.2rem;border-radius:9999px;font-size:0.85rem;font-weight:600;display:inline-block;margin-bottom:1.25rem;font-family:"Chakra Petch",sans-serif;}' +
    'h2{color:#38bdf8;margin:0 0 0.5rem 0;font-size:1.6rem;font-weight:700;font-family:"Chakra Petch",sans-serif;}p{color:#94a3b8;line-height:1.6;margin:0 0 1.25rem 0;font-size:0.95rem;}' +
    '.info{background:rgba(15,23,42,0.85);border:1px solid #334155;border-radius:12px;padding:1.25rem;font-size:0.875rem;color:#cbd5e1;text-align:left;line-height:1.6;margin-bottom:1.25rem;}' +
    'a.sheet-btn{background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;text-decoration:none;padding:0.6rem 1.25rem;border-radius:8px;font-weight:600;display:inline-flex;align-items:center;gap:0.5rem;font-size:0.9rem;margin-top:0.5rem;transition:all 0.2s;}' +
    'a.sheet-btn:hover{background:#38bdf8;color:#0f172a;}' +
    '</style></head><body><div class="card">' +
    '<div class="badge">✓ Master Universal Backend (Active)</div>' +
    '<h2>ระบบรวมคะแนนทุกใบงาน Electronic Analysis พร้อมทำงาน</h2>' +
    '<p>สคริปต์นี้ทำหน้าที่เป็น Central API รวมศูนย์ รองรับการส่งคะแนนจาก <strong>ทุกใบงานทั้ง 17 แล็บ</strong> เข้าสู่ Google Sheet เดียวกัน พร้อมระบบแยกแท็บอัตโนมัติ</p>' +
    '<div class="info">' +
    '📊 <strong>ไฟล์สเปรดชีตหลัก:</strong> ' + ssName + '<br>' +
    '🔗 <a href="' + ssUrl + '" target="_blank" class="sheet-btn">เปิดดู Google Sheets รวมคะแนน</a><br><br>' +
    '📑 <strong>แท็บใบงานที่รองรับ (' + Object.keys(LAB_REGISTRY).length + ' แล็บ):</strong><br>' +
    '<div style="margin-top:0.5rem;">' + labsListHtml + '</div>' +
    '</div>' +
    '<p style="font-size:0.82rem;color:#64748b;margin:0;">💡 นำ Web App URL ของหน้านี้ไปวางในช่อง "ตั้งค่า Web App URL กลาง" ที่หน้า E-Lab Portal หรือในแต่ละใบงาน เพื่อบันทึกคะแนนรวมได้ทันทีครับ</p>' +
    '</div></body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('E-Lab Universal Master Web App - พร้อมใช้งาน')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// =========================================================================
// 🚀 POST Handler (Submission & Routing Controller)
// =========================================================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(20000);

  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    // หากข้อมูลถูกห่อใน data.data ให้แตกออกมา (Unwrap)
    if (data.data && typeof data.data === 'object') {
      for (var key in data.data) {
        if (typeof data[key] === 'undefined') {
          data[key] = data.data[key];
        }
      }
    }

    var ss = getTargetSpreadsheet();
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '❌ ไม่พบ Google Spreadsheet: กรุณาระบุ TARGET_SPREADSHEET_ID หรือเปิดสคริปต์จากเมนู ส่วนขยาย > Apps Script ในไฟล์ Google Sheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. ตรวจสอบการ Ping / ทดสอบเชื่อมต่อ
    if (data.action === 'testConnection' || data.action === 'ping' || data.test === true || data.ping === true) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        type: 'master',
        message: 'เชื่อมต่อ Universal Master Google Sheet: "' + ss.getName() + '" สำเร็จพร้อมบันทึกคะแนน!',
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. ปลดล็อกล้างประวัติส่งซ้ำ (กรณีอาจารย์ต้องการล้างข้อมูลนักศึกษา)
    if (data.action === 'clearStudentLock' || data.action === 'clearStudent') {
      var sId = String(data.studentId || '').trim();
      if (sId) {
        clearStudentSubmissionFromAllSheets(ss, sId, data.labId);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'ปลดล็อกและลบประวัติเดิมของรหัส ' + sId + ' ใน Google Sheets เรียบร้อยแล้ว'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. ระบุเป้าหมายใบงาน (Lab Routing)
    var labKey = resolveLabKey(data);
    var labMeta = LAB_REGISTRY[labKey] || {
      num: 1,
      name: labKey,
      sheetName: 'Lab Submissions',
      title: 'ใบงาน ' + labKey
    };

    // 4. บันทึกข้อมูลลงแท็บของแล็บนั้นๆ
    var result = processMasterSubmission(ss, labKey, labMeta, data);

    // 5. ซิงค์และอัปเดตคะแนนลงแท็บแรก "📊 สรุปคะแนนรวม 17 แล็บ"
    if (result.status === 'success' && data.studentId) {
      try {
        updateMasterSummaryDashboard(ss, labKey, labMeta, data, result.score);
      } catch (sumErr) {
        console.warn("Summary dashboard update error:", sumErr);
      }
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'เกิดข้อผิดพลาดในการประมวลผล Master Backend: ' + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * ระบุว่าข้อมูลที่ส่งมาเป็นของแล็บใด (Smart Routing & Heuristics)
 */
function resolveLabKey(data) {
  // 1. ตรวจสอบจาก labId โดยตรง
  if (data.labId && LAB_REGISTRY[data.labId]) return data.labId;

  // 2. ตรวจสอบจาก labNumber (1 - 17)
  if (data.labNumber) {
    var num = parseInt(data.labNumber, 10);
    for (var k in LAB_REGISTRY) {
      if (LAB_REGISTRY[k].num === num) return k;
    }
  }

  // 3. ตรวจสอบจาก slug หรือชื่อโฟลเดอร์
  if (data.labSlug) {
    for (var s in LAB_REGISTRY) {
      if (s.indexOf(data.labSlug) !== -1 || data.labSlug.indexOf(s) !== -1) return s;
    }
  }

  // 4. Smart Heuristics: วิเคราะห์จากฟิลด์เฉพาะทางของแต่ละวงจร
  if (data.pin7805 || data.pin7905 || data.t1Rows && data.t1Rows.length && data.t1Rows[0].ic_model) return "elab17-voltage-regulator-sheet-app";
  if (data.topology || data.beta_feedback || (data.t1Rows && data.t1Rows.length && data.t1Rows[0].rf)) return "elab16-negative-feedback-sheet-app";
  if (data.cutoffFreq || (data.t1Rows && data.t1Rows.length && data.t1Rows[0].freq_in)) return "elab15-passive-filter-sheet-app";
  if (data.circuitMode && (data.circuitMode === 'emitter-follower' || data.circuitMode === 'class-b') || data.param_vcc) return "elab14-power-amp-sheet-app";
  if (data.totalGainDb || data.stage1Av || data.stage2Av) return "elab13-multistage-sheet-app";
  if (data.worksheetMode === 'datasheet' || data.vceoMax || data.pTotalMax) return "elab12-datasheet-reading-sheet-app";
  if (data.gmValue || data.rdValue || (data.circuitMode && data.circuitMode === 'cs-amplifier')) return "elab11-fet-small-signal-sheet-app";
  if (data.fetModel || data.vgsFixed || data.rdNominal) return "elab10-mosfet-bias-sheet-app";
  if (data.mosfetPinout || data.part1Rows || data.vgsTh) return "elab9-mosfet-pinout-sheet-app";
  if (data.hfe || data.hie || data.hParamModel) return "elab8-bjt-h-parameter-sheet-app";
  if (data.reValue || (data.circuitMode && data.circuitMode.indexOf('re') !== -1)) return "elab7-bjt-re-model-sheet-app";
  if (data.biasType || data.vceQ || data.icQ || data.bjtModel) return "elab6-bjt-bias-sheet-app";
  if (data.transistorModel || data.vceCutoff || data.icSat) return "elab5-transistor-sheet-app";
  if (data.isCapacitorConnected !== undefined || data.cFilterValue !== undefined) {
    if (data.diodeD1D4 !== undefined || data.bridgeModel) return "elab4-bridge-rectifier-sheet-app";
    return "elab3-rectifier-sheet-app";
  }
  if (data.bridgeModel) return "elab4-bridge-rectifier-sheet-app";
  if (data.zenerModel || data.vzNominal) return "elab2-zener-sheet-app";
  if (data.diodeCondition || data.diodeDirection || data.diodeModel) return "elab1-diode-sheet-app";

  return "elab1-diode-sheet-app"; // Default fallback
}

/**
 * ประมวลผลและบันทึกคะแนนลงในแท็บเฉพาะของแต่ละแล็บ
 */
function processMasterSubmission(ss, labKey, labMeta, data) {
  var sheetName = labMeta.sheetName;
  var sheet = ss.getSheetByName(sheetName);

  // คำนวณคะแนนประเมิน (เต็ม 10.0 คะแนน)
  var grading = calculateLabScore(labKey, data);
  var score = grading.score;
  var feedback = grading.feedback;
  var comment = grading.comment;

  // หากแท็บยังไม่มี ให้สร้างแท็บใหม่พร้อม Header
  if (!sheet) {
    // หากมีแท็บว่างเปล่าแท็บแรก (เช่น ชีต1 หรือ Sheet1) ให้เปลี่ยนชื่อเป็นแท็บนี้เลย
    var allSheets = ss.getSheets();
    if (allSheets.length === 1 && allSheets[0].getLastRow() === 0) {
      sheet = allSheets[0];
      sheet.setName(sheetName);
    } else {
      sheet = ss.insertSheet(sheetName);
    }
    
    var headers = [
      "Timestamp", "รหัสนักศึกษา", "ชื่อ-นามสกุล", "กลุ่ม/ห้อง", "วันที่ทำแล็บ",
      "โหมดการทดลอง", "คะแนน (เต็ม 10.0)", "ผลการประเมิน",
      "คำตอบข้อ 1", "คำตอบข้อ 2", "คำตอบข้อ 3", "คำตอบข้อ 4",
      "สรุปผลการทดลอง (Conclusion)", "Feedback รายละเอียดการตรวจ"
    ];

    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(2); // ตรึงคอลัมน์รหัสนักศึกษา
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#1e293b")
      .setFontColor("#38bdf8")
      .setBorder(true, true, true, true, true, true);
  }

  // ตรวจสอบการส่งซ้ำ (Anti-Duplicate Check ประจำแท็บนี้)
  var targetId = String(data.studentId || '').trim().replace(/^'/, '');
  if (targetId) {
    var vals = sheet.getDataRange().getValues();
    for (var r = 1; r < vals.length; r++) {
      var idCol = String(vals[r][1] || '').trim().replace(/^'/, '');
      if (idCol === targetId) {
        if (!data.allowResubmit) {
          var prevTime = vals[r][0] ? Utilities.formatDate(new Date(vals[r][0]), "Asia/Bangkok", "dd/MM/yyyy HH:mm") : "ก่อนหน้านี้";
          return {
            status: "duplicate",
            score: vals[r][6] || 0,
            maxScore: 10.0,
            message: "⚠️ รหัสนักศึกษา " + targetId + " ได้ส่งใบงานนี้ (" + labMeta.sheetName + ") ไปแล้วเมื่อ " + prevTime + "\nระบบอนุญาตให้ส่งได้เพียง 1 ครั้งเท่านั้น (หากต้องการแก้ไข กรุณาติดต่ออาจารย์ผู้สอน)"
          };
        }
        // หากอนุญาตส่งซ้ำ ให้ลบแถวเดิมออกเพื่อบันทึกข้อมูลใหม่ล่าสุด
        sheet.deleteRow(r + 1);
        break;
      }
    }
  }

  // สร้างแถวข้อมูลบันทึกลงในชีต
  var now = new Date();
  var studentName = data.studentName || '';
  var studentGroup = data.studentGroup || '';
  var labDate = data.labDate || '';
  var chosenModel = data.hwComponentModel || data.hwDiodeModel || data.componentModel || data.diodeModel || data.zenerModel || data.bjtModel || data.fetModel || 'อุปกรณ์มาตรฐาน';
  var labModeText = (data.labDataSource === 'hardware') 
    ? '🔌 ฮาร์ดแวร์จริง (' + chosenModel + ')'
    : '🔬 ซิมูเลเตอร์ (' + chosenModel + ')';

  var q1Ans = data.q1Answer || data.q1 || data.ansQ1 || '-';
  var q2Ans = data.q2Answer || data.q2 || data.ansQ2 || '-';
  var q3Ans = data.q3Answer || data.q3 || data.ansQ3 || '-';
  var q4Ans = data.q4Answer || data.q4 || data.ansQ4 || '-';
  var conclusion = data.labConclusion || data.conclusion || '-';

  var rowData = [
    now,
    targetId,
    studentName,
    studentGroup,
    labDate,
    labModeText,
    score + " / 10.0",
    comment,
    q1Ans,
    q2Ans,
    q3Ans,
    q4Ans,
    conclusion,
    feedback
  ];

  sheet.appendRow(rowData);
  sheet.autoResizeColumns(1, rowData.length);

  return {
    status: "success",
    score: score,
    maxScore: 10.0,
    comment: comment,
    feedback: feedback,
    message: "บันทึกผลการทดลองสำเร็จแล้ว! 🎉\n\n" +
             "📁 บันทึกลงชีต: \"" + ss.getName() + "\"\n" +
             "📑 แท็บ: " + sheetName + "\n" +
             "คะแนนประเมินอัตโนมัติ: " + score + " / 10.0 คะแนน (" + comment + ")"
  };
}

/**
 * สร้างหรืออัปเดตข้อมูลในแท็บแรก: "📊 สรุปคะแนนรวม 17 แล็บ" (Dashboard Tab)
 */
function updateMasterSummaryDashboard(ss, labKey, labMeta, data, labScore) {
  var summarySheetName = "📊 สรุปคะแนนรวม 17 แล็บ";
  var sheet = ss.getSheetByName(summarySheetName);

  var labKeys = Object.keys(LAB_REGISTRY);

  if (!sheet) {
    sheet = ss.insertSheet(summarySheetName, 0); // แทรกเป็นแท็บแรกสุด
    var headers = ["รหัสนักศึกษา", "ชื่อ-นามสกุล", "กลุ่ม/ห้อง"];
    labKeys.forEach(function(k) {
      headers.push("Lab " + LAB_REGISTRY[k].num);
    });
    headers.push("คะแนนรวมทั้งหมด (เต็ม 170.0)");
    headers.push("ส่งแล้ว (แล็บ)");
    headers.push("ร้อยละความสำเร็จ (%)");
    headers.push("อัปเดตล่าสุด");

    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(3); // ตรึง รหัส, ชื่อ, กลุ่ม
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#090d16")
      .setFontColor("#38bdf8")
      .setBorder(true, true, true, true, true, true);

    // ลบแท็บว่างเปล่าเริ่มต้น (เช่น ชีต1 หรือ Sheet1) หากยังว่างเปล่า
    var defaultEmpty = ss.getSheetByName("ชีต1") || ss.getSheetByName("Sheet1");
    if (defaultEmpty && defaultEmpty.getLastRow() === 0 && ss.getSheets().length > 1) {
      try { ss.deleteSheet(defaultEmpty); } catch (e) {}
    }
  }

  var studentId = String(data.studentId || '').trim();
  var studentName = data.studentName || '';
  var studentGroup = data.studentGroup || '';
  if (!studentId) return;

  var vals = sheet.getDataRange().getValues();
  var targetRow = -1;

  for (var r = 1; r < vals.length; r++) {
    if (String(vals[r][0] || '').trim() === studentId) {
      targetRow = r + 1;
      break;
    }
  }

  // หา Index คอลัมน์ของแล็บนี้
  var labColIdx = -1;
  for (var c = 0; c < labKeys.length; c++) {
    if (labKeys[c] === labKey) {
      labColIdx = 4 + c; // 1-based (เริ่มคอลัมน์ D = 4)
      break;
    }
  }

  var totalLabsCount = labKeys.length;
  var sumColIdx = 4 + totalLabsCount;       // คอลัมน์คะแนนรวม
  var countColIdx = sumColIdx + 1;           // คอลัมน์จำนวนแล็บที่ส่ง
  var percentColIdx = countColIdx + 1;       // คอลัมน์ร้อยละ
  var timeColIdx = percentColIdx + 1;        // คอลัมน์อัปเดตล่าสุด

  var numScore = parseFloat(labScore) || 0;

  if (targetRow === -1) {
    // เพิ่มแถวใหม่สำหรับนักศึกษาคนนี้
    var newRow = [studentId, studentName, studentGroup];
    for (var i = 0; i < totalLabsCount; i++) {
      if (labKeys[i] === labKey) {
        newRow.push(numScore);
      } else {
        newRow.push("-");
      }
    }
    newRow.push(numScore); // คะแนนรวม
    newRow.push(1);        // ส่ง 1 แล็บ
    newRow.push(((numScore / 170.0) * 100).toFixed(1) + "%");
    newRow.push(Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss"));

    sheet.appendRow(newRow);
  } else {
    // อัปเดตแถวเดิมที่มีอยู่
    if (labColIdx !== -1) {
      sheet.getRange(targetRow, labColIdx).setValue(numScore);
    }
    sheet.getRange(targetRow, 2).setValue(studentName);
    sheet.getRange(targetRow, 3).setValue(studentGroup);
    sheet.getRange(targetRow, timeColIdx).setValue(Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss"));

    // คำนวณคะแนนรวมและจำนวนแล็บที่ส่งใหม่
    var rowScores = sheet.getRange(targetRow, 4, 1, totalLabsCount).getValues()[0];
    var sum = 0.0;
    var submittedCount = 0;
    for (var s = 0; s < rowScores.length; s++) {
      var val = parseFloat(rowScores[s]);
      if (!isNaN(val)) {
        sum += val;
        submittedCount++;
      }
    }
    sheet.getRange(targetRow, sumColIdx).setValue(parseFloat(sum.toFixed(1)));
    sheet.getRange(targetRow, countColIdx).setValue(submittedCount);
    sheet.getRange(targetRow, percentColIdx).setValue(((sum / 170.0) * 100).toFixed(1) + "%");
  }
}

/**
 * ลบประวัติการส่งงานของนักศึกษาจากแท็บใบงานและแดชบอร์ด
 */
function clearStudentSubmissionFromAllSheets(ss, studentId, specificLabKey) {
  var sheets = ss.getSheets();
  sheets.forEach(function(s) {
    if (specificLabKey) {
      var meta = LAB_REGISTRY[specificLabKey];
      if (meta && s.getName() !== meta.sheetName && s.getName() !== "📊 สรุปคะแนนรวม 17 แล็บ") return;
    }
    var vals = s.getDataRange().getValues();
    for (var r = vals.length - 1; r >= 1; r--) {
      var idCol = String(vals[r][0] || vals[r][1] || '').trim().replace(/^'/, '');
      if (idCol === studentId) {
        s.deleteRow(r + 1);
      }
    }
  });
}

/**
 * คำนวณคะแนนตามเกณฑ์มาตรฐาน 10.0 คะแนน
 */
function calculateLabScore(labKey, data) {
  // หาก Client ได้ประเมินผลผ่าน localGradeSimulator มาแล้ว ให้ใช้คะแนนและ Feedback นั้นโดยตรง
  if (data.localScore !== undefined && data.localScore !== null) {
    var rawScore = parseFloat(data.localScore);
    if (!isNaN(rawScore)) {
      var s = Math.min(10.0, Math.max(0.0, rawScore));
      var comm = data.localComment || (s >= 9 ? "ผ่านเกณฑ์ดีเยี่ยม (Excellent)" : (s >= 7 ? "ผ่านเกณฑ์ดี (Good)" : (s >= 5 ? "ผ่านเกณฑ์พอใช้ (Fair)" : "ต้องปรับปรุงแก้ไขใบงาน")));
      return {
        score: parseFloat(s.toFixed(1)),
        comment: comm,
        feedback: data.localFeedback || "ประเมินผลตามเกณฑ์รูบริก 10 คะแนนมาตรฐานสำเร็จ"
      };
    }
  }

  // Fallback: ตรวจสอบแบบทดสอบปรนัย 4 ข้อ (4.0 คะแนน) และความสมบูรณ์ของสรุปผล (6.0 คะแนน)
  var qScore = 0;
  for (var i = 1; i <= 4; i++) {
    var qAns = data["q" + i + "Answer"] || data["q" + i];
    if (qAns && String(qAns).trim().length > 0) qScore += 1.0;
  }

  var concLen = (data.labConclusion || data.conclusion || '').trim().length;
  var concScore = concLen > 30 ? 2.0 : (concLen > 10 ? 1.0 : 0.0);
  var tableScore = 4.0; // คะแนนส่วนบันทึกผลการทดลอง

  var total = Math.min(10.0, qScore + concScore + tableScore);
  var comment = "ต้องปรับปรุงแก้ไขใบงาน";
  if (total >= 9.0) comment = "ผ่านเกณฑ์ดีเยี่ยม (Excellent)";
  else if (total >= 7.0) comment = "ผ่านเกณฑ์ดี (Good)";
  else if (total >= 5.0) comment = "ผ่านเกณฑ์พอใช้ (Fair)";

  return {
    score: parseFloat(total.toFixed(1)),
    comment: comment,
    feedback: "คะแนนคำถามวัดความเข้าใจ: " + qScore + "/4.0 คะแนน | คะแนนตารางและสรุปผล: " + (concScore + tableScore) + "/6.0 คะแนน"
  };
}
