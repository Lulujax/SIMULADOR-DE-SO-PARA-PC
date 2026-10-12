import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "cn"
import { spring } from "@/lib/motion"

interface StatTileProps {
  label: string
  value: ReactNode
  unit?: string
  icon?: ReactNode
  tone?: "default" | "accent" | "warn" | "danger" | "ok"
  hint?: string
  className?: string
}

const tones = {
  default: "text-foreground",
  accent: "text-indigo-600 dark:text-indigo-300",
  warn: "text-amber-600 dark:text-amber-300",
  danger: "text-rose-600 dark:text-rose-300",
  ok: "text-emerald-600 dark:text-emerald-300",
}

export function StatTile({
  label,
  value,
  unit,
  icon,
  tone = "default",
  hint,
  className,
}: StatTileProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -2 }}
      transition={spring}
      className={cn(
        "rounded-lg border border-border/60 bg-background/60 px-3 py-2",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <span className="text-micro text-muted-foreground/80">{label}</span>
        {hint ? (
          <span className="text-[10px] text-muted-foreground/50" title={hint}>
            ⓘ
          </span>
        ) : null}
      </div>
      <p className={cn("mt-0.5 text-[1.35rem] font-semibold leading-none tabular-nums", tones[tone])}>
        {value}
        {unit ? (
          <span className="ml-0.5 text-[0.7rem] font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </p>
    </motion.div>
  )
}

interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  hint?: string
}

interface SegmentedProps<T extends string> {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: "sm" | "md"
  className?: string
  layoutId?: string
}

/** Control segmentado: la selección se indicationa con un resorte crítico. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
  layoutId = "segmented",
}: SegmentedProps<T>) {
  const reduced = useReducedMotion()
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/60 p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.hint ?? option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative isolate inline-flex items-center gap-1.5 rounded-[7px] font-medium whitespace-nowrap transition-colors",
              size === "sm"
                ? "h-6 px-2 text-[0.7rem]"
                : "h-7 px-2.5 text-[0.78rem]",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`${layoutId}-pill`}
                className="absolute inset-0 -z-10 rounded-[7px] bg-background shadow-sm dark:bg-input/40"
                transition={reduced ? { duration: 0.12 } : spring}
              />
            ) : null}
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}

export function Toggle({ checked, onChange, label, hint }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={hint}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/50"
    >
      <span className="text-[0.78rem] text-foreground/90">{label}</span>
      <span
        className={cn(
          "relative h-[1.15rem] w-8 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-indigo-500" : "bg-border",
        )}
      >
        <motion.span
          className="absolute top-[2px] size-[0.8rem] rounded-full bg-white shadow-sm"
          animate={{ left: checked ? 18 : 2 }}
          transition={springSnappy}
        />
      </span>
    </button>
  )
}

const springSnappy = { type: "spring", bounce: 0, duration: 0.24 } as const