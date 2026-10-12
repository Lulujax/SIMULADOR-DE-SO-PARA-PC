import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Camera as CameraIcon,
  FolderPlus,
  Globe,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Pause,
  Pencil,
  Play,
  Printer,
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
import { useErrorStore } from "@/store/errorStore"
import { stateStyles } from "@/lib/palette"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  const streamRef = useRef<MediaStream | null>(null)
  const [denied, setDenied] = useState(false)
  const [shots, setShots] = useState(0)
  const writeFile = useSystemStore((s) => s.writeFile)
  const addWork = useSimStore((s) => s.addWork)
  const images = useSystemStore((s) => s.fs["/Imágenes"] ?? [])

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: true })
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = media
        if (videoRef.current) {
          videoRef.current.srcObject = media
          void videoRef.current.play().catch(() => {})
        }
      } catch {
        if (!cancelled) setDenied(true)
      }
    }
    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const capture = () => {
    const now = new Date()
    const stamp = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
    writeFile("/Imágenes", {
      name: `CAP_${stamp}.jpg`,
      kind: "imagen",
      content: streamRef.current ? "captura" : "escena-simulada",
      size: 160_000 + Math.floor(Math.random() * 120_000),
      app: "camera",
    })
    setShots((n) => n + 1)
    addWork(process.pid, 14)
  }

  return (
    <div className="flex h-full flex-col">
      <StateStrip process={process} />
      <div className="relative min-h-0 flex-1 bg-neutral-950">
        {denied ? (
          <SimulatedScene />
        ) : streamRef.current ? (
          <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-neutral-600">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[0.62rem] text-white">
          <span className="size-1.5 animate-pulse rounded-full bg-rose-500" />
          {denied ? "ESCENA SIMULADA" : "EN DIRECTO"}
        </div>

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

function SimulatedScene() {
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
      <div className="absolute inset-0 grid place-items-center">
        <VideoOff className="size-8 text-white/25" />
      </div>
      <p className="absolute inset-x-0 bottom-2 text-center text-[0.62rem] text-white/50">
        Sin cámara disponible: se simula el visor
      </p>
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
      setAc(Number(`${ac === 0 ? "" : ac}${label}`))
      setPending(null)
      return
    }

    if (label === "C") {
      setAc(0)
      setPending(null)
      return
    }
    if (label === "±") {
      setAc(-ac)
      return
    }
    if (label === "%") {
      setAc(Math.trunc(ac / 100))
      return
    }
    if (label === "=") {
      if (pending) {
        setAc(compute(pending.op, pending.left, ac))
        setPending(null)
      }
      return
    }

    const op = label as CalcOp
    if (pending) {
      const result = compute(pending.op, pending.left, ac)
      setAc(result)
      setPending({ op, left: result })
    } else {
      setPending({ op, left: ac })
    }
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

function ExplorerWindow({ process }: { process: Process }) {
  const disk = useSim((s) => s.devices.find((d) => d.kind === "disco"))
  const fs = useSystemStore((s) => s.fs)
  const makeFolder = useSystemStore((s) => s.makeFolder)
  const deleteFile = useSystemStore((s) => s.deleteFile)
  const moveFile = useSystemStore((s) => s.moveFile)
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
      setPath(`${path}/${name}`)
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
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
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
                    <ImageIcon className="size-7 text-yellow-500" />
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

function BrowserWindow({ process }: { process: Process }) {
  const net = useSim((s) => s.devices.find((d) => d.kind === "red"))
  const addWork = useSimStore((s) => s.addWork)
  const [url, setUrl] = useState("https://sistemas.university.edu")
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(0)

  function navigate() {
    if (!alive(process)) return
    setBusy(true)
    setLoaded(0)
    addWork(process.pid, 10)
    let step = 0
    const id = window.setInterval(() => {
      step += 22 + Math.random() * 24
      setLoaded(Math.min(100, step))
      if (step >= 100) {
        window.clearInterval(id)
        setBusy(false)
      }
    }, 260)
  }

  return (
    <div className="flex h-full flex-col">
      <StateStrip process={process} device={net} />
      <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5">
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && navigate()}
          className="h-7 font-mono text-[0.7rem]"
          aria-label="Dirección"
        />
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={navigate}
          disabled={!alive(process)}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Globe className="size-3.5" />
          )}
          Ir
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full rounded-full bg-cyan-500"
            animate={{ width: `${loaded}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          />
        </div>
        {loaded > 10 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="mt-4 text-[0.95rem] font-semibold">
              Sistemas Operativos: planificación y memoria
            </h3>
            {[100, 62, 78, 45, 88, 30, 70].map((width, index) => (
              <motion.div
                key={index}
                className="mt-1.5 h-2 rounded bg-muted"
                initial={{ width: 0 }}
                animate={{ width: loaded > index * 12 ? `${width}%` : 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              />
            ))}
            <p className="mt-4 text-[0.74rem] leading-relaxed text-muted-foreground">
              Cada recurso pasa por la cola de la tarjeta de red. Mientras espera, el
              proceso queda bloqueado y la CPU atiende a otro.
            </p>
          </motion.div>
        ) : null}
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
              className="grid aspect-[4/3] w-full max-w-md place-items-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900"
            >
              <div className="text-center text-slate-300">
                <CameraIcon className="mx-auto size-8" />
                <p className="mt-2 font-mono text-[0.72rem]">{current?.name}</p>
                <p className="text-[0.66rem] opacity-70">
                  {((current?.size ?? 0) / 1024).toFixed(0)} KB
                </p>
              </div>
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
                <CameraIcon className="size-4 text-muted-foreground" />
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
  const cwdRef = useRef("/")
  const [lines, setLines] = useState<Line[]>([
    { id: ++lineSeq, text: "Simulador del Sistema Operativo 1.0 — escribe `help`" },
  ])
  const [input, setInput] = useState("")
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
    const cwd = cwdRef.current

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
          cwdRef.current = target
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
        else push("power: usa on|off", "error")
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
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 text-[0.64rem] text-neutral-400">
        <span
          className="size-1.5 rounded-full"
          style={{ background: stateStyles[process.state].hex }}
        />
        {process.pid}@simulador — {cwdRef.current}
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
          <span className="shrink-0">{cwdRef.current} &gt;</span>
          <input
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

