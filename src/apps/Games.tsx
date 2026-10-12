import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Bomb, Flag, Minus, RotateCcw, Trophy } from "lucide-react"
import { cn } from "cn"
import type { Process } from "@/types/os"
import { useSimStore } from "@/store/simStore"
import { useSystemStore } from "@/store/systemStore"
import { stateStyles } from "@/lib/palette"

/** Franja de estado del proceso, igual que en el resto de aplicaciones. */
function Strip({ process }: { process: Process }) {
  const style = stateStyles[process.state]
  const total = Math.max(1, process.burstTotal)
  const progress = Math.round(((total - process.burstRemaining) / total) * 100)
  return (
    <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-1.5">
      <span className="shrink-0 text-[0.66rem] font-medium" style={{ color: style.hex }}>
        {style.label}
      </span>
      {process.state === "ejecutando" ? (
        <span className="truncate font-mono text-[0.64rem] text-muted-foreground">
          {process.registers.ir}
        </span>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="h-1 w-14 overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full rounded-full"
            style={{ background: style.hex }}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          />
        </div>
        <span className="text-[0.62rem] tabular-nums text-muted-foreground">{progress}%</span>
      </div>
    </div>
  )
}

type Phase = "jugando" | "ganado" | "perdido"

interface Cell {
  mine: boolean
  /** Minas alrededor: si es 0, la casilla se abre en cascada. */
  near: number
  open: boolean
  flagged: boolean
}

interface Level {
  cols: number
  rows: number
  mines: number
  label: string
}

const LEVELS: Level[] = [
  { cols: 9, rows: 9, mines: 10, label: "Principiante" },
  { cols: 16, rows: 16, mines: 40, label: "Intermedio" },
  { cols: 22, rows: 16, mines: 70, label: "Experto" },
]

/** Los números usan el color clásico: 1 azul, 2 verde, 3 rojo… */
const MINE_COLOR: Record<number, string> = {
  1: "text-sky-500",
  2: "text-emerald-500",
  3: "text-rose-500",
  4: "text-violet-500",
  5: "text-amber-600",
  6: "text-cyan-600",
  7: "text-neutral-800 dark:text-neutral-200",
  8: "text-zinc-500",
}

function buildBoard(cols: number, rows: number): Cell[] {
  return Array.from({ length: cols * rows }, () => ({
    mine: false,
    near: 0,
    open: false,
    flagged: false,
  }))
}

function placeMines(
  board: Cell[],
  cols: number,
  rows: number,
  mines: number,
  safeIndex: number,
): void {
  // La primera casilla nunca explota: es la regla clásica y evita perder al
  // empezar por un pura suerte.
  let placed = 0
  while (placed < mines) {
    const index = Math.floor(Math.random() * cols * rows)
    if (index === safeIndex || board[index].mine) continue
    board[index].mine = true
    placed += 1
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const index = y * cols + x
      if (board[index].mine) continue
      let near = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          if (board[ny * cols + nx].mine) near += 1
        }
      }
      board[index].near = near
    }
  }
}

