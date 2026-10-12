import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Camera as CameraIcon,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  FolderPlus,
  Globe,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Pause,
  Pencil,
  Play,
  Printer,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Trash2,
  VideoOff,
  X,
} from "lucide-react"
import { cn } from "cn"
import type { AppDefinition } from "@/apps/registry"
import type { Device, Process } from "@/types/os"
import { useSim } from "@/hooks/useSim"
import { useLauncher } from "@/hooks/useLauncher"
import { useSimStore } from "@/store/simStore"
import { useWindowStore } from "@/store/windowStore"
import {
  FOLDERS,
  WALLPAPERS,
  folderName,
  useSystemStore,
} from "@/store/systemStore"
import { useUiStore } from "@/store/uiStore"
import { useMenuStore } from "@/store/menuStore"
import { useErrorStore } from "@/store/errorStore"
import { stateStyles } from "@/lib/palette"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FlowDiagram,
  HardwarePanel,
  MemoryManager,
  NetworkMonitor,
  StatesSync,
} from "@/apps/SystemApps"
import { Minesweeper } from "@/apps/Games"

interface Props {
  app: AppDefinition
  process: Process
}

export function AppContent({ app, process }: Props) {
  switch (app.key) {
    case "notepad":
      return <Notepad process={process} />
    case "camera":
      return <Camera process={process} />
    case "calculator":
      return <CalculatorWindow process={process} />
    case "explorer":
      return <ExplorerWindow process={process} />
    case "browser":
      return <BrowserWindow process={process} />
    case "settings":
      return <SettingsApp />
    case "photos":
      return <PhotosApp />
    case "writer":
      return <WriterWindow process={process} />
    case "terminal":
      return <TerminalWindow process={process} />
    case "taskmgr":
      return <TaskManager />
    case "syslog":
      return <SystemLog />
    case "flow":
      return <FlowDiagram />
    case "states":
      return <StatesSync />
    case "memory":
      return <MemoryManager />
    case "hardware":
      return <HardwarePanel />
    case "network":
      return <NetworkMonitor />
    case "mines":
      return <Minesweeper process={process} />
    default:
      return null
  }
}

const alive = (p: Process) => p.state !== "terminado"

/* ------------------------------------------------------------------ */
/* Piezas comunes                                                      */
/* ------------------------------------------------------------------ */

