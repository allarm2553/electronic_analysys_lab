import os
import re

# Teacher card HTML template
def get_teacher_card_html(lab_id):
    return f'''        <!-- TEACHER GOOGLE SHEETS / GAS WEB APP ENDPOINT CONFIGURATION -->
        <div class="card gas-endpoint-card no-print" style="border: 1px dashed var(--accent-cyan, #38bdf8); background: rgba(15, 23, 42, 0.75); padding: 14px 18px; margin-bottom: 20px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🔗</span>
              <div>
                <strong style="color: var(--accent-cyan, #38bdf8); font-size: 13.5px;">เชื่อมต่อ Google Sheets ผู้สอน (Teacher Web App URL):</strong>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted, #94a3b8); font-family: 'Sarabun', sans-serif;">
                  นำลิงก์ Web App จาก Google Apps Script ของชีตผู้สอนมาวาง เพื่อบันทึกคะแนนเข้าชีตของท่านโดยตรง
                </p>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <a href="./Code.gs" download="Code_{lab_id}.gs" class="btn btn-secondary btn-small" style="padding: 4px 10px; font-size: 11.5px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; color: #93c5fd; border: 1px solid rgba(59,130,246,0.4); background: rgba(59,130,246,0.15); border-radius: 5px;" title="ดาวน์โหลดไฟล์ Code.gs ของแล็บนี้">
                📥 โหลด Code.gs
              </a>
              <button type="button" class="btn btn-secondary btn-small" onclick="copyCodeGsContent('{lab_id}')" style="padding: 4px 10px; font-size: 11.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; color: #d8b4fe; border: 1px solid rgba(168,85,247,0.4); background: rgba(168,85,247,0.15); border-radius: 5px;" title="คัดลอกโค้ด Code.gs ไปวางใน Google Apps Script">
                📋 คัดลอก Code.gs
              </button>
              <span id="gas-status-badge" style="font-size: 11.5px; padding: 3px 10px; border-radius: 12px; background: rgba(56, 189, 248, 0.12); color: var(--accent-cyan, #38bdf8); border: 1px solid var(--accent-cyan, #38bdf8); font-weight: 500;">
                🌐 โหมดจำลองในเครื่อง (ยังไม่เชื่อมต่อชีต)
              </span>
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px;">
            <input type="url" id="gas-endpoint-url" placeholder="วางลิงก์ https://script.google.com/macros/s/.../exec ที่นี่..." style="flex: 1; min-width: 250px; padding: 7px 12px; font-size: 12.5px; background: rgba(10, 15, 28, 0.85); border: 1px solid var(--border-color, rgba(71,85,105,0.35)); border-radius: 5px; color: #f8fafc;">
            <button type="button" class="btn btn-secondary btn-small" onclick="saveGasEndpoint()" style="padding: 7px 12px; font-size: 12px; cursor: pointer; border-radius: 5px; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8;">💾 บันทึก URL</button>
            <button type="button" class="btn btn-small" onclick="copyStudentShareLink('{lab_id}')" style="padding: 7px 12px; font-size: 12px; background: linear-gradient(135deg, #10b981, #059669); border: none; color: #fff; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="คัดลอกลิงก์ที่แนบ Google Apps Script ส่งให้นักเรียน">
              🔗 คัดลอกลิงก์ให้นักเรียน
            </button>
            <button type="button" class="btn btn-primary btn-small" onclick="testGasEndpoint()" style="padding: 7px 12px; font-size: 12px; cursor: pointer; border-radius: 5px; background: #0284c7; border: none; color: #fff;">🧪 ทดสอบเชื่อมต่อ</button>
          </div>
        </div>
'''

