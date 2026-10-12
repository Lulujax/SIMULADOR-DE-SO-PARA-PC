import type { ReactNode } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "cn"

type Side = "top" | "right" | "bottom" | "left"

export function TooltipScope({ children }: { children: ReactNode }) {
  return <TooltipProvider delay={180}>{children}</TooltipProvider>
}

interface ExplainerProps {
  label: string
  children: ReactNode
  side?: Side
  className?: string
  contentClassName?: string
}

/**
 * Tooltip explicativo anclado al control que describe. Es puramente
 * decorativo: no añade rol ni foco, de modo que el control que envuelve
 * conserva su propio nombre accesible.
 */
export function Explainer({
  label,
  children,
  side = "top",
  className,
  contentClassName,
}: ExplainerProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className={cn("inline-flex", className)} aria-hidden="true" />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={cn("max-w-64 text-center", contentClassName)}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

interface InfoDotProps {
  label: string
  side?: Side
  className?: string
}

export function InfoDot({ label, side = "top", className }: InfoDotProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className={cn(
              "grid size-4 shrink-0 place-items-center rounded-full border border-border/70 bg-muted/60 text-[9px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              className,
            )}
          />
        }
      >
        ?
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-64 text-center">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

interface SectionLabelProps {
  children: ReactNode
  hint?: string
  className?: string
}

export function SectionLabel({ children, hint, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="text-micro text-muted-foreground/80">{children}</span>
      <span className="h-px flex-1 bg-border/70" />
      {hint ? <InfoDot label={hint} side="left" /> : null}
    </div>
  )
}