import { create } from "zustand"

export type ErrorKind = "consola" | "ejecucion" | "react" | "accion"

export interface ErrorEntry {
  id: number
  at: string
  tick: number
  kind: ErrorKind
  message: string
  source?: string
  stack?: string
}

const MAX = 120

interface ErrorStore {
  entries: ErrorEntry[]
  capture: (entry: Omit<ErrorEntry, "id" | "at" | "tick">) => void
  clear: () => void
}

let seq = 0
let tickProvider: () => number = () => 0

export function bindErrorTick(provider: () => number) {
  tickProvider = provider
}

export const useErrorStore = create<ErrorStore>()((set) => ({
  entries: [],

  capture: (entry) =>
    set((state) => ({
      entries: [
        {
          ...entry,
          id: ++seq,
          at: new Date().toLocaleTimeString("es-ES"),
          tick: tickProvider(),
        },
        ...state.entries,
      ].slice(0, MAX),
    })),

  clear: () => set({ entries: [] }),
}))

export function captureError(
  kind: ErrorKind,
  message: string,
  source?: string,
  stack?: string,
) {
  useErrorStore.getState().capture({ kind, message, source, stack })
}