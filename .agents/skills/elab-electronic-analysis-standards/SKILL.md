---
name: elab-electronic-analysis-standards
description: >-
  Standardized blueprint and guide for building, maintaining, and upgrading interactive Electronic Circuit Analysis E-Labs (BJT h-Parameter, BJT re-Model, FET/MOSFET Small-Signal, etc.) with 4-tab architecture, multi-view SVG schematics, live dual-trace oscilloscope, 2-mode worksheet parameters, anti-cheat protection, and 10-point Google Apps Script auto-grading.
---

# Electronic Analysis E-Lab Architectural Standard

This skill defines the official, validated architecture, UI/UX design patterns, circuit simulation mathematical solvers, and Google Apps Script auto-grading engines for Electronic Circuit Analysis Lab worksheets.

---

## 1. 4-Tab Core Application Layout

Every E-Lab worksheet application must follow this strict 4-tab sidebar structure:

```text
Sidebar Navigation
├── 📖 ทฤษฎีและคู่มือแล็บ (tab-theory)
├── 🔬 ห้องทดลองจำลองเสมือน (tab-simulator)
├── 📝 ตารางบันทึกผลการทดลอง (tab-worksheet)
└── ❓ คำถามและสรุปผล (tab-assessment)
```

### Tab Breakdown:
1. **`tab-theory` (📖 ทฤษฎีและคู่มือแล็บ)**:
   - Experimental objectives list.
   - Mathematical derivation and equations.
   - **4-Column Comparison Table**: Parameter, Bypassed State, Unbypassed State, Remarks/Effects.

2. **`tab-simulator` (🔬 ห้องทดลองจำลองเสมือน)**:
   - **Left Panel (Circuit Settings)**: Real-time sliders ($V_{CC}/V_{DD}, R_1, R_2, R_C/R_D, R_E/R_S, v_i$), quick transistor/FET model buttons, bypass capacitor toggle buttons, and diagram switch button.
   - **Right Panel (Multi-View & Live Probes Card)**:
     - Header with Sub-tab buttons:
       - `⚡ วงจรจริง (Circuit)`
       - `📐 วงจรสมมูล AC (Model)`
       - `📡 ออสซิลโลสโคปคู่ (Scope)`
       - Optional: `📦 ทูพอร์ต (2-Port)`
     - Dynamic 7-Card Live Readout Probes: $V_B/V_G, V_E/V_S, V_C/V_D, I_E/I_D$, Small-Signal Parameter ($h_{ie}, r_e, g_m$), Voltage Gain $A_v$, Input Impedance $Z_i$.

3. **`tab-worksheet` (📝 ตารางบันทึกผลการทดลอง)**:
   - Student profile: Name, Student ID, Group/Section, Lab Date.
   - **2-Mode Parameter System**:
     - `📌 โหมดค่ามาตรฐาน (Fixed Preset)`: Default reference transistor/FET parameters.
     - `🛠️ โหมดกำหนดค่าเอง (Custom Dynamic)`: Free editing with `⚡ ซิงค์จากแล็บเสมือน`, `🎲 สุ่มโจทย์ใหม่`, `⏪ คืนค่ามาตรฐาน`, and real-time alert box `#ws-param-alert`.
   - **Part 1 (DC Operating Point & Parameter Extraction)** with `⚡ ดึงค่าจากการจำลองอัตโนมัติ` (`autoFillDCFromSim`).
   - **Part 2 (AC Small-Signal Performance Comparison)** with `⚡ ดึงค่าจากการจำลองอัตโนมัติ` (`autoFillACFromSim`).

4. **`tab-assessment` (❓ คำถามและสรุปผล)**:
   - **4 Multiple-Choice Conceptual Questions** (1 point each = 4 points total).
   - Discussion & Conclusion Textarea protected by Anti-Cheat Plagiarism Interceptors.
   - Print PDF and Submit to GAS buttons with loading overlay and grading modal.

---

## 2. Interactive Multi-View Schematics & Oscilloscope Standards

### A. Sub-Tab Switcher in Top Right Card
Place the oscilloscope inside the top-right schematic card as a sub-tab view alongside the circuit schematics. Do NOT place it as an isolated bottom card.

```html
<div class="card">
  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;">
    <h2 class="card-title" style="margin-bottom: 0;">📐 แผนภาพวงจรและแบบจำลอง (Circuit & Model)</h2>
    <div style="display: flex; gap: 6px; background: rgba(15, 23, 42, 0.8); padding: 4px; border-radius: 8px; border: 1px solid var(--border-color);">
      <button id="tab-btn-phys" class="btn btn-secondary active" onclick="switchSchematicMode('physical')">⚡ วงจรจริง (Circuit)</button>
      <button id="tab-btn-model" class="btn btn-secondary" onclick="switchSchematicMode('model')">📐 วงจรสมมูล AC (Model)</button>
      <button id="tab-btn-scope" class="btn btn-secondary" onclick="switchSchematicMode('scope')">📡 ออสซิลโลสโคปคู่ (Scope)</button>
    </div>
  </div>
  
  <div class="schematic-box">
    <!-- SVG 1: Physical circuit with clickable knife switch on bypass cap -->
    <!-- SVG 2: AC equivalent model with live dynamic formula banner -->
    <!-- Canvas 3: Live animated dual-trace oscilloscope screen with readout bar -->
  </div>
  
  <!-- 7 Live Probe Cards Grid -->
</div>
```

### B. Live Dual-Trace Oscilloscope
- **CH1 (Vin - Yellow)**: Normal input sinusoidal wave.
- **CH2 (Vout - Cyan)**: Inverted ($180^\circ$) sinusoidal wave scaled dynamically by $|A_v|$ with realistic clipping saturation.
- 4-Item Live Readout Bar: $v_{i(p-p)}, v_{o(p-p)}, |A_v|$, and Phase status.

---

## 3. UI/UX & Dark Neon Styling Standards

### Range Slider Styling (`input[type="range"]`):
Never allow default browser/OS white capsule sliders. Always apply:

```css
input[type="range"] {
  width: 100%;
  height: 6px;
  background: #1e293b;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-cyan);
  cursor: pointer;
  box-shadow: 0 0 10px var(--accent-cyan-glow);
  transition: transform 0.15s ease, background-color 0.15s ease;
  border: 2px solid #0f172a;
}

input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.25);
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.6);
}
```

### Anti-Cheat & Plagiarism Prevention:
Intercept `paste`, `drop`, `Ctrl+V`, `Cmd+V`, `Shift+Insert` on all student textareas and show a red alert toast `#anti-cheat-toast`.

---

## 4. Google Apps Script Backend Standards (`Code.js`)

### 10-Point Grading Rubric:
- **Part 1 (DC Operating Point & Parameter Extraction)**: 3.0 Points
- **Part 2 (AC Performance with & without Bypass Capacitor)**: 3.0 Points (1.5 pts with $C_E/C_S$ + 1.5 pts without $C_E/C_S$)
- **Part 3 (4 Conceptual Questions)**: 4.0 Points (1.0 pt $	imes$ 4 questions)
- **Total**: 10.0 Points

### Google Sheets Submission Recording:
Always format the header row with dark blue/cyan background (`#0284c7` or `#38bdf8`), white bold text, and auto-resize all columns.
