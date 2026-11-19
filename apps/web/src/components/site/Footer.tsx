import { Link } from "react-router-dom"
import { Logo } from "@/components/venn/kit"
import { PLATFORM, TEAMS, TRUST } from "./nav"

const COLS: [string, { t: string; to: string }[]][] = [
  ["Platform", PLATFORM],
  ["Teams", TEAMS],
  ["Trust", TRUST],
  ["Company", [{ t: "Integrations", to: "/p/integrations" }, { t: "Pricing", to: "/pricing" }, { t: "About", to: "/about" }, { t: "Contact", to: "/contact" }, { t: "Privacy", to: "/privacy" }, { t: "Terms", to: "/terms" }, { t: "Sign in", to: "/login" }]],
]

export function SiteFooter() {
  return (
    <footer className="overflow-hidden bg-[#1D1D1D] pb-16 pt-16 text-white">
      <div className="mx-auto max-w-[clamp(1280px,82vw,1600px)] px-[clamp(1.25rem,3.2vw,3rem)]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div><Logo size={30} /><p className="mt-3 max-w-[260px] text-sm text-white/60">Find the revenue slipping through the cracks.</p></div>
          {COLS.map(([h, items]) => (
            <div key={h}><div className="text-sm text-white/50">{h}</div><ul className="mt-3 space-y-2">{items.map((i) => <li key={i.t}><Link to={i.to} className="text-sm text-white hover:underline">{i.t}</Link></li>)}</ul></div>
          ))}
        </div>
        <p className="mt-14 max-w-[720px] text-xs text-white/50">venn recommends and records. It never moves money, and it does not promise recovery.</p>
      </div>
      {/* Decorative wordmark drawn with CSS content so it is not read or contrast-checked as text. */}
      <div aria-hidden="true" className="select-none whitespace-nowrap pt-6 text-center font-medium leading-[0.8] tracking-[-0.06em] text-white/[0.06] after:content-['venn']" style={{ fontSize: "clamp(160px, 32vw, 520px)" }} />
    </footer>
  )
}
