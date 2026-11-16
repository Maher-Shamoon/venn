import { Logo } from "./kit"

/** Shown while a page's code or a sign-in check is in flight: the wordmark on the same pink wash as sign-in, breathing gently. */
export function Splash({ label = "Loading venn" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6" style={{ background: "linear-gradient(180deg,#f9a8d4 0%,#fbbddb 35%,#fde3ef 70%,#ffffff 100%)" }}>
      <div className="motion-safe:animate-pulse"><Logo size={52} /></div>
      <span className="h-0.5 w-24 overflow-hidden rounded-full bg-black/10"><span className="block h-full w-1/2 rounded-full bg-foreground motion-safe:animate-[splash-slide_1.2s_ease-in-out_infinite]" /></span>
    </div>
  )
}
