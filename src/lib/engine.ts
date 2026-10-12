import type {
  InterruptRecord,
  LogCategory,
  Process,
  ProcessState,
  SimConfig,
  SimState,
} from "@/types/os"
import { submitIoRequest, createDevices, tickDevices } from "./io"
import {
  allocate,
  createMemory,
  deallocate,
  growByOneFrame,
  recomputeFragmentation,
  swapOut,
} from "./memory"
import { pickNext } from "./scheduler"
import { stateStyles } from "./palette"

const PROGRAM_NAMES = [
  "service.exe",
  "antivirus.exe",
  "indexador.exe",
  "sincronizador.exe",
  "telemetry.exe",
]

const ARITHMETIC = [
  "ADD AC, #7",
  "SUB AC, #3",
  "ADD AC, #12",
  "SUB AC, #1",
  "INC AC",
  "DEC AC",
]

const MEMORY_OPS = ["LOAD AC, [MAR]", "STORE AC, [MAR]"]

const IO_OPS = [
  { text: "IN /dev/teclado", device: "teclado", kind: "lectura" as const },
  { text: "READ /dev/disco", device: "disco", kind: "lectura" as const },
  { text: "NET /dev/red", device: "red", kind: "lectura" as const },
  { text: "OUT /dev/impresora", device: "impresora", kind: "escritura" as const },
]

