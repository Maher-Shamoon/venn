/** Fetches the page code in the background once the first page is showing, so moving between pages never waits on the network. */
const groups: (() => Promise<unknown>)[][] = [
  // public site and sign-in first: they are what a visitor clicks next
  [() => import("@/components/site/Home"), () => import("@/components/site/Pricing"), () => import("@/components/site/Company"), () => import("@/components/site/Content"), () => import("@/components/app/Auth")],
  // then the app
  [() => import("@/components/app/Shell"), () => import("@/features/dashboard/routes"), () => import("@/features/ledger/routes"), () => import("@/features/investigations/routes"), () => import("@/features/reconciliation/routes"), () => import("@/features/approvals/routes"), () => import("@/features/workflow/routes"), () => import("@/features/imports/routes"), () => import("@/features/documents/routes"), () => import("@/features/team/routes"), () => import("@/components/app/Admin"), () => import("@/components/app/System")],
]

export function preloadPages() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (c?.saveData) return
  const idle = (f: () => void) => ("requestIdleCallback" in window ? window.requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 800))
  const run = (i: number) => { if (i >= groups.length) return; idle(() => { void Promise.allSettled(groups[i].map((l) => l())).then(() => run(i + 1)) }) }
  run(0)
}
