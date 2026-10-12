import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Lock, Moon, Power, RefreshCw, Sun } from "lucide-react"
import { cn } from "cn"
import { useSystemStore } from "@/store/systemStore"
import { useSimStore } from "@/store/simStore"
import { useWindowStore } from "@/store/windowStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { spring } from "@/lib/motion"

export function SystemScreens() {
  const power = useSystemStore((s) => s.power)
  if (power === "on") return null
  if (power === "booting") return <BootScreen />
  if (power === "locked") return <LockScreen />
  if (power === "sleeping") return <SleepScreen />
  return <ShutdownScreen />
}

function BootScreen() {
  const bootProgress = useSystemStore((s) => s.bootProgress)
  const powerOn = useSystemStore((s) => s.powerOn)
  const restart = useSystemStore((s) => s.restart)
  const setBootProgress = useSystemStore((s) => s.setBootProgress)

  useEffect(() => {
    if (bootProgress >= 1) {
      const id = window.setTimeout(() => powerOn(), 420)
      return () => window.clearTimeout(id)
    }
    const step = 0.04 + Math.random() * 0.09
    const id = window.setTimeout(
      () => setBootProgress(Math.min(1, bootProgress + step)),
      90 + Math.random() * 160,
    )
    return () => window.clearTimeout(id)
  }, [bootProgress, powerOn, setBootProgress])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-neutral-950 text-neutral-100">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring}
        className="flex flex-col items-center gap-6"
      >
        <div className="grid size-16 place-items-center rounded-2xl bg-indigo-500 text-2xl font-bold text-white">
          SO
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Iniciando {useSystemStore.getState().user.host}</p>
          <p className="mt-1 text-[0.7rem] text-neutral-500">
            Cargando kernel, planificador y gestor de memoria
          </p>
        </div>
        <div className="h-1 w-56 overflow-hidden rounded-full bg-neutral-800">
          <motion.div
            className="h-full rounded-full bg-indigo-400"
            animate={{ width: `${bootProgress * 100}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          />
        </div>
      </motion.div>

      <div className="absolute inset-x-0 bottom-8 flex justify-center">
        <button
          type="button"
          onClick={restart}
          className="text-[0.68rem] text-neutral-600 transition-colors hover:text-neutral-400"
        >
          Reiniciar
        </button>
      </div>
    </div>
  )
}

function ShutdownScreen() {
  const powerOn = useSystemStore((s) => s.powerOn)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-neutral-950 text-neutral-100"
      onDoubleClick={powerOn}
    >
      <motion.div
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Power className="size-10 text-neutral-500" />
      </motion.div>
      <p className="text-sm text-neutral-400">El equipo está apagado</p>
      <Button
        size="lg"
        variant="secondary"
        onClick={powerOn}
        className="gap-2"
      >
        <Power className="size-4" />
        Encender
      </Button>
      <p className="text-[0.68rem] text-neutral-600">
        También puedes hacer doble clic en cualquier parte
      </p>
    </motion.div>
  )
}

function SleepScreen() {
  const wake = useSystemStore((s) => s.wake)
  const sleep = useSystemStore((s) => s.sleep)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onDoubleClick={wake}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-100"
    >
      <Moon className="size-8 text-neutral-600" />
      <p className="text-sm text-neutral-500">En suspensión</p>
      <button
        type="button"
        onClick={wake}
        className="rounded-lg border border-neutral-800 px-4 py-2 text-[0.76rem] text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
      >
        Despertar
      </button>
      <button
        type="button"
        onClick={sleep}
        className="text-[0.68rem] text-neutral-700 transition-colors hover:text-neutral-500"
      >
        Volver a suspender
      </button>
    </motion.div>
  )
}

function LockScreen() {
  const user = useSystemStore((s) => s.user)
  const unlock = useSystemStore((s) => s.unlock)
  const shutdown = useSystemStore((s) => s.shutdown)
  const [value, setValue] = useState("")
  const [error, setError] = useState(false)
  const now = new Date()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 px-6 text-slate-100"
      onClick={() => setError(false)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
        className="flex flex-col items-center gap-4"
      >
        <div className="text-center">
          <p className="text-5xl font-light tabular-nums">
            {now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {now.toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>

        <div className="grid size-16 place-items-center rounded-full bg-slate-700 text-xl font-semibold">
          {user.name.slice(0, 1)}
        </div>
        <p className="text-sm font-medium">{user.name}</p>

        <form
          className="flex w-64 flex-col items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (unlock(value)) {
              setValue("")
              return
            }
            setError(true)
          }}
        >
          <Input
            type="password"
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Contraseña"
            aria-label="Contraseña"
            className={cn(
              "h-9 w-full rounded-full bg-white/10 text-center text-slate-100 placeholder:text-slate-500",
              error && "border-destructive",
            )}
          />
          <Button type="submit" size="sm" className="w-full rounded-full">
            <Lock className="size-3.5" />
            Desbloquear
          </Button>
          <p className="text-[0.68rem] text-slate-500">
            Pista: la contraseña es <span className="font-mono">simulador</span>
          </p>
          {error ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[0.7rem] text-rose-400"
            >
              Contraseña incorrecta
            </motion.p>
          ) : null}
        </form>

        <div className="mt-6 flex gap-2">
          <Button variant="ghost" size="sm" onClick={shutdown} className="text-slate-400 hover:text-slate-100">
            <Power className="size-3.5" />
            Apagar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-slate-100"
            onClick={() => {
              useSimStore.getState().reset()
              useWindowStore.getState().reset()
              unlock("simulador")
            }}
          >
            <RefreshCw className="size-3.5" />
            Cerrar sesión
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export { Sun }