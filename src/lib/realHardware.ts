import { useEffect, useRef, useState } from "react"
import { captureError } from "@/store/errorStore"

export interface RealAudio {
  supported: boolean
  ready: boolean
  volume: number
  muted: boolean
  /** Estado real del oscillator: está sonando o no. */
  sounding: boolean
}

export interface RealHardware {
  audio: RealAudio
  battery: { supported: boolean; level: number; charging: boolean }
  network: { online: boolean; downlink: number | null; type: string }
  cpu: { cores: number; threads: number; load: number }
  memory: { supported: boolean; usedMB: number; limitMB: number }
  storage: { supported: boolean; usedMB: number; quotaMB: number }
  screen: { width: number; height: number; pixelRatio: number; colorDepth: number }
  userAgent: string
}

interface BatteryLike {
  level: number
  charging: boolean
  addEventListener(type: string, listener: () => void): void
}

interface PerformanceMemory {
  usedJSHeapSize: number
  jsHeapSizeLimit: number
}

const perf = performance as Performance & { memory?: PerformanceMemory }

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let ambientOsc: OscillatorNode | null = null
let audioVolume = 0.45
let audioMuted = false
const audioListeners = new Set<() => void>()

function emitAudio() {
  for (const listener of audioListeners) listener()
}

/** Crea el contexto de audio real del navegador (usa la salida del PC). */
function ensureAudio(): AudioContext | null {
  if (audioCtx) return audioCtx
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null
    audioCtx = new Ctor()
    masterGain = audioCtx.createGain()
    masterGain.gain.value = audioMuted ? 0 : audioVolume
    masterGain.connect(audioCtx.destination)
    return audioCtx
  } catch (error) {
    captureError(
      "accion",
      `No se pudo iniciar el audio: ${error instanceof Error ? error.message : String(error)}`,
      "realHardware.ensureAudio",
    )
    return null
  }
}

/** Aplica el volumen al dispositivo de salida real. */
export function setRealVolume(value: number, muted = audioMuted) {
  audioVolume = Math.max(0, Math.min(1, value))
  audioMuted = muted
  const ctx = ensureAudio()
  if (ctx && masterGain) {
    masterGain.gain.setTargetAtTime(audioMuted ? 0 : audioVolume, ctx.currentTime, 0.02)
  }
  emitAudio()
}

export function setRealMuted(muted: boolean) {
  setRealVolume(audioVolume, muted)
}

export function getRealVolume() {
  return { volume: audioVolume, muted: audioMuted }
}

