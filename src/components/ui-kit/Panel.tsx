import { useState, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import { cn } from "cn"
import { fade, spring } from "@/lib/motion"

interface PanelProps {
  title: string
  icon?: ReactNode
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  collapsible?: boolean
  className?: string
  bodyClassName?: string
  dense?: boolean
}

/**
 * Panel de material translúcido. El colapso sale y entra por la misma
 * ruta (altura + opacidad) para que el movimiento sea reversible.
 */
export function Panel({
  title,
  icon,
  subtitle,
  actions,
  children,
  defaultOpen = true,
  collapsible = true,
  className,
  bodyClassName,
  dense = false,
}: PanelProps) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(defaultOpen)
  const Chevron = (
    <ChevronRight
      className={cn(
        "size-3.5 text-muted-foreground transition-transform duration-200",
        open && "rotate-90",
      )}
    />
  )

  const header = (
    <div
      className={cn(
        "flex w-full items-center gap-2 px-3.5",
        dense ? "py-2" : "py-2.5",
        collapsible && "cursor-pointer",
      )}
      role={collapsible ? "button" : undefined}
      tabIndex={collapsible ? 0 : undefined}
      aria-expanded={collapsible ? open : undefined}
      onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      onKeyDown={
        collapsible
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                setOpen((v) => !v)
              }
            }
          : undefined
      }
    >
      {collapsible ? <span className="text-muted-foreground">{Chevron}</span> : null}
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      <div className="min-w-0 flex-1 text-left">
        <h3 className="truncate text-[0.82rem] font-semibold text-foreground">{title}</h3>
        {subtitle ? (
          <p className="truncate text-[0.7rem] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div
          className="flex items-center gap-1"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </div>
  )

  return (
    <section
      className={cn(
        "material-panel shadow-panel edge-light overflow-hidden rounded-xl border border-border/60",
        className,
      )}
    >
      {header}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduced ? fade : spring}
            className="overflow-hidden"
          >
            <div className={cn("px-3.5 pb-3.5", bodyClassName)}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}