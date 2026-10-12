import { useEffect } from "react"
import { useSimStore } from "@/store/simStore"
import { useWindowStore } from "@/store/windowStore"

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  )
}

export function useSimulationHotkeys() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      const sim = useSimStore.getState()
      const windows = useWindowStore.getState()

      switch (event.key) {
        case " ":
          event.preventDefault()
          sim.toggleRun()
          break
        case "ArrowRight":
          event.preventDefault()
          sim.pause()
          sim.stepOnce()
          break
        case "r":
        case "R":
          sim.reset()
          windows.reset()
          break
        case "d":
        case "D":
          windows.minimizeAll()
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}