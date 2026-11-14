import { Component, type ReactNode } from "react"
import { Page500 } from "./System"

/** Catches render errors so a broken screen shows the 500 page instead of a white page. Must sit inside the router. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.error("Unhandled render error", error) }
  render() { return this.state.failed ? <Page500 /> : this.props.children }
}
