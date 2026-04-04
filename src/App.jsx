import { useState, useEffect, useRef } from 'react'

const SESSION_KEY = 'aijin_session'
const OPERATOR_KEY = 'aijin_operator'

/** ใช้เฉพาะโหมดเบราว์เซอร์ (ไม่มี Electron) */
const AUTH_USER = (import.meta.env.VITE_AIJIN_USER ?? 'dev').trim()
const AUTH_PASS = import.meta.env.VITE_AIJIN_PASS ?? 'browser-only'

/** นับถอยหลังก่อนสั่ง boot อัตโนมัติ (วินาที) */
const AUTO_BOOT_SECONDS = 5 * 60

/** จดจำ OS ที่เลือกล่าสุด — ใช้เมื่อเปิดแอปใหม่หรือไม่ได้เปลี่ยนการเลือก */
const LAST_OS_KEY = 'aijin_last_os'

const OS_LIST = [
  {
    id: 'ubuntu',
    name: 'UBUNTU 24.04.4 LTS',
    version: 'Noble · Kernel 6.8 (point release 4)',
    desc: 'PRIMARY DEV ENVIRONMENT',
    icon: (
      <svg viewBox="0 0 24 24" className="w-16 h-16" fill="currentColor">
        <path d="M12 0a12 12 0 1 0 12 12A12 12 0 0 0 12 0zm0 22a10 10 0 1 1 10-10 10 10 0 0 1-10 10zM7 12a5 5 0 1 1 10 0 5 5 0 0 1-10 0z" />
      </svg>
    ),
    color: 'text-orange-500',
    accent: '#f97316',
  },
  {
    id: 'windows',
    name: 'WINDOWS 11 PRO',
    version: 'Build 22631.3447',
    desc: 'GAMING & PRODUCTION',
    icon: (
      <svg viewBox="0 0 24 24" className="w-16 h-16" fill="currentColor">
        <path d="M0 3.449L9.75 2.1v9.451H0V3.449zm0 17.102L9.75 21.9v-9.451H0v8.102zM10.75 1.9L24 0v11.549h-13.25V1.9zm13.25 22.1L10.75 22.1v-9.451H24v11.351z" />
      </svg>
    ),
    color: 'text-white',
    accent: '#ffffff',
  },
]

function getLastOsIndex() {
  try {
    const id = localStorage.getItem(LAST_OS_KEY)
    if (!id) return 0
    const i = OS_LIST.findIndex((os) => os.id === id)
    return i >= 0 ? i : 0
  } catch {
    return 0
  }
}

