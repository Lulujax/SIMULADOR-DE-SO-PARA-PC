import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Bell,
  ChevronUp,
  Moon,
  MonitorSmartphone,
  Pause,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react"
import { cn } from "cn"
import { APP_MAP } from "@/apps/registry"
import { useSim } from "@/hooks/useSim"
import { useSimStore } from "@/store/simStore"
import { useWindowStore } from "@/store/windowStore"
import { useUiStore } from "@/store/uiStore"
import { useSystemStore } from "@/store/systemStore"
import { stateStyles } from "@/lib/palette"
import { StartMenu } from "./StartMenu"
import { spring } from "@/lib/motion"

interface Props {
  menuOpen: boolean
  onToggleMenu: () => void
}

export function Taskbar({ menuOpen, onToggleMenu }: Props) {
  const windows = useWindowStore((s) => s.windows)
  const focusWindow = useWindowStore((s) => s.focusWindow)
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow)
  const minimizeAll = useWindowStore((s) => s.minimizeAll)
  const processes = useSim((s) => s.processes)
  const memory = useSim((s) => s.memory)
  const stats = useSim((s) => s.stats)
  const sys = useSystemStore()
  const wifi = useSystemStore((s) => s.wifi)
  const volume = useSystemStore((s) => s.volume)
  const [tray, setTray] = useState<null | "red" | "sonido" | "energia" | "notificaciones">(
    null,
  )
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Agrupar procesos visibles por aplicación
  const groups: { app: string; pids: number[]; state: string }[] = []
  const index = new Map<string, number>()
  for (const process of processes) {
    if (!process.app || process.state === "terminado") continue
    const at = index.get(process.app)
    if (at === undefined) {
      index.set(process.app, groups.length)
      groups.push({ app: process.app, pids: [process.pid], state: process.state })
    } else {
      groups[at].pids.push(process.pid)
      groups[at].state = process.state
    }
  }

  let focusedPid: number | null = null
  let topZ = -1
  for (const win of Object.values(windows)) {
    if (win.minimized) continue
    if (win.z > topZ) {
      topZ = win.z
      focusedPid = win.pid
    }
  }

  const cpu = stats.cpuCycles === 0 ? 0 : Math.round((stats.busyCycles / stats.cpuCycles) * 100)
  const usedKb = memory.frames.filter((f) => f.pid !== null).length * memory.unitKB
  const ram = Math.round((usedKb / memory.totalKB) * 100)
  const muted = volume === 0

  return (
    <>
      <StartMenu open={menuOpen} onClose={onToggleMenu} />

      <footer
        onContextMenu={(event) => event.preventDefault()}
        className="material-chrome edge-light absolute inset-x-0 bottom-0 z-40 flex h-16 items-center gap-1.5 border-t border-border/60 px-1.5"
      >
        <button
          type="button"
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          title="Inicio"
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 rounded-lg px-2.5 transition-all active:scale-95",
            menuOpen
              ? "bg-foreground text-background"
              : "hover:bg-foreground/[0.07]",
          )}
        >
          <span className="grid size-6 place-items-center rounded-md bg-indigo-500 text-[0.7rem] font-bold text-white">
            SO
          </span>
          <span className="hidden text-[0.76rem] font-medium sm:inline">Inicio</span>
        </button>

        <SimTray />

        <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {groups.length === 0 ? (
            <span className="px-2 text-[0.7rem] text-muted-foreground">
              Ninguna aplicación abierta
            </span>
          ) : (
            groups.map((group) => {
              const app = APP_MAP[group.app]
              if (!app) return null
              const win = windows[group.pids[0]]
              const active = group.pids.includes(focusedPid ?? -1)
              const state = stateStyles[group.state as keyof typeof stateStyles]
              return (
                <button
                  key={group.app}
                  type="button"
                  onClick={() => {
                    if (!win) return
                    if (win.minimized) focusWindow(group.pids[0])
                    else if (active) minimizeWindow(group.pids[0])
                    else focusWindow(group.pids[0])
                  }}
                  title={`${app.title} — clic para enfocar, clic derecho para más`}
                  className={cn(
                    "relative flex h-11 shrink-0 items-center gap-2 rounded-lg px-2.5 transition-colors",
                    active ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.05]",
                  )}
                >
                  <app.icon className="size-4 shrink-0" style={{ color: app.accent }} />
                  <span className="hidden max-w-24 truncate text-[0.72rem] md:inline">
                    {app.shortTitle ?? app.title}
                  </span>
                  <span
                    className="absolute right-1 bottom-1 left-1 h-[2px] rounded-full"
                    style={{ background: state?.hex, opacity: active ? 1 : 0.3 }}
                  />
                </button>
              )
            })
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 rounded-lg px-1">
          <TrayButton
            label={`CPU ${cpu}% · RAM ${ram}% de ${memory.totalKB} KB`}
            onClick={() => setTray(tray === "notificaciones" ? null : "notificaciones")}
            active={tray === "notificaciones"}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[0.6rem] tabular-nums text-muted-foreground">
                {now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <Bell className="size-3.5" />
              {sys.notifications.length > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-indigo-500" />
              ) : null}
            </div>
          </TrayButton>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <TrayButton
            label={wifi ? "Conectado a SO-PC-5G" : "Sin conexión a red"}
            onClick={() => setTray(tray === "red" ? null : "red")}
            active={tray === "red"}
          >
            {wifi ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          </TrayButton>
          <TrayButton
            label={muted ? "Silenciado" : `Volumen ${volume}%`}
            onClick={() => setTray(tray === "sonido" ? null : "sonido")}
            active={tray === "sonido"}
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </TrayButton>
          <TrayButton
            label="Energía y sesiones"
            onClick={() => setTray(tray === "energia" ? null : "energia")}
            active={tray === "energia"}
          >
            <Power className="size-3.5" />
          </TrayButton>
        </div>

        <TrayPanel kind={tray} onClose={() => setTray(null)} />
      </footer>
    </>
  )
}

