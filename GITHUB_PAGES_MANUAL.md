# 📘 คู่มือการใช้งานระบบห้องปฏิบัติการวิเคราะห์วงจรอิเล็กทรอนิกส์ออนไลน์
## (Electronic Circuit Analysis E-Labs on GitHub Pages)

เอกสารนี้จัดทำขึ้นเพื่อเป็นคู่มือการใช้งานระบบห้องปฏิบัติการจำลองเสมือนจริง (E-Labs) ทั้ง **14 ใบงาน** ซึ่งทำงานบน **GitHub Pages** ร่วมกับระบบบันทึกคะแนนและตรวจประเมินผลอัตโนมัติผ่าน **Google Sheets & Google Apps Script**

---

## 📑 สารบัญ (Table of Contents)
1. [ภาพรวมสถาปัตยกรรมระบบ (System Overview)](#1-ภาพรวมสถาปัตยกรรมระบบ-system-overview)
2. [สารบัญลิงก์เข้าสู่ 14 ใบงานการทดลอง (E-Labs Directory)](#2-สารบัญลิงก์เข้าสู่-14-ใบงานการทดลอง-e-labs-directory)
3. [คู่มือสำหรับครูผู้สอน (Teacher Setup & Connection Guide)](#3-คู่มือสำหรับครูผู้สอน-teacher-setup--connection-guide)
   - [3.1 การสร้าง Google Sheets บันทึกคะแนนและ Deploy Web App](#31-การสร้าง-google-sheets-บันทึกคะแนนและ-deploy-web-app)
   - [3.2 การนำ URL มาเชื่อมต่อกับหน้าเว็บใบงาน](#32-การนำ-url-มาเชื่อมต่อกับหน้าเว็บใบงาน)
   - [3.3 การสร้างลิงก์แบบฝัง URL ปลายทางให้นักศึกษาคลิกใช้งานทันที](#33-การสร้างลิงก์แบบฝัง-url-ปลายทางให้นักศึกษาคลิกใช้งานทันที)
4. [คู่มือสำหรับนักศึกษา / ผู้เรียน (Student User Guide)](#4-คู่มือสำหรับนักศึกษา--ผู้เรียน-student-user-guide)
   - [4.1 โครงสร้าง 4 แท็บการเรียนรู้](#41-โครงสร้าง-4-แท็บการเรียนรู้)
   - [4.2 การสลับโหมดการทดลอง (Simulation vs Hardware Lab)](#42-การสลับโหมดการทดลอง-simulation-vs-hardware-lab)
   - [4.3 การตรวจสอบคะแนนก่อนส่ง (Score Preview) และการยืนยันส่งงาน](#43-การตรวจสอบคะแนนก่อนส่ง-score-preview-และการยืนยันส่งงาน)
   - [4.4 การพิมพ์รายงานผลและบันทึกเป็น PDF](#44-การพิมพ์รายงานผลและบันทึกเป็น-pdf)
5. [การแก้ปัญหาและคำถามที่พบบ่อย (FAQ & Troubleshooting)](#5-การแก้ปัญหาและคำถามที่พบบ่อย-faq--troubleshooting)

---

## 1. ภาพรวมสถาปัตยกรรมระบบ (System Overview)

ระบบถูกออกแบบเป็น **Universal Serverless Architecture** ประกอบด้วย 2 ส่วนหลัก:

```text
┌────────────────────────────────────────────────────────┐
│ 🌐 GitHub Pages (Frontend Interface)                  │
│ URL: https://allarm2553.github.io/electronic_analysys_lab/ │
│ ├── หน้าพอร์ทัลรวม 14 ใบงาน                              │
│ ├── วงจรจำลองเสมือนจริง (HTML5 Canvas / SVG Physics)    │
│ └── ระบบตรวจคะแนนและจำลองผลลัพธ์ในเครื่อง (Client)      │
└──────────────────────────┬─────────────────────────────┘
                           │ (HTTPS POST Payload)
                           ▼
┌────────────────────────────────────────────────────────┐
│ 📊 Google Apps Script + Google Sheets (Backend / DB)   │
│ ├── ตรวจประเมินผลอัตโนมัติ (10.0 คะแนนเต็ม)              │
│ ├── ป้องกันการส่งงานซ้ำ (Single Submission Locking)     │
│ └── บันทึกคะแนนลง Google Sheets ของผู้สอนแบบ Real-Time │
└────────────────────────────────────────────────────────┘
```

---

## 2. สารบัญลิงก์เข้าสู่ 14 ใบงานการทดลอง (E-Labs Directory)

* 🌐 **หน้าพอร์ทัลหลัก (Main Portal):**  
  👉 [https://allarm2553.github.io/electronic_analysys_lab/](https://allarm2553.github.io/electronic_analysys_lab/)

| ลำดับ | หัวข้อการทดลอง | ลิงก์เข้าสู่ใบงานออนไลน์ (GitHub Pages) |
| :---: | :--- | :--- |
| **Lab 1** | คุณสมบัติของไดโอด (Diode Characteristics) | [เข้าสู่ Lab 1](https://allarm2553.github.io/electronic_analysys_lab/elab-diode-sheets-app/) |
| **Lab 2** | คุณสมบัติซีเนอร์ไดโอด (Zener Diode Characteristics) | [เข้าสู่ Lab 2](https://allarm2553.github.io/electronic_analysys_lab/elab-zener-sheets-app/) |
| **Lab 3** | วงจรเรียงกระแสครึ่งคลื่น (Half-Wave Rectifier) | [เข้าสู่ Lab 3](https://allarm2553.github.io/electronic_analysys_lab/elab-rectifier-sheets-app/) |
| **Lab 4** | วงจรเรียงกระแสเต็มคลื่นแบบบริดจ์ (Bridge Rectifier) | [เข้าสู่ Lab 4](https://allarm2553.github.io/electronic_analysys_lab/elab-bridge-rectifier-sheets-app/) |
| **Lab 5** | คุณสมบัติทรานซิสเตอร์ BJT (Transistor Pinout & Char.) | [เข้าสู่ Lab 5](https://allarm2553.github.io/electronic_analysys_lab/elab-transistor-sheets-app/) |
| **Lab 6** | การไบอัสทรานซิสเตอร์ DC (BJT DC Biasing & Q-Point) | [เข้าสู่ Lab 6](https://allarm2553.github.io/electronic_analysys_lab/elab-bjt-bias-sheets-app/) |
| **Lab 7** | BJT re-Model สัญญาณขนาดเล็ก (BJT re-Model AC Amp) | [เข้าสู่ Lab 7](https://allarm2553.github.io/electronic_analysys_lab/elab-bjt-re-model-sheets-app/) |
| **Lab 8** | BJT h-Parameter สัญญาณขนาดเล็ก (BJT h-Parameter Amp) | [เข้าสู่ Lab 8](https://allarm2553.github.io/electronic_analysys_lab/elab-bjt-h-parameter-sheets-app/) |
| **Lab 9** | JFET สัญญาณขนาดเล็ก (JFET Small-Signal Analysis) | [เข้าสู่ Lab 9](https://allarm2553.github.io/electronic_analysys_lab/elab-fet-small-signal-sheets-app/) |
| **Lab 10** | การไบอัส MOSFET (MOSFET DC Biasing Characteristics) | [เข้าสู่ Lab 10](https://allarm2553.github.io/electronic_analysys_lab/elab-mosfet-bias-sheets-app/) |
| **Lab 11** | หาตำแหน่งขาและทดสอบ MOSFET (MOSFET Pinout & Test) | [เข้าสู่ Lab 11](https://allarm2553.github.io/electronic_analysys_lab/elab-mosfet-pinout-sheets-app/) |
| **Lab 12** | วงจรขยายหลายภาค RC-Coupled (Multistage Amplifier) | [เข้าสู่ Lab 12](https://allarm2553.github.io/electronic_analysys_lab/elab-multistage-sheets-app/) |
| **Lab 13** | เพาเวอร์แอมป์ Class A/B (Power Amplifier & Follower) | [เข้าสู่ Lab 13](https://allarm2553.github.io/electronic_analysys_lab/elab-power-amp-sheets-app/) |
| **Lab 14** | การอ่าน Data Sheet อุปกรณ์ (Datasheet Reading & Specs) | [เข้าสู่ Lab 14](https://allarm2553.github.io/electronic_analysys_lab/elab-datasheet-reading-sheets-app/) |

---

## 3. คู่มือสำหรับครูผู้สอน (Teacher Setup & Connection Guide)

ครูผู้สอนสามารถสร้าง Google Sheets สำหรับรับคะแนนของตนเองได้ง่ายๆ โดยทำเพียงครั้งเดียวต่อ 1 ภาคการศึกษา:

### 3.1 การสร้าง Google Sheets บันทึกคะแนนและ Deploy Web App
1. เปิด **[Google Drive](https://drive.google.com/)** -> สร้าง **Google ชีต (Google Sheets) ใหม่** ตั้งชื่อตามต้องการ (เช่น *"คะแนนแล็บ 1 วงจรไดโอด"*).
2. คลิกที่เมนูด้านบน: **ส่วนขยาย (Extensions)** -> **Apps Script**.
3. ลบโค้ดเดิมออกทั้งหมด แล้วนำโค้ดในไฟล์ **`Code.js`** ของแล็บนั้นๆ (เปิดดูได้จาก GitHub Repository) มาวาง.
4. กดปุ่มไอคอน **💾 บันทึก (Save project)**.
5. คลิกปุ่มสีน้ำเงินมุมบนขวา: **ทำให้ใช้งานได้ (Deploy)** -> **การทำให้ใช้งานได้รายการใหม่ (New deployment)**.
   * คลิกรูปเฟือง ⚙️ -> เลือก **เว็บแอป (Web app)**.
   * **ดำเนินการในฐานะ (Execute as):** เลือก `ฉัน (อีเมลของผู้สอน)`.
   * **ใครมีสิทธิ์เข้าถึง (Who has access):** ⚠️ **ต้องเลือกเป็น "ทุกคน (Anyone)"** *(สำคัญมาก เพื่อให้หน้าเว็บส่งคะแนนเข้ามาได้)*.
   * กด **ทำให้ใช้งานได้ (Deploy)**.
6. ให้สิทธิ์การเข้าถึง (Authorize) ตามขั้นตอนของ Google แล้วกด **คัดลอก (Copy) URL ของเว็บแอป**  
   *(ลิงก์จะขึ้นต้นด้วย `https://script.google.com/macros/s/.../exec`)*.

---

### 3.2 การนำ URL มาเชื่อมต่อกับหน้าเว็บใบงาน
1. เปิดหน้าเว็บใบงานแล็บนั้นบนเบราว์เซอร์
2. ไปที่แท็บ **📝 ตารางบันทึกผลการทดลอง**
3. ด้านบนจะมีกล่องเส้นประสีฟ้า: **"🔗 เชื่อมต่อ Google Sheets ผู้สอน (Teacher Web App URL)"**
4. วาง URL ที่คัดลอกมาลงในช่องข้อความ
5. คลิกปุ่ม **"💾 บันทึก URL"** (ระบบจะจดจำ URL นี้ไว้ในเบราว์เซอร์อัตโนมัติ)
6. คลิกปุ่ม **"🧪 ทดสอบเชื่อมต่อ"** หากสำเร็จ สถานะจะเปลี่ยนเป็น `✅ เชื่อมต่อสำเร็จ 100%`

---

### 3.3 การสร้างลิงก์แบบฝัง URL ปลายทางให้นักศึกษาคลิกใช้งานทันที ⭐ (แนะนำที่สุด)
เพื่อให้นักศึกษาไม่ต้องพิมพ์หรือวาง URL เอง ครูผู้สอนสามารถแนบ `?endpoint=...` ต่อท้าย URL แล็บได้เลย เช่น:

```text
https://allarm2553.github.io/electronic_analysys_lab/elab-diode-sheets-app/?endpoint=https://script.google.com/macros/s/AKfycbz_XXXXX/exec
```

> 💡 **เมื่อนักศึกษาคลิกลิงก์นี้:** หน้าเว็บจะทำการตั้งค่าเชื่อมต่อกับ Google Sheets ของครูท่านนั้นให้อัตโนมัติทันที 100%!

---

## 4. คู่มือสำหรับนักศึกษา / ผู้เรียน (Student User Guide)

### 4.1 โครงสร้าง 4 แท็บการเรียนรู้
ทุกใบงานจะแบ่งออกเป็น 4 ส่วนหลักผ่านแถบเมนูด้านซ้าย:

```text
Sidebar Navigation
├── 📖 ทฤษฎีและคู่มือแล็บ (tab-theory)      <- ศึกษาหลักการทำงาน สูตรคำนวณ วงจรสมมูล
├── 🔬 ห้องทดลองจำลองเสมือน (tab-simulator)  <- ปรับค่า ทดลองวัดด้วยมัลติมิเตอร์ / ออสซิลโลสโคป
├── 📝 ตารางบันทึกผลการทดลอง (tab-worksheet) <- กรอกข้อมูลส่วนตัว บันทึกผลการวัด ดึงค่าจากซิมูเลเตอร์
└── ❓ คำถามและสรุปผล (tab-assessment)       <- ทำแบบทดสอบ 4 ข้อ สรุปผล ตรวจคะแนน และกดส่งงาน
```

---

### 4.2 การสลับโหมดการทดลอง (Simulation vs Hardware Lab)
ในแท็บ **📝 ตารางบันทึกผลการทดลอง** นักศึกษาสามารถเลือกโหมดการทดลองได้ 2 รูปแบบ:

* 🔬 **โหมดห้องทดลองจำลอง (Virtual Simulator):** 
  * ใช้ค่าการทดลองจากโปรแกรมจำลองเสมือนจริง
  * เกณฑ์ความคลาดเคลื่อน $\pm 5\%$
  * มีปุ่ม `⚡ ดึงค่าจากการจำลองอัตโนมัติ` ช่วยบันทึกข้อมูลลงตารางได้อย่างสะดวกรวดเร็ว
* 🔌 **โหมดการทดลองจากอุปกรณ์จริง (Hardware Lab):**
  * สำหรับนักศึกษาที่ต่อวงจรจริงด้วย Breadboard และอุปกรณ์ในห้องแล็บ
  * สามารถพิมพ์เบอร์อุปกรณ์จริง และค่าความต้านทานที่วัดได้จริง
  * ระบบปรับเกณฑ์ความคลาดเคลื่อนเป็น $\pm 15 - 20\%$ เพื่อรองรับความคลาดเคลื่อนทางกายภาพของอุปกรณ์จริง
  * มีระบบป้องกันการกดดึงค่าจากซิมูเลเตอร์มาทับค่าที่วัดได้จริงโดยไม่ตั้งใจ

---

### 4.3 การตรวจสอบคะแนนก่อนส่ง (Score Preview) และการยืนยันส่งงาน
1. เมื่อบันทึกตารางผลการทดลองและตอบคำถามปรนัย 4 ข้อครบถ้วนแล้ว ให้ไปที่แท็บ **❓ คำถามและสรุปผล**
2. คลิกปุ่ม **"🔍 ตรวจสอบคะแนนก่อนส่ง"**
3. ระบบจะแสดงหน้าต่างสรุปผลคะแนนประเมิน (เต็ม 10.0 คะแนน) พร้อมรายงานความถูกต้องแบบละเอียดรายข้อ
4. หากต้องการปรับปรุง ให้กด **"✏️ กลับไปแก้ไขคำตอบ"**
5. หากมั่นใจในผลการทดลอง ให้กด **"🚀 ยืนยันส่งใบงานจริง"** ข้อมูลจะถูกบันทึกส่งเข้า Google Sheets ของผู้สอนทันที

---

### 4.4 การพิมพ์รายงานผลและบันทึกเป็น PDF
หลังจากการส่งงาน หรือในระหว่างการทดลอง นักศึกษาสามารถกดปุ่ม **"🖨️ พิมพ์รายงาน / บันทึก PDF"** ระบบจะจัดรูปแบบเอกสารทางการพร้อมตัดส่วนปุ่มควบคุมที่ไม่จำเป็นออก เพื่อให้บันทึกเป็นไฟล์ PDF ขนาด A4 ที่สวยงามและใช้เป็นเอกสารหลักฐานการเรียนได้ทันที

---

## 5. การแก้ปัญหาและคำถามที่พบบ่อย (FAQ & Troubleshooting)

### ❓ Q1: ส่งงานแล้วคะแนนไม่ขึ้นใน Google Sheets ของผู้สอน?
* **สาเหตุที่ 1:** ตอน Deploy Web App ใน Google Apps Script ไม่ได้ตั้งสิทธิ์ *Who has access (ใครมีสิทธิ์เข้าถึง)* เป็น **"Anyone (ทุกคน)"**
  * *วิธีแก้:* ไปที่ Apps Script -> Deploy -> Manage deployments -> แก้ไขสิทธิ์ให้เป็น **Anyone** -> กด Deploy ใหม่
* **สาเหตุที่ 2:** กรอก URL ผิด หรือไม่ได้นำลิงก์ที่ลงท้ายด้วย `/exec` มาใช้
  * *วิธีแก้:* ตรวจสอบ URL ในกล่องเชื่อมต่อให้ขึ้นต้นด้วย `https://script.google.com/macros/s/.../exec`

### ❓ Q2: ระบบ Anti-Cheat ทำงานอย่างไร?
* ระบบมีกลไกตรวจจับการคัดลอก/วาง (Paste/Drop) ในช่องสรุปผลการทดลอง หากนักศึกษาพยายามกด `Ctrl+V` หรือ Paste ข้อความ หน้าจอจะขึ้นเตือนสีแดงว่า *"🚫 ไม่อนุญาตให้คัดลอก/วางข้อความ"* เพื่อส่งเสริมการคิดวิเคราะห์และพิมพ์สรุปผลด้วยตนเอง

### ❓ Q3: นักศึกษาสามารถส่งใบงานซ้ำได้หรือไม่?
* ระบบมีกลไก **Single Submission Protection** โดยตรวจสอบจาก *รหัสนักศึกษา* หากรหัสนี้เคยส่งงานไปแล้ว ระบบจะล็อกใบงานเป็นโหมดดูอย่างเดียว (View-Only) และแสดงเวลาที่เคยส่งงานไว้ เพื่อป้องกันการส่งงานซ้ำซ้อน