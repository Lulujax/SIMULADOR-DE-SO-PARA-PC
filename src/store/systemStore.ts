import { create } from "zustand"
import { setRealVolume } from "@/lib/realHardware"
import { useSimStore } from "@/store/simStore"
import { useWindowStore } from "@/store/windowStore"

export type PowerState = "off" | "booting" | "on" | "locked" | "sleeping"

export type FileKind = "texto" | "imagen" | "carpeta" | "audio"

export interface VFile {
  id: string
  name: string
  kind: FileKind
  content: string
  size: number
  createdAt: number
  app?: string
}

export interface SysNotification {
  id: number
  at: string
  title: string
  body: string
  app?: string
  tone: "info" | "ok" | "aviso"
}

export interface Wallpaper {
  id: string
  name: string
  kind: "gradiente" | "color"
  value: string
  dark?: boolean
}

export const WALLPAPERS: Wallpaper[] = [
  {
    id: "medianoche",
    name: "Medianoche",
    kind: "gradiente",
    value: "radial-gradient(120% 90% at 18% 8%, #1e2a4a 0%, #0d1220 45%, #070a12 100%)",
    dark: true,
  },
  {
    id: "amanecer",
    name: "Amanecer",
    kind: "gradiente",
    value: "linear-gradient(160deg, #fbc2eb 0%, #a6c1ee 45%, #f6d365 100%)",
  },
  {
    id: "bosque",
    name: "Bosque",
    kind: "gradiente",
    value: "linear-gradient(160deg, #134e5e 0%, #71b280 100%)",
    dark: true,
  },
  {
    id: "atardecer",
    name: "Atardecer",
    kind: "gradiente",
    value: "linear-gradient(160deg, #ff9a9e 0%, #fecfef 50%, #a18cd1 100%)",
  },
  {
    id: "grafito",
    name: "Grafito",
    kind: "color",
    value: "#18181b",
    dark: true,
  },
  {
    id: "hielo",
    name: "Hielo",
    kind: "color",
    value: "#eef2ff",
  },
]

const PASSWORD = "simulador"

const INITIAL_FS: Record<string, VFile[]> = {
  "/": [
    { id: "d-docs", name: "Documentos", kind: "carpeta", content: "", size: 0, createdAt: 0 },
    { id: "d-img", name: "Imágenes", kind: "carpeta", content: "", size: 0, createdAt: 0 },
    { id: "d-mus", name: "Música", kind: "carpeta", content: "", size: 0, createdAt: 0 },
    { id: "d-sys", name: "Sistema", kind: "carpeta", content: "", size: 0, createdAt: 0 },
  ],
  "/Documentos": [
    {
      id: "f-bienvenida",
      name: "Bienvenida.txt",
      kind: "texto",
      content:
        "Bienvenido al simulador del sistema operativo.\n\n" +
        "Cada aplicación que abres es un proceso real:\n" +
        "  · nasce en estado Nuevo y pide memoria\n" +
        "  · pasa a Listo y espera su turno en la CPU\n" +
        "  · se ejecuta hasta que termina su quantum\n" +
        "  · se bloquea cuando espera a un dispositivo\n" +
        "  · termina con HALT y libera su memoria\n\n" +
        "Abre el Administrador de tareas para verlo en vivo.",
      size: 0,
      createdAt: 0,
      app: "notepad",
    },
  ],
  "/Imágenes": [],
  "/Música": [],
  "/Sistema": [
    { id: "f-kernel", name: "kernel.log", kind: "texto", content: "", size: 0, createdAt: 0 },
    { id: "f-procs", name: "procesos.cfg", kind: "texto", content: "", size: 0, createdAt: 0 },
  ],
}

interface SystemState {
  power: PowerState
  bootProgress: number
  user: { name: string; host: string }
  password: string
  wallpaperId: string
  iconSize: "pequeno" | "mediano" | "grande"
  volume: number
  wifi: boolean
  showDesktopIcons: boolean
  fs: Record<string, VFile[]>
  drafts: Record<number, { name: string; content: string }>
  notifications: SysNotification[]
  recentPower: "apagar" | "reiniciar" | "suspender"

  setDraft: (pid: number, draft: { name: string; content: string }) => void

  /** Apaga, reinicia o arranca el núcleo desde cero. */
  startBoot: () => void
  /** El arranque terminó: el núcleo queda disponible. */
  finishBoot: () => void
  /** Atajo del usuario: enciende el equipo (arranque si estaba apagado). */
  powerOn: () => void
  shutdown: () => void
  restart: () => void
  lock: () => void
  unlock: (password: string) => boolean
  sleep: () => void
  wake: () => void
  setBootProgress: (value: number) => void

  setWallpaper: (id: string) => void
  setIconSize: (size: "pequeno" | "mediano" | "grande") => void
  toggleDesktopIcons: () => void
  setVolume: (value: number) => void
  toggleWifi: () => void

  readDir: (path: string) => VFile[]
  writeFile: (path: string, file: Omit<VFile, "id" | "createdAt">) => VFile
  deleteFile: (path: string, id: string) => void
  makeFolder: (path: string, name: string) => void
  moveFile: (from: string, id: string, to: string) => void
  renameFile: (path: string, id: string, name: string) => void
  exists: (path: string, name: string) => boolean

  notify: (entry: Omit<SysNotification, "id" | "at">) => void
  dismissNotification: (id: number) => void
  clearNotifications: () => void
}

let fileSeq = 100
let notifySeq = 0

