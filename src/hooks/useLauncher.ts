import { useCallback } from "react"
import { useSimStore } from "@/store/simStore"
import { useWindowStore } from "@/store/windowStore"
import { useSystemStore } from "@/store/systemStore"
import { APPS, APP_MAP, type AppDefinition } from "@/apps/registry"
import { createProcess } from "@/lib/engine"
import { captureError } from "@/store/errorStore"

export interface Launcher {
  /** Abre una app. Si ya tiene una ventana visible, la enfoca. Devuelve el PID. */
  launch: (key: string) => number | null
  /** Fuerza una instancia nueva aunque ya exista una ventana del mismo tipo. */
  launchNew: (key: string) => number | null
  apps: AppDefinition[]
}

export function useLauncher(): Launcher {
  const create = useCallback((key: string): number | null => {
    const app = APP_MAP[key]
    if (!app) return null
    try {
      const store = useSimStore.getState()
      const process = createProcess(store.sim, {
        name: app.processName,
        app: app.key,
        program: app.program,
        memoryRequired: app.memoryKB,
        burstTotal: app.burst,
        priority: app.priority,
        createdByUser: true,
      })
      store.commit()

      // Abrir una aplicación implica que el sistema está vivo: si el reloj
      // estaba parado, arranca. Si no, el proceso se quedaría eternamente
      // en estado «Nuevo» y parecería que no funciona.
      if (!store.running) useSimStore.setState({ running: true })

      if (!app.background) {
        useWindowStore.getState().openWindow(process.pid, app.key, app.defaultSize)
      }

      useSystemStore.getState().notify({
        title: app.title,
        body: `Proceso ${app.processName} (PID ${process.pid}) creado`,
        app: app.key,
        tone: "ok",
      })
      return process.pid
    } catch (error) {
      captureError(
        "accion",
        `No se pudo abrir ${key}: ${error instanceof Error ? error.message : String(error)}`,
        "useLauncher.create",
        error instanceof Error ? error.stack : undefined,
      )
      return null
    }
  }, [])

  const launch = useCallback(
    (key: string): number | null => {
      try {
        const visible = Object.values(useWindowStore.getState().windows).find(
          (win) => win.app === key && !win.minimized,
        )
        if (visible) {
          useWindowStore.getState().focusWindow(visible.pid)
          return visible.pid
        }
      } catch (error) {
        captureError(
          "accion",
          `No se pudo enfocar ${key}: ${error instanceof Error ? error.message : String(error)}`,
          "useLauncher.launch",
        )
      }
      return create(key)
    },
    [create],
  )

  const launchNew = useCallback((key: string) => create(key), [create])

  return { launch, launchNew, apps: APPS }
}