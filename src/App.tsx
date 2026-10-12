import { TooltipProvider } from "@/components/ui/tooltip"
import { useSimulationClock } from "@/hooks/useSimulationClock"
import { useSimulationHotkeys } from "@/hooks/useSimulationHotkeys"
import { Desktop } from "@/components/desktop/Desktop"

export default function App() {
  useSimulationClock()
  useSimulationHotkeys()

  return (
    <TooltipProvider delay={250}>
      <Desktop />
    </TooltipProvider>
  )
}