export default function App() {
  const [sessionAuthed, setSessionAuthed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1'
    } catch {
      return false
    }
  })
  const [operatorName, setOperatorName] = useState(() => {
    try {
      return sessionStorage.getItem(OPERATOR_KEY) || 'CHIEF ARM'
    } catch {
      return 'CHIEF ARM'
    }
  })
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  /** loading | desktop | browser */
  const [authMode, setAuthMode] = useState('loading')
  const [authCtx, setAuthCtx] = useState(null)

  const [selectedIndex, setSelectedIndex] = useState(() => getLastOsIndex())
  const [countdown, setCountdown] = useState(AUTO_BOOT_SECONDS)
  const [booting, setBooting] = useState(false)
  const [switchPhase, setSwitchPhase] = useState('idle')
  const [switchMessage, setSwitchMessage] = useState('')
  const [systemLogs, setSystemLogs] = useState([])
  const menuRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function loadAuthContext() {
      try {
        if (typeof window !== 'undefined' && window.authDesktop?.getContext) {
          const ctx = await window.authDesktop.getContext()
          if (cancelled) return
          setAuthCtx(ctx)
          if (ctx?.supported) {
            setAuthMode('desktop')
            setLoginId(ctx.osUsername || '')
            setLoginError('')
          } else {
            setAuthMode('browser')
            if (ctx?.error) setLoginError(ctx.error)
          }
          return
        }
      } catch {
        /* fall through */
      }
      if (!cancelled) setAuthMode('browser')
    }
    loadAuthContext()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!sessionAuthed) {
      setSystemLogs([])
      return undefined
    }

    const logs = [
      'DMI PROCESSOR: INTEL I9-12900H @ 5.0GHZ',
      'MEMORY: 32GB DDR5 4800MHZ DUAL-CHANNEL',
      'STORAGE: SAMSUNG SSD 990 PRO 2TB (NVME Gen4)',
      'VGA: NVIDIA GEFORCE RTX 3070 TI (8GB GDDR6)',
      'DISPLAY: 15.6" FHD IPS 300HZ READY',
      `AUTHORIZATION: ${operatorName} - AIJI FORGE THAILAND`,
    ]

    setSystemLogs([])
    let i = 0
    const interval = setInterval(() => {
      if (i < logs.length) {
        setSystemLogs((prev) => [...prev, logs[i]])
        i++
      } else {
        clearInterval(interval)
      }
    }, 350)

    return () => clearInterval(interval)
  }, [sessionAuthed, operatorName])

  useEffect(() => {
    if (!sessionAuthed) return
    const id = OS_LIST[selectedIndex]?.id
    if (!id) return
    try {
      localStorage.setItem(LAST_OS_KEY, id)
    } catch {
      /* ignore */
    }
  }, [sessionAuthed, selectedIndex])

  useEffect(() => {
    if (!sessionAuthed) return undefined
    if (menuRef.current) menuRef.current.focus()
    let timer
    if (countdown > 0 && !booting) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    } else if (countdown === 0 && !booting) {
      setBooting(true)
    }
    return () => clearTimeout(timer)
  }, [sessionAuthed, countdown, booting, selectedIndex])

  useEffect(() => {
    if (!booting) {
      setSwitchPhase('idle')
      setSwitchMessage('')
      return
    }
    setSwitchPhase('running')
    setSwitchMessage('')
    const osId = OS_LIST[selectedIndex]?.id
    if (!osId) return undefined

    const timer = setTimeout(async () => {
      try {
        const bridge = window.osSwitcher
        if (!bridge?.run) {
          setSwitchPhase('error')
          setSwitchMessage(
            'โหมดเว็บไม่สามารถรีบูตหรือสลับ OS ได้ — ใช้แอป Electron บน Windows หรือ Linux (npm run app)',
          )
          return
        }
        const res = await bridge.run(osId)
        if (res.ok) {
          setSwitchPhase('done')
          setSwitchMessage(
            res.message ||
              'ส่งคำสั่งแล้ว — หากตั้งค่าเป็นรีบูต เครื่องจะรีสตาร์ทตามที่กำหนดใน os-switch.config.json',
          )
        } else {
          setSwitchPhase('error')
          setSwitchMessage(res.error || 'สั่งงานไม่สำเร็จ')
        }
      } catch (err) {
        setSwitchPhase('error')
        setSwitchMessage(err instanceof Error ? err.message : String(err))
      }
    }, 2200)

    return () => clearTimeout(timer)
  }, [booting, selectedIndex])

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(OPERATOR_KEY)
    } catch {
      /* ignore */
    }
    setSessionAuthed(false)
    setBooting(false)
    setCountdown(AUTO_BOOT_SECONDS)
    setLoginId('')
    setLoginPassword('')
    setLoginError('')
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setLoginError('')

    if (authMode === 'desktop' && window.authDesktop?.verify) {
      try {
        const r = await window.authDesktop.verify(loginId, loginPassword)
        if (r.ok) {
          try {
            sessionStorage.setItem(SESSION_KEY, '1')
            sessionStorage.setItem(OPERATOR_KEY, r.osUsername.toUpperCase())
          } catch {
            /* ignore */
          }
          setOperatorName(r.osUsername.toUpperCase())
          setSessionAuthed(true)
          setLoginPassword('')
        } else {
          setLoginError(r.error || 'เข้าสู่ระบบไม่สำเร็จ')
        }
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : String(err))
      }
      return
    }

    const id = loginId.trim()
    if (id === AUTH_USER && loginPassword === AUTH_PASS) {
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
        sessionStorage.setItem(OPERATOR_KEY, id.toUpperCase())
      } catch {
        /* ignore */
      }
      setOperatorName(id.toUpperCase())
      setSessionAuthed(true)
      setLoginPassword('')
    } else {
      setLoginError(
        'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง — โหมดเว็บตั้งค่าใน .env (ดู .env.example)',
      )
    }
  }

  const handleKeyDown = (e) => {
    if (!sessionAuthed) return
    if (booting) {
      if (e.key === 'Escape' && (switchPhase === 'error' || switchPhase === 'done'))
        setBooting(false)
      return
    }
    if (e.key === 'ArrowRight')
      setSelectedIndex((prev) => (prev + 1) % OS_LIST.length)
    if (e.key === 'ArrowLeft')
      setSelectedIndex((prev) => (prev - 1 + OS_LIST.length) % OS_LIST.length)
    if (e.key === 'Enter') setBooting(true)
  }

  return (
    <div className="min-h-screen bg-[#020204] text-white font-sans overflow-hidden relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono&display=swap');
        .logo-font { font-family: 'Orbitron', sans-serif; letter-spacing: 0.5em; }
        .mono-font { font-family: 'JetBrains Mono', monospace; }

        .orange-glow {
          box-shadow: 0 0 50px rgba(249, 115, 22, 0.25);
        }

        .scan-line {
          position: absolute;
          width: 100%;
          height: 3px;
          background: rgba(249, 115, 22, 0.03);
          top: 0;
          animation: scan 10s infinite linear;
          z-index: 50;
          pointer-events: none;
        }
        @keyframes scan {
          0% { top: 0%; }
          100% { top: 100%; }
        }

        .bg-grid {
          background-size: 50px 50px;
          background-image: linear-gradient(to right, rgba(249,115,22,0.02) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(249,115,22,0.02) 1px, transparent 1px);
        }

        @keyframes load-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(calc(400% + 100%)); }
        }
      `}</style>

      <div className="absolute inset-0 bg-grid" />
      <div className="scan-line" />

      {!sessionAuthed && (
        <div className="relative z-20 min-h-screen flex flex-col items-center justify-center px-6 py-16 select-text">
          <div className="w-full max-w-md border border-orange-500/25 rounded-2xl bg-black/70 backdrop-blur-2xl shadow-[0_0_60px_rgba(249,115,22,0.08)] overflow-hidden">
            <div className="px-8 pt-8 pb-2 border-b border-white/5">
              <p className="mono-font text-[9px] text-orange-500/80 tracking-[0.35em] uppercase font-bold">
                Secure session
              </p>
              <h2 className="logo-font text-2xl text-white mt-3 tracking-[0.25em]">
                Ai<span className="text-orange-500">JIN</span>
              </h2>
              <p className="mono-font text-[10px] text-neutral-500 mt-2 tracking-widest uppercase">
                เข้าสู่ระบบเพื่อเลือก OS
              </p>
            </div>
            <form
              onSubmit={handleLoginSubmit}
              className="px-8 py-8 space-y-5"
              autoComplete="on"
            >
              {authMode === 'loading' && (
                <p className="mono-font text-[10px] text-neutral-500 text-center tracking-widest uppercase">
                  กำลังโหลดการยืนยันตัวตน…
                </p>
              )}

              {authMode === 'desktop' && authCtx && (
                <p className="mono-font text-[9px] text-neutral-500 leading-relaxed border border-white/10 rounded-lg px-3 py-2 bg-black/40">
                  <span className="text-orange-500/80 uppercase tracking-widest">โหมดแอป</span>
                  <br />
                  HOST:{' '}
                  <span className="text-neutral-300">{authCtx.hostname}</span>
                  <br />
                  {authCtx.hint}
                </p>
              )}

              <div>
                <label
                  htmlFor="aijin-login-id"
                  className="mono-font text-[9px] text-neutral-500 uppercase tracking-widest block mb-2"
                >
                  {authMode === 'desktop'
                    ? 'ชื่อผู้ใช้ระบบ (ต้องตรงกับบัญชีที่ล็อกอิน OS นี้)'
                    : 'Operator ID (โหมดเว็บ)'}
                </label>
                <input
                  id="aijin-login-id"
                  name="username"
                  type="text"
                  value={loginId}
                  onChange={(ev) => setLoginId(ev.target.value)}
                  disabled={authMode === 'loading'}
                  className="w-full mono-font text-sm bg-[#0a0a0c] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-neutral-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 disabled:opacity-50"
                  placeholder={authMode === 'browser' ? AUTH_USER : authCtx?.osUsername || ''}
                  autoComplete="username"
                  autoFocus={authMode !== 'loading'}
                />
              </div>
              <div>
                <label
                  htmlFor="aijin-login-pass"
                  className="mono-font text-[9px] text-neutral-500 uppercase tracking-widest block mb-2"
                >
                  {authMode === 'desktop'
                    ? 'รหัสเครื่อง (UUID / machine-id)'
                    : 'Password (โหมดเว็บ)'}
                </label>
                <input
                  id="aijin-login-pass"
                  name="password"
                  type="password"
                  value={loginPassword}
                  onChange={(ev) => setLoginPassword(ev.target.value)}
                  disabled={authMode === 'loading'}
                  className="w-full mono-font text-sm bg-[#0a0a0c] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-neutral-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 disabled:opacity-50"
                  placeholder={
                    authMode === 'desktop' ? 'วางรหัสจากเทอร์มินัล / PowerShell' : '••••••••'
                  }
                  autoComplete="current-password"
                />
              </div>
              {loginError && (
                <p className="mono-font text-[10px] text-red-400/90 tracking-wide">{loginError}</p>
              )}
              <button
                type="submit"
                disabled={authMode === 'loading'}
                className="w-full mono-font text-[11px] font-bold uppercase tracking-[0.2em] py-3 rounded-lg bg-orange-500 text-black hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                เข้าสู่ระบบ
              </button>
              {authMode === 'browser' && (
                <p className="mono-font text-[9px] text-neutral-600 text-center leading-relaxed">
                  โหมดเว็บ: ตั้งค่า <span className="text-orange-500/70">VITE_AIJIN_USER</span> /{' '}
                  <span className="text-orange-500/70">VITE_AIJIN_PASS</span> ในไฟล์{' '}
                  <span className="text-neutral-400">.env</span> (ดู .env.example)
                </p>
              )}
              {authMode === 'desktop' && (
                <p className="mono-font text-[9px] text-neutral-600 text-center leading-relaxed">
                  รหัสผ่านไม่ใช่รหัส Microsoft Account — เป็นค่าฮาร์ดแวร์/เครื่องที่ OS รายงานเท่านั้น
                </p>
              )}
            </form>
          </div>
          <p className="mono-font text-[9px] text-neutral-600 mt-8 tracking-widest uppercase">
            Precision Management Interface
          </p>
        </div>
      )}

      {sessionAuthed && (
      <div
        className="min-h-screen outline-none select-none relative"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        ref={menuRef}
      >
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10 border-b border-orange-500/10 bg-black/40 backdrop-blur-lg">
        <div className="mono-font text-[10px] flex items-center gap-6">
          <div>
            <p className="text-orange-500 font-bold tracking-widest">USER: {operatorName}</p>
            <p className="text-neutral-600">ID: 21-08-1992</p>
          </div>
          <div className="h-6 w-[1px] bg-white/10" />
          <div>
            <p className="text-neutral-400">ORG: AIJI FORGE THAILAND</p>
            <p className="text-neutral-600 uppercase">Lowcost Automation Unit</p>
          </div>
        </div>
        <div className="text-right mono-font text-[10px] flex flex-col items-end gap-2">
          <div>
            <p className="text-white/60">SYS_UPTIME: 0.00021s</p>
            <p className="text-orange-500 font-bold">MODE: HIGH-PERFORMANCE</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-[9px] uppercase tracking-widest text-neutral-500 hover:text-orange-400 border border-white/10 px-3 py-1 rounded"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center min-h-screen pt-20 px-10 relative z-10">
        <div className="mb-16 text-center">
          <div className="inline-block relative mb-4">
            <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative border border-orange-500/30 p-5 rounded-2xl bg-black/60 backdrop-blur-2xl orange-glow">
              <svg
                viewBox="0 0 24 24"
                className="w-16 h-16 text-orange-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 7.5l-9-5.25L3 7.5"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 7.5l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-5.25v9"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-6xl font-black logo-font text-white drop-shadow-[0_0_25px_rgba(249,115,22,0.5)]">
            Ai<span className="text-orange-500">JIN</span>
          </h1>
          <p className="text-orange-500/50 text-[10px] tracking-[0.8em] mt-4 uppercase font-bold mono-font">
            Precision Management Interface
          </p>
        </div>

        <div className="flex flex-row gap-12 items-center justify-center w-full max-w-5xl">
          {OS_LIST.map((os, idx) => {
            const isWindows = os.id === 'windows'
            const cardFrame =
              isWindows && selectedIndex === idx
                ? 'border-[#1d4ed8]/55 bg-[#030a14]/90 shadow-[0_0_44px_rgba(29,78,216,0.22),inset_0_0_0_1px_rgba(56,189,248,0.12)]'
                : isWindows
                  ? 'border-[#0c2744] bg-[#040d18]/85 shadow-[inset_0_0_0_1px_rgba(12,39,68,0.95),inset_0_1px_0_0_rgba(30,64,175,0.08)]'
                  : selectedIndex === idx
                    ? 'border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.1)]'
                    : 'border-white/10'

            return (
            <div
              key={os.id}
              onClick={() => {
                if (booting) return
                setSelectedIndex(idx)
                setCountdown(AUTO_BOOT_SECONDS)
              }}
              className={`
                relative flex-1 group transition-all duration-500 cursor-pointer
                ${selectedIndex === idx ? 'scale-105' : 'scale-95 opacity-25 hover:opacity-50'}
              `}
            >
              {selectedIndex === idx && (
                <div
                  className={`absolute -inset-0.5 rounded-2xl blur-lg animate-pulse ${
                    isWindows ? 'bg-blue-600/28' : 'bg-orange-500/20'
                  }`}
                />
              )}

              <div
                className={`
                  relative border rounded-2xl p-10 flex flex-col items-center transition-all duration-500 backdrop-blur-3xl
                  ${isWindows ? '' : 'bg-black/60'}
                  ${cardFrame}
                `}
              >
                <div
                  className={`mb-6 transition-transform duration-500 ${selectedIndex === idx ? 'scale-110 ' + os.color : 'text-neutral-500'}`}
                >
                  {os.icon}
                </div>

                <h3
                  className={`text-xl font-black mb-1 tracking-tight uppercase ${selectedIndex === idx ? 'text-white' : 'text-neutral-500'}`}
                >
                  {os.name}
                </h3>
                <p
                  className={`text-[10px] mono-font mb-6 font-bold ${
                    isWindows ? 'text-sky-400/70' : 'text-orange-500/60'
                  }`}
                >
                  {os.version}
                </p>

                <div className="w-full space-y-3">
                  <div
                    className={`h-[1px] w-full bg-gradient-to-r from-transparent to-transparent ${
                      isWindows ? 'via-sky-500/35' : 'via-white/10'
                    } ${selectedIndex === idx ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <p className="text-[9px] text-neutral-500 text-center tracking-[0.2em] uppercase font-medium">
                    {os.desc}
                  </p>
                </div>

                {selectedIndex === idx && (
                  <div className="absolute -bottom-3 flex flex-col items-center">
                    <div
                      className={`text-black text-[9px] font-black px-4 py-1 rounded-sm uppercase tracking-tighter shadow-lg ${
                        isWindows ? 'bg-sky-500' : 'bg-orange-500'
                      }`}
                    >
                      Ready to execute
                    </div>
                  </div>
                )}
              </div>
            </div>
            )
          })}
        </div>
      </div>

      <div className="absolute left-10 bottom-24 w-80 mono-font text-[9px] text-neutral-500 space-y-2 hidden xl:block">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-[1px] bg-orange-500/50" />
          <p className="text-orange-500 font-bold uppercase tracking-widest">Hardware Initialization</p>
        </div>
        {systemLogs.map((log, i) => (
          <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-700">
            <span className="text-orange-500 opacity-50">[{i + 1}]</span>
            <p className="border-l border-white/5 pl-3">{log}</p>
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 w-full p-8 border-t border-orange-500/10 bg-black/60 backdrop-blur-xl z-10 flex justify-between items-center">
        <div className="flex gap-12 text-[9px] font-mono tracking-[0.3em] text-neutral-500 uppercase">
          <div className="flex items-center gap-3">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </div>
            AUTO-BOOT SEQUENCE:{' '}
            <span className="text-white font-bold">
              {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
            </span>
            <span className="text-neutral-600 normal-case tracking-normal font-normal ml-2 max-sm:hidden">
              · ไม่เลือก = boot {OS_LIST[selectedIndex]?.name ?? ''}
            </span>
          </div>
          <div className="hidden md:flex gap-8 border-l border-white/10 pl-12">
            <span>[ENTER] CONFIRM</span>
            <span>[ARROW] NAVIGATE</span>
            <span className="text-orange-500/80 normal-case tracking-wider">
              npm run app (Win+Linux) · Win: dist:win / dist:msi · Linux: dist:linux / dist:linux:dir
            </span>
          </div>
        </div>
        <div className="text-[10px] mono-font text-orange-500/80 font-bold tracking-[0.2em] flex items-center gap-4">
          <span className="text-neutral-700 font-normal">S/N:</span> AJ-2108-1992-CHIEF
        </div>
      </div>

      {booting && (
        <div className="absolute inset-0 z-[100] bg-[#020204] flex flex-col items-center justify-center animate-in fade-in duration-1000 px-8">
          {booting &&
            switchPhase !== 'done' &&
            switchPhase !== 'error' && (
            <>
              <div className="w-80 h-[1px] bg-white/5 rounded-full overflow-hidden relative mb-10">
                <div
                  className={`absolute top-0 bottom-0 left-0 w-1/3 ${
                    OS_LIST[selectedIndex]?.id === 'windows' ? 'bg-sky-500' : 'bg-orange-500'
                  }`}
                  style={{
                    animation: 'load-bar 2s ease-in-out infinite',
                  }}
                />
              </div>
              <div className="text-center max-w-md">
                <p
                  className={`logo-font text-2xl tracking-[0.5em] animate-pulse uppercase mb-2 ${
                    OS_LIST[selectedIndex]?.id === 'windows' ? 'text-sky-400' : 'text-orange-500'
                  }`}
                >
                  OS HANDOVER
                </p>
                <p className="mono-font text-[10px] text-neutral-500 tracking-widest uppercase mb-1">
                  {OS_LIST[selectedIndex]?.name}
                </p>
                <p className="mono-font text-[9px] text-neutral-600 tracking-widest uppercase italic">
                  กำลังส่งคำสั่งสลับระบบ...
                </p>
              </div>
            </>
          )}

          {switchPhase === 'done' && (
            <div className="text-center max-w-lg space-y-4">
              <p className="mono-font text-emerald-500/90 text-xs tracking-widest uppercase">
                สำเร็จ
              </p>
              <p className="mono-font text-[11px] text-neutral-400 leading-relaxed">{switchMessage}</p>
              <button
                type="button"
                onClick={() => setBooting(false)}
                className="mono-font text-[10px] px-4 py-2 rounded border border-white/20 text-neutral-300 hover:bg-white/5 uppercase tracking-widest"
              >
                ปิด [Esc]
              </button>
            </div>
          )}

          {switchPhase === 'error' && (
            <div className="text-center max-w-lg space-y-4">
              <p className="mono-font text-red-400/90 text-xs tracking-widest uppercase">ผิดพลาด</p>
              <p className="mono-font text-[11px] text-neutral-400 leading-relaxed">{switchMessage}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {typeof window !== 'undefined' && window.osSwitcher?.openConfigFolder && (
                  <button
                    type="button"
                    onClick={() => window.osSwitcher.openConfigFolder()}
                    className="mono-font text-[10px] px-4 py-2 rounded bg-orange-500/90 text-black font-bold hover:bg-orange-400 uppercase tracking-widest"
                  >
                    เปิดโฟลเดอร์ config
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBooting(false)}
                  className="mono-font text-[10px] px-4 py-2 rounded border border-white/20 text-neutral-300 hover:bg-white/5 uppercase tracking-widest"
                >
                  กลับ [Esc]
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      )}
    </div>
  )
}
