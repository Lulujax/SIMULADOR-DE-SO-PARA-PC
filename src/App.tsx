import { useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSimulationClock } from "@/hooks/useSimulationClock"
import { useSimulationHotkeys } from "@/hooks/useSimulationHotkeys"
import { useErrorWatcher } from "@/hooks/useErrorWatcher"
import { useLauncher } from "@/hooks/useLauncher"
import { Desktop } from "@/components/desktop/Desktop"
import { useUiStore } from "@/store/uiStore"

export default function App() {
  useSimulationClock()
  useSimulationHotkeys()
  useErrorWatcher()
  useSystemShortcuts()

  return (
    <TooltipProvider delay={250}>
      <Desktop />
    </TooltipProvider>
  )
}

/**
 * Atajos del sistema: tecla Windows para el menú Inicio y apertura de
 * aplicaciones desde cualquier punto del escritorio.
 */
function useSystemShortcuts() {
  const { launch } = useLauncher()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key === "Meta" || event.key === "OS") {
        event.preventDefault()
        useUiStore.getState().toggleStart()
      }
    }

    function onOpenApp(event: Event) {
      const key = (event as CustomEvent<string>).detail
      if (typeof key === "string") launch(key)
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("so:open-app", onOpenApp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("so:open-app", onOpenApp)
    }
  }, [launch])
}
