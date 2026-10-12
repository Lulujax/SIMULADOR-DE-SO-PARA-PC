import type { Device, IoRequest, SimState } from "@/types/os"

export const DEVICE_SPEED: Record<string, number> = {
  teclado: 3,
  disco: 14,
  red: 6,
  impresora: 20,
}

export function createDevices(): Device[] {
  return [
    {
      id: "teclado",
      kind: "teclado",
      name: "Teclado",
      description: "Entrada del usuario. Genera interrupciones por pulsación.",
      status: "libre",
      queue: [],
      active: null,
      completed: 0,
      icon: "keyboard",
    },
    {
      id: "disco",
      kind: "disco",
      name: "Disco duro",
      description: "Acceso a disco: la E/S más lenta y la que más bloquea.",
      status: "libre",
      queue: [],
      active: null,
      completed: 0,
      icon: "hard-drive",
    },
    {
      id: "red",
      kind: "red",
      name: "Tarjeta de red",
      description: "E/S de red. Atiende por prioridad: salta la cola.",
      status: "libre",
      queue: [],
      active: null,
      completed: 0,
      icon: "network",
    },
    {
      id: "impresora",
      kind: "impresora",
      name: "Impresora",
      description: "Lenta y no compartible en este modelo: efecto ancla.",
      status: "libre",
      queue: [],
      active: null,
      completed: 0,
      icon: "printer",
    },
  ]
}

export function nextRequestId(sim: SimState): number {
  sim.seq += 1
  return sim.seq
}

export function submitIoRequest(
  sim: SimState,
  device: Device,
  request: Omit<IoRequest, "id" | "total" | "remaining">,
): IoRequest {
  const total = DEVICE_SPEED[device.kind] ?? 8
  const io: IoRequest = { ...request, id: nextRequestId(sim), total, remaining: total }
  device.queue.push(io)
  device.status = device.queue.length > 1 ? "en espera" : "ocupado"
  return io
}

export interface DeviceProgress {
  completed: IoRequest[]
  started: IoRequest | null
}

/**
 * Avanza un ciclo todos los dispositivos. Cuando una operación termina se
 * genera la interrupción correspondiente (aún sin atender: la ISR la
 * atenderá en el siguiente tick, imitando el Hardware real).
 */
export function tickDevices(sim: SimState): DeviceProgress {
  const progress: DeviceProgress = { completed: [], started: null }

  for (const device of sim.devices) {
    if (!device.active && device.queue.length > 0) {
      device.active = device.queue.shift() ?? null
      device.status = "ocupado"
      progress.started = device.active
    }
    if (!device.active) {
      device.status = device.queue.length > 0 ? "ocupado" : "libre"
      continue
    }
    device.active.remaining -= 1
    if (device.active.remaining <= 0) {
      progress.completed.push(device.active)
      device.completed += 1
      device.active = null
      device.status = device.queue.length > 0 ? "ocupado" : "libre"
    }
  }
  return progress
}

export function deviceLoad(device: Device): number {
  if (!device.active) return 0
  const done = 1 - device.active.remaining / Math.max(1, device.active.total)
  return Math.round(done * 100)
}