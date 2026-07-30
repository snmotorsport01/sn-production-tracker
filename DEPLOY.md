# SN ERP — คู่มือ Deploy ⚙️

ระบบมี **2 ส่วนแยกกัน** ต้อง deploy คนละที่:

| ส่วน | อยู่ที่ | deploy ยังไง |
|---|---|---|
| **Frontend** (หน้าเว็บ/แอป) | GitHub Pages (repo นี้) | `git push` |
| **Backend** (เขียน/อ่าน Google Sheet) | Google Apps Script | paste `Code.gs` → Deploy ที่ script.google.com |

---

## 🔴 กฎเหล็ก: อย่าให้ exec URL เปลี่ยน!

ทุกหน้า (`*.html`) เรียก backend ผ่าน **exec URL** เดียวกัน
ถ้า URL เปลี่ยน → แอปยิงผิดที่ → **"Load failed" / บันทึกไม่ได้** จนกว่าจะแก้ URL ในทุกไฟล์

### ✅ วิธี redeploy backend ที่ถูกต้อง (URL ไม่เปลี่ยน)
1. เปิด [script.google.com](https://script.google.com) → โปรเจกต์ ERP → `Code.gs`
2. เอาโค้ดจาก `~/Desktop/ERP/Code.gs` มาวางทับ → **`Cmd+S`** (เซฟ)
3. **การทำให้ใช้งานได้ → จัดการการทำให้ใช้งานได้ → ✏️ (แก้อันเดิม) → เวอร์ชัน: `เวอร์ชันใหม่` → ทำให้ใช้งานได้**

### ❌ อย่าทำ
- **อย่าเลือก "การทำให้ใช้งานได้รายการใหม่" (New deployment)** → จะได้ URL ใหม่ → แอปพัง
- อย่า deploy ก่อน `Cmd+S` → จะได้โค้ดเก่า

---

## ถ้า URL เปลี่ยนไปแล้ว (เผลอสร้าง deployment ใหม่)

ต้องแก้ exec URL ในทุกไฟล์ `.html` (10 หน้า) + bump service worker แล้ว push:

```bash
cd ~/Desktop/ERP/sn-production-tracker

# 1) แทนที่ URL เก่าด้วยใหม่ในทุกหน้า (ใส่ ID เก่า/ใหม่ให้ตรง)
OLD="AKfycb...URL_เก่า...";  NEW="AKfycb...URL_ใหม่..."
for f in *.html; do sed -i '' "s|$OLD|$NEW|g" "$f"; done

# 2) bump เลขเวอร์ชันใน sw.js (เช่น v14 -> v15) เพื่อล้าง cache เก่า

# 3) push
git add -A && git commit -m "fix: update backend exec URL" && git push
```

**exec URL ปัจจุบัน:**
```
https://script.google.com/macros/s/AKfycbzMqTc5rY4oi2jelEuuMZhybmbx-_13zaG0zDDrjvjC09Bx3sloUEa4c1V8Cv3fTtZW/exec
```

---

## Deploy Frontend (แก้หน้าเว็บ)

```bash
cd ~/Desktop/ERP/sn-production-tracker
# ...แก้ไฟล์...
git add -A && git commit -m "..." && git push
```

⚠️ **ทุกครั้งที่แก้ไฟล์หน้าเว็บ ต้อง bump `VERSION` ใน `sw.js`** (เช่น `v14` → `v15`)
ไม่งั้น service worker จะเสิร์ฟไฟล์เก่าจาก cache
(ตอนนี้ SW เป็น network-first แล้ว หน้าใหม่จะมาไวขึ้น แต่ bump ไว้ชัวร์สุด)

GitHub Pages ใช้เวลา ~1 นาทีหลัง push จึงขึ้น live

---

## ไฟล์สำคัญ
- `~/Desktop/ERP/Code.gs` — โค้ด backend ตัวจริง (backup + ตัวที่เอาไป paste)
- `axis.css` — ธีม AXIS (แก้ที่นี่ที่เดียว มีผลทุกหน้า)
- `sw.js` — service worker (มี `VERSION` ที่ต้อง bump)
- `manifest.json` — ไอคอน/ชื่อ PWA

## หมายเหตุ backend
- โค้ด Apps Script มีหลายไฟล์: `Code.gs` (หลัก), `Inventory.gs`, `InventoryV2.gs`, `N8N.gs`, `Auth.gs` — **แก้แค่ `Code.gs`**
- Deployment ต้องตั้ง: **ดำเนินการในฐานะ = ฉัน** · **ผู้ที่มีสิทธิ์เข้าถึง = ทุกคน** (ไม่งั้นแอปโดนเด้งหน้า login → Load failed)
- ชีตข้อมูล: `1aW9nMYepJnSiJZEs3zZSNiJ97zwaQmM20IsLMC_UXo4` (แท็บ Invoices สร้างเองอัตโนมัติเมื่อบันทึก invoice ใบแรก)
