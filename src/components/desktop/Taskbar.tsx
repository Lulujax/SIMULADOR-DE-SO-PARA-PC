import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  BatteryCharging,
  BatteryFull,
  Bell,
  ChevronUp,
  Cpu,
  MonitorSmartphone,
  Moon,
  Pause,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react"
import { cn } from "cn"
import type { ProcessState } from "@/types/os"
import { APP_MAP, PINNED_APPS } from "@/apps/registry"
import { useLauncher } from "@/hooks/useLauncher"
import { useSim } from "@/hooks/useSim"
import { useSimStore } from "@/store/simStore"
import { useWindowStore } from "@/store/windowStore"
import { useUiStore } from "@/store/uiStore"
import { useSystemStore } from "@/store/systemStore"
import { stateStyles } from "@/lib/palette"
import { playTestTone, useRealHardware } from "@/lib/realHardware"
import { StartMenu } from "./StartMenu"
import { spring } from "@/lib/motion"

type Panel = null | "rapido" | "aviso"

export function Taskbar() {
  const startOpen = useUiStore((s) => s.startOpen)
  const toggleStart = useUiStore((s) => s.toggleStart)
  const { launch } = useLauncher()
  const windows = useWindowStore((s) => s.windows)
  const focusWindow = useWindowStore((s) => s.focusWindow)
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow)
  const minimizeAll = useWindowStore((s) => s.minimizeAll)
  const processes = useSim((s) => s.processes)
  const memory = useSim((s) => s.memory)
  const stats = useSim((s) => s.stats)
  const notifications = useSystemStore((s) => s.notifications)
  const [panel, setPanel] = useState<Panel>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Una instancia por aplicación; el estado del grupo es el del último proceso.
  const groups = useMemo(() => {
    const list: { app: string; pids: number[]; state: string; hasWindow: boolean }[] = []
    const index = new Map<string, number>()
    for (const process of processes) {
      if (!process.app || process.state === "terminado") continue
      const at = index.get(process.app)
      if (at === undefined) {
        index.set(process.app, list.length)
        list.push({
          app: process.app,
          pids: [process.pid],
          state: process.state,
          hasWindow: windows[process.pid] !== undefined,
        })
      } else {
        list[at].pids.push(process.pid)
        list[at].state = process.state
        if (windows[process.pid]) list[at].hasWindow = true
      }
    }
    return list
  }, [processes, windows])

  let focusedPid: number | null = null
  let topZ = -1
  for (const win of Object.values(windows)) {
    if (win.minimized) continue
    if (win.z > topZ) {
      topZ = win.z
      focusedPid = win.pid
    }
  }

  const pinnedKeys = useMemo(() => new Set(PINNED_APPS.map((a) => a.key)), [])
  const openWindows = groups.filter((g) => g.hasWindow && !pinnedKeys.has(g.app))

  const cpu =
    stats.cpuCycles === 0 ? 0 : Math.round((stats.busyCycles / stats.cpuCycles) * 100)
  const ram = Math.round(
    ((memory.frames.filter((f) => f.pid !== null).length * memory.unitKB) /
      memory.totalKB) *
      100,
  )

  return (
    <>
      <StartMenu open={startOpen} onClose={toggleStart} />

      <footer
        onContextMenu={(event) => event.preventDefault()}
        aria-label="Barra de tareas"
        // Muy por encima del z-index de las ventanas (10-999): antes, al abrir
        // suficientes apps, las ventanas tapaban la barra y quedaban inalcanzables.
        className="material-chrome edge-light absolute inset-x-0 bottom-0 z-[9000] flex h-16 items-center gap-1 border-t border-border/60 px-1.5"
      >
        <button
          type="button"
          onClick={toggleStart}
          aria-expanded={startOpen}
          aria-label="Inicio"
          title="Inicio"
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-lg transition-colors active:scale-95",
            startOpen
              ? "bg-foreground text-background"
              : "hover:bg-foreground/[0.07]",
          )}
        >
          <span className="grid size-6 place-items-center rounded-md bg-indigo-500 text-[0.7rem] font-bold text-white">
            SO
          </span>
        </button>

        <SimControls />

        <div className="mx-0.5 hidden h-8 w-px shrink-0 bg-border/70 md:block" />

        {/* Aplicaciones ancladas: visibles aunque no estén abiertas.
            En pantallas de móvil se ocultan para que la barra no desborde:
            el menú Inicio ya da acceso a todo. */}
        <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
          {PINNED_APPS.map((app) => {
            const group = groups.find((g) => g.app === app.key)
            const winPid = group?.pids.find((pid) => windows[pid] !== undefined) ?? null
            const win = winPid !== null ? windows[winPid] : undefined
            const active = win !== undefined && !win.minimized && win.pid === focusedPid
            return (
              <button
                key={app.key}
                type="button"
                title={app.title}
                aria-label={app.title}
                aria-pressed={Boolean(win)}
                onClick={() => {
                  if (!win) {
                    launch(app.key)
                    return
                  }
                  if (win.minimized) useWindowStore.getState().restoreWindow(win.pid)
                  else if (active) minimizeWindow(win.pid)
                  else focusWindow(win.pid)
                }}
                className={cn(
                  "relative grid size-10 shrink-0 place-items-center rounded-lg transition-colors active:scale-90",
                  active
                    ? "bg-foreground/[0.1]"
                    : "hover:bg-foreground/[0.07]",
                )}
              >
                <app.icon className="size-[1.15rem]" style={{ color: app.accent }} />
                {group ? (
                  <span
                    className="absolute right-1.5 bottom-1 size-1.5 rounded-full"
                    style={{ background: stateStyles[group.state as ProcessState]?.hex }}
                    title={`${group.pids.length} proceso(s) · ${stateStyles[group.state as ProcessState]?.label}`}
                  />
                ) : null}
                <span
                  className={cn(
                    "absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-foreground/60 transition-opacity",
                    win ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            )
          })}
        </div>

        {/* Ventanas abiertas que no están ancladas. */}
        {openWindows.length > 0 ? (
          <div className="mx-0.5 hidden h-8 w-px shrink-0 bg-border/70 lg:block" />
        ) : null}
        <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {openWindows.map((group) => {
            const app = APP_MAP[group.app]
            if (!app) return null
            const win = windows[group.pids.find((pid) => windows[pid] !== undefined)!]
            if (!win) return null
            const active = !win.minimized && win.pid === focusedPid
            const state = stateStyles[group.state as ProcessState]
            return (
              <button
                key={group.app}
                type="button"
                onClick={() => {
                  if (win.minimized) useWindowStore.getState().restoreWindow(win.pid)
                  else if (active) minimizeWindow(win.pid)
                  else focusWindow(win.pid)
                }}
                title={`${app.title} · ${state?.label ?? ""}`}
                className={cn(
                  "relative flex h-11 max-w-44 shrink-0 items-center gap-2 rounded-lg px-2.5 transition-colors",
                  active ? "bg-foreground/[0.1]" : "hover:bg-foreground/[0.05]",
                )}
              >
                <app.icon className="size-4 shrink-0" style={{ color: app.accent }} />
                <span className="hidden min-w-0 truncate text-[0.72rem] md:inline">
                  {app.shortTitle ?? app.title}
                </span>
                <span
                  className="absolute right-2 bottom-1 left-2 h-[2px] rounded-full"
                  style={{ background: state?.hex, opacity: active ? 1 : 0.35 }}
                />
              </button>
            )
          })}
        </div>

        <QuickPanelButton
          panel={panel}
          setPanel={setPanel}
          cpu={cpu}
          ram={ram}
          totalKB={memory.totalKB}
        />

        <TrayButton
          label={
            notifications.length > 0
              ? `${notifications.length} notificaciones`
              : "Notificaciones"
          }
          onClick={() => setPanel(panel === "aviso" ? null : "aviso")}
          active={panel === "aviso"}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[0.62rem] tabular-nums text-muted-foreground">
              {now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <Bell className="size-3.5" />
            {notifications.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-indigo-500" />
            ) : null}
          </div>
        </TrayButton>

        <button
          type="button"
          aria-label="Mostrar el escritorio"
          title="Mostrar el escritorio"
          onClick={minimizeAll}
          className="h-9 w-1 shrink-0 rounded-full border-l border-border/70 transition-colors hover:bg-foreground/10"
        />

        <AnimatePresence>
          {panel === "aviso" ? (
            <NotificationsPanel key="aviso" onClose={() => setPanel(null)} />
          ) : panel === "rapido" ? (
            <QuickPanel key="rapido" onClose={() => setPanel(null)} />
          ) : null}
        </AnimatePresence>
      </footer>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Controles de la simulación                                          */
/* ------------------------------------------------------------------ */

function SimControls() {
  const running = useSimStore((s) => s.running)
  const speed = useSimStore((s) => s.speed)
  const setSpeed = useSimStore((s) => s.setSpeed)

  return (
    <div className="hidden shrink-0 items-center gap-0.5 rounded-lg border border-border/50 px-0.5 sm:flex">
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
        title="Avanzar un ciclo"
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
        title="Reiniciar"
        onClick={() => useSimStore.getState().reset()}
        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] active:scale-90"
      >
        <RotateCcw className="size-3.5" />
      </button>
      <div className="flex items-center gap-1 px-1">
        <input
          type="range"
          aria-label="Velocidad de la simulación"
          min={1}
          max={4}
          step={1}
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
          className="os-range w-12"
          style={{ "--range-progress": ((speed - 1) / 3) * 100 + "%" } as React.CSSProperties}
        />
        <span className="w-4 text-[0.62rem] tabular-nums text-muted-foreground">{speed}x</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Indicador del sistema                                                */
/* ------------------------------------------------------------------ */

function QuickPanelButton({
  panel,
  setPanel,
  cpu,
  ram,
  totalKB,
}: {
  panel: Panel
  setPanel: (value: Panel) => void
  cpu: number
  ram: number
  totalKB: number
}) {
  const wifi = useSystemStore((s) => s.wifi)
  const volume = useSystemStore((s) => s.volume)
  const hw = useRealHardware()

  const batteryTone =
    hw.battery.supported && !hw.battery.charging && hw.battery.level < 0.2
      ? "text-red-500"
      : "text-foreground"

  return (
    <button
      type="button"
      aria-label="Ajustes rápidos"
      title={`CPU ${cpu}% · RAM ${ram}% de ${totalKB} KB · ${wifi ? "con red" : "sin red"} · volumen ${volume}%`}
      onClick={() => setPanel(panel === "rapido" ? null : "rapido")}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2.5 rounded-lg px-2.5 transition-colors active:scale-95",
        panel === "rapido" ? "bg-foreground/[0.1]" : "hover:bg-foreground/[0.07]",
      )}
    >
      <span className="hidden min-w-16 flex-col gap-1 sm:flex">
        <span className="flex items-center gap-1">
          <span className="h-1 w-8 overflow-hidden rounded-full bg-border">
            <motion.span
              className="block h-full rounded-full bg-amber-500"
              animate={{ width: `${cpu}%` }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            />
          </span>
          <span className="text-[0.58rem] tabular-nums text-muted-foreground">CPU</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1 w-8 overflow-hidden rounded-full bg-border">
            <motion.span
              className="block h-full rounded-full bg-indigo-500"
              animate={{ width: `${ram}%` }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            />
          </span>
          <span className="text-[0.58rem] tabular-nums text-muted-foreground">RAM</span>
        </span>
      </span>
      <span className="flex items-center gap-2.5">
        {wifi ? (
          <Wifi className="size-3.5" />
        ) : (
          <WifiOff className="size-3.5 opacity-50" />
        )}
        {volume === 0 ? (
          <VolumeX className="size-3.5" />
        ) : (
          <span className="flex items-center gap-0.5">
            <Volume2 className="size-3.5" />
            <span className="text-[0.6rem] tabular-nums text-muted-foreground">{volume}</span>
          </span>
        )}
        {hw.battery.supported ? (
          hw.battery.charging ? (
            <BatteryCharging className={cn("size-4", batteryTone)} />
          ) : (
            <span className={cn("flex items-center gap-0.5", batteryTone)}>
              <BatteryFull className="size-4" />
              <span className="text-[0.6rem] tabular-nums">
                {Math.round(hw.battery.level * 100)}
              </span>
            </span>
          )
        ) : null}
        <ChevronUp className="size-3 text-muted-foreground" />
      </span>
    </button>
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
        "relative grid size-10 shrink-0 place-items-center rounded-lg transition-colors active:scale-90",
        active
          ? "bg-foreground/[0.1]"
          : "text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Panel de ajustes rápidos: red, sonido real, energía y equipo        */
/* ------------------------------------------------------------------ */

function QuickPanel({ onClose }: { onClose: () => void }) {
  const sys = useSystemStore()
  const hw = useRealHardware()
  const { launch } = useLauncher()

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar los ajustes rápidos"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        transition={spring}
        role="dialog"
        aria-label="Ajustes rápidos"
        className="material-float shadow-float absolute right-2 bottom-[68px] z-50 w-[21rem] rounded-2xl border border-border/70 p-3"
      >
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={sys.toggleWifi}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-2 text-[0.62rem] font-medium transition-colors",
              sys.wifi
                ? "border-indigo-500/40 bg-indigo-500/12 text-indigo-600 dark:text-indigo-300"
                : "border-border/60 hover:bg-foreground/[0.06]",
            )}
          >
            {sys.wifi ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
            {sys.wifi ? "Conectado" : "Sin red"}
          </button>
          <button
            type="button"
            onClick={() => sys.setVolume(sys.volume === 0 ? 60 : 0)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-2 text-[0.62rem] font-medium transition-colors",
              sys.volume > 0
                ? "border-indigo-500/40 bg-indigo-500/12 text-indigo-600 dark:text-indigo-300"
                : "border-border/60 hover:bg-foreground/[0.06]",
            )}
          >
            {sys.volume > 0 ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            {sys.volume === 0 ? "Silenciado" : `Volumen ${sys.volume}%`}
          </button>
          <button
            type="button"
            onClick={() => {
              sys.lock()
              onClose()
            }}
            className="flex flex-col items-center gap-1 rounded-xl border border-border/60 p-2 text-[0.62rem] font-medium transition-colors hover:bg-foreground/[0.06]"
          >
            <MonitorSmartphone className="size-4" />
            Bloquear
          </button>
        </div>

        <div className="mt-2.5 rounded-xl border border-border/60 bg-background/60 p-2.5">
          <div className="flex items-center gap-2">
            <p className="text-[0.76rem] font-semibold">Sonido de salida real</p>
            <span className="ml-auto text-[0.72rem] tabular-nums text-muted-foreground">
              {sys.volume}%
            </span>
          </div>
          <input
            type="range"
            aria-label="Volumen de salida del equipo"
            min={0}
            max={100}
            step={5}
            value={sys.volume}
            onChange={(event) => sys.setVolume(Number(event.target.value))}
            className="os-range mt-2 w-full"
            style={{ "--range-progress": sys.volume + "%" } as React.CSSProperties}
          />
          <div className="mt-1.5 flex items-center gap-1">
            {[0, 25, 50, 75, 100].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => sys.setVolume(value)}
                className="flex-1 rounded-md border border-border/60 py-1 text-[0.62rem] tabular-nums transition-colors hover:bg-foreground/[0.07]"
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => playTestTone(523.25)}
              title="Reproducir un tono con el volumen actual"
              className="rounded-md border border-border/60 px-2 py-1 text-[0.62rem] transition-colors hover:bg-foreground/[0.07]"
            >
              Probar
            </button>
          </div>
          <p className="mt-1.5 text-[0.58rem] leading-snug text-muted-foreground">
            {hw.audio.supported
              ? hw.audio.sounding
                ? "Salida de audio del navegador activa."
                : "El motor de audio espera tu primer gesto para activarse."
              : "Este navegador no ofrece Web Audio."}{" "}
            El navegador no puede cambiar el volumen maestro del sistema operativo.
          </p>
        </div>

        <div className="mt-2.5 rounded-xl border border-border/60 bg-background/60 p-2.5">
          <p className="text-[0.76rem] font-semibold">Este equipo</p>
          <div className="mt-1.5 space-y-1 text-[0.66rem]">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Procesador</span>
              <span className="tabular-nums">
                {hw.cpu.cores} núcleos · {hw.cpu.load}% de carga
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Memoria del motor</span>
              <span className="tabular-nums">
                {hw.memory.supported
                  ? `${hw.memory.usedMB} / ${hw.memory.limitMB} MB`
                  : "no disponible"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Almacenamiento</span>
              <span className="tabular-nums">
                {hw.storage.supported
                  ? `${hw.storage.usedMB} / ${hw.storage.quotaMB} MB`
                  : "no disponible"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Batería</span>
              <span className="tabular-nums">
                {hw.battery.supported
                  ? `${Math.round(hw.battery.level * 100)}% ${
                      hw.battery.charging ? "cargando" : ""
                    }`
                  : "sin batería"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Pantalla</span>
              <span className="tabular-nums">
                {hw.screen.width}×{hw.screen.height}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              launch("hardware")
              onClose()
            }}
            className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-border/60 px-2 py-1.5 text-[0.66rem] transition-colors hover:bg-foreground/[0.07]"
          >
            <Cpu className="size-3.5" />
            Abrir «Hardware del equipo»
          </button>
        </div>

        <div className="mt-2.5 space-y-0.5">
          <PowerRow
            label="Suspender"
            icon={Moon}
            onSelect={() => {
              sys.sleep()
              onClose()
            }}
          />
          <PowerRow
            label="Reiniciar"
            icon={RefreshCw}
            onSelect={() => {
              sys.restart()
              onClose()
            }}
          />
          <PowerRow
            label="Apagar"
            icon={Power}
            danger
            onSelect={() => {
              sys.shutdown()
              onClose()
            }}
          />
        </div>
      </motion.div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Notificaciones                                                       */
/* ------------------------------------------------------------------ */

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const notifications = useSystemStore((s) => s.notifications)
  const dismiss = useSystemStore((s) => s.dismissNotification)
  const clear = useSystemStore((s) => s.clearNotifications)

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar las notificaciones"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        transition={spring}
        role="dialog"
        aria-label="Notificaciones"
        className="material-float shadow-float absolute right-2 bottom-[68px] z-50 w-[21rem] rounded-2xl border border-border/70 p-3"
      >
        <div className="flex items-center gap-2">
          <p className="text-[0.78rem] font-semibold">Notificaciones</p>
          <span className="text-[0.66rem] text-muted-foreground">{notifications.length}</span>
          {notifications.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="ml-auto text-[0.66rem] text-muted-foreground hover:text-foreground"
            >
              Limpiar
            </button>
          ) : null}
        </div>
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="py-6 text-center text-[0.72rem] text-muted-foreground">
              No hay notificaciones.
            </p>
          ) : (
            notifications.map((n) => (
              <motion.button
                key={n.id}
                layout
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => dismiss(n.id)}
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
                  <span className="block truncate text-[0.72rem] font-medium">{n.title}</span>
                  <span className="block text-[0.66rem] text-muted-foreground">{n.body}</span>
                </span>
                <span className="shrink-0 text-[0.6rem] text-muted-foreground">{n.at}</span>
              </motion.button>
            ))
          )}
        </div>
      </motion.div>
    </>
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
        danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-foreground/[0.07]",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}