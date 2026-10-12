import { Component, type ErrorInfo, type ReactNode } from "react"
import { captureError } from "@/store/errorStore"

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Cortafuegos: si un panel revienta, el escritorio sigue vivo. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError("react", error.message, info.componentStack?.slice(0, 300), error.stack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-[0.85rem] font-semibold text-destructive">
          Algo falló en este panel
        </p>
        <p className="max-w-[42ch] text-[0.72rem] leading-relaxed text-muted-foreground">
          El error quedó registrado en «Registro del sistema». El resto del escritorio
          sigue funcionando.
        </p>
        <code className="max-w-full overflow-x-auto rounded-md bg-muted px-2 py-1 font-mono text-[0.66rem] text-muted-foreground">
          {error.message}
        </code>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="rounded-lg border border-border px-3 py-1.5 text-[0.74rem] transition-colors hover:bg-muted"
        >
          Reintentar
        </button>
      </div>
    )
  }
}