STANDARD_GAS_JS = '''/* ==========================================================================
   TEACHER GOOGLE SHEETS / GAS WEB APP ENDPOINT CONFIGURATION & DISPATCHER
   ========================================================================== */
function getGasStorageKey() {
  const match = window.location.pathname.match(/(elab\\d+-[a-z0-9-]+)/i);
  if (match) return 'elab_gas_endpoint_' + match[1];
  const parts = window.location.pathname.split('/').filter(p => p && p !== 'index.html');
  const labSlug = parts.length > 0 ? parts[parts.length - 1] : 'default_lab';
  return 'elab_gas_endpoint_' + labSlug;
}

function copyCodeGsContent(labId) {
  fetch('./Code.gs')
    .then(res => {
      if (!res.ok) throw new Error("Network error");
      return res.text();
    })
    .then(code => {
      navigator.clipboard.writeText(code).then(() => {
        alert("คัดลอก Code.gs สำเร็จ! 🎉\\n\\nคัดลอกโค้ด Google Apps Script ประจำแล็บนี้ลง Clipboard เรียบร้อยแล้ว\\nสามารถเปิด Google Apps Script แล้วกด Ctrl+V วางเพื่อ Deploy ได้ทันที!");
      }).catch(() => {
        prompt("คัดลอกโค้ดด้านล่างนี้ไปวางใน Code.gs:", code);
      });
    })
    .catch(() => {
      window.open("https://github.com/allarm2553/electronic_analysys_lab/blob/main/" + labId + "/Code.gs", "_blank");
    });
}

function copyStudentShareLink(labId) {
  const input = document.getElementById("gas-endpoint-url");
  const val = (input && input.value.trim()) || (typeof getSavedGasEndpoint === "function" ? getSavedGasEndpoint() : "");
  if (!val || !val.startsWith("https://script.google.com")) {
    alert("กรุณากรอกหรือวาง Web App URL ในช่อง แล้วกดบันทึกก่อนคัดลอกลิงก์ส่งให้นักเรียนครับ");
    return;
  }
  const shareUrl = window.location.origin + window.location.pathname + "?gas=" + encodeURIComponent(val);
  navigator.clipboard.writeText(shareUrl).then(() => {
    alert("คัดลอกลิงก์สำหรับส่งให้นักเรียนเรียบร้อยแล้ว! 🎉\\n\\n" + shareUrl + "\\n\\nเมื่อนักเรียนคลิกลิงก์นี้ ระบบจะเชื่อมต่อส่งคะแนนเข้า Google Sheets ของอาจารย์โดยอัตโนมัติ!");
  }).catch(() => {
    prompt("คัดลอกลิงก์นี้ส่งให้นักเรียน:", shareUrl);
  });
}

function getSavedGasEndpoint() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paramUrl = urlParams.get('gas') || urlParams.get('endpoint') || urlParams.get('gasUrl') || urlParams.get('sheetUrl');
    const key = getGasStorageKey();
    if (paramUrl && paramUrl.trim().startsWith('http')) {
      localStorage.setItem(key, paramUrl.trim());
      const labMatch = window.location.pathname.match(/(elab\\d+-[a-z0-9-]+)/i);
      if (labMatch) localStorage.setItem('gas_endpoint_' + labMatch[1], paramUrl.trim());
      return paramUrl.trim();
    }
    let val = (localStorage.getItem(key) || '').trim();
    if (!val) {
      const labMatch = window.location.pathname.match(/(elab\\d+-[a-z0-9-]+)/i);
      if (labMatch) val = (localStorage.getItem('gas_endpoint_' + labMatch[1]) || '').trim();
      if (!val) val = (localStorage.getItem('elab_gas_endpoint_index.html') || '').trim();
      if (val) localStorage.setItem(key, val);
    }
    return val;
  } catch(e) {
    return '';
  }
}

function initGasEndpointUI() {
  const input = document.getElementById('gas-endpoint-url');
  const badge = document.getElementById('gas-status-badge');
  const saved = getSavedGasEndpoint();
  if (input && saved) {
    input.value = saved;
    if (badge) {
      badge.innerText = '🟢 เชื่อมต่อชีตแล้ว';
      badge.style.color = 'var(--accent-green, #10b981)';
      badge.style.borderColor = 'var(--accent-green, #10b981)';
      badge.style.background = 'rgba(16, 185, 129, 0.15)';
    }
  }
}

function saveGasEndpoint() {
  const input = document.getElementById('gas-endpoint-url');
  const badge = document.getElementById('gas-status-badge');
  if (!input) return;
  const val = input.value.trim();
  const key = getGasStorageKey();
  const labMatch = window.location.pathname.match(/(elab\\d+-[a-z0-9-]+)/i);
  if (!val) {
    try { 
      localStorage.removeItem(key); 
      if (labMatch) localStorage.removeItem('gas_endpoint_' + labMatch[1]);
    } catch(e){}
    if (badge) {
      badge.innerText = '⚪ โหมดจำลองในเครื่อง';
      badge.style.color = 'var(--text-muted, #94a3b8)';
      badge.style.borderColor = 'var(--border-color, rgba(71,85,105,0.35))';
      badge.style.background = 'transparent';
    }
    alert('ล้างการเชื่อมต่อเรียบร้อย (ระบบจะทำงานในโหมดตรวจจำลองในเครื่อง)');
    return;
  }
  if (!val.startsWith('https://script.google.com/macros/s/')) {
    alert(`⚠️ คำเตือน: ลิงก์ที่กรอกควรขึ้นต้นด้วย "https://script.google.com/macros/s/.../exec"\\n(ได้จากการ Deploy Web App ใน Google Apps Script ของชีตผู้สอน)\\n\\nหากเป็นลิงก์ Google Sheets ทั่วไป ระบบจะไม่สามารถส่งคะแนนได้`);
  }
  try { 
    localStorage.setItem(key, val);
    if (labMatch) localStorage.setItem('gas_endpoint_' + labMatch[1], val);
  } catch(e){}
  if (badge) {
    badge.innerText = '🟢 เชื่อมต่อชีตแล้ว';
    badge.style.color = 'var(--accent-green, #10b981)';
    badge.style.borderColor = 'var(--accent-green, #10b981)';
    badge.style.background = 'rgba(16, 185, 129, 0.15)';
  }
  alert('💾 บันทึก URL Google Apps Script สำหรับบันทึกคะแนนเรียบร้อยแล้ว!');
}

function testGasEndpoint() {
  const input = document.getElementById('gas-endpoint-url');
  if (!input || !input.value.trim()) {
    alert('⚠️ กรุณากรอก URL Web App ก่อนกดทดสอบ');
    return;
  }
  const url = input.value.trim();
  const badge = document.getElementById('gas-status-badge');
  if (badge) {
    badge.innerText = '⏳ กำลังทดสอบ...';
    badge.style.color = 'var(--accent-yellow, #f59e0b)';
  }
  
  fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ping: true, test: true })
  })
  .then(r => r.json())
  .then(data => {
    if (badge) {
      badge.innerText = '✅ เชื่อมต่อสำเร็จ 100%';
      badge.style.color = 'var(--accent-green, #10b981)';
      badge.style.borderColor = 'var(--accent-green, #10b981)';
      badge.style.background = 'rgba(16, 185, 129, 0.15)';
    }
    alert(`🎉 ทดสอบการเชื่อมต่อสำเร็จ!\\nระบบตอบรับพร้อมรับข้อมูลคะแนนเข้า Google Sheets เรียบร้อยครับ`);
  })
  .catch(err => {
    if (badge) {
      badge.innerText = '⚠️ เชื่อมต่อขัดข้อง';
      badge.style.color = 'var(--accent-red, #ef4444)';
      badge.style.borderColor = 'var(--accent-red, #ef4444)';
      badge.style.background = 'rgba(239, 68, 68, 0.15)';
    }
    alert(`⚠️ การทดสอบล้มเหลว: ` + err.message + `\\n\\nคำแนะนำ:\\n1. ตรวจสอบว่าใน Apps Script ได้ตั้งค่า Who has access เป็น "Anyone (ทุกคน)" หรือไม่\\n2. ตรวจสอบว่า URL เป็นเวอร์ชัน /exec`);
  });
}
window.saveGasEndpoint = saveGasEndpoint;
window.testGasEndpoint = testGasEndpoint;
window.initGasEndpointUI = initGasEndpointUI;
window.addEventListener('DOMContentLoaded', initGasEndpointUI);
'''

