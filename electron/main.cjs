const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn, execSync } = require('child_process')

const CONFIG_NAME = 'os-switch.config.json'

function configPath() {
  return path.join(app.getPath('userData'), CONFIG_NAME)
}

function normalizeMachineSecret(value) {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/[{}]/g, '')
    .replace(/\s+/g, '')
}

function getMachineSecret() {
  if (process.platform === 'win32') {
    try {
      const cmd =
        'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID"'
      const out = execSync(cmd, {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 25000,
        maxBuffer: 2 * 1024 * 1024,
      })
      return normalizeMachineSecret(out)
    } catch (e) {
      console.error('getMachineSecret win', e)
      return ''
    }
  }

  if (process.platform === 'linux') {
    for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try {
        if (fs.existsSync(p)) {
          return normalizeMachineSecret(fs.readFileSync(p, 'utf8'))
        }
      } catch (e) {
        console.error('getMachineSecret linux', p, e)
      }
    }
    return ''
  }

  if (process.platform === 'darwin') {
    try {
      const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice', {
        encoding: 'utf8',
        timeout: 15000,
      })
      const m = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(out)
      return m ? normalizeMachineSecret(m[1]) : ''
    } catch (e) {
      console.error('getMachineSecret darwin', e)
      return ''
    }
  }

  return ''
}

function examplePath() {
  if (process.platform === 'linux') {
    const linuxEx = path.join(__dirname, 'os-switch.linux-host.example.json')
    if (fs.existsSync(linuxEx)) return linuxEx
  }
  return path.join(__dirname, 'os-switch.example.json')
}

function ensureConfig() {
  const target = configPath()
  if (fs.existsSync(target)) return target
  try {
    const example = examplePath()
    if (fs.existsSync(example)) {
      fs.copyFileSync(example, target)
    } else {
      fs.writeFileSync(
        target,
        JSON.stringify(
          {
            ubuntu: {
              command: 'shutdown.exe',
              args: ['/r', '/t', '10', '/c', 'AiJIN: Configure os-switch.config.json for your dual-boot setup.'],
            },
            windows: {
              command: 'shutdown.exe',
              args: ['/r', '/t', '10', '/c', 'AiJIN: Configure os-switch.config.json for your dual-boot setup.'],
            },
          },
          null,
          2,
        ),
      )
    }
  } catch (e) {
    console.error('ensureConfig', e)
  }
  return target
}

function loadConfig() {
  ensureConfig()
  const p = configPath()
  try {
    const raw = fs.readFileSync(p, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#020204',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const devUrl = process.env.ELECTRON_START_URL
  if (devUrl) {
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    const distHtml = path.join(__dirname, '..', 'dist', 'index.html')
    if (fs.existsSync(distHtml)) {
      win.loadFile(distHtml)
    } else {
      win.loadURL('http://127.0.0.1:5173')
    }
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('th.aiji.appswit')
  }
  ensureConfig()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('os-switch:config-path', () => configPath())

ipcMain.handle('auth:get-context', () => {
  const osUsername = os.userInfo().username
  const hostname = os.hostname()
  const secret = getMachineSecret()
  const supported = secret.length > 0

  let hint =
    'รหัสผ่านต้องตรงกับรหัสประจำเครื่องของ OS นี้ (ไม่มีช่องว่าง ตัวพิมพ์เล็กก็ได้)'
  if (process.platform === 'win32') {
    hint =
      'รหัสผ่าน = UUID ฮาร์ดแวร์ของเครื่อง (เดียวกับ Win32_ComputerSystemProduct.UUID) เปิด PowerShell แล้วรัน: (Get-CimInstance Win32_ComputerSystemProduct).UUID'
  } else if (process.platform === 'linux') {
    hint =
      'รหัสผ่าน = ค่าในไฟล์ /etc/machine-id (รัน: cat /etc/machine-id) — บรรทัดเดียว ไม่มีช่องว่าง'
  } else if (process.platform === 'darwin') {
    hint = 'รหัสผ่าน = IOPlatformUUID ของเครื่อง Mac (ดูจาก ioreg หรือ เกี่ยวกับระบบ)'
  }

  return {
    supported,
    osUsername,
    hostname,
    platform: process.platform,
    hint,
    error: supported ? null : 'อ่านรหัสเครื่องไม่ได้ — บน Windows ลองรันแอปตามปกติ; บน Linux ตรวจว่าอ่าน /etc/machine-id ได้',
  }
})

ipcMain.handle('auth:verify', (_event, payload) => {
  const username = payload && typeof payload.username === 'string' ? payload.username : ''
  const password = payload && typeof payload.password === 'string' ? payload.password : ''
  const secret = getMachineSecret()
  if (!secret) {
    return { ok: false, error: 'ไม่พบรหัสเครื่อง — ไม่สามารถยืนยันตัวตนได้' }
  }

  const expectedUser = os.userInfo().username
  const okUser = username.trim().toLowerCase() === expectedUser.toLowerCase()
  const okPass = normalizeMachineSecret(password) === secret

  if (!okUser) {
    return {
      ok: false,
      error: `ชื่อผู้ใช้ต้องตรงกับบัญชีที่ล็อกอิน OS นี้ (${expectedUser})`,
    }
  }
  if (!okPass) {
    return {
      ok: false,
      error: 'รหัสผ่านไม่ตรงกับรหัสเครื่อง (UUID / machine-id) — ตรวจตัวพิมพ์และไม่ใส่ช่องว่าง',
    }
  }

  return { ok: true, osUsername: expectedUser }
})

ipcMain.handle('os-switch:open-folder', async () => {
  await shell.openPath(path.dirname(configPath()))
  return { ok: true }
})

ipcMain.handle('os-switch:run', async (_event, osId) => {
  if (typeof osId !== 'string' || !/^[a-z0-9_-]+$/i.test(osId)) {
    return { ok: false, error: 'Invalid OS id' }
  }

  const cfg = loadConfig()
  const entry = cfg[osId]
  if (!entry || typeof entry.command !== 'string') {
    return {
      ok: false,
      error: `No command for "${osId}" in ${CONFIG_NAME}. Open config folder and edit the file.`,
    }
  }

  const args = Array.isArray(entry.args) ? entry.args : []
  const child = spawn(entry.command, args, {
    shell: true,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  child.unref()

  return {
    ok: true,
    message: entry.label || `Started: ${entry.command}`,
  }
})