function SimTray() {
  const running = useSimStore((s) => s.running)
  const speed = useSimStore((s) => s.speed)
  const setSpeed = useSimStore((s) => s.setSpeed)
  const tick = useSim((s) => s.tick)

  return (
    <div className="hidden shrink-0 items-center gap-0.5 rounded-lg border border-border/50 px-1 md:flex">
      <button
        type="button"
        aria-label={running ? "Pausar la simulación" : "Iniciar la simulación"}
        title={running ? "Pausar" : "Iniciar"}
        onClick={() => useSimStore.getState().toggleRun()}
        className={cn(
          "grid size-8 place-items-center rounded-md transition-colors active:scale-90",
          running
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground hover:bg-foreground/[0.07]",
        )}
      >
        {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </button>
      <button
        type="button"
        aria-label="Avanzar un ciclo"
        title="Avanzar un ciclo (→)"
        onClick={() => {
          useSimStore.getState().pause()
          useSimStore.getState().stepOnce()
        }}
        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] active:scale-90"
      >
        <SkipForward className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Reiniciar la simulación"
        title="Reiniciar (R)"
        onClick={() => useSimStore.getState().reset()}
        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] active:scale-90"
      >
        <RotateCcw className="size-3.5" />
      </button>
      <div className="flex items-center gap-1 px-1.5">
        <span className="text-[0.62rem] tabular-nums text-muted-foreground">
          t{tick}
        </span>
        <input
          type="range"
          aria-label="Velocidad de simulación"
          min={1}
          max={4}
          step={1}
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
          className="os-range w-14"
          style={
            { "--range-progress": `${((speed - 1) / 3) * 100}%` } as React.CSSProperties
          }
        />
        <span className="w-4 text-[0.62rem] tabular-nums text-muted-foreground">
          {speed}×
        </span>
      </div>
    </div>
  )
}

