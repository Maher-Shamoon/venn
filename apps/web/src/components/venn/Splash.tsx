import { createPortal } from "react-dom"

/**
 * Whole-screen change loader (sign-in, sign-up, setup, first load): only the mark, over a blurred copy of the screen the person was on.
 * Two outlined circles start apart and slide together; where they overlap the fill turns black. When the mark is whole, the screen is ready.
 * Inside a screen (navigating the app, loading a table) use skeletons instead, never this.
 * Never keep it in state that survives leaving the page: see GoogleButton, which clears it when the browser restores the page.
 */
export function Splash({ label = "Loading venn" }: { label?: string }) {
  const node = (
    <div role="status" aria-label={label} className="fixed inset-0 z-[100] flex items-center justify-center bg-white/30 backdrop-blur-xl animate-in fade-in duration-200">
      <svg viewBox="0 0 24 24" className="size-28 overflow-visible text-foreground" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle className="venn-l" cx="8.5" cy="12" r="6.5" />
        <circle className="venn-r" cx="15.5" cy="12" r="6.5" />
        <path className="venn-lens" d="M12 6.4a6.5 6.5 0 0 1 0 11.2 6.5 6.5 0 0 1 0-11.2z" fill="currentColor" stroke="none" />
      </svg>
    </div>
  )
  return typeof document === "undefined" ? node : createPortal(node, document.body)
}
