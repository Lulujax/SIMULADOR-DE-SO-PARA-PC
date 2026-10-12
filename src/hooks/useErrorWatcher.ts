import { useEffect } from "react"
import { bindErrorTick, captureError } from "@/store/errorStore"
import { useSimStore } from "@/store/simStore"

const IGNORED = [
  "Download the React DevTools",
  "[vite] connect",
  "[vite] hot",
]

function shouldIgnore(message: string): boolean {
  return IGNORED.some((pattern) => message.includes(pattern))
}

/**
 * Vigilante de la aplicación: captura errores de consola, excepciones no
 * capturadas y rechazos de promesa, y los deja visibles dentro del propio
 * simulador en lugar de perderlos en la consola del navegador.
 */
export function useErrorWatcher() {
  useEffect(() => {
    bindErrorTick(() => useSimStore.getState().sim.tick)

    const originalError = console.error.bind(console)
    const originalWarn = console.warn.bind(console)

    console.error = (...args: unknown[]) => {
      const message = args
        .map((a) => (typeof a === "string" ? a : safeStringify(a)))
        .join(" ")
      if (!shouldIgnore(message)) {
        captureError("consola", message.slice(0, 400), "console.error")
      }
      originalError(...args)
    }

    console.warn = (...args: unknown[]) => {
      const message = args
        .map((a) => (typeof a === "string" ? a : safeStringify(a)))
        .join(" ")
      if (!shouldIgnore(message)) {
        captureError("consola", message.slice(0, 400), "console.warn")
      }
      originalWarn(...args)
    }

    const onError = (event: ErrorEvent) => {
      captureError(
        "ejecucion",
        event.message || "Error desconocido",
        event.filename,
        event.error?.stack,
      )
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      captureError(
        "ejecucion",
        reason instanceof Error ? reason.message : String(reason),
        "promesa rechazada",
        reason instanceof Error ? reason.stack : undefined,
      )
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)

    return () => {
      console.error = originalError
      console.warn = originalWarn
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)?.slice(0, 300) ?? String(value)
  } catch {
    return String(value)
  }
}