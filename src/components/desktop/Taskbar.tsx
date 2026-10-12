import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { MonitorSmartphone, Moon, Pause, Play, RotateCcw, Search, SkipForward, Sun } from "lucide-react"
import { cn } from "cn"
import { APPS, APP_MAP } from "@/apps/registry"
import { useLauncher } from "@/hooks/useLauncher"
import { useSim } from "@/hooks/useSim"
import { useSimStore } from "@/store/simStore"
import { useWindowStore } from "@/store/windowStore"
import { useUiStore } from "@/store/uiStore"
import { stateStyles } from "@/lib/palette"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface Props {
  open: boolean
  onToggle: () => void
}

export function Taskbar({ open, onToggle }: Props) {
  const { launch } = useLauncher()
  const windows = useWindowStore((s) => s.windows)
  const focusWindow = useWindowStore((s) => s.focusWindow)
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow)
  const minimizeAll = useWindowStore((s) => s.minimizeAll)
  const processes = useSim((s) => s.processes)
  const memory = useSim((s) => s.memory)
  const stats = useSim((s) => s.stats)
  const [search, setSearch] = useState("")

  // Sin useMemo: el snapshot del motor se muta en sitio, así que la
  // referencia del array de procesos nunca cambia y la memoización
  // devolvería datos rancios en cada tick.
  const running: { app: string; pids: number[]; state: string }[] = []
  const seen = new Map<string, number>()
  for (const process of processes) {
    if (!process.app || process.state === "terminado") continue
    const group = seen.get(process.app)
    if (group === undefined) {
      seen.set(process.app, running.length)
      running.push({ app: process.app, pids: [process.pid], state: process.state })
    } else {
      running[group].pids.push(process.pid)
      running[group].state = process.state
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

  const filtered = APPS.filter(
    (app) =>
      search.trim() === "" ||
      app.title.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <>
      <AnimatePresence>
        {open ? (
          <StartMenu
            apps={filtered}
            search={search}
            onSearch={setSearch}
            onLaunch={(key) => {
              relaunch(key)
              onToggle()
            }}
            onClose={onToggle}
          />
        ) : null}
      </AnimatePresence>

      <footer className="material-chrome edge-light absolute inset-x-0 bottom-0 z-40 flex h-16 items-center gap-2 border-t border-border/60 px-2">
        <StartButton open={open} onToggle={onToggle} />

        <TraySection label="Simulación" hint="Controla el reloj del sistema: ciclo a ciclo o en tiempo real.">
          <SimControls />
        </TraySection>

        <div className="scrollbar-none mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {running.length === 0 ? (
            <p className="px-2 text-[0.7rem] text-muted-foreground">
              No hay aplicaciones abiertas — pulsa Iniciar
            </p>
          ) : (
            running.map((group) => {
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
                    if (!win) {
                      launch(group.app)
                      return
                    }
                    if (win.minimized || active) {
                      if (win.minimized) focusWindow(group.pids[0])
                      else minimizeWindow(group.pids[0])
                    } else {
                      focusWindow(group.pids[0])
                    }
                  }}
                  className={cn(
                    "group relative flex h-11 shrink-0 items-center gap-2 rounded-lg px-2.5 transition-colors",
                    active ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.05]",
                  )}
                >
                  <app.icon className="size-4 shrink-0" style={{ color: app.accent }} />
                  <span className="max-w-24 truncate text-[0.72rem]">{app.title}</span>
                  <span className="text-[0.62rem] tabular-nums text-muted-foreground">
                    ×{group.pids.length}
                  </span>
                  <span
                    className="absolute right-1 bottom-1 left-1 h-[2px] rounded-full"
                    style={{
                      background: state?.hex,
                      opacity: active ? 1 : 0.35,
                    }}
                  />
                </button>
              )
            })
          )}
        </div>

        <TraySection
          className="hidden lg:flex"
          label="Recursos"
          hint={`CPU: ${stats.busyCycles}/${stats.cpuCycles} ciclos ocupados. RAM en uso sobre el total.`}
        >
          <ResourceGauges />
        </TraySection>

        <TraySection label="Apariencia" hint="Cambia entre el tema claro, el oscuro o el del sistema.">
          <ThemeToggle />
        </TraySection>

        <button
          type="button"
          onClick={minimizeAll}
          className="hidden h-11 shrink-0 rounded-lg px-2.5 text-[0.7rem] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground sm:block"
        >
          Mostrar escritorio
        </button>

        <Clock memory={memory.totalKB} />
      </footer>
    </>
  )
}

function StartButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 rounded-lg px-3 transition-all active:scale-95",
        open ? "bg-foreground text-background" : "hover:bg-foreground/[0.06]",
      )}
    >
      <span className="grid size-6 place-items-center rounded-md bg-indigo-500 text-[0.7rem] font-bold text-white">
        SO
      </span>
      <span className="text-[0.76rem] font-medium">Inicio</span>
    </button>
  )
}

