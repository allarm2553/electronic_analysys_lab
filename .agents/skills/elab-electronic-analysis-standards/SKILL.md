---
name: elab-electronic-analysis-standards
description: >-
  Standardized blueprint and guide for building, maintaining, and upgrading interactive Electronic Circuit Analysis E-Labs (Diode, Zener, Rectifier, Bridge, Transistor, BJT Bias, BJT re-Model, BJT h-Parameter, FET Small-Signal, MOSFET Bias, MOSFET Pinout, Multistage, Power Amp, Datasheet, Passive Filters, Negative Feedback, Voltage Regulators) with 4-tab architecture, multi-view SVG schematics, live dual-trace oscilloscope, 2-mode worksheet parameters (Simulation & Hardware Lab), anti-cheat protection, 10-point auto-grading, and Universal Master Google Apps Script single-spreadsheet multi-tab backend.
---

# Electronic Analysis E-Lab Architectural Standard & Blueprint

This skill defines the official, validated architecture, UI/UX design patterns, circuit simulation mathematical solvers, dual-mode hardware/simulation engines, and Google Apps Script auto-grading engines for all 17 Electronic Circuit Analysis Lab worksheets.

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
| **Passive Filters (Low/High-Pass)** | 3.0 pts (Cutoff & Gain) | 3.0 pts (Frequency Sweep) | — | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
| **Negative Feedback Amplifier** | 3.0 pts (Closed-loop Gain) | 3.0 pts (Bandwidth/Distortion) | — | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
| **Voltage Regulator (78xx/79xx)** | 3.0 pts (Line Regulation) | 3.0 pts (Load Regulation/Dropout) | — | 4.0 pts (4 $\times$ 1.0) | **10.0 pts** |
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
    labId: 'elabX-...',
    labNumber: X,
    q1Answer: (document.querySelector('input[name="q1"]:checked')?.value || '').trim(),
    q2Answer: (document.querySelector('input[name="q2"]:checked')?.value || '').trim(),
    q3Answer: (document.querySelector('input[name="q3"]:checked')?.value || '').trim(),
    q4Answer: (document.querySelector('input[name="q4"]:checked')?.value || '').trim(),
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

## 5. Universal Master Google Apps Script Architecture (`Master_Code.gs`)
*(Designed in accordance with the IoT-LAB Universal Master Standard)*

To streamline grade book management across all 17 E-Labs, the project implements a **Single-Spreadsheet Multi-Tab Universal Master Architecture**:

### 5.1 สถาปัตยกรรม Google Sheets ไฟล์เดียวแยก 17 แท็บ

```text
Google Spreadsheet รวมคะแนน (1 Spreadsheet File)
├── 📊 สรุปคะแนนรวม 17 แล็บ (Tab Index 0: Real-Time Master Dashboard)
├── Lab 1 - ไดโอด (Submissions)
├── Lab 2 - ซีเนอร์ไดโอด (Submissions)
├── Lab 3 - เรียงกระแสครึ่งคลื่น (Submissions)
├── ...
└── Lab 17 - ไอซีเร็กกูเลเตอร์ (Submissions)
```

### 5.2 แดชบอร์ดสรุปคะแนนรวมที่แท็บแรก (`📊 สรุปคะแนนรวม 17 แล็บ`)
- **Frozen Layout**: ตรึงหัวตารางแถวที่ 1 และตรึง 3 คอลัมน์แรก (รหัสนักศึกษา, ชื่อ-นามสกุล, กลุ่ม/ห้อง)
- **Real-Time Dynamic Update**: เมื่อนักศึกษาส่งใบงานใดเข้ามา ระบบจะอัปเดตช่องคะแนนของแล็บนั้น (เต็ม 10.0) พร้อมคำนวณคะแนนรวมสะสม (เต็ม 170.0 คะแนน), จำนวนแล็บที่ส่งแล้ว, ร้อยละความสำเร็จสะสม (%) และประทับเวลาอัปเดตล่าสุดให้โดยอัตโนมัติ

### 5.3 ทะเบียนข้อมูลใบงาน (Master Lab Registry)
`Master_Code.gs` กำหนดรายการนิยามของทั้ง 17 แล็บไว้ดังนี้:

| หมายเลข | Lab Identifier (`labId`) | ชื่อแท็บใน Google Sheets (`sheetName`) | รหัสสีธีม |
| :---: | :--- | :--- | :---: |
| **Lab 1** | `elab1-diode-sheet-app` | `Lab 1 - ไดโอด` | `#3b82f6` |
| **Lab 2** | `elab2-zener-sheet-app` | `Lab 2 - ซีเนอร์ไดโอด` | `#06b6d4` |
| **Lab 3** | `elab3-rectifier-sheet-app` | `Lab 3 - เรียงกระแสครึ่งคลื่น` | `#0ea5e9` |
| **Lab 4** | `elab4-bridge-rectifier-sheet-app` | `Lab 4 - บริดจ์เร็กติไฟเออร์` | `#6366f1` |
| **Lab 5** | `elab5-transistor-sheet-app` | `Lab 5 - คุณลักษณะ BJT` | `#8b5cf6` |
| **Lab 6** | `elab6-bjt-bias-sheet-app` | `Lab 6 - การจัดไบอัส BJT` | `#a855f7` |
| **Lab 7** | `elab7-bjt-re-model-sheet-app` | `Lab 7 - BJT re-Model` | `#d946ef` |
| **Lab 8** | `elab8-bjt-h-parameter-sheet-app` | `Lab 8 - BJT h-Parameter` | `#ec4899` |
| **Lab 9** | `elab9-mosfet-pinout-sheet-app` | `Lab 9 - MOSFET Pinout` | `#f43f5e` |
| **Lab 10** | `elab10-mosfet-bias-sheet-app` | `Lab 10 - การจัดไบอัส MOSFET` | `#ef4444` |
| **Lab 11** | `elab11-fet-small-signal-sheet-app` | `Lab 11 - FET Small-Signal` | `#f97316` |
| **Lab 12** | `elab12-datasheet-reading-sheet-app` | `Lab 12 - Data Sheet` | `#f59e0b` |
| **Lab 13** | `elab13-multistage-sheet-app` | `Lab 13 - ขยายหลายภาค` | `#eab308` |
| **Lab 14** | `elab14-power-amp-sheet-app` | `Lab 14 - ขยายกำลัง` | `#84cc16` |
| **Lab 15** | `elab15-passive-filter-sheet-app` | `Lab 15 - วงจรกรองพาสซีฟ` | `#10b981` |
| **Lab 16** | `elab16-negative-feedback-sheet-app` | `Lab 16 - ป้อนกลับลบ` | `#14b8a6` |
| **Lab 17** | `elab17-voltage-regulator-sheet-app` | `Lab 17 - ไอซีเร็กกูเลเตอร์` | `#0284c7` |

### 5.4 การป้องกันการส่งซ้ำรายแล็บ (Anti-Duplicate per Lab Tab)
- ตรวจสอบ `studentId` จากคอลัมน์ที่ 2 ของแท็บแล็บนั้นๆ
- หากพบว่าเคยส่งใบงานแล็บดังกล่าวไปแล้ว ระบบจะแจ้งเตือนว่าเคยส่งแล้วและปฏิเสธการส่งซ้ำ
- **อิสระระหว่างแล็บ**: นักศึกษาที่ส่ง Lab 1 ไปแล้ว ยังคงส่ง Lab 2..17 ได้ตามปกติ ไม่มีการล็อกข้ามแล็บ

### 5.5 ระบบส่งต่อ URL กลางผ่าน `?gas=` (URL Propagation)
1. อาจารย์นำ Web App URL ที่ได้จากการ Deploy `Master_Code.gs` มาวางในกล่อง **"ตั้งค่า Web App URL กลาง (นำไปใช้กับทุกใบงาน 1-17 พร้อมกัน)"** ที่หน้า E-Lab Portal
2. ระบบจะบันทึก URL ลงใน `localStorage` ของทั้ง 17 แล็บพร้อมกันทันที
3. ลิงก์ที่คัดลอกให้นักเรียนจะแนบ Query Parameter `?gas=https://script.google.com/macros/s/.../exec` ทำให้เมื่อนักเรียนเปิดลิงก์ ระบบจะเชื่อมต่อเข้า Google Sheet ของอาจารย์โดยอัตโนมัติ 100% โดยนักเรียนไม่ต้องตั้งค่าใดๆ
