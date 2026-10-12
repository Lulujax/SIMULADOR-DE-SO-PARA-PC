import { useEffect } from "react"
import { useSimStore } from "@/store/simStore"

const BASE_INTERVAL = 850

export function useSimulationClock() {
  useEffect(() => {
    const interval = window.setInterval(() => {
      const state = useSimStore.getState()
      if (!state.running) return
      const steps = Math.max(1, Math.round(state.speed))
      for (let i = 0; i < steps; i++) {
        useSimStore.getState().stepOnce()
      }
    }, BASE_INTERVAL)

    return () => window.clearInterval(interval)
  }, [])
}