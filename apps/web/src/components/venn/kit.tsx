import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

export function Mark({ className = "size-[22px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8.5" cy="12" r="6.5" />
      <circle cx="15.5" cy="12" r="6.5" />
      <path d="M12 6.4a6.5 6.5 0 0 1 0 11.2 6.5 6.5 0 0 1 0-11.2z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** The product name is always lowercase: "venn". */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium leading-none tracking-[-0.05em]", className)} style={{ fontSize: size }}>
      venn<Mark className="size-[0.8em]" />
    </span>
  )
}

/** Scroll reveal: fades up 24px once, eased out (ramp-style). */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ "--d": `${delay}ms` } as CSSProperties} className={cn("reveal", on && "is-in", className)}>
      {children}
    </div>
  )
}

/** A number that ticks upward. Static when the user prefers reduced motion. */
export function useTicker(start: number, min: number, max: number, ms = 1400) {
  const [v, setV] = useState(start)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = setInterval(() => setV((x) => x + min + Math.random() * (max - min)), ms)
    return () => clearInterval(t)
  }, [min, max, ms])
  return v
}

/** Two-tone headline used throughout: black lead, grey continuation. */
export function TwoTone({ lead, rest, className }: { lead: ReactNode; rest: ReactNode; className?: string }) {
  return (
    <span className={className}>
      <span className="text-foreground">{lead}</span> <span className="text-hushed">{rest}</span>
    </span>
  )
}

function Digit({ d }: { d: string }) {
  const cur = useRef(d)
  const [prev, setPrev] = useState<string | null>(null)
  const [k, setK] = useState(0)
  useEffect(() => {
    if (cur.current === d) return
    setPrev(cur.current); cur.current = d; setK((x) => x + 1)
    const t = setTimeout(() => setPrev(null), 1150)
    return () => clearTimeout(t)
  }, [d])
  if (!/\d/.test(d)) return <span className="inline-block" style={{ height: "1.25em", lineHeight: "1.25em" }}>{d}</span>
  return (
    <span className="relative inline-block overflow-hidden" style={{ height: "1.25em", lineHeight: "1.25em" }}>
      <span className="invisible">{d}</span>
      {prev !== null && <span key={`p${k}`} className="absolute inset-0 animate-roll-out">{prev}</span>}
      <span key={`c${k}`} className={cn("absolute inset-0", prev !== null && "animate-roll-in")}>{d}</span>
    </span>
  )
}

/** Odometer: each changed digit rolls upward. The new digit enters from below and pushes the old one out. */
export function Odometer({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("tick inline-flex items-center", className)} aria-label={value} role="img">
      <span aria-hidden="true" className="inline-flex items-center">{value.split("").map((c, i, a) => <Digit key={a.length - i} d={c} />)}</span>
    </span>
  )
}

export const money =(n: number, cur = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n)