export function Minesweeper({ process }: { process: Process }) {
  const addWork = useSimStore((s) => s.addWork)
  const notify = useSystemStore((s) => s.notify)

  const [levelIndex, setLevelIndex] = useState(0)
  const level = LEVELS[levelIndex]
  const [board, setBoard] = useState<Cell[]>(() => buildBoard(9, 9))
  const [phase, setPhase] = useState<Phase>("jugando")
  const [seconds, setSeconds] = useState(0)
  const started = useRef(false)

  const reset = useCallback(
    (next = levelIndex) => {
      const target = LEVELS[next]
      setBoard(buildBoard(target.cols, target.rows))
      setPhase("jugando")
      setSeconds(0)
      started.current = false
    },
    [levelIndex],
  )

  // Reloj del juego: consume CPU del proceso, como cualquier trabajo real.
  useEffect(() => {
    if (phase !== "jugando" || !started.current) return
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s < 999) addWork(process.pid, 1)
        return s + 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase, process.pid, addWork])

  const remaining = useMemo(() => {
    const flags = board.filter((c) => c.flagged).length
    return Math.max(0, level.mines - flags)
  }, [board, level.mines])

  const opened = board.filter((c) => c.open).length
  const safeCells = level.cols * level.rows - level.mines

  /** Abre en cascada las casillas sin mina alrededor. */
  const flood = (source: Cell[], start: number) => {
    const seen = new Set<number>()
    const queue = [start]
    while (queue.length > 0) {
      const current = queue.pop()!
      if (seen.has(current)) continue
      seen.add(current)
      const cell = source[current]
      if (cell.flagged) continue
      cell.open = true
      if (cell.near > 0) continue
      const x = current % level.cols
      const y = Math.floor(current / level.cols)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= level.cols || ny >= level.rows) continue
          queue.push(ny * level.cols + nx)
        }
      }
    }
  }

  const reveal = (position: number) => {
    if (phase !== "jugando") return
    const cell = board[position]
    if (cell.flagged || cell.open) return

    let next = board.map((c) => ({ ...c }))
    if (!started.current) {
      // La primera jugada coloca las minas: nunca debajo del dedo.
      started.current = true
      const seeded = next
      placeMines(seeded, level.cols, level.rows, level.mines, position)
      next = seeded
    }

    const target = next[position]
    if (target.mine) {
      for (const c of next) if (c.mine) c.open = true
      next[position].flagged = true
      setBoard(next)
      setPhase("perdido")
      notify({
        title: "Buscaminas",
        body: `Pisaste una mina en el nivel ${level.label}.`,
        tone: "aviso",
      })
      addWork(process.pid, 12)
      return
    }

    flood(next, position)
    setBoard(next)
    addWork(process.pid, 6)

    const openedNow = next.filter((c) => c.open).length
    if (openedNow === safeCells) {
      setPhase("ganado")
      notify({
        title: "Buscaminas",
        body: `Nivel ${level.label} superado en ${seconds} s.`,
        tone: "ok",
      })
    }
  }

  const toggleFlag = (position: number) => {
    if (phase !== "jugando") return
    const cell = board[position]
    if (cell.open) return
    setBoard(board.map((c, i) => (i === position ? { ...c, flagged: !c.flagged } : c)))
    addWork(process.pid, 1)
  }

  const changeLevel = (next: number) => {
    setLevelIndex(next)
    reset(next)
  }

  return (
    <div className="flex h-full flex-col">
      <Strip process={process} />

      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <Bomb className="size-4 text-rose-500" />
        <span className="text-[0.78rem] font-semibold">Buscaminas</span>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="rounded-md bg-neutral-800 px-2 py-0.5 font-mono text-[0.72rem] tabular-nums text-emerald-300">
            {String(remaining).padStart(2, "0")}
          </span>
          <span className="rounded-md bg-neutral-800 px-2 py-0.5 font-mono text-[0.72rem] tabular-nums text-neutral-200">
            {String(seconds).padStart(3, "0")}
          </span>
          <button
            type="button"
            onClick={() => reset()}
            aria-label="Partida nueva"
            title="Partida nueva"
            className="grid size-7 place-items-center rounded-md border border-border/60 hover:bg-foreground/[0.07] active:scale-90"
          >
            {phase === "perdido" ? (
              <RotateCcw className="size-3.5 text-rose-500" />
            ) : (
              <Minus className="size-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
        {LEVELS.map((item, i) => (
          <button
            key={item.label}
            type="button"
            onClick={() => changeLevel(i)}
            className={cn(
              "rounded-md border px-2 py-1 text-[0.66rem] transition-colors",
              i === levelIndex
                ? "border-rose-500/50 bg-rose-500/12 text-rose-600 dark:text-rose-300"
                : "border-border/60 text-muted-foreground hover:bg-foreground/[0.07]",
            )}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto text-[0.62rem] text-muted-foreground">
          {level.cols}×{level.rows} · {level.mines} minas
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div
          className="mx-auto grid w-fit gap-1 rounded-lg bg-neutral-800/60 p-1.5"
          style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }}
          role="grid"
          aria-label={`Tablero de ${level.cols} por ${level.rows}`}
        >
          {board.map((cell, position) => (
            <motion.button
              key={position}
              type="button"
              role="gridcell"
              aria-label={`Casilla ${position % level.cols + 1},${
                Math.floor(position / level.cols) + 1
              }${cell.mine && cell.open ? ", mina" : ""}`}
              onClick={() => reveal(position)}
              onContextMenu={(event) => {
                event.preventDefault()
                toggleFlag(position)
              }}
              whileTap={cell.open ? undefined : { scale: 0.88 }}
              className={cn(
                "grid aspect-square w-6 place-items-center rounded-[3px] text-[0.68rem] font-bold transition-colors sm:w-7",
                cell.open
                  ? "bg-neutral-700/70"
                  : "bg-neutral-500/80 hover:bg-neutral-400/80",
                cell.mine && cell.open && "bg-rose-600/80",
                phase === "ganado" && cell.mine && "bg-emerald-600/70",
              )}
            >
              {cell.open ? (
                cell.mine ? (
                  <Bomb className="size-3.5 text-white" />
                ) : cell.near > 0 ? (
                  <span className={cn(MINE_COLOR[cell.near] ?? "text-neutral-200")}>
                    {cell.near}
                  </span>
                ) : null
              ) : cell.flagged ? (
                <Flag className="size-3.5 text-rose-400" fill="currentColor" />
              ) : null}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-1.5 text-[0.66rem] text-muted-foreground">
        {phase === "ganado" ? (
          <span className="flex items-center gap-1 text-emerald-500">
            <Trophy className="size-3.5" />
            ¡Superado en {seconds} s!
          </span>
        ) : phase === "perdido" ? (
          <span className="text-rose-500">Has pisado una mina. Pulsa ↺ para reintentar.</span>
        ) : (
          <span>
            Clic para abrir · clic derecho para poner bandera · {opened} de {safeCells}{" "}
            casillas
          </span>
        )}
      </div>
    </div>
  )
}