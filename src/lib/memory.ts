import type {
  MemoryAlgorithm,
  MemoryMode,
  MemoryState,
  Process,
  SimState,
} from "@/types/os"
import { algorithmLabels, memoryModeLabels } from "./palette"

export interface AllocationResult {
  ok: boolean
  reason?: string
  start?: number
  units?: number
}

export function createMemory(totalKB: number, unitKB: number): MemoryState {
  const units = Math.max(1, Math.floor(totalKB / unitKB))
  return {
    mode: "paginacion",
    continuousKind: "estatica",
    totalKB,
    unitKB,
    staticPartitionKB: Math.max(
      unitKB * 2,
      Math.round(totalKB / 8 / unitKB) * unitKB,
    ),
    algorithm: "first-fit",
    frames: Array.from({ length: units }, (_, index) => ({
      index,
      pid: null,
      page: null,
      refBit: false,
      dirty: false,
      swapped: false,
    })),
    compactionPulse: 0,
    swapPulse: 0,
    swapVictim: null,
    swapEnabled: false,
    internalKB: 0,
    externalKB: 0,
  }
}

/**
 * Al cambiar de esquema el sistema reinicia su gestión de memoria: los
 * procesos activos vuelven a la cola de «nuevos» para reubicarse.
 */
export function resetAllocations(sim: SimState) {
  const mem = sim.memory
  mem.frames = createMemory(mem.totalKB, mem.unitKB).frames
  mem.internalKB = 0
  mem.externalKB = mem.totalKB
  mem.compactionPulse++
  sim.readyQueue = []
  sim.cpuPid = null
  for (const p of sim.processes) {
    p.pageTable = []
    p.memoryStart = -1
    p.allocatedUnits = 0
    p.blockedReason = null
    if (p.isSystem || p.state === "terminado") continue
    p.state = "nuevo"
  }
}

export function setMemoryMode(sim: SimState, mode: MemoryMode) {
  sim.memory.mode = mode
  resetAllocations(sim)
}

export function setUnitSize(sim: SimState, unitKB: number) {
  sim.memory.unitKB = unitKB
  resetAllocations(sim)
}

function findFreeRuns(mem: MemoryState): { start: number; length: number }[] {
  const runs: { start: number; length: number }[] = []
  let start = -1
  for (let i = 0; i <= mem.frames.length; i++) {
    const free = i < mem.frames.length && mem.frames[i].pid === null
    if (free && start === -1) start = i
    if (!free && start !== -1) {
      runs.push({ start, length: i - start })
      start = -1
    }
  }
  return runs
}

export function selectRun(
  mem: MemoryState,
  needed: number,
  algorithm: MemoryAlgorithm,
  hint: number,
): { start: number; length: number } | null {
  const runs = findFreeRuns(mem).filter((r) => r.length >= needed)
  if (runs.length === 0) return null
  if (algorithm === "first-fit") return runs[0]
  if (algorithm === "best-fit") {
    return runs.reduce((best, r) => (r.length < best.length ? r : best))
  }
  const after = runs.find((r) => r.start > hint)
  return after ?? runs[0]
}

export function allocate(sim: SimState, process: Process): AllocationResult {
  const mem = sim.memory
  const neededUnits = Math.max(1, Math.ceil(process.memoryRequired / mem.unitKB))

  if (mem.mode === "paginacion") {
    const freeIdx: number[] = []
    mem.frames.forEach((f, i) => {
      if (f.pid === null && !f.swapped) freeIdx.push(i)
    })
    if (freeIdx.length < neededUnits) {
      return { ok: false, reason: "Memoria insuficiente: faltan marcos libres" }
    }
    const chosen = freeIdx.slice(0, neededUnits)
    chosen.forEach((frameIndex, page) => {
      mem.frames[frameIndex] = {
        index: frameIndex,
        pid: process.pid,
        page,
        refBit: false,
        dirty: false,
        swapped: false,
      }
    })
    process.pageTable = chosen.slice()
    process.memoryStart = chosen[0]
    process.allocatedUnits = neededUnits
    recomputeFragmentation(sim)
    return { ok: true, start: chosen[0], units: neededUnits }
  }

  const partitionUnits = Math.max(
    1,
    Math.round(mem.staticPartitionKB / mem.unitKB),
  )

  if (mem.continuousKind === "estatica") {
    const partitionCount = Math.floor(mem.frames.length / partitionUnits)
    for (let p = 0; p < partitionCount; p++) {
      const base = p * partitionUnits
      let free = true
      for (let i = 0; i < partitionUnits; i++) {
        if (mem.frames[base + i].pid !== null) {
          free = false
          break
        }
      }
      if (!free) continue
      if (process.memoryRequired > partitionUnits * mem.unitKB) {
        return {
          ok: false,
          reason: `La partición ${p + 1} (${partitionUnits * mem.unitKB} KB) es demasiado pequeña: fragmentación interna de ${partitionUnits * mem.unitKB - process.memoryRequired} KB`,
        }
      }
      for (let i = 0; i < partitionUnits; i++) {
        mem.frames[base + i] = {
          index: base + i,
          pid: process.pid,
          page: i,
          refBit: false,
          dirty: false,
          swapped: false,
        }
      }
      process.memoryStart = base
      process.allocatedUnits = partitionUnits
      process.pageTable = []
      recomputeFragmentation(sim)
      return { ok: true, start: base, units: partitionUnits }
    }
    return {
      ok: false,
      reason: `No hay particiones estáticas libres de ${partitionUnits * mem.unitKB} KB`,
    }
  }

  const run = selectRun(mem, neededUnits, mem.algorithm, process.memoryStart + 1)
  if (!run) {
    return {
      ok: false,
      reason: `No hay un bloque contiguo de ${neededUnits * mem.unitKB} KB (fragmentación externa)`,
    }
  }
  for (let i = 0; i < neededUnits; i++) {
    const frameIndex = run.start + i
    mem.frames[frameIndex] = {
      index: frameIndex,
      pid: process.pid,
      page: i,
      refBit: false,
      dirty: false,
      swapped: false,
    }
  }
  process.memoryStart = run.start
  process.allocatedUnits = neededUnits
  process.pageTable = []
  recomputeFragmentation(sim)
  return { ok: true, start: run.start, units: neededUnits }
}

