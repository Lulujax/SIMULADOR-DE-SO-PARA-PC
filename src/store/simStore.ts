import { create } from "zustand"
import type {
  ContinuousKind,
  Device,
  MemoryAlgorithm,
  MemoryMode,
  Process,
  SchedulerAlgorithm,
  SimSnapshot,
  SimState,
} from "@/types/os"
import {
  allocate,
  compact,
  deallocate,
  resetAllocations,
  setMemoryMode,
  setUnitSize,
  swapOut,
} from "@/lib/memory"
import { submitIoRequest } from "@/lib/io"
import {
  createInitialState,
  createProcess,
  logEvent,
  releaseCpu,
  stepOnce,
  transition,
  unblockFromSync,
} from "@/lib/engine"
import { pickNext } from "@/lib/scheduler"

interface SimStore {
  sim: SimState
  version: number
  running: boolean
  speed: number
  selectedPid: number | null

  commit: () => void
  play: () => void
  pause: () => void
  toggleRun: () => void
  stepOnce: () => void
  reset: () => void
  setSpeed: (speed: number) => void
  select: (pid: number | null) => void

  spawn: (overrides?: Partial<Process>) => void
  suspend: (pid: number) => void
  resume: (pid: number) => void
  block: (pid: number) => void
  kill: (pid: number) => void
  boostPriority: (pid: number) => void

  setScheduler: (value: SchedulerAlgorithm) => void
  setQuantum: (value: number) => void
  setClockEvery: (value: number) => void
  setAutoSpawn: (value: boolean) => void
  setMaxProcesses: (value: number) => void

  setMode: (mode: MemoryMode) => void
  setContinuousKind: (kind: ContinuousKind) => void
  setAlgorithm: (algorithm: MemoryAlgorithm) => void
  setUnitKB: (value: number) => void
  setPartitionKB: (value: number) => void
  setTotalKB: (value: number) => void
  setSwapEnabled: (value: boolean) => void
  compact: () => void

  injectIo: (deviceId: string) => void

  /** Una tecla pulsada genera una E/S real al teclado. */
  typeOnKeyboard: (pid: number, text: string) => void
  /** Una operación de la calculadora actúa sobre el acumulador del proceso. */
  calcPress: (pid: number, op: "digito" | "suma" | "resta" | "multiplica" | "divide" | "porcentaje" | "signo" | "clear" | "igual" | "punto", value?: number) => void
  /** Trabajo extra asignado a un proceso (capturas, render, etc.). */
  addWork: (pid: number, units: number) => void

  exportSnapshot: () => SimSnapshot
  importSnapshot: (snapshot: SimSnapshot) => void
}

function deviceQueueHas(device: Device, pid: number): boolean {
  return device.active?.pid === pid || device.queue.some((r) => r.pid === pid)
}

const baseSim = createInitialState()

