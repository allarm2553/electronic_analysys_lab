import os
import base64

scratch_dir = r"C:\Users\terd2\.gemini\antigravity\scratch"
zener_dir = os.path.join(scratch_dir, "lab-simulators", "zener-lab-simulator")
gas_dir = os.path.dirname(os.path.abspath(__file__))

# 1. Read styles.css
with open(os.path.join(zener_dir, "styles.css"), "r", encoding="utf-8") as f:
    css_content = f.read()

# 2. Read simulator.js
with open(os.path.join(zener_dir, "simulator.js"), "r", encoding="utf-8") as f:
    sim_content = f.read()

# 3. Read index.html structure
with open(os.path.join(zener_dir, "index.html"), "r", encoding="utf-8") as f:
    html = f.read()

# 4. Read ui.js
with open(os.path.join(zener_dir, "ui.js"), "r", encoding="utf-8") as f:
    ui_content = f.read()

# Assemble GAS-specific JS client logic
gas_client_js = r"""
/* ==========================================================================
   PART 4: GOOGLE SHEETS WEB APP SUBMISSION & AUTO-GRADING UI
   ========================================================================== */

function submitReportToGAS() {
  const name = document.getElementById('student-name').value.trim();
  const id = document.getElementById('student-id').value.trim();
  const group = document.getElementById('student-group').value.trim();
  const date = document.getElementById('lab-date').value;
  
  if (!name || !id || !group || !date) {
    alert('⚠️ กรุณากรอกข้อมูลส่วนตัว (ชื่อ-นามสกุล, รหัสนักศึกษา, กลุ่มเรียน และวันที่ทดลอง) ให้ครบถ้วนก่อนส่งใบงาน!');
    return;
  }
  
  // Package radio inputs
  let diodeStatus = '';
  const dsRadios = document.getElementsByName('diode-status');
  for (let r of dsRadios) {
    if (r.checked) diodeStatus = r.value;
  }
  
  // Package table rows
  const part2Rows = [];
  for (let i = 0; i < 12; i++) {
    part2Rows.push({
      vr1: document.getElementById('v-r-val-' + i).value.trim(),
      vd1: document.getElementById('v-d-val-' + i).value.trim(),
      iCalc: document.getElementById('i-calc-val-' + i).value.trim(),
      iMeas: document.getElementById('i-meas-val-' + i).value.trim()
    });
  }
  
  const data = {
    studentName: name,
    studentId: id,
    studentGroup: group,
    labDate: date,
    diodeCondition: STATE.diodeCondition,
    rForward: document.getElementById('r-forward').value.trim(),
    rReverse: document.getElementById('r-reverse').value.trim(),
    diodeStatus: diodeStatus,
    diodeReason: document.getElementById('diode-reason').value.trim(),
    part2Rows: part2Rows,
    q1Answer: document.getElementById('q1-answer').value.trim(),
    q2Answer: document.getElementById('q2-answer').value.trim(),
    q3Answer: document.getElementById('q3-answer').value.trim(),
    labConclusion: document.getElementById('lab-conclusion').value.trim()
  };
  
  // Show Loading Modal/Overlay
  showGradingOverlay(true);
  
  // Call Google Apps Script backend
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(onSuccessGrading)
      .withFailureHandler(onFailureGrading)
      .submitWorksheet(data);
  } else {
    // Simulator local fallback for testing
    setTimeout(() => {
      onSuccessGrading({
        status: 'success',
        score: 10,
        maxScore: 10,
        comment: 'ผ่านเกณฑ์ดีมาก (Local Simulation)',
        feedback: '1.1 ความต้านทานไบอัสตรง: ถูกต้อง\n1.2 ความต้านทานไบอัสกลับ: ถูกต้อง\n1.3 ระบุสรุปสภาพซีเนอร์ไดโอด: ถูกต้อง\nตอนที่ 2 ตารางการรักษาระดับแรงดัน: ถูกต้อง 12 จาก 12 ระดับแรงดัน (ได้ 7 / 7 คะแนน)'
      });
    }, 1500);
  }
}
window.submitReportToGAS = submitReportToGAS;

function showGradingOverlay(show) {
  let overlay = document.getElementById('grading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'grading-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(11, 15, 25, 0.9)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '9999';
    overlay.style.color = '#f8fafc';
    overlay.style.fontFamily = 'Chakra Petch, sans-serif';
    
    overlay.innerHTML = `
      <div class="card" style="width: 90%; max-width: 500px; text-align: center; border: 2px solid var(--accent-cyan); background-color: var(--bg-secondary); padding: 30px; box-shadow: 0 0 20px rgba(56, 189, 248, 0.3);">
        <h2 id="overlay-title" style="margin-bottom: 20px; font-size: 24px; color: var(--accent-cyan);">กำลังประมวลผลคำตอบ...</h2>
        <div id="overlay-spinner" class="logo-icon" style="font-size: 50px; animation: spin 2s linear infinite; margin-bottom: 20px;">⚡</div>
        <p id="overlay-message" style="font-size: 14px; font-family: Sarabun, sans-serif; color: var(--text-muted); line-height: 1.6;"></p>
        <button id="overlay-close-btn" class="btn btn-primary" style="margin-top: 25px; display: none;" onclick="showGradingOverlay(false)">ปิดหน้าต่างนี้ ❌</button>
      </div>
      <style>
        @keyframes spin { 100% { transform: rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(overlay);
  }
  
  overlay.style.display = show ? 'flex' : 'none';
  if (show) {
    document.getElementById('overlay-title').innerText = 'กำลังส่งข้อมูลควิซและประมวลผล...';
    document.getElementById('overlay-title').style.color = 'var(--accent-cyan)';
    document.getElementById('overlay-spinner').style.display = 'block';
    document.getElementById('overlay-message').innerText = 'ระบบกำลังส่งข้อมูลผลการทดลองของคุณไปยังฐานข้อมูล Google Sheets และเรียกสมการวิเคราะห์ตรวจให้คะแนนอัตโนมัติ กรุณารอสักครู่...';
    document.getElementById('overlay-close-btn').style.display = 'none';
  }
}
window.showGradingOverlay = showGradingOverlay;

function onSuccessGrading(res) {
  showGradingOverlay(true);
  const title = document.getElementById('overlay-title');
  const spinner = document.getElementById('overlay-spinner');
  const msg = document.getElementById('overlay-message');
  const closeBtn = document.getElementById('overlay-close-btn');
  
  if (res.status === 'success') {
    title.innerText = '🎉 ใบงานตรวจและบันทึกคะแนนเสร็จสิ้น!';
    title.style.color = 'var(--accent-green)';
    spinner.style.display = 'none';
    
    // Format feedback text beautifully
    const formattedFeedback = res.feedback.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
    
    msg.innerHTML = `
      <div style="text-align: left; background: rgba(15,23,42,0.4); border: 1px solid var(--border-color); border-radius: 6px; padding: 15px; margin: 15px 0;">
        <p style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: var(--text-main);">
          คะแนนสอบ: <span style="font-size: 24px; color: var(--accent-green);">${res.score}</span> / ${res.maxScore}
        </p>
        <p style="font-size: 14px; font-weight: bold; margin-bottom: 15px; color: var(--text-muted);">
          การประเมิน: <span style="color: var(--accent-cyan);">${res.comment}</span>
        </p>
        <hr style="border: 0; border-top: 1px solid var(--border-color); margin-bottom: 15px;">
        <p style="font-size: 13px; font-weight: bold; color: var(--accent-cyan); margin-bottom: 8px;">รายละเอียดการตรวจ:</p>
        <div style="font-size: 12px; font-family: Sarabun, sans-serif; line-height: 1.8; color: var(--text-main);">${formattedFeedback}</div>
      </div>
      <p style="font-size: 13px; font-family: Sarabun, sans-serif; color: var(--text-muted);">ขอบคุณที่ส่งรายงานผลการปฏิบัติการ ข้อมูลการส่งได้รับการเก็บบันทึกบน Google Sheets ของอาจารย์เรียบร้อยแล้ว!</p>
    `;
    closeBtn.style.display = 'inline-block';
  } else {
    onFailureGrading(res.message);
  }
}
window.onSuccessGrading = onSuccessGrading;

function onFailureGrading(error) {
  showGradingOverlay(true);
  const title = document.getElementById('overlay-title');
  const spinner = document.getElementById('overlay-spinner');
  const msg = document.getElementById('overlay-message');
  const closeBtn = document.getElementById('overlay-close-btn');
  
  title.innerText = '❌ เกิดข้อผิดพลาดในการส่งข้อมูล';
  title.style.color = 'var(--accent-red)';
  spinner.style.display = 'none';
  msg.innerHTML = `
    <p style="color: var(--accent-red); font-weight: bold; margin-bottom: 15px;">ไม่สามารถเขียนข้อมูลหรือส่งให้คะแนนได้:</p>
    <div style="font-family: monospace; font-size: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--accent-red); padding: 10px; border-radius: 4px; color: var(--text-main); margin-bottom: 15px; text-align: left;">
      ${error}
    </div>
    <p style="font-size: 13px; font-family: Sarabun, sans-serif; color: var(--text-muted);">คำแนะนำ: โปรดตรวจสอบว่าอาจารย์ผู้สอนเปิดสิทธิ์การเข้าถึง Web App เป็น "Anyone" (ทุกคน) หรือยัง และคุณมีการเชื่อมต่ออินเทอร์เน็ตอยู่หรือไม่</p>
  `;
  closeBtn.style.display = 'inline-block';
}
window.onFailureGrading = onFailureGrading;
"""

