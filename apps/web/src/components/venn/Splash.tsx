import { createPortal } from "react-dom"

/**
 * Full-screen change loader (first load, sign-in, sign-up, setup): the wordmark over a blurred copy of the screen the person was on.
 * The two circles start apart, slide together, and the overlap fills black; when the mark is whole the screen is ready.
 * Inside a screen (navigating the app, loading a table) use skeletons instead, never this.
 */
export function Splash({ label = "Loading venn" }: { label?: string }) {
  const node = (
    <div role="status" aria-label={label} className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-b from-[#f9a8d4]/45 via-white/55 to-white/75 backdrop-blur-xl animate-in fade-in duration-200">
      <span className="inline-flex items-center gap-[0.06em] font-medium leading-none tracking-[-0.05em] text-foreground" style={{ fontSize: 92 }}>
        venn
        <svg viewBox="0 0 24 24" className="size-[0.8em] overflow-visible" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle className="venn-l" cx="8.5" cy="12" r="6.5" />
          <circle className="venn-r" cx="15.5" cy="12" r="6.5" />
          <path className="venn-lens" d="M12 6.4a6.5 6.5 0 0 1 0 11.2 6.5 6.5 0 0 1 0-11.2z" fill="currentColor" stroke="none" />
        </svg>
      </span>
    </div>
  )
  return typeof document === "undefined" ? node : createPortal(node, document.body)
}