/** Tono corto: sirve para comprobar que el volumen mueve el PC de verdad. */
export function playTestTone(frequency = 440, seconds = 0.22) {
  const ctx = ensureAudio()
  if (!ctx || !masterGain) return false
  void ctx.resume()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "sine"
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(audioMuted ? 0.0001 : 0.28, ctx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start()
  osc.stop(ctx.currentTime + seconds + 0.02)
  return true
}

/** Tono continuo muy suave: mantiene viva la salida de audio. */
export function startAmbientTone() {
  const ctx = ensureAudio()
  if (!ctx || !masterGain || ambientOsc) return
  void ctx.resume()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "triangle"
  osc.frequency.value = 110
  gain.gain.value = 0.02
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start()
  ambientOsc = osc
}

export function stopAmbientTone() {
  if (!audioCtx || !ambientOsc) return
  try {
    ambientOsc.stop()
  } catch {
    /* ya estaba detenido */
  }
  ambientOsc = null
}

export function isAudioSounding(): boolean {
  return audioCtx !== null && audioCtx.state === "running"
}

export function subscribeAudio(listener: () => void) {
  audioListeners.add(listener)
  return () => audioListeners.delete(listener)
}

/* ------------------------------------------------------------------ */
/* Sensores del equipo real                                            */
/* ------------------------------------------------------------------ */

interface NetworkInformation {
  downlink?: number
  effectiveType?: string
  type?: string
}

interface Connection {
  downlink?: number
  effectiveType?: string
  type?: string
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

function connection(): Connection | undefined {
  const nav = navigator as Navigator & {
    connection?: Connection
    mozConnection?: Connection
    webkitConnection?: Connection
  }
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection
}

async function readBattery() {
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<BatteryLike>
  }
  if (!nav.getBattery) return null
  try {
    return await nav.getBattery()
  } catch {
    return null
  }
}

/** Carga real del hilo principal, medida con requestAnimationFrame. */
function useMainThreadLoad() {
  const [load, setLoad] = useState(0)
  const last = useRef<{ t: number; frames: number } | null>(null)

  useEffect(() => {
    let frame = 0
    last.current = { t: performance.now(), frames: 0 }
    const tick = () => {
      const now = performance.now()
      const state = last.current
      if (!state) return
      state.frames += 1
      const delta = now - state.t
      if (delta >= 500) {
        const fps = (state.frames / delta) * 1000
        setLoad(Math.max(0, Math.min(100, Math.round((1 - fps / 60) * 100))))
        last.current = { t: now, frames: 0 }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      last.current = null
      cancelAnimationFrame(frame)
    }
  }, [])

  return load
}

/**
 * Lee el hardware real del equipo donde se está ejecutando el simulador.
 * Es el punto 6 del enunciado: el panel de hardware contrasta lo simulado
 * con lo que de verdad tiene el PC.
 */
export function useRealHardware(): RealHardware {
  const [battery, setBattery] = useState({ supported: false, level: 1, charging: false })
  const [online, setOnline] = useState(() => navigator.onLine)
  const [net, setNet] = useState<{ downlink: number | null; type: string }>({
    downlink: null,
    type: "desconocida",
  })
  const [memory, setMemory] = useState({ supported: false, usedMB: 0, limitMB: 0 })
  const [storage, setStorage] = useState({ supported: false, usedMB: 0, quotaMB: 0 })
  const [screen, setScreen] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: window.devicePixelRatio,
    colorDepth: window.screen.colorDepth,
  }))
  const [audio, setAudio] = useState<RealAudio>({
    supported: typeof window.AudioContext !== "undefined",
    ready: false,
    volume: audioVolume,
    muted: audioMuted,
    sounding: false,
  })
  const load = useMainThreadLoad()

  useEffect(() => {
    let batteryRef: BatteryLike | null = null
    let cancelled = false

    void readBattery().then((b) => {
      if (!b || cancelled) return
      batteryRef = b
      setBattery({ supported: true, level: b.level, charging: b.charging })
      const sync = () =>
        setBattery({ supported: true, level: b.level, charging: b.charging })
      b.addEventListener("levelchange", sync)
      b.addEventListener("chargingchange", sync)
    })

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    const conn = connection()
    const syncNet = () => {
      const info = conn as NetworkInformation | undefined
      setNet({
        downlink: info?.downlink ?? null,
        type: info?.effectiveType ?? "desconocida",
      })
    }
    conn?.addEventListener("change", syncNet)
    syncNet()

    const syncMemory = () => {
      if (!perf.memory) return
      setMemory({
        supported: true,
        usedMB: Math.round(perf.memory.usedJSHeapSize / 1048576),
        limitMB: Math.round(perf.memory.jsHeapSizeLimit / 1048576),
      })
    }
    syncMemory()
    const memoryTimer = window.setInterval(syncMemory, 2000)

    const syncStorage = () => {
      if (!navigator.storage?.estimate) return
      void navigator.storage.estimate().then((estimate) => {
        setStorage({
          supported: true,
          usedMB: Math.round((estimate.usage ?? 0) / 1048576),
          quotaMB: Math.round((estimate.quota ?? 0) / 1048576),
        })
      })
    }
    syncStorage()

    const onResize = () =>
      setScreen({
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
        colorDepth: window.screen.colorDepth,
      })
    window.addEventListener("resize", onResize)

    const unsubAudio = subscribeAudio(() =>
      setAudio({
        supported: typeof window.AudioContext !== "undefined",
        ready: audioCtx !== null,
        volume: audioVolume,
        muted: audioMuted,
        sounding: isAudioSounding(),
      }),
    )

    return () => {
      cancelled = true
      void batteryRef
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      conn?.removeEventListener("change", syncNet)
      window.clearInterval(memoryTimer)
      window.removeEventListener("resize", onResize)
      unsubAudio()
    }
  }, [])

  return {
    audio,
    battery,
    network: { online, downlink: net.downlink, type: net.type },
    cpu: {
      cores: navigator.hardwareConcurrency ?? 1,
      threads: navigator.hardwareConcurrency ?? 1,
      load,
    },
    memory,
    storage,
    screen,
    userAgent: navigator.userAgent,
  }
}