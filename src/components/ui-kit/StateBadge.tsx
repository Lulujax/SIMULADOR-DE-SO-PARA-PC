import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "cn"
import type { ProcessState } from "@/types/os"
import { stateStyles } from "@/lib/palette"
import { spring } from "@/lib/motion"

interface StateBadgeProps {
  state: ProcessState
  size?: "sm" | "md"
  showLabel?: boolean
  className?: string
}

export function StateBadge({
  state,
  size = "sm",
  showLabel = true,
  className,
}: StateBadgeProps) {
  const style = stateStyles[state]
  const reduced = useReducedMotion()
  return (
    <motion.span
      layout="position"
      transition={reduced ? { duration: 0.12 } : spring}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        style.chip,
        size === "sm" ? "px-2 py-0.5 text-[0.68rem]" : "px-2.5 py-1 text-[0.78rem]",
        className,
      )}
    >
      <motion.span
        key={state}
        initial={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0.15 } : spring}
        className={cn("size-1.5 rounded-full", style.dot)}
      />
      {showLabel ? style.label : null}
    </motion.span>
  )
}

interface ProcessChipProps {
  pid: number
  name: string
  state: ProcessState
  selected?: boolean
  onSelect?: () => void
  trailing?: string
  layoutId?: string
  compact?: boolean
  className?: string
}

/**
 * Tarjeta de proceso. Usa `layout` para que el salto entre colas sea un
 * movimiento real (resorte interrumpible) y no un teletransporte.
 */
export function ProcessChip({
  pid,
  name,
  state,
  selected = false,
  onSelect,
  trailing,
  compact = false,
  className,
}: ProcessChipProps) {
  const style = stateStyles[state]
  const reduced = useReducedMotion()
  return (
    <motion.button
      type="button"
      layout="position"
      layoutId={`chip-${pid}`}
      onClick={onSelect}
      transition={reduced ? { duration: 0.12 } : spring}
      whileHover={reduced ? undefined : { scale: 1.02 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      className={cn(
        "group relative flex w-full items-center gap-2 overflow-hidden rounded-lg border px-2 py-1.5 text-left",
        compact ? "py-1" : "",
        selected
          ? "border-foreground/25 bg-foreground/[0.06] shadow-sm"
          : "border-border/60 bg-background/70 hover:bg-background",
        className,
      )}
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: style.hex }}
        aria-hidden
      />
      <div className="min-w-0 flex-1 pl-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.72rem] font-semibold tabular-nums text-foreground">
            P{pid}
          </span>
          <span className="truncate text-[0.7rem] text-muted-foreground">{name}</span>
        </div>
        {!compact ? (
          <span className={cn("text-[0.65rem] font-medium", style.text)}>
            {style.label}
          </span>
        ) : null}
      </div>
      {trailing ? (
        <span className="shrink-0 text-[0.65rem] tabular-nums text-muted-foreground">
          {trailing}
        </span>
      ) : null}
    </motion.button>
  )
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 px-4 py-6 text-center">
      {icon ? <span className="text-muted-foreground/60">{icon}</span> : null}
      <p className="text-[0.78rem] font-medium text-muted-foreground">{title}</p>
      {description ? (
        <p className="max-w-[26ch] text-[0.7rem] text-muted-foreground/80">{description}</p>
      ) : null}
    </div>
  )
}