import { useEffect, useState } from "react"
import type { SimSnapshot } from "@/types/os"
import { useSimStore } from "@/store/simStore"

export function downloadSnapshot() {
  const snapshot = useSimStore.getState().exportSnapshot()
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `estado-so-tick-${snapshot.state.tick}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function useSnapshotImport(onLoaded: () => void) {
  const [error, setError] = useState<string | null>(null)

  function openPicker() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json,.json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const parsed = JSON.parse(text) as SimSnapshot
        if (!parsed?.state?.processes) {
          throw new Error("El archivo no tiene la forma de una instantánea del simulador")
        }
        useSimStore.getState().importSnapshot(parsed)
        setError(null)
        onLoaded()
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo leer el archivo")
      }
    }
    input.click()
  }

  return { error, openPicker, setError }
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener("change", update)
    return () => list.removeEventListener("change", update)
  }, [query])

  return matches
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}