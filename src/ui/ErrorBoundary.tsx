import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[BASSX] Unhandled UI error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal">
          <span className="fatal__mark">BX</span>
          <h1>Something dropped a channel.</h1>
          <p>
            BASSX hit an unexpected error. Your saved presets are still on this
            device — reloading usually restores everything.
          </p>
          <pre>{this.state.error.message}</pre>
          <button
            type="button"
            className="primary-btn"
            onClick={() => window.location.reload()}
          >
            Reload BASSX
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
