import type { LucideIcon } from "lucide-react"
import {
  Calculator,
  Compass,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  ListTree,
  NotebookPen,
  Printer,
  Settings,
  TerminalSquare,
  Video,
} from "lucide-react"
import type { DeviceKind } from "@/types/os"

export interface AppDefinition {
  key: string
  processName: string
  title: string
  shortTitle?: string
  description: string
  icon: LucideIcon
  accent: string
  device: DeviceKind | null
  memoryKB: number
  burst: number
  priority: number
  program: string[]
  defaultSize: { width: number; height: number }
  minSize: { width: number; height: number }
  background?: boolean
  onDesktop?: boolean
}

export const APPS: AppDefinition[] = [
  {
    key: "notepad",
    processName: "notepad.exe",
    title: "Bloc de notas",
    description:
      "Escribe con el teclado: cada tecla es una interrupción de entrada/salida real.",
    icon: NotebookPen,
    accent: "#38bdf8",
    device: "teclado",
    memoryKB: 16,
    burst: 160,
    priority: 5,
    program: [
      "MOV AC, #0",
      "MOV MAR, #0x100",
      "IN /dev/teclado",
      "ADD AC, #1",
      "STORE AC, [MAR]",
      "LOAD AC, [MAR]",
      "INC cont-datos",
      "HALT",
    ],
    defaultSize: { width: 620, height: 440 },
    minSize: { width: 340, height: 240 },
    onDesktop: true,
  },
  {
    key: "camera",
    processName: "camera.exe",
    title: "Cámara",
    description:
      "Captura fotos. Cada disparo consume CPU y guarda el archivo en Imágenes.",
    icon: Video,
    accent: "#f472b6",
    device: null,
    memoryKB: 32,
    burst: 200,
    priority: 4,
    program: ["MOV AC, #0", "ADD AC, #3", "STORE AC, [MAR]", "INC cont-datos", "HALT"],
    defaultSize: { width: 680, height: 500 },
    minSize: { width: 380, height: 300 },
    onDesktop: true,
  },
  {
    key: "calculator",
    processName: "calc.exe",
    title: "Calculadora",
    description:
      "Opera directamente sobre el acumulador del proceso: ves la ALU en acción.",
    icon: Calculator,
    accent: "#a78bfa",
    device: null,
    memoryKB: 12,
    burst: 200,
    priority: 6,
    program: [
      "MOV AC, #0",
      "ADD AC, #7",
      "SUB AC, #3",
      "INC AC",
      "DEC AC",
      "MOV AC, #12",
      "ADD AC, #5",
      "INC cont-datos",
      "HALT",
    ],
    defaultSize: { width: 320, height: 470 },
    minSize: { width: 280, height: 400 },
    onDesktop: true,
  },
  {
    key: "explorer",
    processName: "explorer.exe",
    title: "Explorador de archivos",
    description:
      "Navega el disco, crea carpetas, mueve y borra archivos. Lee del disco duro.",
    icon: FolderOpen,
    accent: "#fbbf24",
    device: "disco",
    memoryKB: 28,
    burst: 260,
    priority: 4,
    program: [
      "READ /dev/disco",
      "LOAD AC, [MAR]",
      "ADD AC, #1",
      "STORE AC, [MAR]",
      "READ /dev/disco",
      "INC cont-datos",
      "HALT",
    ],
    defaultSize: { width: 720, height: 460 },
    minSize: { width: 420, height: 280 },
    onDesktop: true,
  },
  {
    key: "browser",
    processName: "browser.exe",
    title: "Navegador",
    description: "Descarga contenido por la red y cachea los recursos.",
    icon: Globe,
    accent: "#22d3ee",
    device: "red",
    memoryKB: 40,
    burst: 220,
    priority: 4,
    program: [
      "NET /dev/red",
      "ADD AC, #1",
      "STORE AC, [MAR]",
      "NET /dev/red",
      "LOAD AC, [MAR]",
      "INC cont-datos",
      "HALT",
    ],
    defaultSize: { width: 700, height: 480 },
    minSize: { width: 380, height: 260 },
    onDesktop: true,
  },
  {
    key: "settings",
    processName: "settings.exe",
    title: "Configuración",
    description: "Cambia el fondo del escritorio, el tamaño de los iconos y el tema.",
    icon: Settings,
    accent: "#64748b",
    device: null,
    memoryKB: 18,
    burst: 260,
    priority: 7,
    program: ["LOAD AC, [MAR]", "INC cont-datos", "HALT"],
    defaultSize: { width: 760, height: 520 },
    minSize: { width: 420, height: 320 },
    onDesktop: true,
  },
  {
    key: "photos",
    processName: "photos.exe",
    title: "Fotos",
    description: "Mira las capturas guardadas por la cámara.",
    icon: ImageIcon,
    accent: "#facc15",
    device: null,
    memoryKB: 22,
    burst: 240,
    priority: 7,
    program: ["LOAD AC, [MAR]", "ADD AC, #1", "INC cont-datos", "HALT"],
    defaultSize: { width: 660, height: 460 },
    minSize: { width: 380, height: 280 },
    onDesktop: true,
  },
  {
    key: "writer",
    processName: "writer.exe",
    title: "Impresora",
    description:
      "Envía el documento a la cola de la impresora, el recurso que más bloquea.",
    icon: Printer,
    accent: "#fb7185",
    device: "impresora",
    memoryKB: 24,
    burst: 180,
    priority: 3,
    program: [
      "MOV AC, #0",
      "OUT /dev/impresora",
      "ADD AC, #1",
      "OUT /dev/impresora",
      "STORE AC, [MAR]",
      "INC cont-datos",
      "HALT",
    ],
    defaultSize: { width: 460, height: 340 },
    minSize: { width: 320, height: 240 },
  },
  {
    key: "terminal",
    processName: "terminal.exe",
    title: "Terminal",
    description:
      "Consola con órdenes reales: ls, ps, kill, mem, cat y más.",
    icon: TerminalSquare,
    accent: "#4ade80",
    device: null,
    memoryKB: 10,
    burst: 220,
    priority: 5,
    program: [
      "MOV AC, #0",
      "ADD AC, #1",
      "STORE AC, [MAR]",
      "LOAD AC, [MAR]",
      "INC cont-datos",
      "HALT",
    ],
    defaultSize: { width: 660, height: 400 },
    minSize: { width: 340, height: 220 },
    onDesktop: true,
  },
  {
    key: "taskmgr",
    processName: "taskmgr.exe",
    title: "Administrador de tareas",
    description:
      "Todos los procesos con su estado, CPU y memoria. Suspende o termina.",
    icon: ListTree,
    accent: "#94a3b8",
    device: null,
    memoryKB: 20,
    burst: 300,
    priority: 8,
    program: ["LOAD AC, [MAR]", "ADD AC, #1", "INC cont-datos", "HALT"],
    defaultSize: { width: 760, height: 500 },
    minSize: { width: 440, height: 320 },
    onDesktop: true,
  },
  {
    key: "syslog",
    processName: "syslog.exe",
    title: "Registro del sistema",
    description:
      "Bitácora de eventos y de los errores detectados, con marcas de tiempo.",
    icon: Compass,
    accent: "#c084fc",
    device: null,
    memoryKB: 14,
    burst: 320,
    priority: 9,
    program: ["LOAD AC, [MAR]", "INC cont-datos", "HALT"],
    defaultSize: { width: 700, height: 440 },
    minSize: { width: 380, height: 240 },
    onDesktop: true,
  },
  {
    key: "service",
    processName: "service.exe",
    title: "Servicio",
    shortTitle: "Servicio",
    description:
      "Proceso invisible del sistema: consume recursos sin abrir ninguna ventana.",
    icon: ListTree,
    accent: "#64748b",
    device: null,
    memoryKB: 18,
    burst: 400,
    priority: 7,
    program: ["LOAD AC, [MAR]", "ADD AC, #1", "INC cont-datos", "HALT"],
    defaultSize: { width: 0, height: 0 },
    minSize: { width: 0, height: 0 },
    background: true,
  },
]

export const APP_MAP: Record<string, AppDefinition> = Object.fromEntries(
  APPS.map((app) => [app.key, app]),
)

export function getApp(process: { app: string | null }): AppDefinition | undefined {
  return process.app ? APP_MAP[process.app] : undefined
}

export const DESKTOP_APPS = APPS.filter((a) => a.onDesktop)