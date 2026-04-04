/**
 * ตรงกับ engines ของ Vite 8: ^20.19.0 || >=22.12.0
 */
const version = process.version
const m = /^v(\d+)\.(\d+)\.(\d+)/.exec(version)
if (!m) {
  console.error('[appswit] ไม่อ่านรุ่น Node.js ได้:', version)
  process.exit(1)
}

const major = Number(m[1])
const minor = Number(m[2])
const patch = Number(m[3])

let supported = false
if (major > 22) supported = true
else if (major === 22 && (minor > 12 || (minor === 12 && patch >= 0))) supported = true
else if (major === 20 && (minor > 19 || (minor === 19 && patch >= 0))) supported = true

if (!supported) {
  console.error(
    '[appswit] Node.js รุ่นนี้ไม่รองรับ — ต้องใช้ ^20.19.0 หรือ >=22.12.0 (ตาม Vite 8)',
  )
  console.error('[appswit] รุ่นปัจจุบัน:', version)
  console.error('[appswit] แนะนำ: ติดตั้ง Node 20 LTS ล่าสุด หรือ 22 LTS — ดู .nvmrc')
  process.exit(1)
}
