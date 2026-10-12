import type { Process, SchedulerAlgorithm, SimState } from "@/types/os"
import { schedulerLabels } from "./palette"

/**
 * Devuelve el proceso que debe ocupar la CPU según el algoritmo activo.
 * La cola de listos se mantiene ordenada por llegada; el planificador sólo
 * decide cuál sale primero, sin reordenar la estructura (así se ve el
 * fairness real de cada política en el diagrama).
 */
export function pickNext(sim: SimState): Process | null {
  if (sim.readyQueue.length === 0) return null
  const candidates = sim.readyQueue
    .map((pid) => sim.processes.find((p) => p.pid === pid))
    .filter((p): p is Process => !!p && p.state === "listo")

  if (candidates.length === 0) return null

  if (sim.config.scheduler === "prioridad") {
    return candidates.reduce((best, p) => {
      if (p.priority !== best.priority) return p.priority < best.priority ? p : best
      return p.arrivalTime < best.arrivalTime ? p : best
    })
  }
  return candidates.reduce((best, p) => (p.arrivalTime < best.arrivalTime ? p : best))
}

export function scheduleExplanation(
  scheduler: SchedulerAlgorithm,
  quantum: number,
): string {
  const label = schedulerLabels[scheduler]
  if (scheduler === "roundRobin") {
    return `${label}: el proceso en CPU pierde el control tras ${quantum} ciclos y vuelve al final de la cola. Todos obtienen la misma fracción de CPU.`
  }
  if (scheduler === "prioridad") {
    return `${label}: gana el proceso con menor número de prioridad (1 = máxima). Puede causar inanición si la carga nunca termina.`
  }
  return `${label}: gana el proceso que lleva más tiempo esperando. Simple, pero un proceso largo puede retrasar a los cortos.`
}

export function readyQueueOrder(sim: SimState): number[] {
  return [...sim.readyQueue].sort((a, b) => {
    const pa = sim.processes.find((p) => p.pid === a)
    const pb = sim.processes.find((p) => p.pid === b)
    if (!pa || !pb) return 0
    if (sim.config.scheduler === "prioridad" && pa.priority !== pb.priority) {
      return pa.priority - pb.priority
    }
    return pa.arrivalTime - pb.arrivalTime
  })
}