export const useSimStore = create<SimStore>()((set, get) => ({
  sim: baseSim,
  version: 0,
  running: false,
  speed: 1,
  selectedPid: null,

  commit: () => set((s) => ({ version: s.version + 1 })),

  play: () => set({ running: true }),
  pause: () => set({ running: false }),
  toggleRun: () => set((s) => ({ running: !s.running })),

  stepOnce: () => {
    stepOnce(get().sim)
    get().commit()
  },

  reset: () => {
    const fresh = createInitialState()
    set({ sim: fresh, running: false, selectedPid: null })
    set((s) => ({ version: s.version + 1 }))
  },

  setSpeed: (speed) => set({ speed }),
  select: (pid) => set({ selectedPid: pid }),

  spawn: (overrides) => {
    const sim = get().sim
    createProcess(sim, overrides)
    set({ selectedPid: sim.processes[sim.processes.length - 1]?.pid ?? null })
    get().commit()
  },

  suspend: (pid) => {
    const sim = get().sim
    const process = sim.processes.find((p) => p.pid === pid)
    if (!process || process.state === "terminado" || process.isSystem) return
    if (sim.cpuPid === pid) sim.cpuPid = null
    sim.readyQueue = sim.readyQueue.filter((x) => x !== pid)
    swapOut(sim, process)
    process.blockedReason = "Suspendido por el operador: escrito a disco"
    logEvent(sim, "memoria", `P${pid} suspendido y escrito a la zona de swap`, pid)
    get().commit()
  },

  resume: (pid) => {
    const sim = get().sim
    const process = sim.processes.find((p) => p.pid === pid)
    if (!process || process.state !== "suspendido") return
    sim.memory.swapVictim = pid
    const alloc = allocate(sim, process)
    if (!alloc.ok) {
      logEvent(
        sim,
        "memoria",
        `No se puede traer P${pid} de swap: ${alloc.reason}`,
        pid,
      )
      get().commit()
      return
    }
    transition(sim, process, "listo", "Traído de disco (swap in)")
    sim.readyQueue.push(pid)
    logEvent(sim, "memoria", `P${pid} recupera ${process.memoryRequired} KB del swap`, pid)
    get().commit()
  },

  block: (pid) => {
    const sim = get().sim
    const process = sim.processes.find((p) => p.pid === pid)
    if (!process || process.state === "terminado" || process.isSystem) return
    if (process.state === "ejecutando") {
      sim.cpuPid = null
      sim.readyQueue = sim.readyQueue.filter((x) => x !== pid)
    }
    process.blockedReason = "Bloqueado manualmente por el operador"
    transition(sim, process, "bloqueado", process.blockedReason)
    get().commit()
  },

  kill: (pid) => {
    const sim = get().sim
    const process = sim.processes.find((p) => p.pid === pid)
    if (!process || process.isSystem) return
    if (process.state === "terminado") {
      unblockFromSync(sim, process)
      return
    }
    deallocate(sim, process)
    if (sim.cpuPid === pid) sim.cpuPid = null
    sim.readyQueue = sim.readyQueue.filter((x) => x !== pid)
    transition(sim, process, "terminado", "Terminado por el operador")
    sim.stats.terminated += 1
    get().commit()
  },

  boostPriority: (pid) => {
    const sim = get().sim
    const process = sim.processes.find((p) => p.pid === pid)
    if (!process) return
    process.priority = Math.max(1, process.priority - 1)
    logEvent(sim, "planificador", `P${pid} sube a prioridad ${process.priority}`, pid)
    get().commit()
  },

  setScheduler: (value) => {
    const sim = get().sim
    sim.config.scheduler = value
    sim.quantumLeft = 0
    logEvent(sim, "planificador", `Planificador cambiado a ${value}`)
    get().commit()
  },

  setQuantum: (value) => {
    get().sim.config.quantum = value
    get().commit()
  },

  setClockEvery: (value) => {
    get().sim.config.clockEvery = value
    get().commit()
  },

  setAutoSpawn: (value) => {
    get().sim.config.autoSpawn = value
    get().commit()
  },

  setMaxProcesses: (value) => {
    get().sim.config.maxProcesses = value
    get().commit()
  },

  setMode: (mode) => {
    const sim = get().sim
    setMemoryMode(sim, mode)
    logEvent(sim, "memoria", `Gestión de memoria: ${mode === "paginacion" ? "paginación" : "particiones"}`)
    get().commit()
  },

  setContinuousKind: (kind) => {
    const sim = get().sim
    sim.memory.continuousKind = kind
    setMemoryMode(sim, "continua")
    logEvent(sim, "memoria", `Particiones ${kind === "estatica" ? "estáticas" : "dinámicas"}`)
    get().commit()
  },

  setAlgorithm: (algorithm) => {
    const sim = get().sim
    sim.memory.algorithm = algorithm
    logEvent(sim, "memoria", `Algoritmo de asignación: ${algorithm}`)
    get().commit()
  },

  setUnitKB: (value) => {
    const sim = get().sim
    setUnitSize(sim, value)
    logEvent(sim, "memoria", `Unidad de memoria: ${value} KB`)
    get().commit()
  },

  setPartitionKB: (value) => {
    get().sim.memory.staticPartitionKB = value
    get().commit()
  },

  setTotalKB: (value) => {
    const sim = get().sim
    sim.memory.totalKB = value
    resetAllocations(sim)
    logEvent(sim, "memoria", `Memoria total ajustada a ${value} KB`)
    get().commit()
  },

  setSwapEnabled: (value) => {
    get().sim.memory.swapEnabled = value
    logEvent(get().sim, "memoria", `Intercambio automático ${value ? "activado" : "desactivado"}`)
    get().commit()
  },

  compact: () => {
    const sim = get().sim
    const moved = compact(sim)
    logEvent(
      sim,
      "memoria",
      moved > 0
        ? `Compactación: ${moved} unidades reubicadas, se eliminó la fragmentación externa`
        : "Compactación sin cambios: la memoria ya era contigua",
    )
    get().commit()
  },

  injectIo: (deviceId) => {
    const sim = get().sim
    const device = sim.devices.find((d) => d.id === deviceId)
    const candidates = sim.processes.filter(
      (p) => p.state === "listo" || p.state === "ejecutando",
    )
    const process = pickNext(sim) ?? candidates[0]
    if (!device || !process) return
    submitIoRequest(sim, device, {
      pid: process.pid,
      deviceId,
      kind: device.kind === "impresora" ? "escritura" : "lectura",
      op: `IN /dev/${deviceId}`,
    })
    if (process.state === "ejecutando") sim.cpuPid = null
    sim.readyQueue = sim.readyQueue.filter((pid) => pid !== process.pid)
    process.ioRequest = deviceId
    process.blockedReason = `Esperando ${device.name} (petición externa)`
    transition(sim, process, "bloqueado", `${device.name}: petición del operador`)
    logEvent(sim, "es", `P${process.pid} → ${device.name}`, process.pid)
    get().commit()
  },

  typeOnKeyboard: (pid, text) => {
    const sim = get().sim
    const process = sim.processes.find((p) => p.pid === pid)
    if (!process) return
    const keyboard = sim.devices.find((d) => d.kind === "teclado")
    if (!keyboard) return
    const waiting = process.ioRequest === "teclado" || deviceQueueHas(keyboard, pid)

    if (!waiting) {
      submitIoRequest(sim, keyboard, {
        pid: process.pid,
        deviceId: "teclado",
        kind: "lectura",
        op: `IN /dev/teclado "${text.slice(-1)}"`,
      })
      if (process.state === "ejecutando") releaseCpu(sim, "Entrada del usuario")
      sim.readyQueue = sim.readyQueue.filter((x) => x !== process.pid)
      process.ioRequest = "teclado"
      process.blockedReason = "Esperando teclado"
      transition(sim, process, "bloqueado", `Teclado: "${text.slice(-1)}"`)
      sim.stats.ioWaits += 1
    }
    process.burstRemaining += 1
    process.burstTotal += 1
    get().commit()
  },

  calcPress: (pid, op, value = 0) => {
    const sim = get().sim
    const process = sim.processes.find((p) => p.pid === pid)
    if (!process) return
    const ac = process.registers.ac

    switch (op) {
      case "digito":
        process.registers.ac = Number(String(ac).slice(0, -1) + value) * 0 + Number(`${ac === 0 ? "" : ac}${value}`)
        break
      case "punto":
        break
      case "clear":
        process.registers.ac = 0
        break
      case "signo":
        process.registers.ac = -ac
        break
      case "porcentaje":
        process.registers.ac = Math.trunc(ac / 100)
        break
      default:
        break
    }

    process.registers.ac = Math.max(-999999, Math.min(999999, process.registers.ac))
    process.registers.cc = process.registers.ac < 0 ? "N" : process.registers.ac === 0 ? "Z" : "P"
    process.burstRemaining += 1
    process.burstTotal += 1
    get().commit()
  },

  addWork: (pid, units) => {
    const sim = get().sim
    const process = sim.processes.find((p) => p.pid === pid)
    if (!process) return
    process.burstRemaining += units
    process.burstTotal += units
    get().commit()
  },

  exportSnapshot: () => ({
    version: 2,
    exportedAt: new Date().toISOString(),
    state: structuredClone(get().sim),
  }),

  importSnapshot: (snapshot) => {
    if (!snapshot?.state?.processes) return
    const fresh: SimState = {
      ...structuredClone(snapshot.state),
      eventLog: snapshot.state.eventLog ?? [],
      transitions: snapshot.state.transitions ?? [],
    }
    set({ sim: fresh, running: false, selectedPid: null })
    set((s) => ({ version: s.version + 1 }))
  },
}))