const SYNC_OPS = [
  "LOCK mutex-1",
  "UNLOCK mutex-1",
  "WAIT semaforo-1",
  "SIGNAL semaforo-1",
  "INC cont-datos",
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function buildProgram(): string[] {
  const program: string[] = ["MOV AC, #0", "MOV MAR, #0x100"]
  const length = randomInt(4, 8)
  for (let i = 0; i < length; i++) {
    const roll = Math.random()
    if (roll < 0.45) program.push(pick(ARITHMETIC))
    else if (roll < 0.65) program.push(pick(MEMORY_OPS))
    else if (roll < 0.82) program.push(pick(IO_OPS).text)
    else program.push(pick(SYNC_OPS))
  }
  program.push("INC cont-datos")
  program.push("HALT")
  return program
}

const MAX_LOG = 400
const MAX_TRANSITIONS = 60
const MAX_INTERRUPTS = 40
const MAX_USAGE = 64

export function logEvent(
  sim: SimState,
  category: LogCategory,
  message: string,
  pid: number | null = null,
) {
  sim.seq += 1
  sim.eventLog.push({
    id: sim.seq,
    tick: sim.tick,
    category,
    message,
    pid,
  })
  if (sim.eventLog.length > MAX_LOG) {
    sim.eventLog.splice(0, sim.eventLog.length - MAX_LOG)
  }
}

function pushInterrupt(
  sim: SimState,
  record: Omit<InterruptRecord, "id" | "tick" | "handled">,
) {
  sim.seq += 1
  sim.interrupts.push({ ...record, id: sim.seq, tick: sim.tick, handled: false })
  if (sim.interrupts.length > MAX_INTERRUPTS) {
    sim.interrupts.splice(0, sim.interrupts.length - MAX_INTERRUPTS)
  }
}

export function transition(
  sim: SimState,
  process: Process,
  to: ProcessState,
  reason: string,
) {
  const from = process.state
  if (from === to) return
  process.state = to
  sim.seq += 1
  sim.transitions.push({
    id: sim.seq,
    tick: sim.tick,
    pid: process.pid,
    from,
    to,
    reason,
  })
  if (sim.transitions.length > MAX_TRANSITIONS) {
    sim.transitions.splice(0, sim.transitions.length - MAX_TRANSITIONS)
  }
  logEvent(
    sim,
    "proceso",
    `P${process.pid} · ${stateStyles[from].label} → ${stateStyles[to].label}: ${reason}`,
    process.pid,
  )
}

export function createProcess(
  sim: SimState,
  overrides: Partial<Process> = {},
): Process {
  const pid = overrides.pid ?? sim.nextPid++
  if (pid >= sim.nextPid) sim.nextPid = pid + 1
  const systemProcesses = sim.processes.filter((p) => p.isSystem)
  const parent = systemProcesses[0]
  const memoryRequired = overrides.memoryRequired ?? randomInt(8, 36)
  const burst = overrides.burstTotal ?? randomInt(18, 90)
  const process: Process = {
    pid,
    ppid: overrides.ppid ?? parent?.pid ?? 0,
    name: overrides.name ?? pick(PROGRAM_NAMES),
    app: overrides.app ?? null,
    state: "nuevo",
    priority: overrides.priority ?? randomInt(1, 9),
    burstTotal: burst,
    burstRemaining: burst,
    cpuTime: 0,
    memoryRequired,
    memoryStart: -1,
    allocatedUnits: 0,
    pageTable: [],
    heldResources: [],
    waitingFor: null,
    blockedReason: null,
    arrivalTime: overrides.arrivalTime ?? sim.tick,
    registers: { pc: 0, ac: 0, ir: "—", mar: 0, mb: 0, cc: "Z" },
    program: overrides.program ?? buildProgram(),
    ioRequest: null,
    isSystem: false,
    createdByUser: false,
  }
  sim.processes.push(process)
  sim.stats.created += 1
  logEvent(sim, "sistema", `Nuevo proceso ${process.name} (P${pid})`, pid)
  return process
}

export function defaultConfig(): SimConfig {
  return {
    scheduler: "roundRobin",
    quantum: 6,
    clockEvery: 10,
    autoSpawn: true,
    maxProcesses: 10,
  }
}

export function createInitialState(): SimState {
  const sim: SimState = {
    tick: 0,
    startedAt: Date.now(),
    processes: [],
    readyQueue: [],
    blockedQueue: [],
    cpuPid: null,
    quantumLeft: 0,
    cpu: { pc: 0, ac: 0, ir: "—", mar: 0, mb: 0, cc: "Z" },
    instruction: "CPU libre",
    usageHistory: Array.from({ length: MAX_USAGE }, () => 0),
    memory: createMemory(512, 4),
    devices: createDevices(),
    interrupts: [],
    semaphores: [{ name: "semaforo-1", initial: 1, count: 1, waiting: [] }],
    mutexes: [{ name: "mutex-1", owner: null, queue: [], acquisitions: 0 }],
    sharedCounters: { "cont-datos": 0 },
    eventLog: [],
    transitions: [],
    stats: {
      created: 0,
      terminated: 0,
      contextSwitches: 0,
      ioWaits: 0,
      pageFaults: 0,
      cpuCycles: 0,
      busyCycles: 0,
      interrumptions: 0,
      swaps: 0,
    },
    config: defaultConfig(),
    nextPid: 1,
    seq: 1,
  }

  createProcess(sim, {
    pid: 0,
    ppid: 0,
    name: "kernel.exe",
    isSystem: true,
    priority: 0,
    burstTotal: 0,
    arrivalTime: 0,
    program: ["HALT"],
  })
  const kernel = sim.processes[sim.processes.length - 1]
  kernel.state = "ejecutando"
  logEvent(sim, "sistema", "Sistema operativo iniciado (kernel.exe, PID 0)")

  for (let i = 0; i < 3; i++) createProcess(sim, { isSystem: false })
  logEvent(
    sim,
    "sistema",
    `Núcleo listo · ${sim.memory.totalKB} KB de RAM · página de ${sim.memory.unitKB} KB · Round Robin q=${sim.config.quantum}`,
  )
  return sim
}

/* ------------------------------------------------------------------ */
/* Sincronización                                                      */
/* ------------------------------------------------------------------ */

function acquireMutex(sim: SimState, process: Process, name: string): boolean {
  const mutex = sim.mutexes.find((m) => m.name === name)
  if (!mutex) return true
  if (mutex.owner === null || mutex.owner === process.pid) {
    const previous = mutex.owner
    mutex.owner = process.pid
    mutex.acquisitions += 1
    if (previous !== process.pid && !process.heldResources.includes(name)) {
      process.heldResources.push(name)
      logEvent(sim, "sincronizacion", `P${process.pid} adquiere ${name}`, process.pid)
    }
    return true
  }
  if (!mutex.queue.includes(process.pid)) mutex.queue.push(process.pid)
  process.waitingFor = name
  return false
}

function releaseMutex(sim: SimState, process: Process, name: string) {
  const mutex = sim.mutexes.find((m) => m.name === name)
  if (!mutex || mutex.owner !== process.pid) return
  const next = mutex.queue.shift()
  mutex.owner = next ?? null
  if (next !== undefined) {
    const waiter = sim.processes.find((p) => p.pid === next)
    if (waiter) {
      waiter.waitingFor = null
      if (!waiter.heldResources.includes(name)) waiter.heldResources.push(name)
      logEvent(
        sim,
        "sincronizacion",
        `${name} se transfiere a P${next} (orden de llegada)`,
        next,
      )
    }
  } else {
    process.heldResources = process.heldResources.filter((r) => r !== name)
  }
  logEvent(sim, "sincronizacion", `P${process.pid} libera ${name}`, process.pid)
}

function acquireSemaphore(sim: SimState, process: Process, name: string): boolean {
  const sem = sim.semaphores.find((s) => s.name === name)
  if (!sem) return true
  if (sem.count > 0) {
    sem.count -= 1
    logEvent(
      sim,
      "sincronizacion",
      `${name} (${sem.count}/${sem.initial}) privilegio de sección para P${process.pid}`,
      process.pid,
    )
    return true
  }
  if (!sem.waiting.includes(process.pid)) sem.waiting.push(process.pid)
  process.waitingFor = name
  logEvent(
    sim,
    "sincronizacion",
    `${name} en 0: P${process.pid} queda en espera`,
    process.pid,
  )
  return false
}

function releaseSemaphore(sim: SimState, process: Process, name: string) {
  const sem = sim.semaphores.find((s) => s.name === name)
  if (!sem) return
  sem.count = Math.min(sem.initial, sem.count + 1)
  const next = sem.waiting.shift()
  if (next !== undefined) {
    const waiter = sim.processes.find((p) => p.pid === next)
    if (waiter) {
      waiter.waitingFor = null
      sem.count = Math.max(0, sem.count - 1)
      logEvent(
        sim,
        "sincronizacion",
        `SIGNAL despierta a P${next}, que hereda el privilegio de ${name}`,
        next,
      )
    }
  }
  logEvent(sim, "sincronizacion", `P${process.pid} ejecuta SIGNAL ${name}`, process.pid)
}

export function releaseResources(sim: SimState, process: Process) {
  for (const name of [...process.heldResources]) {
    releaseMutex(sim, process, name)
  }
  for (const mutex of sim.mutexes) {
    mutex.queue = mutex.queue.filter((pid) => pid !== process.pid)
  }
  for (const sem of sim.semaphores) {
    sem.waiting = sem.waiting.filter((pid) => pid !== process.pid)
  }
}

export function unblockFromSync(sim: SimState, process: Process) {
  process.waitingFor = null
  process.blockedReason = null
  if (process.state === "bloqueado") {
    transition(sim, process, "listo", "Recurso disponible")
    sim.readyQueue.push(process.pid)
  }
}

/* ------------------------------------------------------------------ */
/* Ciclo del simulador                                                 */
/* ------------------------------------------------------------------ */

function serviceInterrupts(sim: SimState) {
  const pending = sim.interrupts.filter((i) => !i.handled)
  if (pending.length === 0) return
  // Las interrupciones de E/S tienen prioridad sobre el reloj: así lo ve
  // el estudiante al observar el orden de despacho de la CPU.
  pending.sort((a, b) => {
    const rank = (k: InterruptRecord["kind"]) =>
      k === "fin-es" ? 0 : k === "fallo-pagina" ? 1 : k === "sistema" ? 2 : 3
    return rank(a.kind) - rank(b.kind) || a.id - b.id
  })

  for (const interrupt of pending) {
    interrupt.handled = true
    sim.stats.interrumptions += 1
    logEvent(
      sim,
      "interrupcion",
      `ISR vector ${interrupt.vector}: ${interrupt.message}`,
    )

    if (interrupt.kind === "fin-es") {
      const device = sim.devices.find((d) => d.id === interrupt.source)
      const pid = Number(interrupt.message.match(/P(\d+)/)?.[1] ?? 0)
      const process = sim.processes.find((p) => p.pid === pid)
      if (device && device.active?.pid === pid) device.active = null
      if (process && process.state === "bloqueado") {
        process.ioRequest = null
        transition(sim, process, "listo", `${device?.name ?? "E/S"} completada`)
        sim.readyQueue.push(process.pid)
      }
    }

    if (interrupt.kind === "fallo-pagina") {
      const pid = Number(interrupt.message.match(/P(\d+)/)?.[1] ?? 0)
      const process = sim.processes.find((p) => p.pid === pid)
      if (process && process.state === "bloqueado") {
        if (sim.memory.mode === "paginacion") {
          const loaded = growByOneFrame(sim, process)
          if (loaded.ok) {
            transition(sim, process, "listo", `Página ${loaded.page} cargada desde disco`)
            sim.readyQueue.push(process.pid)
            continue
          }
          process.blockedReason = "Sin marcos libres: la página sigue en disco"
          continue
        }
        transition(sim, process, "listo", "Dirección dentro del segmento")
        sim.readyQueue.push(process.pid)
      }
    }
  }
}

function admitProcesses(sim: SimState) {
  const waiting = sim.processes
    .filter((p) => p.state === "nuevo" && !p.isSystem)
    .sort((a, b) => a.arrivalTime - b.arrivalTime)

  for (const process of waiting) {
    const result = allocate(sim, process)
    if (result.ok) {
      process.blockedReason = null
      transition(
        sim,
        process,
        "listo",
        sim.memory.mode === "paginacion"
          ? `${result.units} marcos asignados`
          : `Bloque desde ${result.start} (${result.units} u)`,
      )
      sim.readyQueue.push(process.pid)
      logEvent(
        sim,
        "memoria",
        `Memoria para P${process.pid}: ${process.memoryRequired} KB en ${
          sim.memory.mode === "paginacion" ? "marcos" : "partición"
        } ${result.start}`,
        process.pid,
      )
    } else {
      if (sim.memory.swapEnabled) {
        const victim = sim.processes
          .filter((p) => p.state === "bloqueado" && p.pid !== process.pid)
          .sort((a, b) => a.cpuTime - b.cpuTime)[0]
        if (victim) {
          swapOut(sim, victim)
          sim.blockedQueue = sim.blockedQueue.filter((pid) => pid !== victim.pid)
          logEvent(
            sim,
            "memoria",
            `Intercambio automático: P${victim.pid} pasa a disco para liberar ${victim.memoryRequired} KB`,
            victim.pid,
          )
          const retry = allocate(sim, process)
          if (retry.ok) {
            transition(sim, process, "listo", `${retry.units} u recuperadas del swap`)
            sim.readyQueue.push(process.pid)
            continue
          }
        }
      }
      if (process.blockedReason !== result.reason) {
        process.blockedReason = result.reason ?? "Sin memoria"
        logEvent(sim, "memoria", `P${process.pid} no admite: ${process.blockedReason}`, process.pid)
      }
    }
  }
}

function dispatch(sim: SimState) {
  if (sim.cpuPid !== null) return
  const next = pickNext(sim)
  if (!next) return
  sim.cpuPid = next.pid
  sim.readyQueue = sim.readyQueue.filter((pid) => pid !== next.pid)
  sim.quantumLeft = sim.config.scheduler === "roundRobin" ? sim.config.quantum : 0
  sim.cpu = { ...next.registers }
  sim.instruction = next.program[next.registers.pc % next.program.length] ?? "—"
  transition(sim, next, "ejecutando", sim.stats.contextSwitches === 0
    ? "La CPU estaba libre"
    : `Despacho · ${sim.config.scheduler === "prioridad" ? `prioridad ${next.priority}` : sim.config.scheduler === "roundRobin" ? `quantum ${sim.config.quantum}` : "orden de llegada"}`)
  sim.stats.contextSwitches += 1
}

export function releaseCpu(sim: SimState, instruction = "CPU libre") {
  sim.cpuPid = null
  sim.quantumLeft = 0
  sim.instruction = instruction
  sim.cpu = { pc: 0, ac: 0, ir: "—", mar: 0, mb: 0, cc: "Z" }
}

function terminateProcess(sim: SimState, process: Process) {
  deallocate(sim, process)
  releaseResources(sim, process)
  sim.readyQueue = sim.readyQueue.filter((pid) => pid !== process.pid)
  sim.blockedQueue = sim.blockedQueue.filter((pid) => pid !== process.pid)
  if (sim.cpuPid === process.pid) releaseCpu(sim, "HALT")
  transition(sim, process, "terminado", "Ejecución finalizada (HALT)")
  sim.stats.terminated += 1
}

function resolveNumber(token: string | undefined): number {
  if (!token) return 0
  const value = token.replace("#", "").replace("0x", "")
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

function executeOne(sim: SimState) {
  const process = sim.processes.find((p) => p.pid === sim.cpuPid)
  if (!process || process.state !== "ejecutando") {
    releaseCpu(sim)
    sim.usageHistory.push(0)
    if (sim.usageHistory.length > MAX_USAGE) sim.usageHistory.shift()
    return
  }

  sim.stats.busyCycles += 1
  process.cpuTime += 1
  process.burstRemaining = Math.max(0, process.burstRemaining - 1)

  const raw = process.program[process.registers.pc % process.program.length] ?? "HALT"
  const [mnemonicRaw, ...args] = raw.split(/\s+/)
  const mnemonic = mnemonicRaw.toUpperCase()
  sim.instruction = raw
  process.registers.ir = raw
  sim.cpu.ir = raw
  sim.cpu.pc = process.registers.pc

  const nextPc = () => {
    process.registers.pc = (process.registers.pc + 1) % process.program.length
  }

  switch (mnemonic) {
    case "MOV": {
      process.registers.ac = resolveNumber(args[1])
      process.registers.mar = resolveNumber(args[1]) % Math.max(1, sim.memory.frames.length)
      nextPc()
      break
    }
    case "ADD":
    case "SUB": {
      const value = resolveNumber(args[1])
      process.registers.ac =
        mnemonic === "ADD"
          ? process.registers.ac + value
          : process.registers.ac - value
      nextPc()
      break
    }
    case "INC":
    case "DEC": {
      process.registers.ac += mnemonic === "INC" ? 1 : -1
      nextPc()
      break
    }
    case "LOAD": {
      const address = process.registers.mar
      const frame = sim.memory.frames[address]
      const valid =
        sim.memory.mode === "paginacion"
          ? frame?.pid === process.pid
          : address >= process.memoryStart &&
            address < process.memoryStart + Math.max(1, process.allocatedUnits)
      if (!valid) {
        sim.stats.pageFaults += 1
        pushInterrupt(sim, {
          kind: "fallo-pagina",
          source: "MMU",
          vector: 14,
          message: `P${process.pid} referencia 0x${address
            .toString(16)
            .toUpperCase()
            .padStart(4, "0")} no residente`,
        })
        transition(
          sim,
          process,
          "bloqueado",
          sim.memory.mode === "paginacion"
            ? `Fallo de página en 0x${address.toString(16).toUpperCase()}`
            : `Fallo de segmentación en 0x${address.toString(16).toUpperCase()}`,
)
        releaseCpu(sim, "Fallo de pagina")
        return
      }
      process.registers.mb = process.registers.ac
      if (frame) {
        frame.refBit = true
        frame.dirty = true
      }
      nextPc()
      break
    }
    case "STORE": {
      const frame = sim.memory.frames[process.registers.mar]
      if (frame && frame.pid === process.pid) frame.dirty = true
      process.registers.mb = process.registers.ac
      nextPc()
      break
    }
    case "JNZ": {
      if (process.registers.ac !== 0) {
        process.registers.pc = resolveNumber(args[0]) % process.program.length
      } else {
        nextPc()
      }
      break
    }
    case "IN":
    case "READ":
    case "WRITE":
    case "OUT":
    case "NET": {
      const deviceId = args[0]?.replace("/dev/", "") ?? "disco"
      const device = sim.devices.find((d) => d.id === deviceId)
      if (!device) {
        nextPc()
        break
      }
      const kind = mnemonic === "OUT" || mnemonic === "WRITE" ? "escritura" : "lectura"
      submitIoRequest(sim, device, { pid: process.pid, deviceId, kind, op: raw })
      process.ioRequest = deviceId
      process.blockedReason = `Esperando ${device.name}`
      transition(sim, process, "bloqueado", `${device.name}: ${kind} en curso`)
      sim.blockedQueue.push(process.pid)
      sim.stats.ioWaits += 1
      releaseCpu(sim, "Peticion de E/S en curso")
      return
    }
    case "LOCK": {
      const name = args[0] ?? "mutex-1"
      if (!acquireMutex(sim, process, name)) {
        process.blockedReason = `${name} ocupado por P${
          sim.mutexes.find((m) => m.name === name)?.owner ?? "?"
        }`
        transition(sim, process, "bloqueado", process.blockedReason)
        sim.blockedQueue.push(process.pid)
        releaseCpu(sim, "Espera por mutex")
        return
      }
      nextPc()
      break
    }
    case "UNLOCK": {
      releaseMutex(sim, process, args[0] ?? "mutex-1")
      process.heldResources = process.heldResources.filter(
        (r) => r !== (args[0] ?? "mutex-1"),
      )
      nextPc()
      break
    }
    case "WAIT": {
      const name = args[0] ?? "semaforo-1"
      if (!acquireSemaphore(sim, process, name)) {
        process.blockedReason = `${name} en 0`
        transition(sim, process, "bloqueado", process.blockedReason)
        sim.blockedQueue.push(process.pid)
        releaseCpu(sim, "Espera por semaforo")
        return
      }
      nextPc()
      break
    }
    case "SIGNAL": {
      releaseSemaphore(sim, process, args[0] ?? "semaforo-1")
      nextPc()
      break
    }
    case "INCR": {
      const counter = args[0] ?? "cont-datos"
      sim.sharedCounters[counter] = (sim.sharedCounters[counter] ?? 0) + 1
      logEvent(sim, "sincronizacion", `${counter} = ${sim.sharedCounters[counter]}`, process.pid)
      nextPc()
      break
    }
    case "HALT":
    default: {
      terminateProcess(sim, process)
      sim.instruction = "HALT"
      return
    }
  }

  process.registers.cc = process.registers.ac === 0 ? "Z" : process.registers.ac > 0 ? "P" : "N"
  sim.cpu = { ...process.registers }
  sim.usageHistory.push(100)
  if (sim.usageHistory.length > MAX_USAGE) sim.usageHistory.shift()

  if (process.burstRemaining <= 0) {
    terminateProcess(sim, process)
    return
  }

  if (
    sim.config.scheduler === "roundRobin" &&
    sim.quantumLeft > 0
  ) {
    sim.quantumLeft -= 1
    if (sim.quantumLeft === 0) {
      transition(
        sim,
        process,
        "listo",
        `Fin del quantum (${sim.config.quantum}) — vuelve al final de la cola`,
      )
      sim.readyQueue.push(process.pid)
      releaseCpu(sim, "Fin del quantum")
    }
  }
}

export function stepOnce(sim: SimState) {
  sim.tick += 1
  sim.stats.cpuCycles += 1

  // Invariante de las colas: sólo puede haber en la cola de listos quien
  // esté realmente en estado «listo».
  sim.readyQueue = sim.readyQueue.filter((pid) => {
    const process = sim.processes.find((p) => p.pid === pid)
    return process !== undefined && process.state === "listo" && !process.isSystem
  })

  serviceInterrupts(sim)

  const progress = tickDevices(sim)
  for (const done of progress.completed) {
    pushInterrupt(sim, {
      kind: "fin-es",
      source: done.deviceId,
      vector: done.deviceId === "teclado" ? 9 : 14,
      message: `${done.op} de P${done.pid} completado en ${done.deviceId}`,
    })
  }

  if (sim.tick % sim.config.clockEvery === 0) {
    pushInterrupt(sim, {
      kind: "reloj",
      source: "timer",
      vector: 20,
      message: `Interrupción de reloj cada ${sim.config.clockEvery} ciclos`,
    })
  }

  if (sim.config.autoSpawn && sim.tick % 9 === 0) {
    const live = sim.processes.filter(
      (p) => !p.isSystem && p.state !== "terminado" && p.state !== "suspendido",
    ).length
    if (live < sim.config.maxProcesses) createProcess(sim)
  }

  sim.blockedQueue = sim.processes
    .filter((p) => p.state === "bloqueado")
    .map((p) => p.pid)

  admitProcesses(sim)
  dispatch(sim)
  executeOne(sim)
  recomputeFragmentation(sim)
}

export function cpuUtilization(sim: SimState): number {
  if (sim.stats.cpuCycles === 0) return 0
  return Math.round((sim.stats.busyCycles / sim.stats.cpuCycles) * 100)
}