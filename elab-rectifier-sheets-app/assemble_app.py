import os

scratch_dir = r"C:\Users\terd2\.gemini\antigravity\scratch"
rectifier_src_dir = os.path.join(scratch_dir, "lab-simulators", "rectifier-lab-simulator")
gas_dir = os.path.dirname(os.path.abspath(__file__))

# 1. Read styles.css
with open(os.path.join(rectifier_src_dir, "styles.css"), "r", encoding="utf-8") as f:
    css_content = f.read()

# 2. Read simulator.js
with open(os.path.join(rectifier_src_dir, "simulator.js"), "r", encoding="utf-8") as f:
    sim_content = f.read()

# 3. Read index.html structure
with open(os.path.join(rectifier_src_dir, "index.html"), "r", encoding="utf-8") as f:
    html = f.read()

# 4. Read ui.js
with open(os.path.join(rectifier_src_dir, "ui.js"), "r", encoding="utf-8") as f:
    ui_content = f.read()

# Assemble GAS-specific JS client logic
gas_client_js = r"""
/* ==========================================================================
   PART 5: GOOGLE SHEETS WEB APP SUBMISSION & AUTO-GRADING UI
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
  
  // Package table 1 rows (4 rows)
  const t1Rows = [];
  for (let i = 0; i < 4; i++) {
    t1Rows.push(document.getElementById('t1-val-' + i).value);
  }
  
  // Package table 2 rows (6 rows)
  const t2Rows = [];
  for (let i = 0; i < 6; i++) {
    t2Rows.push(document.getElementById('t2-val-' + i).value);
  }
  
  // Get post-lab question responses
  const q1 = getSelectedRadioValue('q1');
  const q2 = getSelectedRadioValue('q2');
  const q3 = getSelectedRadioValue('q3');
  
  const conclusion = document.getElementById('lab-conclusion').value.trim();
  
  if (!q1 || !q2 || !q3) {
    alert('⚠️ กรุณาตอบคำถามท้ายการทดลองให้ครบทั้ง 3 ข้อ!');
    return;
  }
  
  const data = {
    studentName: name,
    studentId: id,
    studentGroup: group,
    labDate: date,
    t1Rows: t1Rows,
    t2Rows: t2Rows,
    q1: q1,
    q2: q2,
    q3: q3,
    labConclusion: conclusion
  };
  
  // Show loading indicator
  showSubmittingDialog();
  
  // Send data to GAS backend submitWorksheet function
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(onSuccessGrading)
      .withFailureHandler(onFailureGrading)
      .submitWorksheet(data);
  } else {
    // Offline simulation mode
    setTimeout(() => {
      alert('⚠️ ไม่พบการเชื่อมต่อ Google Apps Script (กำลังรันในโหมด Offline / Local Simulator)\nระบบจะทำคะแนนจำลองให้ที่นี่:\n\n' + JSON.stringify(data, null, 2));
      hideSubmittingDialog();
    }, 1000);
  }
}
window.submitReportToGAS = submitReportToGAS;

function getSelectedRadioValue(name) {
  const radio = document.querySelector(`input[name="${name}"]:checked`);
  return radio ? radio.value : null;
}

function showSubmittingDialog() {
  let modal = document.getElementById('grading-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'grading-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:9999; backdrop-filter:blur(5px); font-family:Sarabun, sans-serif;';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div style="background:#1e293b; border:1px solid rgba(255,255,255,0.15); border-radius:16px; padding:30px; max-width:480px; width:90%; text-align:center; color:#fff; box-shadow:0 15px 30px rgba(0,0,0,0.5);">
      <div style="font-size:40px; margin-bottom:15px; animation:spin 1.5s linear infinite;">⏳</div>
      <h3 style="font-family:Chakra Petch, sans-serif; font-size:18px; margin-bottom:10px;">กำลังส่งผลตรวจและประเมินคะแนน...</h3>
      <p style="font-size:13px; color:#94a3b8;">ระบบกำลังคำนวณและเกรดใบงานตามหลักการทางคณิตศาสตร์แบบอัตโนมัติ โปรดรอสักครู่</p>
    </div>
  `;
  modal.style.display = 'flex';
}

function hideSubmittingDialog() {
  const modal = document.getElementById('grading-modal');
  if (modal) modal.style.display = 'none';
}

function onSuccessGrading(res) {
  hideSubmittingDialog();
  
  let modal = document.getElementById('grading-modal');
  if (!modal) return;
  
  if (res.status === 'success') {
    modal.innerHTML = `
      <div style="background:#1e293b; border:2px solid #10b981; border-radius:16px; padding:30px; max-width:520px; width:95%; text-align:left; color:#fff; box-shadow:0 15px 30px rgba(0,0,0,0.5); position:relative;">
        <h2 style="font-family:Chakra Petch, sans-serif; font-size:22px; color:#10b981; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; display:flex; align-items:center; gap:8px;">
          <span>🎉</span> ส่งและตรวจใบงานเรียบร้อยแล้ว
        </h2>
        <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); border-radius:10px; padding:15px; margin-bottom:20px; text-align:center;">
          <span style="font-size:12px; color:#94a3b8; display:block;">คะแนนที่ได้ในการประเมิน</span>
          <strong style="font-size:36px; color:#10b981; font-family:Chakra Petch, sans-serif;">${res.score} / ${res.maxScore}</strong>
          <span style="display:block; font-size:13px; font-weight:bold; margin-top:5px; color:#34d399;">เกณฑ์การประเมิน: ${res.comment}</span>
        </div>
        <h4 style="font-family:Chakra Petch, sans-serif; margin-bottom:8px; color:#94a3b8; font-size:13px;">สรุปรายการตรวจสอบ:</h4>
        <pre style="background:#0f172a; border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:12px; font-size:12px; max-height:180px; overflow-y:auto; font-family:Sarabun, sans-serif; white-space:pre-wrap; color:#cbd5e1; margin-bottom:20px;">${res.feedback}</pre>
        <div style="text-align:center;">
          <button class="btn btn-primary" onclick="hideSubmittingDialog()" style="padding:10px 30px; font-size:13px;">ปิดหน้าต่างตรวจผล</button>
        </div>
      </div>
    `;
  } else {
    onFailureGrading(res.message);
  }
}
window.onSuccessGrading = onSuccessGrading;

function onFailureGrading(error) {
  hideSubmittingDialog();
  
  let modal = document.getElementById('grading-modal');
  if (!modal) return;
  
  modal.innerHTML = `
    <div style="background:#1e293b; border:2px solid #ef4444; border-radius:16px; padding:30px; max-width:480px; width:90%; text-align:center; color:#fff; box-shadow:0 15px 30px rgba(0,0,0,0.5);">
      <div style="font-size:40px; color:#ef4444; margin-bottom:15px;">❌</div>
      <h3 style="font-family:Chakra Petch, sans-serif; font-size:18px; color:#ef4444; margin-bottom:10px;">เกิดข้อผิดพลาดในการประเมินผล</h3>
      <p style="font-size:13px; color:#94a3b8; margin-bottom:20px;">รายละเอียด: ${error}</p>
      <button class="btn btn-secondary" onclick="hideSubmittingDialog()" style="padding:8px 24px; font-size:13px;">ปิด</button>
    </div>
  `;
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

# Write to target GAS directory
with open(os.path.join(gas_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

print("GAS index.html successfully compiled!")
