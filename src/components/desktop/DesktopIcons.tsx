import { useEffect, useRef } from "react"
import { motion, useMotionValue } from "framer-motion"
import { cn } from "cn"
import { DESKTOP_APPS } from "@/apps/registry"
import { useLauncher } from "@/hooks/useLauncher"
import { useMenuStore } from "@/store/menuStore"
import { useSystemStore } from "@/store/systemStore"
import { useSimStore } from "@/store/simStore"
import { useWindowStore } from "@/store/windowStore"
import { project, rubberband, velocityFrom, type Sample } from "@/lib/gestures"

const GRID_X = { pequeno: 84, mediano: 100, grande: 124 }
const GRID_Y = { pequeno: 76, mediano: 92, grande: 112 }

interface IconBox {
  key: string
  x: number
  y: number
  width: number
  height: number
}

export function DesktopIcons() {
  const { launch } = useLauncher()
  const iconSize = useSystemStore((s) => s.iconSize)
  const show = useSystemStore((s) => s.showDesktopIcons)
  const showMenu = useMenuStore((s) => s.show)
  const positions = useWindowStore((s) => s.iconPositions)
  const setIconPosition = useWindowStore((s) => s.setIconPosition)

  const stepX = GRID_X[iconSize]
  const stepY = GRID_Y[iconSize]

  const boxes: IconBox[] = DESKTOP_APPS.map((app, index) => {
    const col = Math.floor(index / 12)
    const row = index % 12
    const stored = positions[app.key]
    return {
      key: app.key,
      x: stored?.x ?? 10 + col * stepX,
      y: stored?.y ?? 10 + row * stepY,
      width: stepX - 10,
      height: stepY - 10,
    }
  })

  const boxesRef = useRef(boxes)
  boxesRef.current = boxes

  if (!show) return null

  return (
    <>
      {DESKTOP_APPS.map((app, index) => {
        const box = boxes[index]
        return (
          <IconDraggable
            key={app.key}
            app={app}
            box={box}
            onOpen={() => launch(app.key)}
            onCommit={(x, y) => setIconPosition(app.key, { x, y })}
            onMenu={(event) => {
              event.preventDefault()
              const pid = launch(app.key)
              const point = { clientX: event.clientX, clientY: event.clientY }
              showMenu(
                point,
                [
                  {
                    id: "abrir",
                    label: "Abrir",
                    shortcut: "intro",
                    onSelect: () => launch(app.key),
                  },
                  {
                    id: "otra",
                    label: "Abrir en una ventana nueva",
                    onSelect: () => {
                      const store = useSimStore.getState()
                      store.reset()
                      store.commit()
                    },
                    disabled: true,
                  },
                  { id: "sep1", separator: true },
                  {
                    id: "ocultar",
                    label: "Quitar del escritorio",
                    onSelect: () => useSystemStore.getState().toggleDesktopIcons(),
                  },
                  {
                    id: "admin",
                    label: "Abrir Administrador de tareas",
                    onSelect: () => launch("taskmgr"),
                  },
                  { id: "sep2", separator: true },
                  {
                    id: "cerrar",
                    label: "Terminar proceso",
                    danger: true,
                    disabled: pid === null,
                    onSelect: () => {
                      if (pid !== null) {
                        useSimStore.getState().kill(pid)
                        useWindowStore.getState().closeWindow(pid)
                      }
                    },
                  },
                ],
                app.title,
              )
            }}
          />
        )
      })}
    </>
  )
}

interface IconProps {
  app: (typeof DESKTOP_APPS)[number]
  box: IconBox
  onOpen: () => void
  onCommit: (x: number, y: number) => void
  onMenu: (event: React.MouseEvent) => void
}

function IconDraggable({ app, box, onOpen, onCommit, onMenu }: IconProps) {
  const x = useMotionValue(box.x)
  const y = useMotionValue(box.y)
  const samples = useRef<Sample[]>([])
  const grab = useRef({ dx: 0, dy: 0 })
  const dragging = useRef(false)

  useEffect(() => {
    if (dragging.current) return
    x.set(box.x)
    y.set(box.y)
  }, [box.x, box.y, x, y])

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    const el = event.currentTarget
    el.setPointerCapture(event.pointerId)
    dragging.current = true
    grab.current = { dx: event.clientX - x.get(), dy: event.clientY - y.get() }
    samples.current = [{ t: performance.now(), x: event.clientX, y: event.clientY }]
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return
    x.set(event.clientX - grab.current.dx)
    y.set(event.clientY - grab.current.dy)
    samples.current = [
      ...samples.current,
      { t: performance.now(), x: event.clientX, y: event.clientY },
    ].slice(-8)
  }

  function onPointerUp() {
    if (!dragging.current) return
    dragging.current = false
    const { vx, vy } = velocityFrom(samples.current)
    const restX = Math.max(4, Math.min(window.innerWidth - box.width - 8, x.get() + project(vx) * 0.2))
    const restY = Math.max(4, Math.min(window.innerHeight - 90, y.get() + project(vy) * 0.2))
    x.set(restX)
    y.set(restY)
    onCommit(restX, restY)
  }

  return (
    <motion.button
      type="button"
      style={{ x, y, width: box.width, height: box.height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onOpen}
      onContextMenu={onMenu}
      title={`${app.title} — clic para abrir, arrastra para mover`}
      className={cn(
        "group absolute top-0 left-0 flex flex-col items-center justify-start gap-1.5 rounded-lg p-2 text-center",
        "hover:bg-foreground/[0.07] focus-visible:ring-[2px] focus-visible:ring-ring active:scale-95",
      )}
    >
      <span
        className="grid size-11 place-items-center rounded-xl shadow-sm"
        style={{ background: `${app.accent}2e`, color: app.accent }}
      >
        <app.icon className="size-6" />
      </span>
      <span className="line-clamp-2 text-[0.68rem] leading-tight font-medium text-foreground/90">
        {app.shortTitle ?? app.title}
      </span>
    </motion.button>
  )
}

/** Rectángulo de selección por arrastre sobre el escritorio. */
export function Marquee({
  rect,
}: {
  rect: { left: number; top: number; width: number; height: number } | null
}) {
  if (!rect) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute border border-indigo-500/50 bg-indigo-500/10"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    />
  )
}

export function clampToDesktop(
  value: number,
  size: number,
  area: number,
  slack = 8,
): number {
  if (value < 0) return rubberband(value, area)
  if (value > area - size - slack) return area - size - slack + rubberband(value - (area - size - slack), area)
  return value
}