function SimControls() {
  const running = useSimStore((s) => s.running)
  const speed = useSimStore((s) => s.speed)
  const toggleRun = useSimStore((s) => s.toggleRun)
  const stepOnce = useSimStore((s) => s.stepOnce)
  const reset = useSimStore((s) => s.reset)
  const setSpeed = useSimStore((s) => s.setSpeed)
  const tick = useSim((s) => s.tick)

  return (
    <div className="flex items-center gap-0.5">
      <TrayButton
        label={running ? "Pausar la simulación (Espacio)" : "Iniciar la simulación (Espacio)"}
        onClick={toggleRun}
        active={running}
      >
        {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </TrayButton>
      <TrayButton label="Avanzar un ciclo (→)" onClick={() => {
        useSimStore.getState().pause()
        stepOnce()
      }}>
        <SkipForward className="size-3.5" />
      </TrayButton>
      <TrayButton label="Reiniciar el sistema (R)" onClick={reset}>
        <RotateCcw className="size-3.5" />
      </TrayButton>

      <div className="ml-1 hidden items-center gap-1.5 px-1.5 md:flex">
        <span className="text-[0.64rem] tabular-nums text-muted-foreground">t{tick}</span>
        <input
          type="range"
          aria-label="Velocidad de simulación"
          min={1}
          max={4}
          step={1}
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
          className="os-range w-16"
          style={
            {
              "--range-progress": `${((speed - 1) / 3) * 100}%`,
            } as React.CSSProperties
          }
        />
        <span className="w-6 text-[0.64rem] tabular-nums text-muted-foreground">
          {speed}×
        </span>
      </div>
      <span className="px-1.5 text-[0.64rem] tabular-nums text-muted-foreground md:hidden">
        {speed}×
      </span>
    </div>
  )
}

function ResourceGauges() {
  const memory = useSim((s) => s.memory)
  const stats = useSim((s) => s.stats)
  const cpu = stats.cpuCycles === 0 ? 0 : Math.round((stats.busyCycles / stats.cpuCycles) * 100)
  const used = memory.frames.filter((f) => f.pid !== null).length * memory.unitKB
  const ram = Math.round((used / memory.totalKB) * 100)

  return (
    <div className="flex items-center gap-2 px-1.5">
      <Gauge label="CPU" value={cpu} color="#6366f1" />
      <Gauge label="RAM" value={ram} color="#0ea5e9" />
    </div>
  )
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1" title={`${label}: ${value}%`}>
      <span className="text-[0.62rem] text-muted-foreground">{label}</span>
      <div className="h-6 w-1.5 overflow-hidden rounded-full bg-border">
        <motion.div
          className="w-full rounded-full"
          style={{ background: color }}
          animate={{ height: `${value}%` }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        />
      </div>
    </div>
  )
}

function ThemeToggle() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : MonitorSmartphone

  return (
    <TrayButton
      label={`Apariencia: ${theme === "system" ? "la del sistema" : theme === "dark" ? "oscura" : "clara"}`}
      onClick={() =>
        setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")
      }
    >
      <Icon className="size-3.5" />
    </TrayButton>
  )
}

function Clock({ memory }: { memory: number }) {
  const tick = useSim((s) => s.tick)
  const now = new Date()

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 rounded-lg px-2.5 text-right">
      <div className="leading-tight">
        <p className="text-[0.72rem] font-semibold tabular-nums">
          {now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-[0.6rem] text-muted-foreground tabular-nums">
          ciclo {tick} · {memory} KB
        </p>
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
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className={cn(
              "grid size-8 place-items-center rounded-lg transition-all active:scale-90",
              active
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

function TraySection({
  children,
  label,
  hint,
  className,
}: {
  children: React.ReactNode
  label: string
  hint: string
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className={cn("flex shrink-0 items-center gap-1 rounded-lg px-1", className)} aria-label={label} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 text-center">
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}

interface MenuProps {
  apps: typeof APPS
  search: string
  onSearch: (value: string) => void
  onLaunch: (key: string) => void
  onClose: () => void
}

function StartMenu({ apps, search, onSearch, onLaunch, onClose }: MenuProps) {
  const processes = useSim((s) => s.processes)
  const countByApp: Record<string, number> = {}
  for (const process of processes) {
    if (process.app && process.state !== "terminado") {
      countByApp[process.app] = (countByApp[process.app] ?? 0) + 1
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <motion.div
        role="dialog"
        aria-label="Menú de aplicaciones"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        className="material-float shadow-float absolute bottom-[70px] left-2 z-50 w-[min(30rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-border/70"
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar aplicaciones"
            className="flex-1 bg-transparent text-[0.78rem] outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
          <p className="text-micro px-1.5 pb-1.5 text-muted-foreground/80">
            Aplicaciones instaladas
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {apps.map((app) => (
              <motion.button
                key={app.key}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                onClick={() => onLaunch(app.key)}
                className="flex flex-col items-start gap-2 rounded-xl border border-border/50 bg-background/60 p-2.5 text-left transition-colors hover:border-border hover:bg-background"
              >
                <span
                  className="grid size-8 place-items-center rounded-lg"
                  style={{ background: `${app.accent}22`, color: app.accent }}
                >
                  <app.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.76rem] font-medium">
                    {app.shortTitle ?? app.title}
                  </span>
                  <span className="block truncate text-[0.64rem] text-muted-foreground">
                    {countByApp[app.key]
                      ? `${countByApp[app.key]} abierta(s)`
                      : app.device
                        ? `Usa ${app.device}`
                        : "Sólo CPU"}
                  </span>
                </span>
              </motion.button>
            ))}
          </div>
          {apps.length === 0 ? (
            <p className="px-2 py-6 text-center text-[0.74rem] text-muted-foreground">
              Ninguna aplicación coincide con la búsqueda.
            </p>
          ) : null}

          <p className="mt-3 px-1.5 text-micro text-muted-foreground/80">
            Cada aplicación es un proceso del sistema
          </p>
          <p className="px-1.5 pt-1.5 text-[0.68rem] leading-relaxed text-muted-foreground">
            Al abrirla se crea un proceso en estado «Nuevo». El gestor de memoria le
            concede un espacio y el planificador lo saca de la cola de listos hacia la
            CPU cuando le toque.
          </p>
        </div>
      </motion.div>
    </>
  )
}