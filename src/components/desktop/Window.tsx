import { useEffect, useRef, useState } from "react"
import { animate, motion, useMotionValue } from "framer-motion"
import { Maximize2, Minus, X } from "lucide-react"
import { cn } from "cn"
import { getApp } from "@/apps/registry"
import { useWindowStore } from "@/store/windowStore"
import { useSimStore } from "@/store/simStore"
import { useSim } from "@/hooks/useSim"
import { project, rubberband, velocityFrom, type Sample } from "@/lib/gestures"
import { stateStyles } from "@/lib/palette"
import { AppContent } from "@/apps/AppContent"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface Props {
  pid: number
  bounds: { width: number; height: number }
  isFocused: boolean
}

const TASKBAR_HEIGHT = 64
const EDGE_SNAP = 12

type SnapHint = "max" | "left" | "right" | null

export function Window({ pid, bounds, isFocused }: Props) {
  const win = useWindowStore((s) => s.windows[pid])
  const focusWindow = useWindowStore((s) => s.focusWindow)
  const closeWindow = useWindowStore((s) => s.closeWindow)
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow)
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize)
  const commitBox = useWindowStore((s) => s.commitBox)
  const kill = useSimStore((s) => s.kill)

  const process = useSim((s) => s.processes.find((p) => p.pid === pid))
  const app = process ? getApp(process) : undefined

  const x = useMotionValue(win?.x ?? 0)
  const y = useMotionValue(win?.y ?? 0)
  const width = useMotionValue(win?.width ?? 400)
  const height = useMotionValue(win?.height ?? 300)
  const dragScale = useMotionValue(1)

  const samples = useRef<Sample[]>([])
  const grab = useRef({ dx: 0, dy: 0 })
  const dragging = useRef(false)
  const [snapHint, setSnapHint] = useState<SnapHint>(null)

  const maxBounds = {
    x: 0,
    y: 0,
    width: bounds.width,
    height: bounds.height - TASKBAR_HEIGHT,
  }

  useEffect(() => {
    if (!win || dragging.current || win.minimized) return
    x.set(win.maximized ? maxBounds.x : win.x)
    y.set(win.maximized ? maxBounds.y : win.y)
    width.set(win.maximized ? maxBounds.width : win.width)
    height.set(win.maximized ? maxBounds.height : win.height)
    // maxBounds deriva de `bounds`, que cambia sólo al redimensionar la ventana
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win, x, y, width, height, bounds.width, bounds.height])

  const snapTo = (hint: Exclude<SnapHint, null>) => {
    if (hint === "max") {
      toggleMaximize(pid, maxBounds)
      return
    }
    const half = Math.round(bounds.width / 2)
    toggleMaximize(pid, {
      x: hint === "left" ? 0 : half,
      y: 0,
      width: half,
      height: maxBounds.height,
    })
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest("[data-no-drag]")) return
    const el = event.currentTarget
    el.setPointerCapture(event.pointerId)
    dragging.current = true
    focusWindow(pid)
    const box = el.getBoundingClientRect()
    grab.current = { dx: event.clientX - box.left, dy: event.clientY - box.top }
    samples.current = [{ t: performance.now(), x: event.clientX, y: event.clientY }]
    dragScale.set(1.012)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const nextX = event.clientX - grab.current.dx
    const nextY = event.clientY - grab.current.dy

    // Resistencia progresiva en los bordes en vez de un tope seco.
    const maxX = bounds.width - 80
    const maxY = bounds.height - TASKBAR_HEIGHT - TITLE_HEIGHT
    const boundedX =
      nextX < 0
        ? rubberband(nextX, bounds.width)
        : nextX > maxX
          ? maxX + rubberband(nextX - maxX, bounds.width)
          : nextX
    const boundedY =
      nextY < 0
        ? rubberband(nextY, bounds.height)
        : nextY > maxY
          ? maxY + rubberband(nextY - maxY, bounds.height)
          : nextY

    x.set(boundedX)
    y.set(boundedY)
    samples.current = [...samples.current, { t: performance.now(), x: event.clientX, y: event.clientY }].slice(-8)

    setSnapHint(
      event.clientY <= EDGE_SNAP
        ? "max"
        : event.clientX <= EDGE_SNAP
          ? "left"
          : event.clientX >= bounds.width - EDGE_SNAP
            ? "right"
            : null,
    )
  }

  const finishDrag = () => {
    if (!dragging.current) return
    dragging.current = false
    dragScale.set(1)

    if (snapHint) {
      snapTo(snapHint)
      setSnapHint(null)
      return
    }

    // El objeto hereda la velocidad del dedo y se detiene en la proyección.
    const { vx, vy } = velocityFrom(samples.current)
    const restX = Math.min(
      bounds.width - 80,
      Math.max(-bounds.width * 0.1, x.get() + project(vx) * 0.3),
    )
    const restY = Math.min(
      bounds.height - TASKBAR_HEIGHT,
      Math.max(-bounds.height * 0.1, y.get() + project(vy) * 0.3),
    )
    animate(x, restX, { type: "spring", bounce: 0.12, duration: 0.45, velocity: vx })
    animate(y, restY, { type: "spring", bounce: 0.12, duration: 0.45, velocity: vy })
    window.setTimeout(() => commitBox(pid, { x: x.get(), y: y.get() }), 460)
  }

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const startX = event.clientX
    const startY = event.clientY
    const startW = width.get()
    const startH = height.get()
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)

    const onMove = (e: PointerEvent) => {
      width.set(Math.max(app?.minSize.width ?? 320, startW + (e.clientX - startX)))
      height.set(Math.max(app?.minSize.height ?? 200, startH + (e.clientY - startY)))
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      commitBox(pid, { width: width.get(), height: height.get() })
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  if (!win || !app || !process || win.minimized) return null

  const state = stateStyles[process.state]
  const running = process.state === "ejecutando"

  return (
    <>
      {snapHint ? (
        <div
          className={cn(
            "pointer-events-none absolute z-[1] rounded-xl border-2 border-white/25 bg-white/10 backdrop-blur-sm",
            snapHint === "max" && "inset-x-3 top-3 bottom-[68px]",
            snapHint === "left" && "left-3 top-3 bottom-[68px] w-[calc(50%-18px)]",
            snapHint === "right" && "right-3 top-3 bottom-[68px] w-[calc(50%-18px)]",
          )}
        />
      ) : null}

      <motion.section
        role="dialog"
        aria-label={`${app.title} — proceso ${pid}`}
        style={{ x, y, width, height, zIndex: win.z, scale: dragScale }}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.14 } }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        onPointerDownCapture={() => focusWindow(pid)}
        className={cn(
          "absolute flex flex-col overflow-hidden rounded-xl border-2 bg-card shadow-2xl",
          isFocused ? "border-border/80" : "border-border/40",
        )}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onDoubleClick={() =>
            toggleMaximize(pid, win.maximized ? (win.restore ?? maxBounds) : maxBounds)
          }
          className={cn(
            "flex shrink-0 items-center gap-2 border-b px-2 select-none",
            isFocused
              ? "h-[38px] border-border/70 bg-muted/70"
              : "h-[38px] border-border/40 bg-muted/40",
          )}
        >
          <app.icon className="size-3.5 shrink-0" style={{ color: app.accent }} />
          <span className="truncate text-[0.74rem] font-semibold">{app.title}</span>
          <span className="shrink-0 rounded bg-foreground/10 px-1.5 py-px font-mono text-[0.6rem] text-muted-foreground">
            {pid}
          </span>

          <span
            className="flex shrink-0 items-center gap-1 text-[0.62rem] font-medium"
            style={{ color: state.hex }}
          >
            <motion.span
              className="size-1.5 rounded-full"
              style={{ background: state.hex }}
              animate={running ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
              transition={
                running ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }
              }
            />
            {state.label}
          </span>
          {process.state === "bloqueado" && process.blockedReason ? (
            <span className="truncate text-[0.62rem] text-muted-foreground">
              {process.blockedReason}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-0.5" data-no-drag>
            <WindowButton label="Minimizar" onClick={() => minimizeWindow(pid)}>
              <Minus className="size-3.5" />
            </WindowButton>
            <WindowButton
              label={win.maximized ? "Restaurar" : "Maximizar"}
              onClick={() =>
                toggleMaximize(pid, win.restore ?? maxBounds)
              }
            >
              <Maximize2 className="size-3" />
            </WindowButton>
            <WindowButton
              label="Cerrar y terminar el proceso"
              danger
              onClick={() => {
                closeWindow(pid)
                kill(pid)
              }}
            >
              <X className="size-3.5" />
            </WindowButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-background">
          <AppContent app={app} process={process} />
        </div>

        <div
          onPointerDown={startResize}
          aria-hidden
          className="absolute right-0 bottom-0 size-4 cursor-nwse-resize rounded-br-xl"
          style={{
            background:
              "linear-gradient(135deg, transparent 50%, var(--muted-foreground) 50%, var(--muted-foreground) 62%, transparent 62%, transparent 72%, var(--muted-foreground) 72%, var(--muted-foreground) 84%, transparent 84%)",
            opacity: 0.4,
          }}
        />
      </motion.section>
    </>
  )
}

const TITLE_HEIGHT = 38

function WindowButton({
  children,
  label,
  danger = false,
  onClick,
}: {
  children: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
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
              "grid size-6 place-items-center rounded-md text-muted-foreground transition-colors active:scale-95",
              danger
                ? "hover:bg-destructive/15 hover:text-destructive"
                : "hover:bg-foreground/10 hover:text-foreground",
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}