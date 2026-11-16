import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Check, Lock } from "lucide-react"
import Balatro from "@/components/Balatro"
import { Logo, Odometer, money, useTicker } from "@/components/venn/kit"
import { cn } from "@/lib/utils"

const Glass = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("absolute rounded-2xl border border-white/60 bg-white/45 p-3.5 text-sm text-foreground shadow-[0_24px_50px_-26px_rgba(12,10,8,.5)] backdrop-blur-xl", className)}>{children}</div>
)

/** Left side of the auth pages. A venn diagram made of the product itself: bank payments on one side, invoices on the other,
 *  and the matched overlap is a live swirl. Moving the pointer pulls the circles together and apart. */
export function Showcase({ mode, copy: given, progress = 0 }: { mode: "login" | "signup" | "setup"; copy?: { tag: string; h: string; p: string }; progress?: number }) {
  const exposure = useTicker(44250.37, 0.21, 3.9, 2200)
  const [px, setPx] = useState(0)
  const copy = given ?? (mode === "login"
    ? { tag: "Welcome back", h: "Your queue is waiting.", p: "Short payments, duplicates and claimed wires, each with its evidence." }
    : { tag: "Start free", h: "Start with a CSV. Know the rest by lunch.", p: "No new accounting system. Nothing is approved without a person." })
  const u = (n: number) => `calc(var(--d) * ${n})`
  // In setup the circles start almost apart and close as the steps are completed.
  const dx = mode === "setup" ? 0.82 - progress * 0.44 - px * 0.05 : 0.5 - px * 0.18, left1 = 0.12
  const lens = left1 + (dx + 1) / 2
  const label = "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[11px] uppercase tracking-wide transition-[left] duration-700 ease-[var(--ease-out-soft)]"
  return (
    <aside onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPx(((e.clientX - r.left) / r.width) * 2 - 1) }} onPointerLeave={() => setPx(0)}
      className="relative hidden h-screen overflow-hidden lg:sticky lg:top-0 lg:block" style={{ background: "linear-gradient(180deg,#f9a8d4 0%,#fbbddb 30%,#fcd9e9 58%,#fef1f7 82%,#ffffff 100%)" }}>
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-[6%] size-[460px] animate-float-slow rounded-full bg-[#f472b6]/45 blur-[100px]" />
      <div aria-hidden="true" className="dotgrid pointer-events-none absolute inset-0 opacity-[.13] [mask-image:linear-gradient(180deg,black,transparent_65%)]" />
      <div className="relative flex h-full flex-col px-10 pt-9 xl:px-14">
        <Link to="/" className="inline-flex w-fit"><Logo size={30} /></Link>
        <div className="relative z-10 mt-8 max-w-[560px] animate-rise-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/50 px-3 py-1 font-mono text-[11px] uppercase backdrop-blur"><span className="size-1.5 rounded-full bg-foreground" />{copy.tag}</div>
          <h2 className="mt-4 text-[40px] leading-[42px] tracking-[-0.025em] xl:text-[52px] xl:leading-[54px]">{copy.h}</h2>
          <p className="mt-3 max-w-[440px] text-base text-foreground/70 xl:text-lg">{copy.p}</p>
          {mode === "signup" && <ul className="mt-4 space-y-1.5 text-[15px]">{["Every claim is tied to a stored record", "Amounts are calculated by code, not guessed", "An owner approves anything consequential"].map((t) => <li key={t} className="flex items-center gap-2.5"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-white"><Check className="size-3" /></span>{t}</li>)}</ul>}
        </div>

        <div className="relative min-h-0 flex-1" style={{ ["--d" as string]: "min(340px, 36vh)" }}>
          <div className="absolute bottom-[-4%] left-1/2 h-[var(--d)] -translate-x-1/2" style={{ width: u(1.95) }}>
            {[left1, left1 + dx].map((l, i) => <div key={i} aria-hidden="true" className="absolute top-0 aspect-square rounded-full border border-white/80 bg-white/25 shadow-[0_30px_80px_-40px_rgba(244,114,182,.9)] backdrop-blur-[2px] transition-[left] duration-700 ease-[var(--ease-out-soft)]" style={{ left: u(l), width: "var(--d)" }} />)}
            <div className="absolute top-0 aspect-square transform-gpu overflow-hidden rounded-full transition-[left] duration-700 ease-[var(--ease-out-soft)]" style={{ left: u(left1), width: "var(--d)" }}>
              <div className="absolute top-0 aspect-square overflow-hidden rounded-full transition-[left] duration-700 ease-[var(--ease-out-soft)]" style={{ left: u(dx), width: "var(--d)" }}>
                <div className="absolute inset-0 bg-black"><Balatro color1="#f9a8d4" color2="#000000" color3="#000000" swirl={0.25} pixelSize={1.5} mouseInteraction={false} contrast={3.5} lighting={0.4} speed={1} rotationSpeed={0} scale={1} detail={5} crt={0} mouseStrength={1} intro lightMode={false} /></div>
              </div>
            </div>
            <span className={cn(label, "text-foreground/70")} style={{ left: u(left1 + (dx * 0.5 - 0.02)), top: "50%" }}>bank<br />payments</span>
            <span className={cn(label, "text-foreground/70")} style={{ left: u(left1 + dx + 1 - dx * 0.5 + 0.02), top: "50%" }}>open<br />invoices</span>
            <span className={cn(label, "text-white")} style={{ left: u(lens), top: "50%", opacity: mode === "setup" ? Math.min(1, Math.max(0, (progress - 0.15) * 4)) : 1, transition: "left 700ms var(--ease-out-soft), opacity 500ms" }}>matched</span>
            <Glass className="-left-6 -top-[14%] w-[240px] animate-float [--r:-2deg] [@media(max-height:780px)]:hidden">
              <div className="flex items-center gap-2 font-mono text-[11px] text-foreground/60"><Check className="size-3.5 text-[#17692b]" />MATCHED · RULE R3</div>
              <div className="mt-1.5">PAY-0009 → INV-1047 + INV-1048</div>
            </Glass>
            <Glass className="-right-4 top-[8%] w-[220px] animate-float-slow [--r:2deg]">
              <div className="font-mono text-[11px] text-foreground/60">EXPOSURE UNDER REVIEW</div>
              <Odometer value={money(exposure)} className="mt-1 text-[22px] tracking-[-0.02em]" />
            </Glass>
            <Glass className="-bottom-0 left-[6%] hidden w-[230px] animate-float [--r:1deg] [@media(min-height:900px)]:block">
              <div className="flex items-center gap-2 font-mono text-[11px] text-foreground/60"><Lock className="size-3.5" />LOGGED · IMMUTABLE</div>
              <div className="mt-1.5">Write-off approved by Dana W.</div>
            </Glass>
          </div>
        </div>
      </div>
    </aside>
  )
}