# Replace external CSS link with inline style block
html = html.replace(
    '<link rel="stylesheet" href="styles.css">',
    f'<style>\n{css_content}\n</style>'
)

# Replace local script inclusions with inline script blocks
html = html.replace(
    '<script src="simulator.js"></script>\n  <script src="ui.js"></script>',
    f'<script>\n{sim_content}\n</script>\n<script>\n{ui_content}\n{gas_client_js}\n</script>'
)

# Re-try with space variance if first replace missed
if '<script src="simulator.js"></script>' in html:
    html = html.replace(
        '<script src="simulator.js"></script>',
        f'<script>\n{sim_content}\n</script>'
    )
if '<script src="ui.js"></script>' in html:
    html = html.replace(
        '<script src="ui.js"></script>',
        f'<script>\n{ui_content}\n{gas_client_js}\n</script>'
    )

# Replace the print button with both print and submit buttons in report footer
html = html.replace(
    '<button class="btn btn-primary btn-large" onclick="printReport()">🖨️ พิมพ์รายงานผลการทดลอง / บันทึก PDF</button>',
    '''<div class="footer-buttons-row" style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; width: 100%;">
            <button class="btn btn-secondary btn-large" onclick="printReport()">🖨️ พิมพ์รายงานผลการทดลอง / บันทึก PDF 🖨️</button>
            <button class="btn btn-primary btn-large" style="background: linear-gradient(135deg, #10b981 0%, #047857 100%); border-color: #10b981;" onclick="submitReportToGAS()">ส่งใบงานและตรวจคะแนนอัตโนมัติ 🚀</button>
          </div>'''
)

# Embed images as Base64 if needed
banner_path = os.path.join(zener_dir, "diode_lab_banner.png")
if os.path.exists(banner_path):
    with open(banner_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    html = html.replace('src="diode_lab_banner.png"', f'src="data:image/png;base64,{encoded_string}"')

# Write to target GAS directory
with open(os.path.join(gas_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

print("GAS index.html successfully compiled!")
