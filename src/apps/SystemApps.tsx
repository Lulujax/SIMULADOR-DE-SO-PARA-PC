import "@xyflow/react/dist/style.css"
import { memo, useEffect, useMemo, useRef } from "react"
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import { motion } from "framer-motion"
import {
  Activity,
  BatteryCharging,
  BatteryFull,
  Boxes,
  Cpu,
  HardDrive,
  Keyboard,
  MemoryStick,
  Network,
  Plug,
  PlugZap,
  Printer,
  RefreshCw,
  Volume2,
  Waves,
  Zap,
} from "lucide-react"
import { cn } from "cn"
import type { Process } from "@/types/os"
import { useSim } from "@/hooks/useSim"
import { useSimStore } from "@/store/simStore"
import { useSystemStore } from "@/store/systemStore"
import { algorithmLabels, memoryModeLabels, processColor, stateStyles } from "@/lib/palette"
import { memoryUsage } from "@/lib/memory"
import {
  playTestTone,
  setRealVolume,
  useRealHardware,
} from "@/lib/realHardware"

/* ------------------------------------------------------------------ */
/* Piezas reutilizables                                                 */
/* ------------------------------------------------------------------ */

function Tile({
  label,
  value,
  sub,
  tone = "text-foreground",
}: {
  label: string
  value: string
  sub?: string
  tone?: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
      <p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-[0.92rem] font-semibold tabular-nums leading-tight", tone)}>
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[0.6rem] text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  )
}

function Bar({ percent, tone }: { percent: number; tone: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-border/70">
      <motion.div
        className="h-full rounded-full"
        style={{ background: tone }}
        animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        transition={{ type: "spring", bounce: 0, duration: 0.35 }}
      />
    </div>
  )
}

function PanelHead({
  icon: Icon,
  title,
  right,
}: {
  icon: typeof Cpu
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 pb-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <h3 className="text-[0.72rem] font-semibold">{title}</h3>
      <div className="ml-auto">{right}</div>
    </div>
  )
}

function Chip({
  children,
  tone,
  title,
}: {
  children: React.ReactNode
  tone?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6rem] font-medium tabular-nums ring-1",
        tone ?? "bg-muted text-muted-foreground ring-border/60",
      )}
    >
      {children}
    </span>
  )
}

function Btn({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2 py-1 text-[0.66rem] font-medium transition-colors active:scale-95 disabled:opacity-40",
        active
          ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
          : "border-border/60 hover:bg-foreground/[0.06]",
      )}
    >
      {children}
    </button>
  )
}

/* ================================================================== */
/* 1. Flujo del sistema (@xyflow/react)                                */
/* ================================================================== */

interface FlowData extends Record<string, unknown> {
  label: string
  hint: string
  color: string
  metric?: string
  active: boolean
}

