import type { ProcessState } from "@/types/os"

export interface StateStyle {
  label: string
  short: string
  chip: string
  dot: string
  text: string
  ring: string
  bar: string
  hex: string
  description: string
}

export const stateStyles: Record<ProcessState, StateStyle> = {
  nuevo: {
    label: "Nuevo",
    short: "NUE",
    chip: "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-sky-500/25",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/40",
    bar: "bg-sky-500",
    hex: "#0ea5e9",
    description:
      "El proceso acaba de llegar. Espera en el disco del sistema hasta que el planificador lo admite y le asigna memoria.",
  },
  listo: {
    label: "Listo",
    short: "LIS",
    chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/40",
    bar: "bg-emerald-500",
    hex: "#10b981",
    description:
      "Tiene memoria y está esperando CPU. Vive en la cola de listos, ordenada por el algoritmo de planificación elegido.",
  },
  ejecutando: {
    label: "Ejecutando",
    short: "EJE",
    chip: "bg-indigo-500/14 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30",
    dot: "bg-indigo-500",
    text: "text-indigo-700 dark:text-indigo-300",
    ring: "ring-indigo-500/40",
    bar: "bg-indigo-500",
    hex: "#6366f1",
    description:
      "Ocupó la CPU. En Round Robin pierde el procesador cada «quantum» y vuelve a la cola de listos.",
  },
  bloqueado: {
    label: "Bloqueado",
    short: "BLO",
    chip: "bg-amber-500/14 text-amber-700 dark:text-amber-300 ring-amber-500/30",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/40",
    bar: "bg-amber-500",
    hex: "#f59e0b",
    description:
      "Pide una E/S, un recurso o un semáforo y no puede continuar. Espera una interrupción, no la CPU.",
  },
  suspendido: {
    label: "Suspendido",
    short: "SUS",
    chip: "bg-violet-500/14 text-violet-700 dark:text-violet-300 ring-violet-500/30",
    dot: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/40",
    bar: "bg-violet-500",
    hex: "#8b5cf6",
    description:
      "Intercambiado a disco. No ocupa memoria ni CPU: el sistema lo escribió en el área de swap para liberar marcos.",
  },
  terminado: {
    label: "Terminado",
    short: "TER",
    chip: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400 ring-zinc-500/25",
    dot: "bg-zinc-500",
    text: "text-zinc-600 dark:text-zinc-400",
    ring: "ring-zinc-500/30",
    bar: "bg-zinc-500",
    hex: "#71717a",
    description:
      "Ejecutó HALT. El sistema libera su memoria y sus recursos; queda solo en el historial y las estadísticas.",
  },
}

export const processColors = [
  "#6366f1",
  "#0ea5e9",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#22c55e",
  "#f43f5e",
  "#06b6d4",
  "#a855f7",
]

export function processColor(pid: number): string {
  return processColors[pid % processColors.length]
}

export const schedulerLabels: Record<string, string> = {
  fifo: "FIFO",
  roundRobin: "Round Robin",
  prioridad: "Prioridades",
}

export const memoryModeLabels: Record<string, string> = {
  continua: "Particiones (contigua)",
  paginacion: "Paginación",
}

export const algorithmLabels: Record<string, string> = {
  "first-fit": "First Fit",
  "best-fit": "Best Fit",
  "next-fit": "Next Fit",
}

export const deviceLabels: Record<string, string> = {
  teclado: "Teclado",
  disco: "Disco duro",
  red: "Tarjeta de red",
  impresora: "Impresora",
}