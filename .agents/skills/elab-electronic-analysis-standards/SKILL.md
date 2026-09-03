---
name: elab-electronic-analysis-standards
description: >-
  Standardized blueprint and guide for building, maintaining, and upgrading interactive Electronic Circuit Analysis E-Labs (Diode, Zener, Rectifier, Bridge, Transistor, BJT Bias, BJT re-Model, BJT h-Parameter, FET Small-Signal, MOSFET Bias, MOSFET Pinout, Multistage, Power Amp, Datasheet) with 4-tab architecture, multi-view SVG schematics, live dual-trace oscilloscope, 2-mode worksheet parameters (Simulation & Hardware Lab), anti-cheat protection, and 10-point Google Apps Script auto-grading.
---

# Electronic Analysis E-Lab Architectural Standard & Blueprint

This skill defines the official, validated architecture, UI/UX design patterns, circuit simulation mathematical solvers, dual-mode hardware/simulation engines, and Google Apps Script auto-grading engines for all 14 Electronic Circuit Analysis Lab worksheets.

---

## 1. Core 4-Tab Sidebar Architecture

Every E-Lab worksheet application must follow this strict 4-tab sidebar navigation layout:

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
   - Mathematical equations with KaTeX/LaTeX formatting.
   - Component characteristics comparison tables.

2. **`tab-simulator` (🔬 ห้องทดลองจำลองเสมือน)**:
   - **Interactive Controls (Left Panel)**: Real-time range sliders, quick component selector buttons, power/switch toggles.
   - **Schematic & Scope Card (Right Panel)**:
     - Sub-tab switcher: `⚡ วงจรจริง (Circuit)`, `📐 วงจรสมมูล AC (Model)`, `📡 ออสซิลโลสโคปคู่ (Scope)`.
     - 7-Card Live Dynamic Probes ($V_B, V_E, V_C, I_E, A_v, Z_i, Z_o$, etc.).

3. **`tab-worksheet` (📝 ตารางบันทึกผลการทดลอง)**:
   - Student profile: Name, Student ID, Group/Section, Lab Date.
   - **Dual-Mode System (`#lab-mode-card`)**:
     - `🔬 ห้องทดลองจำลองเสมือน (Virtual Simulator)`: Physics equations, strict tolerance ($\pm 5\%$), autofill buttons enabled.
     - `🔌 การทดลองจากอุปกรณ์จริง (Hardware Lab)`: Real-world physical components, relaxed tolerance ($\pm 15 - 20\%$), physical component selection & measured passive values.
   - Confirmation interceptor on auto-fill buttons when in Hardware Lab mode.
   - Tables for DC and AC parameters with auto-fill helpers.

4. **`tab-assessment` (❓ คำถามและสรุปผล)**:
   - **4 Multiple-Choice Questions (1.0 pt $\times$ 4 = 4.0 pts total)** via `<input type="radio" name="q1..q4">`.
   - Discussion & Conclusion Textarea protected by Anti-Cheat Plagiarism Interceptors.
   - **Score Preview Modal (`🔍 ตรวจสอบคะแนนก่อนส่ง`)** and **Submit to GAS (`🚀 ส่งใบงานและตรวจคะแนน`)**.

---

## 2. Standardized 10-Point Score Normalization (Max Score = 10.0)

Every lab must strictly normalize all evaluation sections to sum up to **10.0 points**:

| Lab Category | Part 1 (Lab Table 1) | Part 2 (Lab Table 2 / DC/AC) | Part 3 / Pinout / Other | Part 4 (MC Questions) | Total Score |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Diode / Zener / Rectifier / Bridge** | 2.0 pts | 4.0 pts | — | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
| **Transistor BJT (Characteristics)** | 2.0 pts (Table 1) | 1.0 pt (Base/Type) | 1.0 pt (Table 2) + 2.0 pts (Pinout) | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
| **BJT Bias (DC Operating Point)** | 3.0 pts (Table 1) | 2.0 pts (Q-Point/Beta) | 1.0 pt (Pinout) | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
| **BJT re-Model / h-Parameter / FET** | 3.0 pts (DC / re / h / gm) | 3.0 pts (AC Av, Zi, Zo) | — | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
| **MOSFET Bias** | 2.0 pts (Transfer) | 4.0 pts (Drain) | — | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
| **MOSFET Pinout & Testing** | 1.0 pt (Table 1) | 1.0 pt (Table 2) | 2.0 pts (Trigger) + 2.0 pts (Summary) | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
| **Multistage RC-Coupled Amplifier** | 1.5 pts (Stage 1 DC) | 1.5 pts (Stage 2 DC) | 3.0 pts (AC Performance) | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
| **Power Amplifier (Class A/B)** | 3.0 pts (Output/Eff) | 3.0 pts (Thermal/X-Over) | — | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
| **Datasheet Reading** | 2.0 pts (Limits) | 2.0 pts (DC/AC Char) | 2.0 pts (Applications) | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |

---

## 3. Critical Implementation Rules & Best Practices

### A. Temporal Dead Zone (TDZ) Safety in `localGradeSimulator`:
Always declare `const feedback = [ ... ];` at the very beginning of the function before any conditional statements or returns. Never reference `feedback` before its declaration.

### B. Payload Extraction for Radio Buttons:
Always extract Multiple Choice answers from checked radio inputs:
```javascript
function getWorksheetPayload() {
  return {
    q1Answer: (document.querySelector('input[name="q1"]:checked')?.value || '').trim(),
    q2Answer: (document.querySelector('input[name="q2"]:checked')?.value || '').trim(),
    q3Answer: (document.querySelector('input[name="q3"]:checked')?.value || '').trim(),
    q4Answer: (document.querySelector('input[name="q4"]:checked')?.value || '').trim(),
    q1: (document.querySelector('input[name="q1"]:checked')?.value || '').trim(),
    q2: (document.querySelector('input[name="q2"]:checked')?.value || '').trim(),
    q3: (document.querySelector('input[name="q3"]:checked')?.value || '').trim(),
    q4: (document.querySelector('input[name="q4"]:checked')?.value || '').trim(),
    labConclusion: document.getElementById('lab-conclusion')?.value.trim() || ''
  };
}
```

### C. Multimeter Reverse Resistance Acceptance:
When evaluating reverse bias diode/transistor measurements, accept `'∞'`, `'inf'`, `'infinity'`, and large numeric resistance values.

### D. Element ID Alignment:
Ensure all inputs in `getWorksheetPayload()` match actual DOM element IDs (e.g., `ac-zi-bypassed`, `ac-zo-bypassed`, `hw-component-model`).

---

## 4. Anti-Cheat & Plagiarism Prevention

Intercept `paste`, `drop`, `Ctrl+V`, `Cmd+V`, `Shift+Insert` on student textareas (e.g., `#lab-conclusion`, `#diode-reason`).

---

## 5. Google Apps Script Backend (`Code.js`) Deployment

1. Set `recordToSheet(data, grading)` with headers matching data columns.
2. Format header row with blue/cyan background (`#0284c7`), white bold text, frozen top row, and auto-resized columns.
3. Keep Column 4 strictly as **Student ID (รหัสนักศึกษา)** for seamless spreadsheet integration.