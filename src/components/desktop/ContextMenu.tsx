import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "cn"
import { useMenuStore, type MenuItem } from "@/store/menuStore"

const MENU_WIDTH = 232
const SUBMENU_WIDTH = 212

/**
 * Menú contextual propio del sistema operativo. Se abre siempre dentro de la
 * aplicación: el navegador nunca llega a mostrar su menú.
 */
export function ContextMenuLayer() {
  const open = useMenuStore((s) => s.open)
  const x = useMenuStore((s) => s.x)
  const y = useMenuStore((s) => s.y)
  const items = useMenuStore((s) => s.items)
  const title = useMenuStore((s) => s.title)
  const hide = useMenuStore((s) => s.hide)
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    if (!open) return
    const rect = ref.current?.getBoundingClientRect()
    const width = rect?.width ?? MENU_WIDTH
    const height = rect?.height ?? 240
    setPosition({
      left: Math.max(6, Math.min(x, window.innerWidth - width - 6)),
      top: Math.max(6, Math.min(y, window.innerHeight - height - 6)),
    })
  }, [open, x, y, items])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return
      hide()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide()
    }
    window.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("blur", hide)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("blur", hide)
    }
  }, [open, hide])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={ref}
          role="menu"
          aria-label={title ?? "Menú contextual"}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          style={{ left: position.left, top: position.top }}
          className="material-float shadow-float fixed z-[9500] w-[232px] origin-top-left overflow-hidden rounded-xl border border-border/70 py-1"
          onContextMenu={(event) => event.preventDefault()}
        >
          {title ? (
            <div className="px-3 pt-1.5 pb-2 text-micro text-muted-foreground/80">
              {title}
            </div>
          ) : null}
          {items.map((item) => (
            <MenuRow key={item.id} item={item} onClose={hide} depth={0} />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function MenuRow({
  item,
  onClose,
  depth,
}: {
  item: MenuItem
  onClose: () => void
  depth: number
}) {
  const [subOpen, setSubOpen] = useState(false)
  const [flipLeft, setFlipLeft] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const hasChildren = Boolean(item.children && item.children.length > 0)

  if (item.separator) {
    return <div className="my-1 h-px bg-border/70" />
  }

  return (
    <div
      ref={rowRef}
      className="relative"
      onPointerEnter={() => {
        if (!hasChildren) return
        // Si no cabe a la derecha, el submenú se abre a la izquierda: si no,
        // opciones como «Ver» quedaban fuera de la pantalla sin poder pulsarse.
        const box = rowRef.current?.getBoundingClientRect()
        setFlipLeft(box != null && box.right + SUBMENU_WIDTH + 12 > window.innerWidth)
        setSubOpen(true)
      }}
      onPointerLeave={() => setSubOpen(false)}
    >
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onClick={() => {
          if (item.disabled || hasChildren) return
          item.onSelect?.()
          onClose()
        }}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[0.76rem] transition-colors",
          item.disabled
            ? "cursor-default text-muted-foreground/40"
            : item.danger
              ? "text-destructive hover:bg-destructive/12"
              : "text-foreground hover:bg-foreground/[0.07]",
          depth > 0 && "pl-8",
        )}
      >
        {item.checked ? (
          <Check className="size-3.5 shrink-0" />
        ) : item.icon ? (
          <span className="grid size-3.5 shrink-0 place-items-center">
            {item.icon}
          </span>
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.shortcut ? (
          <span className="shrink-0 text-[0.66rem] text-muted-foreground">
            {item.shortcut}
          </span>
        ) : null}
        {hasChildren ? <span className="text-[0.66rem] text-muted-foreground">›</span> : null}
      </button>

      {hasChildren && subOpen ? (
        <motion.div
          initial={{ opacity: 0, x: flipLeft ? 4 : -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.18 }}
          className={cn(
            "material-float shadow-float absolute top-0 z-[9501] w-[212px] overflow-hidden rounded-xl border border-border/70 py-1",
            flipLeft ? "right-full" : "left-full",
          )}
        >
          {item.children!.map((child) => (
            <MenuRow key={child.id} item={child} onClose={onClose} depth={depth + 1} />
          ))}
        </motion.div>
      ) : null}
    </div>
  )
}