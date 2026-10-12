import { create } from "zustand"

export interface WindowBox {
  pid: number
  app: string
  x: number
  y: number
  width: number
  height: number
  minimized: boolean
  maximized: boolean
  z: number
  restore: { x: number; y: number; width: number; height: number } | null
}

interface WindowStore {
  windows: Record<number, WindowBox>
  iconPositions: Record<string, { x: number; y: number }>
  topZ: number
  cascade: number
  bounds: { width: number; height: number }
  openWindow: (pid: number, app: string, size: { width: number; height: number }) => void
  setBounds: (bounds: { width: number; height: number }) => void
  setIconPosition: (key: string, position: { x: number; y: number }) => void
  clearIconPositions: () => void
  requestApp: (key: string) => void
  pendingApp: string | null
  consumeApp: () => string | null
  closeWindow: (pid: number) => void
  focusWindow: (pid: number) => void
  commitBox: (
    pid: number,
    box: Partial<Pick<WindowBox, "x" | "y" | "width" | "height">>,
  ) => void
  minimizeWindow: (pid: number) => void
  restoreWindow: (pid: number) => void
  toggleMaximize: (
    pid: number,
    bounds: { x: number; y: number; width: number; height: number },
  ) => void
  minimizeAll: () => void
  reset: () => void
}

/** Mantiene la ventana dentro del área visible tras un redimensionado. */
function clampWindow(
  win: WindowBox,
  bounds: { width: number; height: number },
): WindowBox {
  const maxWidth = Math.min(win.width, Math.max(280, bounds.width - 12))
  const maxHeight = Math.min(win.height, Math.max(200, bounds.height - 12))
  return {
    ...win,
    width: maxWidth,
    height: maxHeight,
    x: Math.max(6, Math.min(win.x, bounds.width - maxWidth - 6)),
    y: Math.max(6, Math.min(win.y, bounds.height - maxHeight - 6)),
    restore: win.restore
      ? {
          ...win.restore,
          width: Math.min(win.restore.width, maxWidth),
          height: Math.min(win.restore.height, maxHeight),
          x: Math.max(6, Math.min(win.restore.x, bounds.width - maxWidth - 6)),
          y: Math.max(6, Math.min(win.restore.y, bounds.height - maxHeight - 6)),
        }
      : null,
  }
}

export const useWindowStore = create<WindowStore>()((set, get) => ({
  windows: {},
  iconPositions: {},
  pendingApp: null,
  topZ: 10,
  cascade: 0,
  bounds: { width: 1440, height: 900 },

  openWindow: (pid, app, size) =>
    set((state) => {
      const index = state.cascade % 5
      const { width: areaW, height: areaH } = state.bounds
      const width = Math.min(size.width, Math.max(280, areaW - 24))
      const height = Math.min(size.height, Math.max(200, areaH - 24))
      const stepX = Math.round(Math.max(24, (areaW - width - 24) / 4))
      const stepY = Math.round(Math.max(22, (areaH - height - 24) / 4))
      const x = Math.max(12, Math.min(areaW - width - 12, 12 + index * stepX))
      const y = Math.max(12, Math.min(areaH - height - 12, 12 + index * stepY))
      // En pantallas estrechas la ventana nace maximizada: si no, quedaría
      // medio fuera de la vista.
      const maximized = areaW < 760
      return {
        cascade: state.cascade + 1,
        topZ: state.topZ + 1,
        windows: {
          ...state.windows,
          [pid]: {
            pid,
            app,
            x: maximized ? 6 : x,
            y: maximized ? 6 : y,
            width: maximized ? areaW - 12 : width,
            height: maximized ? areaH - 12 : height,
            minimized: false,
            maximized,
            restore: maximized ? { x, y, width, height } : null,
            z: state.topZ + 1,
          },
        },
      }
    }),

  clearIconPositions: () => set({ iconPositions: {} }),

  requestApp: (key) => set({ pendingApp: key }),

  consumeApp: () => {
    const key = get().pendingApp
    if (key) set({ pendingApp: null })
    return key
  },

  setIconPosition: (key, position) =>
    set((state) => ({
      iconPositions: { ...state.iconPositions, [key]: position },
    })),

  setBounds: (bounds) =>
    set((state) => {
      const windows: Record<number, WindowBox> = {}
      for (const [pid, win] of Object.entries(state.windows)) {
        const clamped = clampWindow(win, bounds)
        windows[Number(pid)] = clamped
      }
      return { bounds, windows }
    }),

  closeWindow: (pid) =>
    set((state) => {
      const next = { ...state.windows }
      delete next[pid]
      return { windows: next }
    }),

  focusWindow: (pid) =>
    set((state) => {
      const win = state.windows[pid]
      if (!win || state.topZ === win.z) return state
      return {
        topZ: state.topZ + 1,
        windows: { ...state.windows, [pid]: { ...win, z: state.topZ + 1 } },
      }
    }),

  commitBox: (pid, box) =>
    set((state) => {
      const win = state.windows[pid]
      if (!win) return state
      return { windows: { ...state.windows, [pid]: { ...win, ...box } } }
    }),

  minimizeWindow: (pid) =>
    set((state) => {
      const win = state.windows[pid]
      if (!win) return state
      return {
        windows: { ...state.windows, [pid]: { ...win, minimized: true } },
      }
    }),

  restoreWindow: (pid) =>
    set((state) => {
      const win = state.windows[pid]
      if (!win) return state
      return {
        topZ: state.topZ + 1,
        windows: {
          ...state.windows,
          [pid]: { ...win, minimized: false, z: state.topZ + 1 },
        },
      }
    }),

  toggleMaximize: (pid, bounds) =>
    set((state) => {
      const win = state.windows[pid]
      if (!win) return state
      if (win.maximized && win.restore) {
        return {
          topZ: state.topZ + 1,
          windows: {
            ...state.windows,
            [pid]: {
              ...win,
              maximized: false,
              z: state.topZ + 1,
              x: win.restore.x,
              y: win.restore.y,
              width: win.restore.width,
              height: win.restore.height,
              restore: null,
            },
          },
        }
      }
      return {
        topZ: state.topZ + 1,
        windows: {
          ...state.windows,
          [pid]: {
            ...win,
            maximized: true,
            z: state.topZ + 1,
            restore: {
              x: win.x,
              y: win.y,
              width: win.width,
              height: win.height,
            },
            ...bounds,
          },
        },
      }
    }),

  minimizeAll: () =>
    set((state) => ({
      windows: Object.fromEntries(
        Object.entries(state.windows).map(([pid, win]) => [
          pid,
          { ...win, minimized: true },
        ]),
      ),
    })),

  reset: () => set({ windows: {}, iconPositions: {}, topZ: 10, cascade: 0 }),
}))

export function useWindow(pid: number): WindowBox | undefined {
  return useWindowStore((s) => s.windows[pid])
}

export const getWindowState = () => useWindowStore.getState()