export const useSystemStore = create<SystemState>()((set, get) => ({
  power: "on",
  bootProgress: 0,
  user: { name: "Estudiante", host: "SO-PC" },
  password: PASSWORD,
  wallpaperId: "medianoche",
  iconSize: "mediano",
  volume: 65,
  wifi: true,
  showDesktopIcons: true,
  fs: INITIAL_FS,
  drafts: {},
  notifications: [],
  recentPower: "apagar",

  setDraft: (pid, draft) =>
    set((state) => ({ drafts: { ...state.drafts, [pid]: draft } })),

  startBoot: () => {
    // Volver a arrancar mientras ya arranca no reinicia la barra: se deja
    // terminar, porque reiniciarla aquí lo dejaría atrapado en bucle.
    if (get().power === "booting") return
    set({ recentPower: "apagar", power: "booting", bootProgress: 0 })
  },

  finishBoot: () => {
    if (get().power !== "booting") return
    set({ power: "on", bootProgress: 0 })
  },

  powerOn: () => {
    const power = get().power
    if (power === "on" || power === "locked" || power === "sleeping") return
    if (power === "booting") {
      // Ya está arrancando: no se toca nada.
      return
    }
    get().startBoot()
  },

  shutdown: () => {
    // Apagar detiene el núcleo: no quedan procesos ni ventanas en memoria.
    useSimStore.getState().reset()
    useWindowStore.getState().reset()
    set({ recentPower: "apagar", power: "off", bootProgress: 0 })
  },

  restart: () => {
    // Un reinicio limpia el núcleo antes de volver a arrancarlo, igual que
    // hace el botón de reinicio del panel de energía.
    useSimStore.getState().reset()
    useWindowStore.getState().reset()
    set({ recentPower: "reiniciar", power: "booting", bootProgress: 0 })
  },

  lock: () => {
    if (get().power !== "on") return
    set({ power: "locked" })
  },

  unlock: (password) => {
    if (password === get().password) {
      set({ power: "on" })
      return true
    }
    return false
  },

  sleep: () => {
    const power = get().power
    // Se admite desde «sleeping» para que «volver a suspender» del modo de
    // suspensión siga teniendo efecto.
    if (power !== "on" && power !== "sleeping") return
    set({ recentPower: "suspender", power: "sleeping" })
  },

  wake: () => {
    if (get().power !== "sleeping") return
    set({ power: "on" })
  },
  setBootProgress: (value) => set({ bootProgress: value }),

  setWallpaper: (id) => {
    set({ wallpaperId: id })
    const paper = WALLPAPERS.find((w) => w.id === id)
    if (paper?.dark === false) document.documentElement.classList.remove("dark")
    else document.documentElement.classList.add("dark")
    document.documentElement.style.colorScheme = paper?.dark ? "dark" : "light"
  },

  setIconSize: (iconSize) => set({ iconSize }),
  toggleDesktopIcons: () => set((s) => ({ showDesktopIcons: !s.showDesktopIcons })),
  setVolume: (volume) => {
    const value = Math.max(0, Math.min(100, Math.round(volume)))
    set({ volume: value })
    setRealVolume(value / 100)
  },
  toggleWifi: () => set((s) => ({ wifi: !s.wifi })),

  readDir: (path) => get().fs[path] ?? [],

  writeFile: (path, file) => {
    const created: VFile = {
      ...file,
      id: `f${++fileSeq}`,
      createdAt: Date.now(),
      size: file.content.length,
    }
    set((state) => ({
      fs: { ...state.fs, [path]: [created, ...(state.fs[path] ?? [])] },
    }))
    return created
  },

  deleteFile: (path, id) =>
    set((state) => ({
      fs: { ...state.fs, [path]: (state.fs[path] ?? []).filter((f) => f.id !== id) },
    })),

  makeFolder: (path, name) => {
    const folder: VFile = {
      id: `d${++fileSeq}`,
      name,
      kind: "carpeta",
      content: "",
      size: 0,
      createdAt: Date.now(),
    }
    set((state) => {
      if ((state.fs[path] ?? []).some((f) => f.name === name)) return state
      const childPath = `${path}/${name}`
      return {
        fs: {
          ...state.fs,
          [path]: [...(state.fs[path] ?? []), folder],
          [childPath]: state.fs[childPath] ?? [],
        },
      }
    })
  },

  moveFile: (from, id, to) =>
    set((state) => {
      const file = (state.fs[from] ?? []).find((f) => f.id === id)
      if (!file || from === to) return state
      if ((state.fs[to] ?? []).some((f) => f.name === file.name)) return state
      return {
        fs: {
          ...state.fs,
          [from]: (state.fs[from] ?? []).filter((f) => f.id !== id),
          [to]: [file, ...(state.fs[to] ?? [])],
        },
      }
    }),

  renameFile: (path, id, name) =>
    set((state) => ({
      fs: {
        ...state.fs,
        [path]: (state.fs[path] ?? []).map((f) => (f.id === id ? { ...f, name } : f)),
      },
    })),

  exists: (path, name) =>
    (get().fs[path] ?? []).some((f) => f.name === name),

  notify: (entry) =>
    set((state) => ({
      notifications: [
        { ...entry, id: ++notifySeq, at: new Date().toLocaleTimeString("es-ES") },
        ...state.notifications,
      ].slice(0, 30),
    })),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearNotifications: () => set({ notifications: [] }),
}))

export function wallpaperById(id: string): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0]
}

export const FOLDERS = ["/", "/Documentos", "/Imágenes", "/Música", "/Sistema"] as const

export function folderName(path: string): string {
  if (path === "/") return "Este equipo"
  return path.split("/").filter(Boolean).pop() ?? "/"
}