def update_labs_1_to_14():
    labs = [f'elab{i}-' for i in range(1, 15)]
    all_dirs = os.listdir('.')
    for prefix in labs:
        matched = [x for x in all_dirs if x.startswith(prefix)]
        if not matched: continue
        d = matched[0]
        filepath = os.path.join(d, 'index.html')
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Replace existing GAS block with updated robust version
        pattern = r'/\* ==========================================================================\s+TEACHER GOOGLE SHEETS / GAS WEB APP ENDPOINT CONFIGURATION & DISPATCHER.*?(?=</script>)'
        if re.search(pattern, content, re.DOTALL):
            new_content = re.sub(pattern, lambda m: STANDARD_GAS_JS + '\n', content, count=1, flags=re.DOTALL)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated JS in {d}')
        else:
            print(f'Warning: Pattern not matched in {d}')

def update_lab15():
    d = 'elab15-passive-filter-sheet-app'
    filepath = os.path.join(d, 'index.html')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Insert teacher card before mode select card
    mode_card_pattern = r'(<!-- Mode Selector Card \(Dual-Mode Architecture\) -->\s*<div class="mode-select-card" id="lab-mode-card">)'
    if mode_card_pattern in content or re.search(mode_card_pattern, content):
        card_html = get_teacher_card_html(d)
        content = re.sub(mode_card_pattern, lambda m: card_html + '\n        ' + m.group(1), content, count=1)
        print('Inserted teacher card in lab15')
    else:
        print('Could not find mode-card pattern in lab15')

    # 2. Update submitReportToGAS to read getSavedGasEndpoint()
    gas_check_pattern = r'// Check GAS endpoint\s+const url = localStorage\.getItem\(\'gas_endpoint_elab15-passive-filter-sheet-app\'\) \|\| \'\';\s+if \(!url\) \{'
    gas_check_replacement = '''// Check GAS endpoint
  const url = typeof getSavedGasEndpoint === 'function' ? getSavedGasEndpoint() : (localStorage.getItem('gas_endpoint_elab15-passive-filter-sheet-app') || '');
  if (!url || !url.startsWith('http')) {'''
    content = re.sub(gas_check_pattern, lambda m: gas_check_replacement, content, count=1)

    # 3. Insert STANDARD_GAS_JS before </script>
    if 'getGasStorageKey' not in content:
        content = re.sub(r'(</script>\s*</body>)', lambda m: STANDARD_GAS_JS + '\n  ' + m.group(1), content, count=1)
        print('Inserted JS in lab15')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def update_lab16():
    d = 'elab16-negative-feedback-sheet-app'
    filepath = os.path.join(d, 'index.html')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Insert teacher card before mode select card
    mode_card_pattern = r'(<!-- Mode Selector Card \(Dual-Mode Architecture\) -->\s*<div class="mode-select-card" id="lab-mode-card">)'
    if mode_card_pattern in content or re.search(mode_card_pattern, content):
        card_html = get_teacher_card_html(d)
        content = re.sub(mode_card_pattern, lambda m: card_html + '\n        ' + m.group(1), content, count=1)
        print('Inserted teacher card in lab16')
    else:
        print('Could not find mode-card pattern in lab16')

    # 2. Update submitReportToGAS to read getSavedGasEndpoint()
    gas_check_pattern = r'const url = localStorage\.getItem\(\'gas_endpoint_elab16-negative-feedback-sheet-app\'\) \|\| \'\';\s+if \(!url\) \{'
    gas_check_replacement = '''const url = typeof getSavedGasEndpoint === 'function' ? getSavedGasEndpoint() : (localStorage.getItem('gas_endpoint_elab16-negative-feedback-sheet-app') || '');
  if (!url || !url.startsWith('http')) {'''
    content = re.sub(gas_check_pattern, lambda m: gas_check_replacement, content, count=1)

    # 3. Insert STANDARD_GAS_JS before </script>
    if 'getGasStorageKey' not in content:
        content = re.sub(r'(</script>\s*</body>)', lambda m: STANDARD_GAS_JS + '\n  ' + m.group(1), content, count=1)
        print('Inserted JS in lab16')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def update_lab17():
    d = 'elab17-voltage-regulator-sheet-app'
    filepath = os.path.join(d, 'index.html')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Insert teacher card before mode selection card
    mode_card_pattern = r'(<!-- Mode Selection Card -->\s*<div class="card" id="lab-mode-card">)'
    if re.search(mode_card_pattern, content):
        card_html = get_teacher_card_html(d)
        content = re.sub(mode_card_pattern, lambda m: card_html + '\n        ' + m.group(1), content, count=1)
        print('Inserted teacher card in lab17')
    else:
        print('Could not find mode-card pattern in lab17')

    # 2. Update submitReportToGAS to read getSavedGasEndpoint() with friendly prompt
    sub_pattern = r'let gasUrl = localStorage\.getItem\(GAS_STORAGE_KEY\);\s+if \(!gasUrl \|\| gasUrl\.includes\(\'XXXXX\'\)\) \{'
    sub_replacement = '''let gasUrl = typeof getSavedGasEndpoint === 'function' ? getSavedGasEndpoint() : localStorage.getItem(GAS_STORAGE_KEY);
      if (!gasUrl || gasUrl.includes('XXXXX')) {
        const proceedOffline = confirm("ยังไม่ได้ระบุ Google Apps Script Web App URL หรือลิงก์ยังไม่สมบูรณ์\\n\\nกด 'ตกลง' (OK) เพื่อทำการตรวจประเมินผลคะแนนจำลองในเครื่อง (Local Mode)\\nหรือกด 'ยกเลิก' (Cancel) เพื่อไประบุ Web App URL ด้านบนตารางบันทึกผล");
        if (!proceedOffline) {
          switchTab('tab-worksheet');
          document.getElementById('gas-endpoint-url')?.focus();
          return;
        }
        const local = localGradeSimulator(payload);
        const modal = document.getElementById('scoreModal');
        document.getElementById('modal-title').innerHTML = '⚠️ บันทึกข้อมูลแบบออฟไลน์ (Local Evaluated)';
        document.getElementById('modal-score').textContent = `${local.score.toFixed(1)} / ${local.maxScore}`;
        document.getElementById('modal-comment').textContent = local.comment + ' (โหมดจำลองในเครื่อง)';
        document.getElementById('modal-feedback').textContent = local.feedback;
        modal.style.display = 'flex';
        return;
      }'''
    content = re.sub(sub_pattern, lambda m: sub_replacement, content, count=1)

    # 3. Insert STANDARD_GAS_JS before </script>
    if 'getGasStorageKey' not in content:
        content = re.sub(r'(</script>\s*</body>)', lambda m: STANDARD_GAS_JS + '\n  ' + m.group(1), content, count=1)
        print('Inserted JS in lab17')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    update_labs_1_to_14()
    update_lab15()
    update_lab16()
    update_lab17()