export function growByOneFrame(
  sim: SimState,
  process: Process,
): { ok: boolean; page: number } {
  const mem = sim.memory
  if (mem.mode !== "paginacion") return { ok: true, page: process.pageTable.length }
  const free = mem.frames.find((frame) => frame.pid === null && !frame.swapped)
  if (!free) return { ok: false, page: process.pageTable.length }
  const page = process.pageTable.length
  mem.frames[free.index] = {
    index: free.index,
    pid: process.pid,
    page,
    refBit: false,
    dirty: false,
    swapped: false,
  }
  process.pageTable = [...process.pageTable, free.index]
  process.allocatedUnits = process.pageTable.length
  recomputeFragmentation(sim)
  return { ok: true, page }
}

export function deallocate(sim: SimState, process: Process) {
  const mem = sim.memory
  for (const frame of mem.frames) {
    if (frame.pid === process.pid) {
      frame.pid = null
      frame.page = null
      frame.refBit = false
      frame.dirty = false
      frame.swapped = false
    }
  }
  process.memoryStart = -1
  process.allocatedUnits = 0
  process.pageTable = []
  recomputeFragmentation(sim)
}

export function compact(sim: SimState): number {
  const mem = sim.memory
  if (mem.mode === "paginacion") return 0
  const next: MemoryState["frames"] = []
  let cursor = 0
  let moved = 0
  for (const frame of mem.frames) {
    if (frame.pid === null) continue
    if (frame.index !== cursor) moved++
    next.push({ ...frame, index: cursor })
    cursor++
  }
  while (next.length < mem.frames.length) {
    next.push({
      index: next.length,
      pid: null,
      page: null,
      refBit: false,
      dirty: false,
      swapped: false,
    })
  }
  mem.frames = next
  mem.compactionPulse++
  recomputeFragmentation(sim)
  sim.sharedCounters["__lastCompaction"] = moved
  return moved
}

export function swapOut(sim: SimState, process: Process) {
  const mem = sim.memory
  deallocate(sim, process)
  process.state = "suspendido"
  mem.swapVictim = process.pid
  mem.swapPulse++
  sim.stats.swaps++
  recomputeFragmentation(sim)
}

export function recomputeFragmentation(sim: SimState) {
  const mem = sim.memory
  const used = mem.frames.filter((f) => f.pid !== null).length
  const usedKB = used * mem.unitKB

  if (mem.mode === "paginacion") {
    mem.internalKB = 0
    mem.externalKB = mem.totalKB - usedKB
    return
  }

  if (mem.continuousKind === "estatica") {
    const partitionUnits = Math.max(
      1,
      Math.round(mem.staticPartitionKB / mem.unitKB),
    )
    const partitionCount = Math.floor(mem.frames.length / partitionUnits)
    let internal = 0
    for (let p = 0; p < partitionCount; p++) {
      const base = p * partitionUnits
      const pid = mem.frames[base]?.pid ?? null
      if (pid === null) continue
      const proc = sim.processes.find((x) => x.pid === pid)
      if (!proc) continue
      internal += Math.max(0, partitionUnits * mem.unitKB - proc.memoryRequired)
    }
    mem.internalKB = internal
    const freeFrames = mem.frames.length - used
    mem.externalKB = freeFrames === 0 ? 0 : freeFrames * mem.unitKB
    return
  }

  const runs = findFreeRuns(mem)
  mem.internalKB = 0
  mem.externalKB = runs.reduce((acc, r) => acc + r.length * mem.unitKB, 0)
}

export interface MemoryUsage {
  usedKB: number
  freeKB: number
  usedPercent: number
  freeRuns: number
}

export function memoryUsage(mem: MemoryState): MemoryUsage {
  const used = mem.frames.filter((f) => f.pid !== null).length
  const usedKB = used * mem.unitKB
  return {
    usedKB,
    freeKB: mem.totalKB - usedKB,
    usedPercent: mem.totalKB === 0 ? 0 : (usedKB / mem.totalKB) * 100,
    freeRuns: findFreeRuns(mem).length,
  }
}

export function describeMemory(sim: SimState): string {
  const mem = sim.memory
  const usage = memoryUsage(mem)
  if (mem.mode === "paginacion") {
    return `${memoryModeLabels.paginacion} · ${mem.totalKB} KB · páginas de ${mem.unitKB} KB · ${usage.usedKB} KB usados`
  }
  const kind =
    mem.continuousKind === "estatica" ? "Particiones estáticas" : "Particiones dinámicas"
  return `${kind} · ${algorithmLabels[mem.algorithm]} · ${mem.totalKB} KB · ${usage.usedKB} KB usados`
}