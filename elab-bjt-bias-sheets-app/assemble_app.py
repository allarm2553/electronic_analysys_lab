import os
import base64

scratch_dir = r"C:\Users\terd2\.gemini\antigravity\scratch"
bjt_dir = os.path.join(scratch_dir, "lab-simulators", "bjt-bias-lab-simulator")
gas_dir = os.path.dirname(os.path.abspath(__file__))

# 1. Read styles.css
with open(os.path.join(bjt_dir, "styles.css"), "r", encoding="utf-8") as f:
    css_content = f.read()

# 2. Read simulator.js
with open(os.path.join(bjt_dir, "simulator.js"), "r", encoding="utf-8") as f:
    sim_content = f.read()

# 3. Read index.html structure
with open(os.path.join(bjt_dir, "index.html"), "r", encoding="utf-8") as f:
    html = f.read()

# 4. Read ui.js
with open(os.path.join(bjt_dir, "ui.js"), "r", encoding="utf-8") as f:
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
  
  // Package table rows
  const part2Rows = [];
  for (let i = 0; i < 6; i++) {
    part2Rows.push({
      vrb: document.getElementById('v-rb-val-' + i).value.trim(),
      vbe: document.getElementById('v-be-val-' + i).value.trim(),
      ib: document.getElementById('i-b-val-' + i).value.trim(),
      vrc: document.getElementById('v-rc-val-' + i).value.trim(),
      vce: document.getElementById('v-ce-val-' + i).value.trim(),
      ic: document.getElementById('i-c-val-' + i).value.trim()
    });
  }
  
  const data = {
    studentName: name,
    studentId: id,
    studentGroup: group,
    labDate: date,
    diodeCondition: STATE.diodeCondition,
    part2Rows: part2Rows,
    ansVceQ: document.getElementById('ans-vce-q').value.trim(),
    ansIcQ: document.getElementById('ans-ic-q').value.trim(),
    ansBetaCalc: document.getElementById('ans-beta-calc').value.trim(),
    ansPin1: document.getElementById('ans-pin1').value,
    ansPin2: document.getElementById('ans-pin2').value,
    ansPin3: document.getElementById('ans-pin3').value,
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
        feedback: 'ตารางบันทึกผลการทดลอง: ถูกต้อง 6 จาก 6 แถวระดับแรงดัน (ได้ 6 คะแนน)\nพิกัด Vce,Q: ถูกต้อง (~4.79 V)\nพิกัด Ic,Q: ถูกต้อง (~7.21 mA)\nคำนวณอัตราขยายกระแส Beta: ถูกต้อง (~300 เท่า)\nระบุขั้วตำแหน่งขา BC108: ถูกต้อง (1=Emitter, 2=Base, 3=Collector)'
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
        <h2 id="overlay-title" style="margin-bottom: 20px; font-size: 24px; color: var(--accent-cyan);">กำลังส่งข้อมูลคำตอบ...</h2>
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
    document.getElementById('overlay-title').innerText = 'กำลังส่งข้อมูลใบงานและประมวลผล...';
    document.getElementById('overlay-title').style.color = 'var(--accent-cyan)';
    document.getElementById('overlay-spinner').style.display = 'block';
    document.getElementById('overlay-message').innerText = 'ระบบกำลังส่งข้อมูลผลการทดลองของคุณไปยัง Google Sheets ของผู้สอนเพื่อตรวจคำนวณและบันทึกคะแนนสะสมอัตโนมัติ กรุณารอสักครู่...';
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
    title.innerText = '🎉 ตรวจใบงานและบันทึกข้อมูลคะแนนสำเร็จ!';
    title.style.color = 'var(--accent-green)';
    spinner.style.display = 'none';
    
    const formattedFeedback = res.feedback.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
    
    msg.innerHTML = `
      <div style="text-align: left; background: rgba(15,23,42,0.4); border: 1px solid var(--border-color); border-radius: 6px; padding: 15px; margin: 15px 0;">
        <p style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: var(--text-main);">
          คะแนนสอบ: <span style="font-size: 24px; color: var(--accent-green);">${res.score}</span> / ${res.maxScore}
        </p>
        <p style="font-size: 14px; font-weight: bold; margin-bottom: 15px; color: var(--text-muted);">
          ผลประเมินสรุป: <span style="color: var(--accent-cyan);">${res.comment}</span>
        </p>
        <hr style="border: 0; border-top: 1px solid var(--border-color); margin-bottom: 15px;">
        <p style="font-size: 13px; font-weight: bold; color: var(--accent-cyan); margin-bottom: 8px;">ผลวิเคราะห์การหักคะแนน:</p>
        <div style="font-size: 12px; font-family: Sarabun, sans-serif; line-height: 1.8; color: var(--text-main);">${formattedFeedback}</div>
      </div>
      <p style="font-size: 13px; font-family: Sarabun, sans-serif; color: var(--text-muted);">รายงานของคุณถูกบันทึกส่งเข้าสเปรดชีตของอาจารย์โดยตรงเรียบร้อยแล้ว!</p>
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
  
  title.innerText = '❌ ระบบส่งคะแนนล้มเหลว';
  title.style.color = 'var(--accent-red)';
  spinner.style.display = 'none';
  msg.innerHTML = `
    <p style="color: var(--accent-red); font-weight: bold; margin-bottom: 15px;">สาเหตุเนื่องมาจาก:</p>
    <div style="font-family: monospace; font-size: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--accent-red); padding: 10px; border-radius: 4px; color: var(--text-main); margin-bottom: 15px; text-align: left;">
      ${error}
    </div>
    <p style="font-size: 13px; font-family: Sarabun, sans-serif; color: var(--text-muted);">กรุณาติดต่อตรวจสอบความถูกต้องของสิทธิ์ Web App กับอาจารย์ผู้ดูแลระบบอีกครั้ง</p>
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

# Replace print button to include submission action
html = html.replace(
    '<button class="btn btn-primary btn-large" onclick="printReport()">🖨️ พิมพ์รายงานผลการทดลอง / บันทึก PDF</button>',
    '''<button class="btn btn-secondary btn-large" onclick="printReport()">🖨️ พิมพ์รายงานผลการทดลอง / บันทึก PDF 🖨️</button>
          <button class="btn btn-primary btn-large" style="background: linear-gradient(135deg, #10b981 0%, #047857 100%); border-color: #10b981;" onclick="submitReportToGAS()">ส่งใบงานและตรวจคะแนนอัตโนมัติ 🚀</button>'''
)

# Embed images as Base64 if needed
banner_path = os.path.join(bjt_dir, "diode_lab_banner.png")
# Fallback to copy from other simulator if it exists
if not os.path.exists(banner_path):
    zener_banner = os.path.join(scratch_dir, "lab-simulators", "zener-lab-simulator", "diode_lab_banner.png")
    if os.path.exists(zener_banner):
        import shutil
        shutil.copy(zener_banner, banner_path)

if os.path.exists(banner_path):
    with open(banner_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    html = html.replace('src="diode_lab_banner.png"', f'src="data:image/png;base64,{encoded_string}"')

# Write to target GAS directory
with open(os.path.join(gas_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

print("GAS index.html successfully compiled!")
