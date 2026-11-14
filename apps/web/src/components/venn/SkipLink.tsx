/** First tab stop on every page: jumps keyboard users past the navigation. */
export function SkipLink() {
  return (
    <a href="#main" onClick={(e) => { e.preventDefault(); const m = document.querySelector("main"); m?.setAttribute("tabindex", "-1"); m?.focus(); m?.scrollIntoView() }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-white">Skip to content</a>
  )
}