function StateStrip({ process, device }: { process: Process; device?: Device }) {
  const state = stateStyles[process.state]
  const total = Math.max(1, process.burstTotal)
  const progress = Math.round(((total - process.burstRemaining) / total) * 100)

  return (
    <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-1.5">
      <span className="shrink-0 text-[0.66rem] font-medium" style={{ color: state.hex }}>
        {state.label}
      </span>
      {process.state === "ejecutando" ? (
        <span className="truncate font-mono text-[0.64rem] text-muted-foreground">
          {process.registers.ir}
        </span>
      ) : null}
      {process.state === "bloqueado" ? (
        <span className="flex min-w-0 items-center gap-1 text-[0.64rem] text-muted-foreground">
          <Loader2 className="size-3 shrink-0 animate-spin" />
          <span className="truncate">
            {device ? `Esperando ${device.name}` : process.blockedReason}
          </span>
        </span>
      ) : null}
      {process.state === "nuevo" && process.blockedReason ? (
        <span className="truncate text-[0.64rem] text-muted-foreground">
          {process.blockedReason}
        </span>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="h-1 w-14 overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full rounded-full"
            style={{ background: state.hex }}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          />
        </div>
        <span className="text-[0.62rem] tabular-nums text-muted-foreground">
          {progress}%
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bloc de notas                                                       */
/* ------------------------------------------------------------------ */

function Notepad({ process }: { process: Process }) {
  const keyboard = useSim((s) => s.devices.find((d) => d.kind === "teclado"))
  const writeFile = useSystemStore((s) => s.writeFile)
  const draft = useSystemStore((s) => s.drafts[process.pid])
  const typeOnKeyboard = useSimStore((s) => s.typeOnKeyboard)
  const [text, setText] = useState(draft?.content ?? "")
  const [name, setName] = useState(draft?.name ?? "Sin título.txt")
  const [saved, setSaved] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  const queued =
    keyboard?.active?.pid === process.pid ||
    keyboard?.queue.some((r) => r.pid === process.pid)

  return (
    <div className="flex h-full flex-col">
      <StateStrip process={process} device={keyboard} />

      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
        <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setSaved(false)
          }}
          className="h-6 max-w-52 border-0 bg-transparent px-1 text-[0.72rem] font-medium"
          aria-label="Nombre del archivo"
        />
        <Button
          size="xs"
          variant="secondary"
          className="ml-auto shrink-0"
          onClick={() => {
            writeFile("/Documentos", { name, kind: "texto", content: text, size: text.length })
            setSaved(true)
          }}
        >
          <Save data-icon="inline-start" />
          Guardar
        </Button>
        <AnimatePresence>
          {saved ? (
            <motion.span
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="shrink-0 text-[0.66rem] text-emerald-600 dark:text-emerald-400"
            >
              Guardado
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <textarea
        ref={areaRef}
        value={text}
        onChange={(event) => {
          const value = event.target.value
          const added = value.length - text.length
          setText(value)
          setSaved(false)
          if (added > 0) typeOnKeyboard(process.pid, value.slice(text.length))
        }}
        spellCheck={false}
        placeholder="Escribe aquí… cada tecla envía una interrupción al teclado."
        className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-[0.8rem] leading-relaxed outline-none placeholder:text-muted-foreground/60"
      />

      <div className="flex items-center gap-3 border-t border-border/60 px-3 py-1 text-[0.64rem] text-muted-foreground">
        <span>{text.length} caracteres</span>
        <span className="ml-auto flex items-center gap-1">
          {queued ? (
            <>
              <Loader2 className="size-3 animate-spin text-amber-500" />
              Tecleo pendiente en el controlador
            </>
          ) : (
            "Teclado listo"
          )}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cámara                                                              */
/* ------------------------------------------------------------------ */

function Camera({ process }: { process: Process }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [media, setMedia] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<"pidiendo" | "viva" | "error">("pidiendo")
  const [reason, setReason] = useState("")
  const [deviceName, setDeviceName] = useState("")
  const [shots, setShots] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const writeFile = useSystemStore((s) => s.writeFile)
  const addWork = useSimStore((s) => s.addWork)
  const images = useSystemStore((s) => s.fs["/Imágenes"] ?? [])

  // 1) Pedir la cámara. Cada intento anterior se libera antes de pedir otra.
  useEffect(() => {
    let cancelled = false
    let opened: MediaStream | null = null

    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        opened = stream
        setDeviceName(stream.getVideoTracks()[0]?.label ?? "Cámara")
        setMedia(stream)
        setStatus("viva")
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const name = error instanceof DOMException ? error.name : ""
        setReason(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Permiso denegado. Autoriza la cámara desde el candado de la barra de direcciones y reinténtalo."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "Este equipo no tiene ninguna cámara conectada."
              : name === "NotReadableError"
                ? "Otra aplicación está usando la cámara."
                : `No se pudo abrir la cámara: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
        )
        setStatus("error")
      })

    return () => {
      cancelled = true
      opened?.getTracks().forEach((track) => track.stop())
    }
  }, [attempt])

  // 2) El <video> sólo existe cuando hay estado que lo pinte: se engancha el
  //    flujo aquí y no dentro de la promesa, para no buscarlo antes de tiempo.
  useEffect(() => {
    const element = videoRef.current
    if (!element || !media) return
    element.srcObject = media
    void element.play().catch(() => {})
  }, [media])

const live = status === "viva" && !!media

  // El estado se limpia en el manejador del clic, no dentro del efecto: así
  // React no encadena un render extra al montar.
  const retry = () => {
    setStatus("pidiendo")
    setReason("")
    setDeviceName("")
    setMedia(null)
    setAttempt((n) => n + 1)
  }

  /** Vuelca el fotograma actual a un JPEG dentro del archivo simulado:
   *  sin esto «Fotos» sólo tenía el nombre del archivo, no la imagen. */
  const grabFrame = (): string | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    try {
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      // El visor está en espejo; se invierte para guardar la foto derecha.
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL("image/jpeg", 0.82)
    } catch {
      return null
    }
  }

  const capture = () => {
    const now = new Date()
    const stamp = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
    const frame = grabFrame()
    writeFile("/Imágenes", {
      name: `CAP_${stamp}.jpg`,
      kind: "imagen",
      content: frame ?? "escena-simulada",
      size: frame ? Math.round((frame.length * 3) / 4) : 160_000,
      app: "camera",
    })
    setShots((n) => n + 1)
    addWork(process.pid, 14)
  }

  return (
    <div className="flex h-full flex-col">
      <StateStrip process={process} />
      <div className="relative min-h-0 flex-1 bg-neutral-950">
        {live ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="size-full scale-x-[-1] object-cover"
          />
        ) : (
          <CameraPlaceholder status={status} reason={reason} />
        )}

        {status === "error" ? (
          <div className="absolute inset-x-3 bottom-20 flex justify-center">
            <button
              type="button"
              onClick={retry}
              className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[0.68rem] font-medium text-neutral-900 transition-colors hover:bg-white"
            >
              <RefreshCw className="size-3.5" />
              Reintentar
            </button>
          </div>
        ) : null}

        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[0.62rem] text-white">
          <span
            className={cn(
              "size-1.5 rounded-full",
              live
                ? "animate-pulse bg-rose-500"
                : status === "pidiendo"
                  ? "bg-amber-400"
                  : "bg-neutral-500",
            )}
          />
          {live ? "EN DIRECTO" : status === "pidiendo" ? "ABRIENDO CÁMARA…" : "SIN CÁMARA"}
        </div>

        {deviceName ? (
          <div className="absolute top-2 right-2 max-w-[45%] truncate rounded-full bg-black/55 px-2 py-1 text-[0.6rem] text-white/80">
            {deviceName}
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={capture}
            aria-label="Hacer una foto"
            className="grid size-14 place-items-center rounded-full border-4 border-white/80 bg-white/25 backdrop-blur"
          >
            <span className="size-10 rounded-full bg-white" />
          </motion.button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-1.5 text-[0.66rem] text-muted-foreground">
        <span>{shots} capturas</span>
        <span>· {images.length} en Imágenes</span>
        <span className="ml-auto">Cada disparo cuesta 14 ciclos</span>
      </div>
    </div>
  )
}

function CameraPlaceholder({
  status,
  reason,
}: {
  status: "pidiendo" | "viva" | "error"
  reason: string
}) {
  return (
    <div className="relative size-full overflow-hidden bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
      <motion.div
        className="absolute inset-0"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 30%, rgba(56,189,248,0.35), transparent 55%), radial-gradient(circle at 70% 60%, rgba(244,114,182,0.35), transparent 55%)",
          backgroundSize: "200% 200%",
        }}
      />
      <div className="absolute inset-0 grid place-items-center px-6">
        {status === "pidiendo" ? (
          <Loader2 className="size-6 animate-spin text-white/40" />
        ) : (
          <div className="text-center">
            <VideoOff className="mx-auto size-8 text-white/30" />
            <p className="mt-2 text-[0.7rem] leading-snug text-white/60">{reason}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Calculadora                                                         */
/* ------------------------------------------------------------------ */

type CalcOp = "+" | "−" | "×" | "÷"
type CalcKey = { label: string; kind: "digit" | "op" | "fn" }

const CALC_KEYS: CalcKey[] = [
  { label: "C", kind: "fn" },
  { label: "±", kind: "fn" },
  { label: "%", kind: "fn" },
  { label: "÷", kind: "op" },
  { label: "7", kind: "digit" },
  { label: "8", kind: "digit" },
  { label: "9", kind: "digit" },
  { label: "×", kind: "op" },
  { label: "4", kind: "digit" },
  { label: "5", kind: "digit" },
  { label: "6", kind: "digit" },
  { label: "−", kind: "op" },
  { label: "1", kind: "digit" },
  { label: "2", kind: "digit" },
  { label: "3", kind: "digit" },
  { label: "+", kind: "op" },
  { label: "0", kind: "digit" },
  { label: "=", kind: "op" },
]

function CalculatorWindow({ process }: { process: Process }) {
  const [pending, setPending] = useState<{ op: CalcOp; left: number } | null>(null)
  // Tras pulsar un operador, el siguiente dígito empieza un número nuevo.
  const [fresh, setFresh] = useState(true)
  const ac = process.registers.ac

  function setAc(value: number) {
    const sim = useSimStore.getState()
    const p = sim.sim.processes.find((x) => x.pid === process.pid)
    if (!p) return
    p.registers.ac = Math.max(-999999, Math.min(999999, Math.trunc(value)))
    p.registers.cc =
      p.registers.ac === 0 ? "Z" : p.registers.ac < 0 ? "N" : "P"
    p.burstRemaining += 1
    p.burstTotal += 1
    sim.commit()
  }

  function compute(op: CalcOp, left: number, right: number): number {
    if (op === "+") return left + right
    if (op === "−") return left - right
    if (op === "×") return left * right
    return right === 0 ? left : Math.trunc(left / right)
  }

  function press(key: CalcKey) {
    if (!alive(process)) return
    const { label, kind } = key

    if (kind === "digit") {
      setAc(fresh ? Number(label) : Number(`${ac === 0 ? "" : ac}${label}`))
      setFresh(false)
      return
    }

    if (label === "C") {
      setAc(0)
      setPending(null)
      setFresh(true)
      return
    }
    if (label === "±") {
      setAc(-ac)
      setFresh(false)
      return
    }
    if (label === "%") {
      setAc(Math.trunc(ac / 100))
      setFresh(true)
      return
    }
    if (label === "=") {
      if (pending) {
        setAc(compute(pending.op, pending.left, ac))
        setPending(null)
      }
      setFresh(true)
      return
    }

    const op = label as CalcOp
    if (pending && !fresh) {
      const result = compute(pending.op, pending.left, ac)
      setAc(result)
      setPending({ op, left: result })
    } else {
      setPending({ op, left: ac })
    }
    setFresh(true)
  }

  return (
    <div className="flex h-full flex-col">
      <StateStrip process={process} />
      <div className="flex items-end gap-2 border-b border-border/60 px-3 py-2">
        <motion.span
          key={ac}
          initial={{ opacity: 0.2, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-[1.9rem] leading-none font-semibold tabular-nums"
        >
          {ac}
        </motion.span>
        <span className="mb-1 ml-auto text-[0.66rem] tabular-nums text-muted-foreground">
          {pending ? `${pending.op} ${pending.left}` : `AC · PC ${process.registers.pc}`}
        </span>
      </div>

      <div className="grid flex-1 grid-cols-4 gap-1.5 p-2">
        {CALC_KEYS.map((key) => (
          <motion.button
            key={key.label}
            type="button"
            whileTap={{ scale: 0.9 }}
            disabled={!alive(process)}
            onClick={() => press(key)}
            className={cn(
              "grid place-items-center rounded-lg border text-[0.95rem] font-medium transition-colors disabled:opacity-40",
              key.kind === "digit"
                ? "border-border/60 bg-muted/50 hover:bg-muted"
                : key.kind === "fn"
                  ? "border-border/60 bg-background text-muted-foreground hover:bg-muted"
                  : "border-violet-500/25 bg-violet-500/12 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300",
            )}
          >
            {key.label}
          </motion.button>
        ))}
      </div>

      <div className="border-t border-border/60 px-3 py-1 text-[0.64rem] text-muted-foreground">
        Escribe directamente en el acumulador (AC) del proceso
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Explorador de archivos                                              */
/* ------------------------------------------------------------------ */

/** Une ruta y nombre sin duplicar la barra: «/» + «Documentos» es
 *  «/Documentos», no «//Documentos» (que no existía y salía vacía). */
function joinPath(path: string, name: string): string {
  if (path === "/" || path === "") return `/${name}`
  return `${path.replace(/\/+$/, "")}/${name}`
}

function ExplorerWindow({ process }: { process: Process }) {
  const disk = useSim((s) => s.devices.find((d) => d.kind === "disco"))
  const fs = useSystemStore((s) => s.fs)
  const makeFolder = useSystemStore((s) => s.makeFolder)
  const deleteFile = useSystemStore((s) => s.deleteFile)
  const moveFile = useSystemStore((s) => s.moveFile)
  const renameFile = useSystemStore((s) => s.renameFile)
  const showMenu = useMenuStore((s) => s.show)
  const setDraft = useSystemStore((s) => s.setDraft)
  const addWork = useSimStore((s) => s.addWork)
  const { launch } = useLauncher()

  const [path, setPath] = useState("/")
  const [dragging, setDragging] = useState<string | null>(null)
  const [overTarget, setOverTarget] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const entries = fs[path] ?? []

  function open(name: string, kind: string) {
    if (kind === "carpeta") {
      setPath(joinPath(path, name))
      addWork(process.pid, 4)
      return
    }
    const file = entries.find((f) => f.name === name)
    if (!file) return
    if (file.kind === "texto") {
      const pid = launch("notepad")
      if (pid !== null) setDraft(pid, { name: file.name, content: file.content })
    } else if (file.kind === "imagen") {
      launch("photos")
    }
  }

  /** La carpeta «Documentos» existe como /Documentos, no como /Documentos/. */
  const goUp = () => {
    if (path === "/") return
    const parts = path.split("/").filter(Boolean)
    parts.pop()
    setPath(parts.length === 0 ? "/" : `/${parts.join("/")}`)
    addWork(process.pid, 2)
  }

  /** Botón derecho sobre un archivo: antes no enseñaba nada. */
  function fileMenu(event: React.MouseEvent, file: (typeof entries)[number]) {
    event.preventDefault()
    event.stopPropagation()
    showMenu(
      { clientX: event.clientX, clientY: event.clientY },
      [
        {
          id: "abrir",
          label: "Abrir",
          onSelect: () => open(file.name, file.kind),
        },
        {
          id: "abrir-con",
          label: "Abrir en una ventana nueva",
          onSelect: () => {
            if (file.kind === "carpeta") launch("explorer")
            else if (file.kind === "imagen") launch("photos")
            else launch("notepad")
          },
        },
        { id: "sep-a", separator: true },
        {
          id: "renombrar",
          label: "Renombrar",
          disabled: file.kind === "carpeta",
          onSelect: () => {
            const next = window.prompt("Nuevo nombre", file.name)
            if (next?.trim()) {
              renameFile(path, file.id, next.trim())
              addWork(process.pid, 2)
            }
          },
        },
        {
          id: "mover",
          label: "Mover a…",
          children: FOLDERS.filter((f) => f !== path).map((folder) => ({
            id: `mv-${folder}`,
            label: folderName(folder),
            onSelect: () => {
              moveFile(path, file.id, folder)
              addWork(process.pid, 3)
            },
          })),
        },
        { id: "sep-b", separator: true },
        {
          id: "propiedades",
          label: "Propiedades",
          children: [
            { id: "p1", label: `Nombre: ${file.name}`, disabled: true },
            { id: "p2", label: `Tipo: ${file.kind}`, disabled: true },
            {
              id: "p3",
              label: `Tamaño: ${(file.size / 1024).toFixed(1)} KB`,
              disabled: true,
            },
            {
              id: "p4",
              label: `Creado: ${new Date(file.createdAt).toLocaleString("es-ES")}`,
              disabled: true,
            },
          ],
        },
        {
          id: "borrar",
          label: "Eliminar",
          danger: true,
          onSelect: () => {
            deleteFile(path, file.id)
            addWork(process.pid, 3)
          },
        },
      ],
      file.name,
    )
  }

  function createFolder() {
    const name = newName.trim() || `Nueva carpeta ${entries.length + 1}`
    makeFolder(path, name)
    setNewName("")
    setCreating(false)
    addWork(process.pid, 2)
  }

  return (
    <div className="flex h-full flex-col">
      <StateStrip process={process} device={disk} />

      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/60 px-2 py-1.5">
        <Button size="icon-xs" variant="ghost" onClick={goUp} aria-label="Subir" disabled={path === "/"}>
          <ChevronUp className="size-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => setPath("/")}
          aria-label="Ir a Este equipo"
        >
          <Monitor className="size-3.5" />
        </Button>
        {FOLDERS.map((folder) => (
          <button
            key={folder}
            type="button"
            onClick={() => setPath(folder)}
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-[0.68rem] transition-colors",
              path === folder
                ? "bg-foreground/10 font-medium"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {folder === "/" ? "Este equipo" : folderName(folder)}
          </button>
        ))}
        <Button
          size="icon-xs"
          variant="ghost"
          className="ml-auto shrink-0"
          onClick={() => setCreating(true)}
          aria-label="Nueva carpeta"
        >
          <FolderPlus className="size-3.5" />
        </Button>
      </div>

      <AnimatePresence>
        {creating ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border/60 bg-muted/40"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <FolderPlus className="size-3.5 shrink-0 text-amber-500" />
              <Input
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && createFolder()}
                placeholder="Nombre de la carpeta"
                className="h-6 text-[0.72rem]"
              />
              <Button size="xs" onClick={createFolder}>
                Crear
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setCreating(false)}>
                <X className="size-3" />
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <p className="px-2 py-8 text-center text-[0.74rem] text-muted-foreground">
            Esta carpeta está vacía
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
            {entries.map((file) => (
              <motion.button
                key={file.id}
                layout
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                draggable
                onDragStart={() => setDragging(file.id)}
                onDragEnd={() => setDragging(null)}
                onDoubleClick={() => open(file.name, file.kind)}
                onContextMenu={(event) => fileMenu(event, file)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors",
                  dragging === file.id
                    ? "border-indigo-500/40 opacity-40"
                    : "border-transparent hover:border-border/60 hover:bg-muted/40",
                )}
              >
                <span className="relative">
                  {file.kind === "carpeta" ? (
                    <FolderOpenIcon />
                  ) : file.kind === "imagen" ? (
                    <Thumb src={file.content} name={file.name} />
                  ) : (
                    <Pencil className="size-7 text-sky-400" />
                  )}
                  {overTarget === file.name && file.kind === "carpeta" ? (
                    <span className="absolute -inset-2 rounded-lg border-2 border-indigo-500" />
                  ) : null}
                </span>
                <span className="line-clamp-2 text-[0.66rem] leading-tight">{file.name}</span>
                <span className="text-[0.6rem] text-muted-foreground">
                  {file.kind === "carpeta"
                    ? "carpeta"
                    : `${(file.size / 1024).toFixed(0)} KB`}
                </span>
                <span className="absolute top-1 right-1 hidden group-hover:block" />
              </motion.button>
            ))}
          </div>
        )}

        <div className="mt-3 rounded-lg border border-dashed border-border/60 p-2.5">
          <p className="text-micro text-muted-foreground/80">Mover o borrar</p>
          <p className="mt-1 text-[0.68rem] text-muted-foreground">
            Selecciona un archivo y suéltalo sobre una carpeta de la lista. Con el
            botón derecho puedes borrarlo o moverlo directamente.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {FOLDERS.filter((f) => f !== path).map((folder) => (
              <button
                key={folder}
                type="button"
                onDragOver={(event) => {
                  event.preventDefault()
                  setOverTarget(folder)
                }}
                onDragLeave={() => setOverTarget(null)}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragging) {
                    moveFile(path, dragging, folder)
                    addWork(process.pid, 3)
                  }
                  setDragging(null)
                  setOverTarget(null)
                }}
                className={cn(
                  "rounded-md border border-border/60 px-2 py-1 text-[0.68rem] transition-colors",
                  overTarget === folder
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "hover:bg-muted",
                )}
              >
                {folderName(folder)}
              </button>
            ))}
          </div>
          <Button
            size="xs"
            variant="outline"
            className="mt-2"
            disabled={!dragging}
            onClick={() => {
              if (dragging) deleteFile(path, dragging)
              setDragging(null)
            }}
          >
            <Trash2 data-icon="inline-start" />
            Borrar el archivo arrastrado
          </Button>
        </div>
      </div>

      <div className="border-t border-border/60 px-3 py-1 text-[0.64rem] text-muted-foreground">
        {entries.length} elementos · {path}
      </div>
    </div>
  )
}

/** Una imagen guardada guarda su contenido como data URL; si no lo tiene,
 *  se dibuja el icono de archivo para que quede claro que no es una foto. */
function Thumb({ src, name }: { src: string; name: string }) {
  if (src?.startsWith("data:image")) {
    return (
      <img
        src={src}
        alt={name}
        className="size-7 rounded object-cover ring-1 ring-yellow-500/40"
      />
    )
  }
  return <ImageIcon className="size-7 text-yellow-500" />
}

function FolderOpenIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-7 text-amber-500" fill="currentColor">
      <path d="M3 7a2 2 0 0 1 2-2h7l2 3h13a2 2 0 0 1 2 2v3H5.6L3 26.6V7z" opacity=".55" />
      <path d="M5 12h25l-3.4 13.2a2 2 0 0 1-1.9 1.5H4.6a2 2 0 0 1-1.9-2.6L5 12z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Navegador                                                           */
/* ------------------------------------------------------------------ */

/** Sitios que los marcadores ofrecen: Google abre con ?igu=1, su modo de
 *  incrustación, que es el único que permite meterlo en un iframe. */
const HOME_URL = "https://www.google.com/webhp?igu=1"

const BOOKMARKS: { label: string; url: string }[] = [
  { label: "Google", url: HOME_URL },
  { label: "Buscar en Google", url: "https://www.google.com/search?igu=1&q=simulador+de+sistema+operativo" },
  { label: "Wikipedia: SO", url: "https://es.wikipedia.org/wiki/Sistema_operativo" },
  { label: "Wikipedia: memoria", url: "https://es.wikipedia.org/wiki/Gesti%C3%B3n_de_memoria" },
  { label: "Wikipedia: planif.", url: "https://es.wikipedia.org/wiki/Planificaci%C3%B3n_de_CPU" },
  { label: "MDN Web Docs", url: "https://developer.mozilla.org/es/" },
  { label: "Ejemplo", url: "https://example.com" },
]

/** Dominios que prohíben expressly el embed: el iframe saldría en blanco. */
const NO_EMBED = [
  "bing.com",
  "duckduckgo.com",
  "startpage.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "youtube.com",
]

function normalizeTarget(raw: string): string {
  const text = raw.trim()
  if (!text) return HOME_URL
  if (/^https?:\/\//i.test(text)) return text
  // Sin esquema se asume una búsqueda, que es lo que espera la gente.
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(text)) return `https://${text}`
  return `https://www.google.com/search?igu=1&q=${encodeURIComponent(text)}`
}

function BrowserWindow({ process }: { process: Process }) {
  const net = useSim((s) => s.devices.find((d) => d.kind === "red"))
  const addWork = useSimStore((s) => s.addWork)
  const [draft, setDraft] = useState(HOME_URL)
  const [url, setUrl] = useState(HOME_URL)
  const [history, setHistory] = useState<string[]>([HOME_URL])
  const [cursor, setCursor] = useState(0)
  const [loadKey, setLoadKey] = useState(0)
  const [loaded, setLoaded] = useState(0)

  const blocked = NO_EMBED.some((domain) => url.includes(domain))
  const ready = alive(process)

  function navigate(raw: string) {
    if (!ready) return
    const target = normalizeTarget(raw)
    setUrl(target)
    setDraft(target)
    setHistory((h) => [...h.slice(0, cursor + 1), target])
    setCursor((c) => c + 1)
    setLoadKey((k) => k + 1)
    // Cada navegación es una petición real a la tarjeta de red simulada:
    // el proceso se bloquea en la cola mientras la página baja.
    setLoaded(0)
    addWork(process.pid, 12)
    let step = 0
    const id = window.setInterval(() => {
      step += 24 + Math.random() * 26
      setLoaded(Math.min(100, step))
      if (step >= 100) window.clearInterval(id)
    }, 240)
  }

  const go = (delta: number) => {
    const next = cursor + delta
    if (next < 0 || next >= history.length) return
    setCursor(next)
    setUrl(history[next])
    setDraft(history[next])
    setLoadKey((k) => k + 1)
    addWork(process.pid, 6)
  }

  return (
    <div className="flex h-full flex-col">
      <StateStrip process={process} device={net} />

      <div className="flex items-center gap-1.5 border-b border-border/60 px-2 py-1.5">
        <button
          type="button"
          aria-label="Atrás"
          title="Atrás"
          disabled={cursor === 0 || !ready}
          onClick={() => go(-1)}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Adelante"
          title="Adelante"
          disabled={cursor >= history.length - 1 || !ready}
          onClick={() => go(1)}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Recargar"
          title="Recargar"
          disabled={!ready}
          onClick={() => navigate(url)}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] disabled:opacity-30"
        >
          {loaded < 100 ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          aria-label="Inicio"
          title="Ir a Google"
          onClick={() => navigate(HOME_URL)}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07]"
        >
          <Globe className="size-3.5" />
        </button>

        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") navigate(draft)
          }}
          placeholder="Escribe una dirección o lo que quieras buscar"
          className="h-7 flex-1 font-mono text-[0.7rem]"
          aria-label="Dirección o búsqueda"
        />

        <button
          type="button"
          aria-label="Abrir en una pestaña nueva"
          title="Abrir en una pestaña nueva"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07]"
        >
          <ExternalLink className="size-3.5" />
        </button>
        <Button size="sm" variant="secondary" className="shrink-0" onClick={() => navigate(draft)} disabled={!ready}>
          Ir
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 px-2 py-1">
        {BOOKMARKS.map((mark) => (
          <button
            key={mark.url}
            type="button"
            onClick={() => navigate(mark.url)}
            className={cn(
              "shrink-0 rounded-md border px-2 py-0.5 text-[0.62rem] transition-colors",
              url === mark.url
                ? "border-cyan-500/50 bg-cyan-500/12 text-cyan-600 dark:text-cyan-300"
                : "border-border/60 text-muted-foreground hover:bg-foreground/[0.07]",
            )}
          >
            {mark.label}
          </button>
        ))}
      </div>

      {loaded < 100 ? (
        <div className="h-1 shrink-0 overflow-hidden rounded-full bg-border/60">
          <motion.div
            className="h-full rounded-full bg-cyan-500"
            animate={{ width: `${loaded}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
          />
        </div>
      ) : null}

      {blocked ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[0.66rem] text-amber-700 dark:text-amber-300">
          <span className="min-w-0 flex-1">
            Este sitio prohíbe mostrarse dentro de otra aplicación, así que el marco
            quedará en blanco.
          </span>
          <button
            type="button"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            className="shrink-0 rounded-md border border-amber-500/40 px-2 py-0.5"
          >
            Abrir en pestaña
          </button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 bg-white">
        {ready ? (
          <iframe
            key={loadKey}
            src={url}
            title="Navegador"
            className="size-full border-0"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => setLoaded(100)}
          />
        ) : (
          <div className="grid size-full place-items-center bg-neutral-100 text-neutral-500">
            <p className="text-[0.75rem]">El proceso terminó: la navegación se cortó.</p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border/60 px-2 py-1 text-[0.62rem] text-muted-foreground">
        <span className="min-w-0 flex-1 truncate font-mono">{url}</span>
        <span className="shrink-0">Cada página pasa por la cola de la tarjeta de red.</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

function SettingsApp() {
  const wallpaperId = useSystemStore((s) => s.wallpaperId)
  const setWallpaper = useSystemStore((s) => s.setWallpaper)
  const iconSize = useSystemStore((s) => s.iconSize)
  const setIconSize = useSystemStore((s) => s.setIconSize)
  const user = useSystemStore((s) => s.user)
  const memory = useSim((s) => s.memory)
  const stats = useSim((s) => s.stats)
  const processes = useSim((s) => s.processes)
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <SettingsIcon className="size-3.5" />
        <span className="text-[0.8rem] font-semibold">Configuración</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <h4 className="text-[0.78rem] font-semibold">Fondo de escritorio</h4>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WALLPAPERS.map((paper) => (
            <motion.button
              key={paper.id}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setWallpaper(paper.id)}
              title={paper.name}
              className={cn(
                "h-16 rounded-lg border-2",
                wallpaperId === paper.id
                  ? "border-indigo-500 ring-2 ring-indigo-500/30"
                  : "border-border/60",
              )}
              style={{ background: paper.value }}
              aria-label={`Fondo ${paper.name}`}
            />
          ))}
        </div>

        <h4 className="mt-5 text-[0.78rem] font-semibold">Tamaño de los iconos</h4>
        <div className="mt-2 flex gap-2">
          {(["pequeno", "mediano", "grande"] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setIconSize(size)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[0.72rem] capitalize transition-colors",
                iconSize === size
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-border/60 hover:bg-muted",
              )}
            >
              {size}
            </button>
          ))}
        </div>

        <h4 className="mt-5 text-[0.78rem] font-semibold">Apariencia</h4>
        <div className="mt-2 flex gap-2">
          {(["light", "dark", "system"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[0.72rem] transition-colors",
                theme === value
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-border/60 hover:bg-muted",
              )}
            >
              {value === "light" ? "Claro" : value === "dark" ? "Oscuro" : "Sistema"}
            </button>
          ))}
        </div>

        <h4 className="mt-5 text-[0.78rem] font-semibold">Acerca del sistema</h4>
        <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-muted/30 p-3 text-[0.72rem]">
          <p>
            <span className="text-muted-foreground">Usuario:</span> {user.name}@{user.host}
          </p>
          <p>
            <span className="text-muted-foreground">Procesos:</span> {processes.length} ·{" "}
            {stats.terminated} terminados
          </p>
          <p>
            <span className="text-muted-foreground">Memoria:</span>{" "}
            {memory.frames.filter((f) => f.pid !== null).length * memory.unitKB} /{" "}
            {memory.totalKB} KB ·{" "}
            {memory.mode === "paginacion" ? "paginación" : "particiones"}
          </p>
          <p>
            <span className="text-muted-foreground">CPU:</span> {stats.cpuCycles} ciclos ·{" "}
            {stats.contextSwitches} cambios de contexto
          </p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fotos                                                               */
/* ------------------------------------------------------------------ */

function PhotosApp() {
  const images = useSystemStore((s) => s.fs["/Imágenes"] ?? [])
  const deleteFile = useSystemStore((s) => s.deleteFile)
  const [index, setIndex] = useState(0)
  const current = images[Math.min(index, Math.max(0, images.length - 1))]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <ImageIcon className="size-3.5" />
        <span className="text-[0.78rem] font-semibold">Fotos</span>
        <span className="ml-auto text-[0.68rem] text-muted-foreground">
          {images.length} elementos
        </span>
      </div>

      {images.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
          <CameraIcon className="size-5 text-muted-foreground/60" />
          <p className="text-[0.78rem] font-medium">Sin capturas todavía</p>
          <p className="max-w-[34ch] text-[0.7rem] text-muted-foreground">
            Abre la aplicación Cámara y haz una foto: aparecerá aquí.
          </p>
        </div>
      ) : (
        <>
          <div className="grid min-h-0 flex-1 place-items-center bg-neutral-950/40 p-4">
            <motion.div
              key={current?.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid aspect-[4/3] w-full max-w-md place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 to-slate-900"
            >
              {current?.content?.startsWith("data:image") ? (
                <img
                  src={current.content}
                  alt={current.name}
                  className="size-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-300">
                  <CameraIcon className="mx-auto size-8" />
                  <p className="mt-2 font-mono text-[0.72rem]">{current?.name}</p>
                  <p className="text-[0.66rem] opacity-70">
                    {((current?.size ?? 0) / 1024).toFixed(0)} KB
                  </p>
                </div>
              )}
            </motion.div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto border-t border-border/60 p-1.5">
            {images.map((image, i) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setIndex(i)}
                onDoubleClick={() => deleteFile("/Imágenes", image.id)}
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-md border",
                  i === index ? "border-indigo-500 bg-indigo-500/10" : "border-border/60",
                )}
                aria-label={image.name}
              >
                <Thumb src={image.content} name={image.name} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Impresora                                                           */
/* ------------------------------------------------------------------ */

function WriterWindow({ process }: { process: Process }) {
  const printer = useSim((s) => s.devices.find((d) => d.kind === "impresora"))
  const addWork = useSimStore((s) => s.addWork)
  const pages = Math.max(0, process.burstTotal - process.burstRemaining)

  return (
    <div className="flex h-full flex-col">
      <StateStrip process={process} device={printer} />
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[16rem] rounded-lg border border-border/60 bg-white p-5 shadow-sm dark:bg-white/90"
        >
          {["Informe de sistemas", "", "1. Introduction", "2. Scheduling", "3. Memory"].map(
            (line, index) => (
              <p
                key={index}
                className={cn(
                  "font-serif text-[0.7rem] leading-relaxed",
                  index === 0 ? "mb-2 text-[0.85rem] font-bold" : "text-neutral-700",
                )}
              >
                {line}
              </p>
            ),
          )}
        </motion.div>
      </div>
      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={!alive(process)}
          onClick={() => addWork(process.pid, 12)}
        >
          <Printer className="size-3.5" />
          Enviar otra copia
        </Button>
        <span className="text-[0.66rem] text-muted-foreground">
          {pages} páginas · cola {printer?.queue.length ?? 0}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Terminal                                                            */
/* ------------------------------------------------------------------ */

interface Line {
  id: number
  text: string
  tone?: "info" | "error" | "ok"
}

let lineSeq = 0

function TerminalWindow({ process }: { process: Process }) {
  const sim = useSim((s) => s)
  const { launch } = useLauncher()
  const [cwd, setCwd] = useState("/")
  const [lines, setLines] = useState<Line[]>([
    { id: ++lineSeq, text: "Simulador del Sistema Operativo 1.0 — escribe `help`" },
  ])
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [lines])

  const push = (text: string, tone?: Line["tone"]) =>
    setLines((prev) => [...prev, { id: ++lineSeq, text, tone }].slice(-200))

  const run = (raw: string) => {
    const line = raw.trim()
    push(line, "info")
    if (line === "") return

    const [cmd, ...args] = line.split(/\s+/)
    const sys = useSystemStore.getState()

    switch (cmd) {
      case "help":
        push("Órdenes disponibles:")
        push("  ls [ruta] · cd <ruta> · cat <archivo> · mkdir <n> · rm <archivo>")
        push("  ps · kill <pid> · top · open <app> · power <on|off>")
        push("  neofetch · echo <texto> · clear")
        break
      case "ls": {
        const target = args[0] ?? cwd
        const entries = sys.fs[target] ?? []
        push(entries.length === 0 ? "(vacío)" : entries.map((f) => f.name).join("  "))
        break
      }
      case "cd": {
        const target = args[0] === "/" ? "/" : `${cwd}/${args[0] ?? ""}`
        if (sys.fs[target] === undefined) push(`cd: ${args[0]}: no existe`, "error")
        else {
          setCwd(target)
          push(`Ahora en ${target}`, "ok")
        }
        break
      }
      case "cat": {
        const file = (sys.fs[cwd] ?? []).find((f) => f.name === args[0])
        if (!file) push(`cat: ${args[0]}: no encontrado`, "error")
        else if (file.kind === "carpeta") push("cat: es un directorio", "error")
        else file.content.split("\n").forEach((l) => push(l))
        break
      }
      case "mkdir":
        if (args[0]) {
          sys.makeFolder(cwd, args[0])
          push(`Carpeta creada: ${args[0]}`, "ok")
        }
        break
      case "rm": {
        const file = (sys.fs[cwd] ?? []).find((f) => f.name === args[0])
        if (!file) push(`rm: ${args[0]}: no encontrado`, "error")
        else {
          sys.deleteFile(cwd, file.id)
          push(`Borrado: ${file.name}`, "ok")
        }
        break
      }
      case "ps":
        push("PID  ESTADO         CPU    NOMBRE")
        for (const p of sim.processes) {
          const usage = Math.round((p.cpuTime / Math.max(1, p.burstTotal)) * 100)
          push(
            `${String(p.pid).padEnd(4)}${stateStyles[p.state].label.padEnd(14)}${String(usage).padStart(3)}%   ${p.name}`,
          )
        }
        break
      case "kill": {
        const pid = Number(args[0])
        const target = sim.processes.find((p) => p.pid === pid)
        if (!target || target.isSystem) push("kill: proceso no válido", "error")
        else {
          useSimStore.getState().kill(pid)
          useWindowStore.getState().closeWindow(pid)
          push(`Proceso ${pid} terminado`, "ok")
        }
        break
      }
      case "top":
        push(`CPU  ${sim.stats.busyCycles}/${sim.stats.cpuCycles} ciclos`)
        push(
          `RAM  ${sim.memory.frames.filter((f) => f.pid !== null).length * sim.memory.unitKB}/${sim.memory.totalKB} KB`,
        )
        push(`PROC ${sim.processes.filter((p) => p.state !== "terminado").length} activos`)
        break
      case "open":
        if (args[0]) {
          const pid = launch(args[0])
          push(
            pid ? `Abriendo ${args[0]}…` : `App desconocida: ${args[0]}`,
            pid ? "ok" : "error",
          )
        }
        break
      case "power":
        if (args[0] === "off") sys.shutdown()
        else if (args[0] === "on") sys.powerOn()
        else if (args[0] === "restart") sys.restart()
        else push("power: usa on|off|restart", "error")
        break
      case "neofetch":
        push(`  ${sys.user.name}@${sys.user.host}`)
        push("  SO Simulado · Vite + React + TypeScript")
        push(
          `  RAM  ${sim.memory.frames.filter((f) => f.pid !== null).length * sim.memory.unitKB}/${sim.memory.totalKB} KB`,
        )
        push(`  PROC ${sim.processes.length}`)
        break
      case "echo":
        push(args.join(" "))
        break
      case "clear":
        setLines([])
        break
      default:
        push(`${cmd}: orden no reconocida. Prueba con \`help\`.`, "error")
    }
  }

  return (
    <div
        className="flex h-full flex-col bg-neutral-950"
        // Sin esto el campo no cogía el foco y las pulsaciones acababan en los
        // atajos globales («r» reiniciaba y cerraba las ventanas del escritorio).
        onPointerDown={() => inputRef.current?.focus()}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 text-[0.64rem] text-neutral-400">
          <span
            className="size-1.5 rounded-full"
            style={{ background: stateStyles[process.state].hex }}
          />
          {process.pid}@simulador - {cwd}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[0.72rem] leading-relaxed">
          {lines.map((line) => (
            <p
              key={line.id}
              className={cn(
                "whitespace-pre-wrap break-words",
                line.tone === "error"
                  ? "text-rose-400"
                  : line.tone === "ok"
                    ? "text-emerald-400"
                    : line.tone === "info"
                      ? "text-neutral-400"
                      : "text-neutral-200",
              )}
            >
              {line.text}
            </p>
          ))}
          <div className="flex items-center gap-1.5 text-emerald-300">
            <span className="shrink-0">{cwd} &gt;</span>
            <input
              ref={inputRef}
              autoFocus
              value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                run(input)
                setInput("")
              }
            }}
            className="min-w-0 flex-1 bg-transparent outline-none"
            aria-label="Entrada de la terminal"
            spellCheck={false}
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Administrador de tareas                                             */
/* ------------------------------------------------------------------ */

function TaskManager() {
  const sim = useSim((s) => s)
  const select = useSimStore((s) => s.select)
  const kill = useSimStore((s) => s.kill)
  const suspend = useSimStore((s) => s.suspend)
  const resume = useSimStore((s) => s.resume)
  const closeWindow = useWindowStore((s) => s.closeWindow)
  const focusWindow = useWindowStore((s) => s.focusWindow)
  const windows = useWindowStore((s) => s.windows)
  const [highlight, setHighlight] = useState<number | null>(null)

  const rows = [...sim.processes]
    .sort(
      (a, b) =>
        (sim.cpuPid === b.pid ? 1 : 0) - (sim.cpuPid === a.pid ? 1 : 0) || a.pid - b.pid,
    )
    .map((process) => ({
      process,
      usage: Math.round((process.cpuTime / Math.max(1, process.burstTotal)) * 100),
    }))

  const running = sim.processes.filter(
    (p) => p.state !== "terminado" && !p.isSystem,
  ).length

  return (
    <div className="flex h-full flex-col text-[0.72rem]">
      <div className="flex items-center gap-3 border-b border-border/60 bg-muted/40 px-3 py-2">
        <span className="font-semibold">Procesos</span>
        <span className="text-muted-foreground">{running} activos</span>
        <span className="text-muted-foreground">
          {sim.memory.frames.filter((f) => f.pid !== null).length * sim.memory.unitKB}/
          {sim.memory.totalKB} KB
        </span>
        <span className="ml-auto text-muted-foreground">ciclo {sim.tick}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-muted/60 text-left text-micro text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 font-medium">Nombre</th>
              <th className="px-2 py-1.5 font-medium">PID</th>
              <th className="px-2 py-1.5 font-medium">Estado</th>
              <th className="px-2 py-1.5 font-medium">CPU</th>
              <th className="px-2 py-1.5 font-medium">Memoria</th>
              <th className="px-2 py-1.5 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ process, usage }) => {
              const state = stateStyles[process.state]
              const hasWindow = windows[process.pid] !== undefined
              const isCpu = sim.cpuPid === process.pid
              return (
                <tr
                  key={process.pid}
                  onMouseEnter={() => setHighlight(process.pid)}
                  onMouseLeave={() => setHighlight(null)}
                  className={cn(
                    "border-b border-border/40 transition-colors",
                    isCpu ? "bg-amber-500/10" : "hover:bg-muted/40",
                  )}
                >
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: state.hex }}
                      />
                      <span className="truncate">{process.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono tabular-nums">{process.pid}</td>
                  <td className="px-2 py-1.5">{state.label}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1 w-10 overflow-hidden rounded-full bg-border">
                        <motion.div
                          className="h-full rounded-full bg-indigo-500"
                          animate={{ width: `${usage}%` }}
                          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                        />
                      </div>
                      <span className="tabular-nums text-muted-foreground">{usage}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {process.memoryStart >= 0 ? `${process.memoryRequired} KB` : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-0.5">
                      {hasWindow ? (
                        <button
                          type="button"
                          aria-label={`Enfocar P${process.pid}`}
                          onClick={() => {
                            select(process.pid)
                            focusWindow(process.pid)
                          }}
                          className="grid size-6 place-items-center rounded hover:bg-muted"
                        >
                          <Monitor className="size-3" />
                        </button>
                      ) : null}
                      {process.state === "suspendido" ? (
                        <button
                          type="button"
                          aria-label={`Reanudar P${process.pid}`}
                          onClick={() => resume(process.pid)}
                          className="grid size-6 place-items-center rounded hover:bg-muted"
                        >
                          <Play className="size-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Suspender P${process.pid}`}
                          disabled={process.isSystem || process.state === "terminado"}
                          onClick={() => suspend(process.pid)}
                          className="grid size-6 place-items-center rounded hover:bg-muted disabled:opacity-40"
                        >
                          <Pause className="size-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Terminar P${process.pid}`}
                        disabled={process.isSystem}
                        onClick={() => {
                          kill(process.pid)
                          if (hasWindow) closeWindow(process.pid)
                        }}
                        className="grid size-6 place-items-center rounded text-destructive hover:bg-destructive/10 disabled:opacity-40"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 border-t border-border/60 bg-muted/40 px-3 py-1.5 text-[0.66rem] text-muted-foreground">
        <span>{sim.stats.contextSwitches} cambios de contexto</span>
        <span>{sim.stats.pageFaults} fallos de página</span>
        <span>{sim.stats.ioWaits} esperas de E/S</span>
        <span className="ml-auto truncate">
          {highlight !== null
            ? `P${highlight}: ${sim.processes.find((p) => p.pid === highlight)?.name ?? ""}`
            : "Pasa el cursor por una fila"}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Registro del sistema                                                */
/* ------------------------------------------------------------------ */

function SystemLog() {
  const log = useSim((s) => s.eventLog)
  const errors = useErrorStore((s) => s.entries)
  const clearErrors = useErrorStore((s) => s.clear)
  const [tab, setTab] = useState<"eventos" | "errores">("eventos")

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-2 py-1.5">
        {(["eventos", "errores"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "rounded-md px-2 py-1 text-[0.72rem] capitalize transition-colors",
              tab === value
                ? "bg-foreground/10 font-medium"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {value}
            {value === "errores" && errors.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-destructive/15 px-1.5 text-[0.62rem] text-destructive">
                {errors.length}
              </span>
            ) : null}
          </button>
        ))}
        <span className="ml-auto text-[0.66rem] text-muted-foreground">
          {tab === "eventos" ? `${log.length} eventos` : `${errors.length} errores`}
        </span>
        {tab === "errores" && errors.length > 0 ? (
          <Button size="xs" variant="ghost" onClick={clearErrors}>
            Limpiar
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[0.68rem]">
        {tab === "eventos" ? (
          <>
            {log
              .slice(-140)
              .reverse()
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex gap-2 border-b border-border/30 px-3 py-1 last:border-0"
                >
                  <span className="shrink-0 tabular-nums text-muted-foreground/70">
                    t{entry.tick}
                  </span>
                  <span className="w-24 shrink-0 truncate text-muted-foreground">
                    {entry.category}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{entry.message}</span>
                </div>
              ))}
            {log.length === 0 ? (
              <p className="px-3 py-6 text-center text-muted-foreground">
                Aún no hay eventos. Pulsa ▶ en la barra de tareas.
              </p>
            ) : null}
          </>
        ) : errors.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted-foreground">
            Sin errores registrados. Cualquier fallo de la aplicación aparecerá aquí.
          </p>
        ) : (
          errors.map((error) => (
            <div key={error.id} className="border-b border-border/30 px-3 py-1.5">
              <div className="flex flex-wrap gap-2">
                <span className="shrink-0 rounded bg-destructive/15 px-1 text-[0.6rem] text-destructive">
                  {error.kind}
                </span>
                <span className="text-muted-foreground/70">{error.at}</span>
                <span className="text-muted-foreground/70">t{error.tick}</span>
                <span className="ml-auto text-muted-foreground/70">{error.source}</span>
              </div>
              <p className="mt-0.5 break-words text-rose-500">{error.message}</p>
              {error.stack ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[0.62rem] text-muted-foreground">
                    traza
                  </summary>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[0.6rem] text-muted-foreground/80">
                    {error.stack}
                  </pre>
                </details>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

