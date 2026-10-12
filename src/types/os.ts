export type ProcessState =
  | "nuevo"
  | "listo"
  | "ejecutando"
  | "bloqueado"
  | "suspendido"
  | "terminado"

export type SchedulerAlgorithm = "fifo" | "roundRobin" | "prioridad"

export type MemoryMode = "continua" | "paginacion"

export type ContinuousKind = "estatica" | "dinamica"

export type MemoryAlgorithm = "first-fit" | "best-fit" | "next-fit"

export type DeviceKind = "teclado" | "disco" | "red" | "impresora"

export type DeviceStatus = "libre" | "ocupado" | "en espera" | "averiado"

export type LogCategory =
  | "sistema"
  | "proceso"
  | "planificador"
  | "memoria"
  | "es"
  | "sincronizacion"
  | "interrupcion"

export interface Registers {
  pc: number
  ac: number
  ir: string
  mar: number
  mb: number
  cc: string
}

export interface Process {
  pid: number
  ppid: number
  name: string
  app: string | null
  state: ProcessState
  priority: number
  burstTotal: number
  burstRemaining: number
  cpuTime: number
  memoryRequired: number
  memoryStart: number
  allocatedUnits: number
  pageTable: (number | null)[]
  heldResources: string[]
  waitingFor: string | null
  blockedReason: string | null
  arrivalTime: number
  registers: Registers
  program: string[]
  ioRequest: string | null
  isSystem: boolean
  createdByUser: boolean
}

export interface TransitionRecord {
  id: number
  tick: number
  pid: number
  from: ProcessState
  to: ProcessState
  reason: string
}

export interface Frame {
  index: number
  pid: number | null
  page: number | null
  refBit: boolean
  dirty: boolean
  swapped: boolean
}

export interface MemoryState {
  mode: MemoryMode
  continuousKind: ContinuousKind
  totalKB: number
  unitKB: number
  staticPartitionKB: number
  algorithm: MemoryAlgorithm
  frames: Frame[]
  compactionPulse: number
  swapPulse: number
  swapVictim: number | null
  swapEnabled: boolean
  internalKB: number
  externalKB: number
}

export interface IoRequest {
  id: number
  pid: number
  deviceId: string
  kind: "lectura" | "escritura"
  op: string
  total: number
  remaining: number
}

export interface Device {
  id: string
  kind: DeviceKind
  name: string
  description: string
  status: DeviceStatus
  queue: IoRequest[]
  active: IoRequest | null
  completed: number
  icon: string
}

export interface InterruptRecord {
  id: number
  tick: number
  kind: "reloj" | "fin-es" | "fallo-pagina" | "sistema"
  source: string
  message: string
  handled: boolean
  vector: number
}

export interface Semaphore {
  name: string
  initial: number
  count: number
  waiting: number[]
}

export interface Mutex {
  name: string
  owner: number | null
  queue: number[]
  acquisitions: number
}

export interface LogEntry {
  id: number
  tick: number
  category: LogCategory
  message: string
  pid: number | null
}

export interface SimStats {
  created: number
  terminated: number
  contextSwitches: number
  ioWaits: number
  pageFaults: number
  cpuCycles: number
  busyCycles: number
  interrumptions: number
  swaps: number
}

export interface SimConfig {
  scheduler: SchedulerAlgorithm
  quantum: number
  clockEvery: number
  autoSpawn: boolean
  maxProcesses: number
}

export interface SimState {
  tick: number
  startedAt: number
  processes: Process[]
  readyQueue: number[]
  blockedQueue: number[]
  cpuPid: number | null
  quantumLeft: number
  cpu: Registers
  instruction: string
  usageHistory: number[]
  memory: MemoryState
  devices: Device[]
  interrupts: InterruptRecord[]
  semaphores: Semaphore[]
  mutexes: Mutex[]
  sharedCounters: Record<string, number>
  eventLog: LogEntry[]
  transitions: TransitionRecord[]
  stats: SimStats
  config: SimConfig
  nextPid: number
  seq: number
}

export interface SimSnapshot {
  version: 2
  exportedAt: string
  state: SimState
}