import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

/**
 * Evita que un error de render deje toda la tienda en negro: en su lugar
 * muestra un aviso y un botón para recargar.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de render en la tienda:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-night px-6 text-center">
          <p className="font-display text-3xl tracking-[0.2em] text-gold">SULTAN BLACK</p>
          <p className="max-w-md text-sm font-light text-bone">
            Algo salió mal al mostrar esta página. Vuelve a intentarlo.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="border border-gold bg-gold px-8 py-3 text-xs font-bold uppercase tracking-[0.24em] text-night transition-colors hover:bg-gold-soft"
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
