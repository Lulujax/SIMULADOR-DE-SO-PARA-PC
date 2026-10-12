import { useEffect, useState } from "react"
import { AnimatePresence, LayoutGroup } from "framer-motion"
import { Window } from "./Window"
import { Taskbar } from "./Taskbar"
import { DesktopIcons } from "./DesktopIcons"
import { useSim } from "@/hooks/useSim"
import { useWindowStore } from "@/store/windowStore"
import { useUiStore } from "@/store/uiStore"

export function Desktop() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [size, setSize] = useState({ width: 1440, height: 900 })
  const windows = useWindowStore((s) => s.windows)
  const topZ = useWindowStore((s) => s.topZ)
  const closeWindow = useWindowStore((s) => s.closeWindow)
  const processes = useSim((s) => s.processes)
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    useWindowStore.getState().setBounds({
      width: size.width,
      height: size.height - 64,
    })
  }, [size.width, size.height])

  // Si el proceso muere por otra vía (administrador de tareas), su ventana
  // desaparece también: el escritorio refleja el estado real del sistema.
  useEffect(() => {
    const alive = new Set(processes.map((p) => p.pid))
    for (const pid of Object.keys(windows)) {
      if (!alive.has(Number(pid))) closeWindow(Number(pid))
    }
  }, [processes, windows, closeWindow])

  const focusedPid = Object.values(windows).reduce<number | null>((best, win) => {
    if (win.minimized) return best
    return best === null || win.z > (windows[best]?.z ?? 0) ? win.pid : best
  }, null)

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Wallpaper dark={isDark} />
      <DesktopIcons />

      <LayoutGroup>
        <AnimatePresence>
          {Object.values(windows).map((win) => (
            <Window
              key={win.pid}
              pid={win.pid}
              bounds={{ width: size.width, height: size.height - 64 }}
              isFocused={focusedPid === win.pid && topZ >= win.z}
            />
          ))}
        </AnimatePresence>
      </LayoutGroup>

      <Taskbar open={menuOpen} onToggle={() => setMenuOpen((v) => !v)} />
    </div>
  )
}

function Wallpaper({ dark }: { dark: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background: dark
          ? "radial-gradient(120% 90% at 18% 8%, #1e2a4a 0%, #0d1220 45%, #070a12 100%)"
          : "radial-gradient(120% 90% at 18% 8%, #cfe0ff 0%, #e6ecff 45%, #f6f8ff 100%)",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "28px 28px",
          color: dark ? "#ffffff" : "#1e293b",
        }}
      />
    </div>
  )
}