const FlowBox = memo(function FlowBox({ data, selected }: NodeProps<Node<FlowData>>) {
  return (
    <div
      className={cn(
        "relative w-40 rounded-xl border px-3 py-2 transition-all duration-300",
        data.active
          ? "border-transparent bg-background shadow-float"
          : "border-border/70 bg-background/85",
        selected && "ring-2 ring-indigo-500/50",
      )}
      style={{
        boxShadow: data.active ? `0 0 0 1px ${data.color}, 0 8px 24px -8px ${data.color}` : undefined,
      }}
    >
      {data.active ? (
        <motion.span
          className="absolute inset-0 -z-10 rounded-xl"
          style={{ background: data.color }}
          initial={{ opacity: 0.32 }}
          animate={{ opacity: [0.32, 0.1, 0.32] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold leading-tight">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: data.color }} />
        {data.label}
      </p>
      <p className="mt-0.5 text-[0.58rem] leading-tight text-muted-foreground">{data.hint}</p>
      {data.metric ? (
        <p className="mt-1 text-[0.6rem] font-semibold tabular-nums" style={{ color: data.color }}>
          {data.metric}
        </p>
      ) : null}
    </div>
  )
})

const nodeTypes = { flowBox: FlowBox }

/** Encaja el diagrama una sola vez: los ids de los nodos nunca cambian. */
function FitOnce() {
  const { fitView } = useReactFlow()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    const id = window.setTimeout(() => {
      void fitView({ padding: 0.12 })
      done.current = true
    }, 80)
    return () => window.clearTimeout(id)
  }, [fitView])
  return null
}

export function FlowDiagram() {
  const sim = useSim((s) => s)
  const blocked = sim.blockedQueue.length
  const ready = sim.readyQueue.length
  const lastIrq = sim.interrupts[sim.interrupts.length - 1]
  const cpu = sim.cpuPid
  const lastSwap = sim.memory.swapPulse

  const { nodes, edges } = useMemo(() => {
    const running = cpu !== null
    const ioActive = sim.devices.some(
      (d) => d.status === "ocupado" || d.status === "en espera",
    )

    const defs: {
      id: string
      label: string
      hint: string
      color: string
      x: number
      y: number
      active: boolean
      metric?: string
      from?: string
      fromSide?: Position
      to?: string
      toSide?: Position
      on?: boolean
      dashed?: boolean
    }[] = [
      {
        id: "irq",
        label: "Interrupción",
        hint: "Reloj, E/S, fallo de página o sistema",
        color: "#f59e0b",
        x: 0,
        y: 40,
        active: (sim.tick % 8) === 0,
        metric: lastIrq ? `#${lastIrq.vector} ${lastIrq.kind}` : "en espera",
        to: "kernel",
      },
      {
        id: "kernel",
        label: "Núcleo",
        hint: "Guarda contexto, atiende el vector",
        color: "#818cf8",
        x: 200,
        y: 40,
        active: (sim.tick % 8) === 0 || sim.tick % 8 === 1,
        metric: `${sim.stats.interrumptions} atendidas`,
        from: "irq",
        to: "sched",
      },
      {
        id: "sched",
        label: "Planificador",
        hint: "Elige el siguiente proceso según la política",
        color: "#6366f1",
        x: 400,
        y: 40,
        active: running,
        metric: sim.config.scheduler === "roundRobin" ? `q=${sim.quantumLeft}` : sim.config.scheduler,
        from: "kernel",
        to: "ready",
      },
      {
        id: "ready",
        label: "Cola de listos",
        hint: "Procesos con memoria, esperando CPU",
        color: "#10b981",
        x: 400,
        y: 190,
        active: ready > 0,
        metric: `${ready} en espera`,
        from: "sched",
        to: "cpu",
      },
      {
        id: "cpu",
        label: "Unidad de proceso",
        hint: "ALU, PC, AC, IR, MAR, MB",
        color: "#0ea5e9",
        x: 200,
        y: 190,
        active: running,
        metric: cpu !== null ? `P${cpu} · ${sim.instruction}` : "libre",
        from: "ready",
        fromSide: Position.Left,
        to: "mem",
        on: running,
      },
      {
        id: "mem",
        label: "Gestor de memoria",
        hint: "Particiones, paginación, swap",
        color: "#34d399",
        x: 0,
        y: 190,
        active: sim.stats.pageFaults > 0 && sim.tick % 3 === 0,
        metric: `${memoryUsage(sim.memory).usedKB} KB usados`,
        from: "cpu",
        fromSide: Position.Left,
        to: "wait",
        dashed: true,
      },
      {
        id: "wait",
        label: "Cola de bloqueados",
        hint: "Esperan E/S, semáforo o mutex",
        color: "#ec4899",
        x: 0,
        y: 330,
        active: blocked > 0,
        metric: `${blocked} bloqueados`,
        from: "mem",
        fromSide: Position.Bottom,
        to: "io",
      },
      {
        id: "io",
        label: "Controladores E/S",
        hint: "Teclado, disco, red e impresora",
        color: "#06b6d4",
        x: 200,
        y: 330,
        active: ioActive,
        metric: `${sim.devices.filter((d) => d.status !== "libre").length} ocupados`,
        from: "wait",
        to: "sched",
        toSide: Position.Right,
        dashed: true,
      },
      {
        id: "swap",
        label: "Zona de intercambio",
        hint: "Procesos suspendidos escritos a disco",
        color: "#a855f7",
        x: 400,
        y: 330,
        active: lastSwap > 0,
        metric: `${sim.processes.filter((p) => p.state === "suspendido").length} suspendidos`,
        from: "mem",
        fromSide: Position.Right,
        to: "mem",
        toSide: Position.Bottom,
        dashed: true,
      },
    ]

    // Todos los nodos se dibujan; solo las flechas exigen origen y destino.
    const builtNodes: Node<FlowData>[] = defs.map((d) => ({
      id: d.id,
      type: "flowBox",
      position: { x: d.x, y: d.y },
      data: {
        label: d.label,
        hint: d.hint,
        color: d.color,
        metric: d.metric,
        active: d.active,
      },
    }))

    const builtEdges: Edge[] = defs
      .filter((d) => d.from !== undefined && d.to !== undefined)
      .map((d, index) => ({
        id: `${d.from}-${d.to}-${index}`,
        source: d.from!,
        target: d.to!,
        sourcePosition: d.fromSide ?? Position.Right,
        targetPosition: d.toSide ?? Position.Left,
        animated: Boolean(d.on),
        label: d.on ? "activo" : undefined,
        style: {
          stroke: d.on ? "#6366f1" : "rgba(148,163,184,0.45)",
          strokeWidth: d.on ? 2.2 : 1.2,
          strokeDasharray: d.dashed ? "5 4" : undefined,
        },
        labelStyle: { fontSize: 9, fill: "#6366f1", fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
      }))

    return { nodes: builtNodes, edges: builtEdges }
  }, [sim, blocked, ready, lastIrq, cpu, lastSwap])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2 text-[0.66rem]">
        <Waves className="size-3.5 text-indigo-500" />
        <span className="font-medium">Ruta activa del sistema</span>
        <Chip tone="bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 ring-indigo-500/25">
          tick {sim.tick}
        </Chip>
        <Chip>{sim.config.scheduler}</Chip>
        <Chip>{sim.quantumLeft > 0 ? `quantum ${sim.quantumLeft}` : "sin quantum"}</Chip>
        <Chip>
          {sim.stats.contextSwitches} cambios de contexto
        </Chip>
        <Chip>{sim.stats.pageFaults} fallos de página</Chip>
        <Chip>{sim.stats.ioWaits} esperas E/S</Chip>
        <span className="ml-auto text-muted-foreground">
          Arrastra los nodos · doble clic para centrar
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            minZoom={0.35}
            maxZoom={1.8}
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            nodesConnectable={false}
            className="bg-transparent"
          >
            <Background gap={18} size={1} color="rgba(148,163,184,0.22)" />
            <MiniMap
              pannable
              zoomable
              style={{ width: 132, height: 92 }}
              className="!bg-background/70"
              nodeColor={(n) => (n.data as FlowData).color}
              maskColor="rgba(0,0,0,0.12)"
            />
            <Controls showInteractive={false} className="!bg-background/80" />
            <FitOnce />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  )
}

/* ================================================================== */
/* 2. Estados y sincronización                                        */
/* ================================================================== */

const STATE_ORDER = ["nuevo", "listo", "ejecutando", "bloqueado", "suspendido", "terminado"]

export function StatesSync() {
  const sim = useSim((s) => s)
  const selected = useSimStore((s) => s.selectedPid)
  const select = useSimStore((s) => s.select)
  const suspend = useSimStore((s) => s.suspend)
  const resume = useSimStore((s) => s.resume)
  const kill = useSimStore((s) => s.kill)

  const counts = STATE_ORDER.map((state) => ({
    state: state as Process["state"],
    total: sim.processes.filter((p) => p.state === state).length,
  }))
  const max = Math.max(1, ...counts.map((c) => c.total))

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="border-b border-border/60 px-3 py-2">
        <PanelHead
          icon={Activity}
          title="Máquina de estados de los procesos"
          right={
            <span className="text-[0.62rem] text-muted-foreground">
              {sim.processes.length} procesos · tick {sim.tick}
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {counts.map((c) => {
            const style = stateStyles[c.state]
            return (
              <button
                key={c.state}
                type="button"
                onClick={() =>
                  select(
                    sim.processes.find((p) => p.state === c.state)?.pid ?? null,
                  )
                }
                className={cn(
                  "rounded-xl border border-border/60 bg-background/60 px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.05]",
                )}
              >
                <p className="flex items-center gap-1.5 text-[0.62rem] font-medium">
                  <span className={cn("size-1.5 rounded-full", style.dot)} />
                  {style.label}
                </p>
                <p
                  className="text-[1.15rem] font-semibold tabular-nums leading-tight"
                  style={{ color: style.hex }}
                >
                  {c.total}
                </p>
                <div className="mt-1">
                  <Bar percent={(c.total / max) * 100} tone={style.hex} />
                </div>
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.62rem] text-muted-foreground">
          <span className="font-medium text-foreground">Transiciones posibles:</span>
          {[
            ["nuevo", "listo", "el planificador admite el proceso"],
            ["listo", "ejecutando", "la CPU se le asigna"],
            ["ejecutando", "listo", "se agota el quantum (preemptivo)"],
            ["ejecutando", "bloqueado", "pide E/S o recurso"],
            ["bloqueado", "listo", "el dispositivo avisa con una interrupción"],
            ["bloqueado", "suspendido", "el sistema lo escribe a swap"],
            ["suspendido", "listo", "swap in: vuelve de disco"],
            ["ejecutando", "terminado", "ejecuta HALT"],
          ].map(([from, to, why]) => (
            <Chip key={`${from}-${to}`} title={why}>
              <span style={{ color: stateStyles[from as Process["state"]].hex }}>
                {stateStyles[from as Process["state"]].short}
              </span>
              <span className="opacity-60">→</span>
              <span style={{ color: stateStyles[to as Process["state"]].hex }}>
                {stateStyles[to as Process["state"]].short}
              </span>
              <span className="font-normal text-muted-foreground">{why}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-2">
        <section>
          <PanelHead icon={Boxes} title="Procesos por estado" />
          <div className="max-h-64 space-y-1 overflow-auto pr-1">
            {sim.processes.length === 0 ? (
              <p className="py-6 text-center text-[0.7rem] text-muted-foreground">
                Abre una aplicación desde el escritorio o la barra de tareas.
              </p>
            ) : (
              [...sim.processes]
                .sort((a, b) => a.pid - b.pid)
                .map((p) => {
                  const style = stateStyles[p.state]
                  const done = p.burstTotal - p.burstRemaining
                  return (
                    <div
                      key={p.pid}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
                        selected === p.pid
                          ? "border-indigo-500/50 bg-indigo-500/10"
                          : "border-border/60 bg-background/60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => select(selected === p.pid ? null : p.pid)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: processColor(p.pid) }}
                        />
                        <span className="shrink-0 text-[0.62rem] tabular-nums text-muted-foreground">
                          P{p.pid}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[0.7rem] font-medium">
                          {p.name}
                        </span>
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[0.58rem] font-semibold"
                          style={{
                            background: `${style.hex}22`,
                            color: style.hex,
                          }}
                        >
                          {style.label}
                        </span>
                      </button>
                      {p.state === "suspendido" ? (
                        <Btn onClick={() => resume(p.pid)} title="Traer de swap">
                          Reactivar
                        </Btn>
                      ) : (
                        <Btn onClick={() => suspend(p.pid)} title="Escribir a swap">
                          Suspender
                        </Btn>
                      )}
                      <Btn onClick={() => kill(p.pid)} title="Terminar proceso">
                        Terminar
                      </Btn>
                      <span className="w-12 shrink-0 text-right text-[0.58rem] tabular-nums text-muted-foreground">
                        {Math.round((done / Math.max(1, p.burstTotal)) * 100)}%
                      </span>
                    </div>
                  )
                })
            )}
          </div>
        </section>

        <div className="space-y-3">
          <section>
            <PanelHead
              icon={Activity}
              title="Registro de transiciones"
              right={
                <span className="text-[0.62rem] text-muted-foreground">
                  {sim.transitions.length} registradas
                </span>
              }
            />
            <div className="max-h-52 space-y-1 overflow-auto rounded-lg border border-border/60 bg-background/40 p-1.5 pr-1">
              {[...sim.transitions]
                .reverse()
                .slice(0, 60)
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex items-baseline gap-1.5 text-[0.62rem] leading-snug"
                  >
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      t{t.tick}
                    </span>
                    <span
                      className="shrink-0 font-semibold"
                      style={{ color: stateStyles[t.from].hex }}
                    >
                      {stateStyles[t.from].short}
                    </span>
                    <span className="opacity-50">→</span>
                    <span
                      className="shrink-0 font-semibold"
                      style={{ color: stateStyles[t.to].hex }}
                    >
                      {stateStyles[t.to].short}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      P{t.pid}: {t.reason}
                    </span>
                  </div>
                ))}
              {sim.transitions.length === 0 ? (
                <p className="py-4 text-center text-[0.68rem] text-muted-foreground">
                  Aún no hay transiciones.
                </p>
              ) : null}
            </div>
          </section>

          <section>
            <PanelHead
              icon={Plug}
              title="Semáforos, mutex y contadores compartidos"
            />
            <div className="space-y-1.5">
              {sim.semaphores.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5"
                >
                  <PlugZap className="size-3.5 shrink-0 text-emerald-500" />
                  <span className="min-w-0 flex-1 truncate text-[0.68rem] font-medium">
                    {s.name}
                  </span>
                  <Chip
                    tone={
                      s.count > 0
                        ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 ring-emerald-500/25"
                        : "bg-red-500/12 text-red-600 dark:text-red-300 ring-red-500/25"
                    }
                  >
                    {s.count}/{s.initial} disponibles
                  </Chip>
                  <Chip>{s.waiting.length} esperando</Chip>
                </div>
              ))}
              {sim.mutexes.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5"
                >
                  <Plug className="size-3.5 shrink-0 text-indigo-500" />
                  <span className="min-w-0 flex-1 truncate text-[0.68rem] font-medium">
                    {m.name}
                  </span>
                  <Chip
                    tone={
                      m.owner !== null
                        ? "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 ring-indigo-500/25"
                        : undefined
                    }
                  >
                    {m.owner !== null ? `lo tiene P${m.owner}` : "libre"}
                  </Chip>
                  <Chip>{m.queue.length} en cola</Chip>
                  <Chip>{m.acquisitions} adquisiciones</Chip>
                </div>
              ))}
              {Object.entries(sim.sharedCounters)
                .filter(([key]) => !key.startsWith("__"))
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5"
                  >
                    <MemoryStick className="size-3.5 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1 truncate text-[0.68rem] font-medium">
                      {key}
                    </span>
                    <Chip tone="bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-500/25">
                      {value}
                    </Chip>
                  </div>
                ))}
              {sim.semaphores.length === 0 &&
              sim.mutexes.length === 0 &&
              Object.keys(sim.sharedCounters).length === 0 ? (
                <p className="py-4 text-center text-[0.68rem] text-muted-foreground">
                  Los procesos que compartan un recurso crean semáforos y mutex aquí.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* 3. Gestor de memoria                                                */
/* ================================================================== */

export function MemoryManager() {
  const mem = useSim((s) => s.memory)
  const processes = useSim((s) => s.processes)
  const store = useSimStore.getState()
  const usage = memoryUsage(mem)
  const partitionUnits = Math.max(
    1,
    Math.round(mem.staticPartitionKB / mem.unitKB),
  )
  const partitionCount = Math.floor(mem.frames.length / partitionUnits)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-3 py-2">
        <MemoryStick className="size-3.5 text-emerald-500" />
        <span className="mr-1 text-[0.66rem] font-medium">Gestión</span>
        <Btn
          active={mem.mode === "paginacion"}
          onClick={() => useSimStore.getState().setMode("paginacion")}
        >
          Paginación
        </Btn>
        <Btn
          active={mem.mode === "continua"}
          onClick={() => useSimStore.getState().setMode("continua")}
        >
          Particiones
        </Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        {mem.mode === "continua" ? (
          <>
            <Btn
              active={mem.continuousKind === "estatica"}
              onClick={() => useSimStore.getState().setContinuousKind("estatica")}
            >
              Estáticas
            </Btn>
            <Btn
              active={mem.continuousKind === "dinamica"}
              onClick={() => useSimStore.getState().setContinuousKind("dinamica")}
            >
              Dinámicas
            </Btn>
            {mem.continuousKind === "dinamica" ? (
              <>
                <span className="mx-1 h-4 w-px bg-border" />
                {(["first-fit", "best-fit", "next-fit"] as const).map((a) => (
                  <Btn
                    key={a}
                    active={mem.algorithm === a}
                    onClick={() => useSimStore.getState().setAlgorithm(a)}
                  >
                    {algorithmLabels[a]}
                  </Btn>
                ))}
                <Btn
                  onClick={() => useSimStore.getState().compact()}
                  title="Reubicar los bloques y eliminar la fragmentación externa"
                >
                  Compactar
                </Btn>
              </>
            ) : (
              <span className="ml-1 text-[0.62rem] text-muted-foreground">
                Partición fija de {mem.staticPartitionKB} KB × {partitionCount}
              </span>
            )}
          </>
        ) : null}
        <span className="mx-1 h-4 w-px bg-border" />
        {[4, 8, 16, 32].map((unit) => (
          <Btn
            key={unit}
            active={mem.unitKB === unit}
            onClick={() => useSimStore.getState().setUnitKB(unit)}
          >
            {unit} KB
          </Btn>
        ))}
        <Btn
          active={mem.swapEnabled}
          onClick={() => useSimStore.getState().setSwapEnabled(!mem.swapEnabled)}
          title="Permitir que el sistema escriba procesos a disco para liberar memoria"
        >
          Intercambio
        </Btn>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Total" value={`${mem.totalKB} KB`} sub={`${mem.frames.length} marcos`} />
        <Tile
          label="Usada"
          value={`${usage.usedKB} KB`}
          sub={`${usage.usedPercent.toFixed(1)}% del total`}
          tone="text-emerald-500"
        />
        <Tile label="Libre" value={`${usage.freeKB} KB`} sub={`${usage.freeRuns} bloques`} />
        <Tile
          label="Fragmentación interna"
          value={`${mem.internalKB} KB`}
          sub="desperdicio dentro de la partición"
          tone={mem.internalKB > 0 ? "text-amber-500" : undefined}
        />
        <Tile
          label="Fragmentación externa"
          value={`${mem.externalKB} KB`}
          sub="huecos entre bloques ocupados"
          tone={mem.mode === "continua" && mem.externalKB > 0 ? "text-amber-500" : undefined}
        />
      </div>

      <div className="px-3">
        <PanelHead
          icon={Boxes}
          title={memoryModeLabels[mem.mode]}
          right={
            <span className="text-[0.62rem] text-muted-foreground">
              {mem.mode === "paginacion"
                ? `Página de ${mem.unitKB} KB · sin fragmentación externa`
                : mem.continuousKind === "estatica"
                  ? `${partitionCount} particiones de ${mem.staticPartitionKB} KB`
                  : `Bloques contiguos · ${algorithmLabels[mem.algorithm]}`}
            </span>
          }
        />
        <div className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-background/40 p-2">
          {mem.frames.map((frame) => {
            const proc = frame.pid !== null ? processes.find((p) => p.pid === frame.pid) : null
            const color = frame.pid !== null ? processColor(frame.pid) : "#64748b"
            const inStaticPartition =
              mem.mode === "continua" && frame.index % partitionUnits === 0
            const size = mem.mode === "continua" && inStaticPartition ? partitionUnits : 1
            const width = size === 1 ? undefined : `${Math.min(340, size * 26)}px`
            return (
              <motion.div
                key={frame.index}
                layout
                className={cn(
                  "relative flex h-9 shrink-0 items-center justify-center rounded-md border text-[0.6rem] font-semibold tabular-nums transition-colors",
                  inStaticPartition &&
                    frame.index / partitionUnits >
                      0 &&
                    "ml-1 border-dashed",
                )}
                style={{
                  width,
                  background: frame.pid !== null ? `${color}2e` : "transparent",
                  borderColor: frame.pid !== null ? `${color}99` : "rgba(148,163,184,0.28)",
                  color: frame.pid !== null ? color : "rgba(148,163,184,0.65)",
                }}
                title={
                  frame.pid !== null
                    ? `Marco ${frame.index}: P${frame.pid}${proc ? ` (${proc.name})` : ""}${frame.refBit ? " · referenciado" : ""}${frame.dirty ? " · modificado" : ""}`
                    : `Marco ${frame.index}: libre`
                }
              >
                {size === 1 ? (
                  <span>{frame.pid !== null ? `P${frame.pid}` : frame.index}</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span>P{frame.pid ?? "·"}</span>
                    <span className="text-[0.55rem] opacity-70">
                      part. {Math.floor(frame.index / partitionUnits) + 1}
                    </span>
                  </span>
                )}
                {frame.refBit ? (
                  <span className="absolute top-0.5 right-0.5 size-1 rounded-full bg-amber-400" />
                ) : null}
                {frame.dirty ? (
                  <span className="absolute right-0.5 bottom-0.5 size-1 rounded-full bg-red-400" />
                ) : null}
              </motion.div>
            )
          })}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.58rem] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-amber-400" /> bit de referencia
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-red-400" /> bit de modificación
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded-sm border border-dashed border-border" /> inicio de
            partición
          </span>
        </div>
      </div>

      <div className="px-3 pb-3">
        <PanelHead
          icon={HardDrive}
          title={mem.mode === "paginacion" ? "Tablas de páginas" : "Bloques asignados"}
          right={
            <span className="text-[0.62rem] text-muted-foreground">
              compactaciones: {mem.compactionPulse} · intercambios: {mem.swapPulse}
            </span>
          }
        />
        <div className="max-h-52 overflow-auto rounded-lg border border-border/60">
          <table className="w-full text-left text-[0.64rem]">
            <thead className="sticky top-0 bg-background/95 text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-2 py-1.5 font-medium">PID</th>
                <th className="px-2 py-1.5 font-medium">Proceso</th>
                <th className="px-2 py-1.5 font-medium">Solicita</th>
                <th className="px-2 py-1.5 font-medium">Ocupado</th>
                <th className="px-2 py-1.5 font-medium">
                  {mem.mode === "paginacion" ? "Tabla de páginas" : "Dirección"}
                </th>
              </tr>
            </thead>
            <tbody>
              {processes
                .filter((p) => p.allocatedUnits > 0 || p.state === "suspendido")
                .map((p) => {
                  const occupied = p.allocatedUnits * mem.unitKB
                  return (
                    <tr
                      key={p.pid}
                      className="border-t border-border/50 hover:bg-foreground/[0.04]"
                    >
                      <td className="px-2 py-1 tabular-nums" style={{ color: processColor(p.pid) }}>
                        P{p.pid}
                      </td>
                      <td className="max-w-36 truncate px-2 py-1">{p.name}</td>
                      <td className="px-2 py-1 tabular-nums">{p.memoryRequired} KB</td>
                      <td className="px-2 py-1 tabular-nums">
                        {occupied} KB
                        {occupied > p.memoryRequired ? (
                          <span className="ml-1 text-amber-500">
                            +{occupied - p.memoryRequired} int.
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1 font-mono text-[0.6rem] text-muted-foreground">
                        {mem.mode === "paginacion"
                          ? p.pageTable.length > 0
                            ? p.pageTable.join(" · ")
                            : "—"
                          : p.memoryStart >= 0
                            ? `marco ${p.memoryStart} (${p.allocatedUnits} unidades)`
                            : "—"}
                      </td>
                    </tr>
                  )
                })}
              {processes.every((p) => p.allocatedUnits === 0) ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                    Ningún proceso tiene memoria asignada todavía.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[0.58rem] text-muted-foreground">
          Simulación: {store.sim.stats.pageFaults} fallos de página ·{" "}
          {store.sim.stats.swaps} escrituras a swap.
        </p>
      </div>
    </div>
  )
}

/* ================================================================== */
/* 4. Hardware del equipo (real + simulado)                            */
/* ================================================================== */

export function HardwarePanel() {
  const hw = useRealHardware()
  const devices = useSim((s) => s.devices)
  const stats = useSim((s) => s.stats)
  const processes = useSim((s) => s.processes)
  const injectIo = useSimStore((s) => s.injectIo)
  const volume = useSystemStore((s) => s.volume)
  const setVolume = useSystemStore((s) => s.setVolume)

  const cpuPercent =
    stats.cpuCycles === 0 ? 0 : Math.round((stats.busyCycles / stats.cpuCycles) * 100)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <Cpu className="size-3.5 text-amber-500" />
        <h3 className="text-[0.72rem] font-semibold">Este equipo</h3>
        <Chip tone="bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 ring-emerald-500/25">
          datos leídos del navegador
        </Chip>
        <span className="ml-auto truncate text-[0.6rem] text-muted-foreground">
          {hw.userAgent.slice(0, 80)}
        </span>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <p className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-wide text-muted-foreground">
            <Cpu className="size-3" /> Procesador real
          </p>
          <p className="mt-1 text-[0.92rem] font-semibold tabular-nums">
            {hw.cpu.cores} núcleos lógicos
          </p>
          <div className="mt-1.5">
            <Bar percent={hw.cpu.load} tone="#f59e0b" />
          </div>
          <p className="mt-1 text-[0.6rem] text-muted-foreground">
            Carga del hilo principal: {hw.cpu.load}%
          </p>
          <div className="mt-2 border-t border-border/60 pt-2">
            <p className="text-[0.6rem] text-muted-foreground">CPU del simulador</p>
            <p className="text-[0.78rem] font-semibold tabular-nums text-indigo-500">
              {cpuPercent}% · {stats.busyCycles}/{stats.cpuCycles} ciclos
            </p>
            <p className="text-[0.6rem] text-muted-foreground">
              {processes.filter((p) => p.state === "ejecutando").length} proceso en la ALU
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <p className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-wide text-muted-foreground">
            <MemoryStick className="size-3" /> Memoria real
          </p>
          {hw.memory.supported ? (
            <>
              <p className="mt-1 text-[0.92rem] font-semibold tabular-nums">
                {hw.memory.usedMB} MB de {hw.memory.limitMB} MB
              </p>
              <div className="mt-1.5">
                <Bar
                  percent={(hw.memory.usedMB / Math.max(1, hw.memory.limitMB)) * 100}
                  tone="#34d399"
                />
              </div>
              <p className="mt-1 text-[0.6rem] text-muted-foreground">
                Montículo del motor JavaScript (performance.memory)
              </p>
            </>
          ) : (
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              El navegador no expone la memoria del proceso. Se muestra la del simulador.
            </p>
          )}
          <div className="mt-2 border-t border-border/60 pt-2">
            <p className="text-[0.6rem] text-muted-foreground">Disco disponible (origen)</p>
            {hw.storage.supported ? (
              <p className="text-[0.78rem] font-semibold tabular-nums">
                {hw.storage.usedMB} MB usados de {hw.storage.quotaMB} MB
              </p>
            ) : (
              <p className="text-[0.7rem] text-muted-foreground">No disponible</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <p className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-wide text-muted-foreground">
            {hw.network.online ? (
              <Network className="size-3" />
            ) : (
              <Network className="size-3 opacity-50" />
            )}{" "}
            Red y energía
          </p>
          <p className="mt-1 text-[0.92rem] font-semibold">
            {hw.network.online ? "Conectado a internet" : "Sin conexión"}
          </p>
          <p className="text-[0.6rem] text-muted-foreground">
            Tipo declarado: {hw.network.type}
            {hw.network.downlink ? ` · ${hw.network.downlink} Mbit/s de bajada` : ""}
          </p>
          <div className="mt-2 flex items-center gap-2 border-t border-border/60 pt-2">
            {hw.battery.supported ? (
              <>
                {hw.battery.charging ? (
                  <BatteryCharging className="size-4 text-emerald-500" />
                ) : (
                  <BatteryFull className="size-4 text-amber-500" />
                )}
                <div className="flex-1">
                  <p className="text-[0.72rem] font-semibold tabular-nums">
                    {Math.round(hw.battery.level * 100)}%{" "}
                    {hw.battery.charging ? "cargando" : "de batería"}
                  </p>
                  <Bar percent={hw.battery.level * 100} tone="#22c55e" />
                </div>
              </>
            ) : (
              <p className="text-[0.66rem] text-muted-foreground">
                Este equipo no informa de batería.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <p className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-wide text-muted-foreground">
            <Zap className="size-3" /> Salida de audio real
          </p>
          <p className="mt-1 text-[0.92rem] font-semibold tabular-nums">
            {volume}%
            {volume === 0 ? " (silenciado)" : ""}
          </p>
          <input
            type="range"
            aria-label="Volumen real del equipo"
            min={0}
            max={100}
            step={5}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="os-range mt-1.5 w-full"
            style={{ "--range-progress": volume + "%" } as React.CSSProperties}
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <Volume2 className="size-3.5 text-muted-foreground" />
            <Btn onClick={() => playTestTone(440)} title="Reproducir un tono con el volumen actual">
              Probar tono
            </Btn>
            <Btn onClick={() => setRealVolume(volume / 100)} title="Reaplicar el volumen">
              <RefreshCw className="size-3" />
            </Btn>
          </div>
          <p className="mt-1.5 text-[0.58rem] leading-snug text-muted-foreground">
            El control mueve la ganancia del AudioContext de este navegador. No es posible
            cambiar el volumen maestro del sistema operativo desde una web.
          </p>
        </div>
      </div>

      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Pantalla"
          value={`${hw.screen.width} × ${hw.screen.height}`}
          sub={`${hw.screen.colorDepth} bits de color · escala ${hw.screen.pixelRatio}×`}
        />
        <Tile
          label="Almacenamiento"
          value={hw.storage.supported ? `${hw.storage.usedMB} MB` : "No disponible"}
          sub="navigator.storage.estimate()"
        />
        <Tile
          label="E/S simulada"
          value={`${stats.ioWaits} esperas`}
          sub={`${stats.interrumptions} interrupciones atendidas`}
        />
        <Tile
          label="Transferencias"
          value={`${stats.swaps} a swap`}
          sub={`${stats.contextSwitches} cambios de contexto`}
        />
      </div>

      <div className="px-3 pb-3">
        <PanelHead
          icon={HardDrive}
          title="Periféricos simulados del sistema"
          right={<span className="text-[0.62rem] text-muted-foreground">Pide una E/S real</span>}
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {devices.map((device) => {
            const Icon =
              device.kind === "teclado"
                ? Keyboard
                : device.kind === "disco"
                  ? HardDrive
                  : device.kind === "red"
                    ? Network
                    : Printer
            const statusTone: Record<string, { text: string; chip: string }> = {
              libre: {
                text: "text-emerald-500",
                chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 ring-emerald-500/25",
              },
              ocupado: {
                text: "text-amber-500",
                chip: "bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-500/25",
              },
              "en espera": {
                text: "text-indigo-500",
                chip: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 ring-indigo-500/25",
              },
              averiado: {
                text: "text-red-500",
                chip: "bg-red-500/12 text-red-600 dark:text-red-300 ring-red-500/25",
              },
            }
            const tone = statusTone[device.status] ?? statusTone.libre
            return (
              <div
                key={device.id}
                className="rounded-xl border border-border/60 bg-background/60 p-2.5"
              >
                <p className="flex items-center gap-1.5 text-[0.68rem] font-medium">
                  <Icon className={cn("size-3.5 shrink-0", tone.text)} />
                  <span className="min-w-0 flex-1 truncate">{device.name}</span>
                </p>
                <p className="mt-0.5 text-[0.58rem] leading-snug text-muted-foreground">
                  {device.description}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <Chip tone={tone.chip}>{device.status}</Chip>
                  <Chip>{device.queue.length} en cola</Chip>
                  <Chip>{device.completed} completadas</Chip>
                </div>
                {device.active ? (
                  <p className="mt-1 truncate text-[0.58rem] text-muted-foreground">
                    {device.active.kind === "escritura" ? "Escribiendo" : "Leyendo"}: P
                    {device.active.pid} · {device.active.op}
                  </p>
                ) : null}
                <div className="mt-1.5">
                  <Btn onClick={() => injectIo(device.id)} title={`Inyectar E/S en ${device.name}`}>
                    Solicitar E/S
                  </Btn>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* 5. Monitor de red                                                   */
/* ================================================================== */

export function NetworkMonitor() {
  const hw = useRealHardware()
  const devices = useSim((s) => s.devices)
  const history = useSim((s) => s.usageHistory)
  const wifi = useSystemStore((s) => s.wifi)
  const toggleWifi = useSystemStore((s) => s.toggleWifi)
  const injectIo = useSimStore((s) => s.injectIo)

  const nic = devices.find((d) => d.kind === "red")
  const samples = history.slice(-40)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="grid gap-2 p-3 sm:grid-cols-3">
        <Tile
          label="Estado real del navegador"
          value={hw.network.online ? "Conectado" : "Sin conexión"}
          sub="navigator.onLine + eventos online/offline"
          tone={hw.network.online ? "text-emerald-500" : "text-red-500"}
        />
        <Tile
          label="Tipo de conexión"
          value={hw.network.type}
          sub={
            hw.network.downlink !== null
              ? `${hw.network.downlink} Mbit/s de bajada estimada`
              : "el navegador no declara ancho de banda"
          }
        />
        <Tile
          label="Adaptador simulado"
          value={wifi ? "SO-PC-5G" : "Desconectado"}
          sub={wifi ? "señal fuerte" : "sin enlace"}
          tone={wifi ? "text-indigo-500" : "text-red-500"}
        />
      </div>

      <div className="px-3">
        <PanelHead icon={Activity} title="Actividad de la CPU simulada" />
        <div className="flex h-24 items-end gap-0.5 rounded-xl border border-border/60 bg-background/40 p-2">
          {samples.length === 0 ? (
            <p className="w-full text-center text-[0.66rem] text-muted-foreground">
              Inicia la simulación para ver el grafico.
            </p>
          ) : (
            samples.map((value, index) => (
              <motion.div
                key={index}
                className="flex-1 rounded-t bg-indigo-500/70"
                initial={{ height: 2 }}
                animate={{ height: `${Math.max(4, Math.min(100, value))}%` }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              />
            ))
          )}
        </div>
      </div>

      {nic ? (
        <div className="p-3">
          <div className="flex items-center gap-2 pb-2">
            <Network className="size-3.5 text-cyan-500" />
            <h3 className="text-[0.72rem] font-semibold">{nic.name}</h3>
            <Chip
              tone={
                nic.status === "libre"
                  ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 ring-emerald-500/25"
                  : "bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-500/25"
              }
            >
              {nic.status}
            </Chip>
            <div className="ml-auto flex gap-1.5">
              <Btn onClick={toggleWifi} active={wifi}>
                {wifi ? "Desconectar" : "Conectar"}
              </Btn>
              <Btn onClick={() => injectIo(nic.id)}>Solicitar E/S</Btn>
            </div>
          </div>
          <p className="pb-2 text-[0.64rem] text-muted-foreground">{nic.description}</p>
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-left text-[0.64rem]">
              <thead className="bg-background/95 text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-2 py-1.5 font-medium">ID</th>
                  <th className="px-2 py-1.5 font-medium">PID</th>
                  <th className="px-2 py-1.5 font-medium">Operación</th>
                  <th className="px-2 py-1.5 font-medium">Tipo</th>
                  <th className="px-2 py-1.5 font-medium">Progreso</th>
                </tr>
              </thead>
              <tbody>
                {[...(nic.active ? [nic.active] : []), ...nic.queue].map((req) => (
                  <tr key={req.id} className="border-t border-border/50">
                    <td className="px-2 py-1 tabular-nums text-muted-foreground">#{req.id}</td>
                    <td className="px-2 py-1 tabular-nums">P{req.pid}</td>
                    <td className="px-2 py-1 font-mono text-[0.6rem]">{req.op}</td>
                    <td className="px-2 py-1">{req.kind}</td>
                    <td className="px-2 py-1">
                      <Bar
                        percent={
                          ((req.total - req.remaining) / Math.max(1, req.total)) * 100
                        }
                        tone="#06b6d4"
                      />
                    </td>
                  </tr>
                ))}
                {!nic.active && nic.queue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                      La cola de la tarjeta de red está vacía.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}