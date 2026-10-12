import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Power, Search, X } from "lucide-react"
import { APPS } from "@/apps/registry"
import { useLauncher } from "@/hooks/useLauncher"
import { useSim } from "@/hooks/useSim"
import { useSimStore } from "@/store/simStore"
import { useWindowStore } from "@/store/windowStore"
import { useSystemStore } from "@/store/systemStore"
import { spring } from "@/lib/motion"

interface Props {
  open: boolean
  onClose: () => void
}

export function StartMenu({ open, onClose }: Props) {
  const { launch } = useLauncher()
  const [search, setSearch] = useState("")
  const processes = useSim((s) => s.processes)
  const sys = useSystemStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSearch("")
      window.setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  const counts: Record<string, number> = {}
  for (const p of processes) {
    if (p.app && p.state !== "terminado") counts[p.app] = (counts[p.app] ?? 0) + 1
  }

  const term = search.trim().toLowerCase()
  const filtered = APPS.filter(
    (app) => term === "" || app.title.toLowerCase().includes(term),
  )

  return (
    <AnimatePresence>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-label="Menú de aplicaciones"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={spring}
            className="material-float shadow-float absolute bottom-[70px] left-2 z-50 flex max-h-[min(32rem,80vh)] w-[min(34rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-border/70"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar aplicaciones y archivos"
                className="min-w-0 flex-1 bg-transparent text-[0.78rem] outline-none placeholder:text-muted-foreground"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpiar búsqueda"
                  className="grid size-5 shrink-0 place-items-center rounded hover:bg-muted"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <p className="text-micro px-1.5 pb-1.5 text-muted-foreground/80">
                Aplicaciones instaladas
              </p>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {filtered.map((app) => (
                  <motion.button
                    key={app.key}
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring}
                    onClick={() => {
                      launch(app.key)
                      onClose()
                    }}
                    className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-background/60 p-2.5 text-left transition-colors hover:border-border hover:bg-background"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg"
                      style={{ background: `${app.accent}22`, color: app.accent }}
                    >
                      <app.icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.76rem] font-medium">
                        {app.title}
                      </span>
                      <span className="block truncate text-[0.64rem] text-muted-foreground">
                        {counts[app.key]
                          ? `${counts[app.key]} abierta(s)`
                          : app.device
                            ? `Usa ${app.device}`
                            : "Sólo CPU"}
                      </span>
                    </span>
                  </motion.button>
                ))}
              </div>
              {filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-[0.74rem] text-muted-foreground">
                  Ninguna aplicación coincide con «{search}».
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-1 border-t border-border/60 p-1.5">
              <button
                type="button"
                onClick={() => {
                  sys.sleep()
                  onClose()
                }}
                className="flex-1 rounded-lg px-2 py-1.5 text-[0.72rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Suspender
              </button>
              <button
                type="button"
                onClick={() => {
                  useSimStore.getState().reset()
                  useWindowStore.getState().reset()
                  sys.shutdown()
                  onClose()
                }}
                className="flex-1 rounded-lg px-2 py-1.5 text-[0.72rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cerrar sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  useSimStore.getState().reset()
                  useWindowStore.getState().reset()
                  sys.restart()
                  onClose()
                }}
                className="flex-1 rounded-lg px-2 py-1.5 text-[0.72rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Reiniciar
              </button>
              <button
                type="button"
                onClick={() => {
                  sys.shutdown()
                  onClose()
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.72rem] font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Power className="size-3.5" />
                Apagar
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

export function useStartMenuHotkey(open: boolean, setOpen: (v: boolean) => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return
      }
      if (event.key === "Meta" || event.key === "OS") {
        event.preventDefault()
        setOpen(!open)
      }
      if (event.key === "Escape" && open) setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, setOpen])
}

export const startMenuClasses = cn