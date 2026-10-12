import { useCallback } from "react"
import type { SimState } from "@/types/os"
import { useSimStore } from "@/store/simStore"

/**
 * El motor muta el snapshot en sitio: es lo correcto para un simulador de
 * alta frecuencia, donde clonar el árbol entero en cada tick sería caro.
 * Este hook expone ese snapshot y se suscribe al contador de versión, de modo
 * que React repinta en cada tick sin copiar la estructura.
 */
export function useSim<T>(selector: (sim: SimState) => T): T {
  useSimStore((s) => s.version)
  return selector(useSimStore.getState().sim)
}

export function useSimActions() {
  const store = useSimStore
  return useCallback(() => store.getState(), [store])
}

export function useRunning(): boolean {
  return useSimStore((s) => s.running)
}

export function useSelectedPid(): number | null {
  return useSimStore((s) => s.selectedPid)
}