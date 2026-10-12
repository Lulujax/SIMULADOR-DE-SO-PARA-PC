import { useEffect, useRef, useState } from "react"
import { AnimatePresence, LayoutGroup } from "framer-motion"
import { Image as ImageIcon, Monitor, Play, RefreshCw, Settings as SettingsIcon } from "lucide-react"
import { Window } from "./Window"
import { Taskbar } from "./Taskbar"
import { DesktopIcons, Marquee } from "./DesktopIcons"
import { ContextMenuLayer } from "./ContextMenu"
import { SystemScreens } from "./SystemScreens"
import { ErrorBoundary } from "./ErrorBoundary"
import { useSim } from "@/hooks/useSim"
import { useWindowStore } from "@/store/windowStore"
import { useMenuStore } from "@/store/menuStore"
import { useSystemStore, WALLPAPERS, wallpaperById } from "@/store/systemStore"

export const TASKBAR_HEIGHT = 64

export function Desktop() {
  const [size, setSize] = useState({ width: 1440, height: 900 })
  const windows = useWindowStore((s) => s.windows)
  const closeWindow = useWindowStore((s) => s.closeWindow)
  const processes = useSim((s) => s.processes)
  const wallpaper = useSystemStore((s) => wallpaperById(s.wallpaperId))

  // El área útil nunca incluye la barra de tareas: es la regla que comparten
  // el escritorio, las ventanas y el ajuste de tamaño. Antes cada uno se
  // restaba la barra por su cuenta y las ventanas acababan debajo de ella.
  const area = { width: size.width, height: Math.max(240, size.height - TASKBAR_HEIGHT) }

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    window.addEventListener("orientationchange", update)
    // Entrar y salir de pantalla completa no siempre dispara «resize»:
    // sin esto las ventanas quedaban donde estaban y se perdían de vista.
    document.addEventListener("fullscreenchange", update)
    document.addEventListener("webkitfullscreenchange", update)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("orientationchange", update)
      document.removeEventListener("fullscreenchange", update)
      document.removeEventListener("webkitfullscreenchange", update)
    }
  }, [])

  useEffect(() => {
    useWindowStore.getState().setBounds(area)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.width, area.height])

  // Si el proceso muere por otra vía, su ventana desaparece también.
  useEffect(() => {
    const alive = new Set(processes.map((p) => p.pid))
    for (const pid of Object.keys(windows)) {
      if (!alive.has(Number(pid))) closeWindow(Number(pid))
    }
  }, [processes, windows, closeWindow])

  return (
    <div
      className="relative h-dvh w-full overflow-hidden select-none"
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      style={{ userSelect: "none" }}
    >
      <Wallpaper value={wallpaper.value} />

      <DesktopArea />

      <LayoutGroup>
        <AnimatePresence>
          {Object.values(windows).map((win) => (
            <ErrorBoundary key={win.pid}>
              <Window
                pid={win.pid}
                bounds={area}
                isFocused={isFocused(windows, win.pid)}
              />
            </ErrorBoundary>
          ))}
        </AnimatePresence>
      </LayoutGroup>

      <Taskbar />
      <ContextMenuLayer />
      <SystemScreens />
    </div>
  )
}

function isFocused(windows: Record<number, { z: number; minimized: boolean }>, pid: number) {
  let top = -1
  let best: number | null = null
  for (const [id, win] of Object.entries(windows)) {
    if (win.minimized) continue
    if (win.z > top) {
      top = win.z
      best = Number(id)
    }
  }
  return best === pid
}

/** Área de escritorio: selección por marco y menú contextual del SO. */
function DesktopArea() {
  const showMenu = useMenuStore((s) => s.show)
  const sys = useSystemStore()
  const marquee = useRef<{ x: number; y: number } | null>(null)
  const [rect, setRect] = useState<null | {
    left: number
    top: number
    width: number
    height: number
  }>(null)

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    // El marco de selección sólo empieza sobre el fondo: si el gesto nace en
    // un icono o en una ventana, esos controles se quedan con el puntero.
    if ((event.target as HTMLElement).closest("[data-window], [data-icon]")) return
    marquee.current = { x: event.clientX, y: event.clientY }
    setRect({ left: event.clientX, top: event.clientY, width: 0, height: 0 })
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!marquee.current) return
    const start = marquee.current
    setRect({
      left: Math.min(start.x, event.clientX),
      top: Math.min(start.y, event.clientY),
      width: Math.abs(event.clientX - start.x),
      height: Math.abs(event.clientY - start.y),
    })
  }

  function onPointerUp() {
    marquee.current = null
    setRect(null)
  }

  function onContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    if ((event.target as HTMLElement).closest("[data-window], [data-icon]")) return
    showMenu(
      { clientX: event.clientX, clientY: event.clientY },
      [
        {
          id: "ver",
          label: "Ver",
          children: [
            {
              id: "iconos",
              label: "Iconos del escritorio",
              checked: sys.showDesktopIcons,
              onSelect: sys.toggleDesktopIcons,
            },
            { id: "sep-a", separator: true },
            ...(["pequeno", "mediano", "grande"] as const).map((size) => ({
              id: `size-${size}`,
              label: `Iconos ${size}`,
              checked: sys.iconSize === size,
              onSelect: () => sys.setIconSize(size),
            })),
          ],
        },
        {
          id: "ordenar",
          label: "Ordenar iconos",
          onSelect: () => useWindowStore.getState().clearIconPositions(),
        },
        { id: "sep-1", separator: true },
        {
          id: "refrescar",
          label: "Actualizar",
          icon: <RefreshCw className="size-3.5" />,
          onSelect: () => sys.notify({ title: "Escritorio", body: "Actualizado", tone: "info" }),
        },
        {
          id: "terminal",
          label: "Abrir Terminal aquí",
          icon: <Monitor className="size-3.5" />,
          onSelect: () => window.dispatchEvent(new CustomEvent("so:open-app", { detail: "terminal" })),
        },
        {
          id: "nuevo-servicio",
          label: "Nuevo proceso en segundo plano",
          icon: <Play className="size-3.5" />,
          onSelect: () => window.dispatchEvent(new CustomEvent("so:open-app", { detail: "service" })),
        },
        { id: "sep-2", separator: true },
        {
          id: "fondo",
          label: "Cambiar el fondo de escritorio",
          icon: <ImageIcon className="size-3.5" />,
          children: WALLPAPERS.map((paper) => ({
            id: `wp-${paper.id}`,
            label: paper.name,
            checked: sys.wallpaperId === paper.id,
            onSelect: () => sys.setWallpaper(paper.id),
          })),
        },
        {
          id: "ajustes",
          label: "Configuración",
          icon: <SettingsIcon className="size-3.5" />,
          onSelect: () => window.dispatchEvent(new CustomEvent("so:open-app", { detail: "settings" })),
        },
        {
          id: "mostrar",
          label: "Mostrar escritorio",
          icon: <Monitor className="size-3.5" />,
          onSelect: () => useWindowStore.getState().minimizeAll(),
        },
      ],
      "Escritorio",
    )
  }

  return (
    <div
      data-desktop
      className="absolute inset-x-0 top-0"
      style={{ bottom: TASKBAR_HEIGHT }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
    >
      <DesktopIcons />
      <Marquee rect={rect} />
    </div>
  )
}

function Wallpaper({ value }: { value: string }) {
  return (
    <div aria-hidden className="absolute inset-0" style={{ background: value }}>
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "28px 28px",
          color: "#ffffff",
        }}
      />
    </div>
  )
}