function TrayButton({
  children,
  label,
  onClick,
  active = false,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "relative grid size-9 place-items-center rounded-md transition-colors active:scale-90",
        active
          ? "bg-foreground/[0.1] text-foreground"
          : "text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function TrayPanel({
  kind,
  onClose,
}: {
  kind: null | "red" | "sonido" | "energia" | "notificaciones"
  onClose: () => void
}) {
  const sys = useSystemStore()
  const memory = useSim((s) => s.memory)
  const stats = useSim((s) => s.stats)
  const processes = useSim((s) => s.processes)

  const cpu = stats.cpuCycles === 0 ? 0 : Math.round((stats.busyCycles / stats.cpuCycles) * 100)
  const usedKb = memory.frames.filter((f) => f.pid !== null).length * memory.unitKB
  const ram = Math.round((usedKb / memory.totalKB) * 100)

  return (
    <AnimatePresence>
      {kind ? (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={spring}
            role="dialog"
            aria-label="Panel rápido"
            className="material-float shadow-float absolute right-2 bottom-[70px] z-50 w-[19rem] rounded-2xl border border-border/70 p-3"
          >
            {kind === "notificaciones" ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-[0.78rem] font-semibold">Notificaciones</p>
                  <span className="text-[0.66rem] text-muted-foreground">
                    {sys.notifications.length}
                  </span>
                  {sys.notifications.length > 0 ? (
                    <button
                      type="button"
                      onClick={sys.clearNotifications}
                      className="ml-auto text-[0.66rem] text-muted-foreground hover:text-foreground"
                    >
                      Limpiar
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                  {sys.notifications.length === 0 ? (
                    <p className="py-6 text-center text-[0.72rem] text-muted-foreground">
                      No hay notificaciones.
                    </p>
                  ) : (
                    sys.notifications.map((n) => (
                      <motion.button
                        key={n.id}
                        layout
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => sys.dismissNotification(n.id)}
                        className="flex w-full items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-2 text-left transition-colors hover:bg-muted/50"
                      >
                        <span
                          className={cn(
                            "mt-1 size-1.5 shrink-0 rounded-full",
                            n.tone === "ok"
                              ? "bg-emerald-500"
                              : n.tone === "aviso"
                                ? "bg-amber-500"
                                : "bg-indigo-500",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.72rem] font-medium">
                            {n.title}
                          </span>
                          <span className="block text-[0.66rem] text-muted-foreground">
                            {n.body}
                          </span>
                        </span>
                        <span className="shrink-0 text-[0.6rem] text-muted-foreground">
                          {n.at}
                        </span>
                      </motion.button>
                    ))
                  )}
                </div>
              </>
            ) : null}

            {kind === "red" ? (
              <>
                <p className="text-[0.78rem] font-semibold">Red</p>
                <button
                  type="button"
                  onClick={sys.toggleWifi}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background/60 p-2.5 text-left transition-colors hover:bg-muted/50"
                >
                  {sys.wifi ? (
                    <Wifi className="size-4 text-emerald-500" />
                  ) : (
                    <WifiOff className="size-4 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.74rem] font-medium">SO-PC-5G</span>
                    <span className="block text-[0.66rem] text-muted-foreground">
                      {sys.wifi ? "Conectado, señal fuerte" : "Sin conexión"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                      sys.wifi ? "bg-indigo-500" : "bg-border",
                    )}
                  >
                    <motion.span
                      className="absolute top-[2px] size-4 rounded-full bg-white shadow"
                      animate={{ left: sys.wifi ? 20 : 2 }}
                      transition={spring}
                    />
                  </span>
                </button>
              </>
            ) : null}

            {kind === "sonido" ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-[0.78rem] font-semibold">Sonido</p>
                  <span className="ml-auto text-[0.72rem] tabular-nums text-muted-foreground">
                    {sys.volume}%
                  </span>
                  <button
                    type="button"
                    onClick={() => sys.setVolume(sys.volume === 0 ? 60 : 0)}
                    className="grid size-7 place-items-center rounded-md hover:bg-muted"
                    aria-label={sys.volume === 0 ? "Activar sonido" : "Silenciar"}
                  >
                    {sys.volume === 0 ? (
                      <VolumeX className="size-3.5" />
                    ) : (
                      <Volume2 className="size-3.5" />
                    )}
                  </button>
                </div>
                <input
                  type="range"
                  aria-label="Volumen"
                  min={0}
                  max={100}
                  step={5}
                  value={sys.volume}
                  onChange={(event) => sys.setVolume(Number(event.target.value))}
                  className="os-range mt-2 w-full"
                  style={
                    { "--range-progress": `${sys.volume}%` } as React.CSSProperties
                  }
                />
                <div className="mt-1 flex gap-1">
                  {[0, 25, 50, 75, 100].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => sys.setVolume(v)}
                      className="flex-1 rounded-md border border-border/60 py-1 text-[0.64rem] hover:bg-muted"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {kind === "energia" ? (
              <>
                <p className="text-[0.78rem] font-semibold">Energía</p>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 p-2.5">
                  <ChevronUp className="size-4 text-emerald-500" />
                  <span className="min-w-0 flex-1 text-[0.72rem]">
                    Batería
                    <span className="block text-[0.66rem] text-muted-foreground">
                      84% · 3 h 12 min restantes
                    </span>
                  </span>
                </div>
                <div className="mt-2 space-y-0.5">
                  <PowerRow
                    label="Suspender"
                    icon={Moon}
                    onSelect={() => {
                      sys.sleep()
                      onClose()
                    }}
                  />
                  <PowerRow
                    label="Bloquear"
                    icon={MonitorSmartphone}
                    onSelect={() => {
                      sys.lock()
                      onClose()
                    }}
                  />
                  <PowerRow
                    label="Reiniciar"
                    icon={RefreshCw}
                    onSelect={() => {
                      useSimStore.getState().reset()
                      useWindowStore.getState().reset()
                      sys.restart()
                      onClose()
                    }}
                  />
                  <PowerRow
                    label="Apagar"
                    icon={Power}
                    danger
                    onSelect={() => {
                      useSimStore.getState().reset()
                      useWindowStore.getState().reset()
                      sys.shutdown()
                      onClose()
                    }}
                  />
                </div>
              </>
            ) : null}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function PowerRow({
  label,
  icon: Icon,
  onSelect,
  danger = false,
}: {
  label: string
  icon: typeof Power
  onSelect: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.74rem] transition-colors",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-foreground/[0.07]",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

export { Sun }