# ใบงานการทดลองที่ 14: วงจรขยายกำลังและวงจรกันชน (Power Amplifier & Emitter Follower)

เว็บแอปพลิเคชันห้องปฏิบัติการจำลองการวิเคราะห์วงจรขยายกำลัง (Complementary Symmetry Class AB Push-Pull Power Amplifier & Common-Collector Emitter Follower Buffer) พร้อมระบบตรวจคะแนนอัตโนมัติ 10 คะแนนและการจำลองผลกระทบของแผ่นระบายความร้อน (Heatsink)

## 🌟 คุณสมบัติเด่น (Key Features)
1. **4-Tab Standard Layout**:
   - 📖 **ทฤษฎีและคู่มือแล็บ (`tab-theory`)**: อธิบาย Class A, B, AB, Emitter Follower, สูตรคำนวณกำลังงาน $P_{out}, P_{DC}, \eta$, ความร้อน $P_D, T_j$, และตารางเปรียบเทียบ $4\Omega$ vs $8\Omega$
   - 🔬 **ห้องทดลองจำลองเสมือน (`tab-simulator`)**:
     - สไลเดอร์ปรับค่า $\pm V_{CC}$ (Dual Rail), $V_{in(p-p)}$
     - ปุ่มเลือกโหลดลำโพง ($4\Omega, 8\Omega, 16\Omega$ หรือปลดออก No-load)
     - สวิตช์สลับโหมดไบแอส Class AB vs Class B (สังเกต Crossover Distortion)
     - สวิตช์แผ่นระบายความร้อน (Heatsink On/Off) พร้อมเกจวัดอุณหภูมิ $T_j$ และไฟเตือน Thermal Runaway
     - จอ Dual-Trace Oscilloscope แสดงรูปคลื่น $V_{in}$ และ $V_{out}$
   - 📝 **ตารางบันทึกผลการทดลอง (`tab-worksheet`)**: บันทึกผล 2 ตอน (กำลังงานและประสิทธิภาพ, ความร้อนและฮีตซิงก์) พร้อมระบบ 2 โหมด (ค่ามาตรฐาน vs กำหนดค่าเอง) และปุ่ม Auto-fill
   - ❓ **คำถามและสรุปผล (`tab-assessment`)**: ข้อสอบปรนัย 4 ข้อ, สรุปผล, Anti-Cheat, และปุ่มส่งงาน / พิมพ์ PDF
2. **ระบบป้องกันฟอร์มค้าง**:
   - ปุ่ม **"🔄 เริ่มทำใบงานใหม่ (ผู้ใช้อื่น)"** เคลียร์ฟอร์มและปลดล็อกอัตโนมัติ
   - CSS Print Media ป้องกันหน้าขาว/Opacity freeze 100%

## 🚀 การติดตั้งและ Deploy บน Google Apps Script
1. สร้าง Google Sheet ใหม่
2. ไปที่ **ส่วนขยาย (Extensions)** -> **Apps Script**
3. คัดลอกโค้ดจาก `Code.js` ไปวางในไฟล์ `Code.gs`
4. สร้างไฟล์ HTML ชื่อ `index` แล้วคัดลอกโค้ดจาก `index.html` ไปวาง
5. กด **Deploy (การทำให้ใช้งานได้)** -> **New Deployment** -> เลือก Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
