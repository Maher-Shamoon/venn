import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { Check, Eye, EyeOff, Loader2, Lock, Mail, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Balatro from "@/components/Balatro"
import { Logo, Odometer, money, useTicker } from "@/components/venn/kit"
import { config } from "@/config"
import { errorMessage, toastApiError } from "@/lib/errors"
import { activeOrg, createOrganization, fetchMe, setActiveOrg } from "@/features/identity/api"
import { AuthError, completeReset, googleAvailable, requestReset, resendVerification, signIn, signInWithGoogle, signUp, useResetReady, useSignedIn } from "@/auth"
import { request } from "@/api/http"
import { A, useApp, type Role } from "./store"
import { Field, NativeSelect } from "./ui"
import { cn } from "@/lib/utils"

const Glass = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("absolute rounded-2xl border border-white/60 bg-white/45 p-3.5 text-sm text-foreground shadow-[0_24px_50px_-26px_rgba(12,10,8,.5)] backdrop-blur-xl", className)}>{children}</div>
)

/** Left side of the auth pages. A venn diagram made of the product itself: bank payments on one side, invoices on the other,
 *  and the matched overlap is a live swirl. Moving the pointer pulls the circles together and apart. */
function Showcase({ mode }: { mode: "login" | "signup" }) {
  const exposure = useTicker(44250.37, 0.21, 3.9, 2200)
  const [px, setPx] = useState(0)
  const copy = mode === "login"
    ? { tag: "Welcome back", h: "Your queue is waiting.", p: "Short payments, duplicates and claimed wires, each with its evidence." }
    : { tag: "Start free", h: "Start with a CSV. Know the rest by lunch.", p: "No new accounting system. Nothing is approved without a person." }
  const u = (n: number) => `calc(var(--d) * ${n})`
  const dx = 0.5 - px * 0.18, left1 = 0.12
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
            <span className={cn(label, "text-white")} style={{ left: u(lens), top: "50%" }}>matched</span>
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

function Card({ title, sub, children, foot, mode = "login" }: { title: string; sub?: string; children: ReactNode; foot?: ReactNode; mode?: "login" | "signup" }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.08fr_1fr]">
      <Showcase mode={mode} />
      <div className="flex min-h-screen flex-col">
        <div className="flex h-24 items-end px-6 pb-4 lg:hidden" style={{ background: "linear-gradient(180deg,#f9a8d4,#fde3ef 70%,#fff)" }}><Link to="/"><Logo size={28} /></Link></div>
        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[420px]">
            <div className="animate-rise-in">
              <h1 className="text-[34px] leading-10 tracking-[-0.02em]">{title}</h1>{sub && <p className="mt-1.5 text-lg text-hushed">{sub}</p>}
            </div>
            <div className="mt-8 animate-rise-in [animation-delay:90ms]">{children}</div>
            {foot && <div className="mt-6 animate-rise-in text-center text-sm text-hushed [animation-delay:160ms]">{foot}</div>}
          </div>
        </main>
        <p className="px-6 pb-6 text-center text-xs text-hushed">Your data is isolated per organization.</p>
      </div>
    </div>
  )
}
const strength = (p: string) => [p.length >= 10, /[A-Z]/.test(p) && /[a-z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length
const email = (v: string) => /^\S+@\S+\.\S+$/.test(v)

function PasswordInput({ value, onChange, autoComplete, invalid, id }: { value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; id?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} className="h-11 pr-11 text-base" />
      <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-md text-hushed transition-colors hover:bg-muted hover:text-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
    </div>
  )
}
const Submit = ({ busy, children }: { busy: boolean; children: ReactNode }) => <Button type="submit" size="lg" disabled={busy} className="h-11 w-full text-base">{busy ? <><Loader2 className="size-4 animate-spin" />Please wait</> : children}</Button>

const GoogleG = () => <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" /><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>

function GoogleButton({ onError }: { onError: (m: string) => void }) {
  if (!googleAvailable) return null
  return (
    <>
      <Button type="button" variant="outline" size="lg" className="h-11 w-full gap-3 text-base" onClick={() => void signInWithGoogle().catch((e) => onError(e instanceof Error ? e.message : "Google sign-in failed."))}><GoogleG />Continue with Google</Button>
      <div className="relative py-1 text-center text-xs text-hushed"><span className="bg-white px-3">or use your email</span><span className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" /></div>
    </>
  )
}

export function Login() {
  const s = useApp(), nav = useNavigate(), from = (useLocation().state as { from?: string } | null)?.from
  const [f, setF] = useState({ email: "", password: "" }), [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  if (s.session && !busy) return <Navigate to="/app" replace />
  const go = async (name: string, mail: string) => {
    setBusy(true)
    let target = s.onboarded ? from ?? "/app" : "/onboarding/organization"
    if (config.authSource === "supabase") {
      // Real accounts: the server says whether this person already belongs to an organization.
      try {
        const m = (await fetchMe()).memberships.find((x) => x.status === "active")
        const pending = localStorage.getItem("venn.invite")
        if (m) { setActiveOrg(m.organization_id); A.finishOnboarding(); target = pending ? `/invite/${pending}` : from ?? "/app" } else target = pending ? `/invite/${pending}` : "/onboarding/organization"
      } catch (x) { toastApiError(x) }
    } else await new Promise((r) => setTimeout(r, 650))
    A.signIn(name, mail)
    nav(target)
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email(f.email) || !f.password) return setErr("Enter your email and password.")
    setBusy(true)
    try { const u = await signIn(f.email, f.password); setErr(""); go(u.name, u.email) }
    catch (x) { setBusy(false); setErr(x instanceof AuthError ? x.message : "Something went wrong. Try again.") }
  }
  return (
    <Card mode="login" title="Sign in" sub="Welcome back." foot={<>New to venn? <Link to="/signup" className="text-foreground underline underline-offset-4">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <GoogleButton onError={setErr} />
        <Field label="Work email"><Input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!err} className="h-11 text-base" /></Field>
        <Field label="Password"><PasswordInput autoComplete="current-password" value={f.password} onChange={(v) => setF({ ...f, password: v })} invalid={!!err} /></Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <div className="flex items-center justify-between text-sm"><label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="size-4 accent-[#f472b6]" />Keep me signed in</label><Link to="/forgot-password" className="underline underline-offset-4">Forgot password?</Link></div>
        <Submit busy={busy}>Sign in</Submit>
        <div className="relative py-1 text-center text-xs text-hushed"><span className="bg-white px-3">or</span><span className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" /></div>
        <Button type="button" variant="outline" size="lg" disabled={busy} className="h-11 w-full text-base" onClick={() => go("Dana Whitfield", "dana@brightpath.example")}>Continue with the sample workspace</Button>
      </form>
    </Card>
  )
}

export function Signup() {
  const nav = useNavigate()
  const [f, setF] = useState({ name: "", email: "", password: "", terms: false }), [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  const st = strength(f.password)
  const rules: [string, boolean][] = [["12+ characters", f.password.length >= 12], ["Upper and lower case", /[A-Z]/.test(f.password) && /[a-z]/.test(f.password)], ["A number", /\d/.test(f.password)], ["A symbol", /[^A-Za-z0-9]/.test(f.password)]]
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return setErr("Enter your full name.")
    if (!email(f.email)) return setErr("Enter a valid work email address.")
    if (st < 3 || f.password.length < 12) return setErr("Choose a stronger password.")
    if (!f.terms) return setErr("Accept the terms to continue.")
    setErr(""); setBusy(true)
    signUp(f.name.trim(), f.email, f.password).then((u) => { if (!u.needsVerification) A.startFresh(u.name, u.email); nav("/verify-email", { state: { email: u.email } }) }, (x) => { setBusy(false); setErr(x instanceof AuthError ? x.message : "Something went wrong. Try again.") })
  }
  return (
    <Card mode="signup" title="Create your account" sub="Start free. No card needed." foot={<>Already have an account? <Link to="/login" className="text-foreground underline underline-offset-4">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <GoogleButton onError={setErr} />
        <Field label="Full name"><Input autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="h-11 text-base" /></Field>
        <Field label="Work email"><Input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="h-11 text-base" /></Field>
        <Field label="Password"><PasswordInput autoComplete="new-password" value={f.password} onChange={(v) => setF({ ...f, password: v })} /></Field>
        <div className="flex gap-1" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i < st ? (st < 3 ? "bg-[#e0b13a]" : "bg-[#2f9e44]") : "bg-muted")} />)}</div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">{rules.map(([t, ok]) => <li key={t} className={cn("flex items-center gap-1.5 transition-colors", ok ? "text-[#17692b]" : "text-hushed")}><Check className={cn("size-3.5", !ok && "opacity-30")} />{t}</li>)}</ul>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} className="mt-1 size-4 accent-[#f472b6]" />I agree to the terms and the privacy policy.</label>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Submit busy={busy}>Create account</Submit>
      </form>
    </Card>
  )
}

export function VerifyEmail() {
  const s = useApp(), nav = useNavigate(), loc = useLocation()
  const addr: string | undefined = (loc.state as { email?: string } | null)?.email ?? s.session?.email
  const [cool, setCool] = useState(0)
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t) }, [cool])
  return (
    <Card title="Check your email" sub={`We sent a link to ${addr ?? "your inbox"}.`}>
      <div className="flex size-12 items-center justify-center rounded-full bg-lime"><Mail className="size-5" /></div>
      <p className="mt-4 text-sm text-hushed">Open the link to verify your address. It expires in 24 hours.</p>
      <div className="mt-5 space-y-2"><Button className="w-full" onClick={() => nav("/onboarding/organization")}>I verified my email</Button><Button variant="outline" className="w-full" disabled={cool > 0} onClick={() => { setCool(30); if (addr) void resendVerification(addr).catch(() => undefined) }}>{cool > 0 ? `Resend in ${cool}s` : "Resend email"}</Button></div>
    </Card>
  )
}

export function Forgot() {
  const [mail, setMail] = useState(""), [done, setDone] = useState(false), [err, setErr] = useState("")
  return (
    <Card title="Reset your password" sub="We will email you a link." foot={<Link to="/login" className="text-foreground underline underline-offset-4">Back to sign in</Link>}>
      {done ? <div className="space-y-3"><p role="status" className="rounded-lg bg-[#e3f6e6] p-4 text-sm text-[#17692b]">If an account exists for that address, a reset link is on its way.</p>{config.dataSource === "local" && <Button variant="outline" className="w-full" render={<Link to="/reset-password" />}>Open the reset link</Button>}</div> : (
        <form onSubmit={(e) => { e.preventDefault(); if (email(mail)) { requestReset(mail); setDone(true) } else setErr("Enter a valid email address.") }} className="space-y-4" noValidate>
          <Field label="Work email"><Input type="email" value={mail} onChange={(e) => setMail(e.target.value)} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}<Button type="submit" className="w-full">Send reset link</Button>
        </form>)}
    </Card>
  )
}
export function Reset() {
  const nav = useNavigate()
  const [p, setP] = useState({ a: "", b: "" }), [err, setErr] = useState(""), ready = useResetReady()
  if (ready === undefined) return null
  if (!ready) return <Card title="This reset link is not valid" sub="It may have expired or already been used."><Button className="w-full" render={<Link to="/forgot-password" />}>Request a new link</Button></Card>
  return (
    <Card title="Choose a new password">
      <form onSubmit={(e) => { e.preventDefault(); if (strength(p.a) < 3 || p.a.length < 12) return setErr("Choose a stronger password."); if (p.a !== p.b) return setErr("The passwords do not match."); completeReset(p.a).then(() => nav("/login"), (x) => setErr(x instanceof AuthError ? x.message : "Something went wrong. Try again.")) }} className="space-y-4" noValidate>
        <Field label="New password"><Input type="password" autoComplete="new-password" value={p.a} onChange={(e) => setP({ ...p, a: e.target.value })} /></Field><Field label="Confirm password"><Input type="password" autoComplete="new-password" value={p.b} onChange={(e) => setP({ ...p, b: e.target.value })} /></Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}<Button type="submit" className="w-full">Update password</Button>
      </form>
    </Card>
  )
}
function LocalInvite() {
  const { token } = useParams(), nav = useNavigate()
  const [name, setName] = useState(""), [pw, setPw] = useState(""), [err, setErr] = useState("")
  if (token === "expired") return <Card title="This invitation has expired" sub="Ask the person who invited you to send a new one."><Button className="w-full" render={<Link to="/login" />}>Go to sign in</Button></Card>
  return (
    <Card title="Join Brightpath Digital" sub="Dana Whitfield invited you as an AR specialist.">
      <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return setErr("Enter your name."); if (pw.length < 10) return setErr("Use at least 10 characters."); A.signIn(name, "sam@brightpath.example"); A.setRole("ar"); nav("/app") }} className="space-y-4" noValidate>
        <Field label="Email"><Input value="sam@brightpath.example" readOnly disabled /></Field><Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Password"><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}<Button type="submit" className="w-full">Accept invitation</Button>
      </form>
    </Card>
  )
}

type InviteInfo = { organization_name: string; role_name: string; email: string }

/** Joining an organization by emailed link. The server checks that the signed-in address is the invited one. */
function RemoteInvite() {
  const { token = "" } = useParams(), nav = useNavigate(), signedIn = useSignedIn()
  const [info, setInfo] = useState<InviteInfo | "invalid" | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  useEffect(() => {
    // Remember the link so signing in or verifying email later brings the person back here.
    localStorage.setItem("venn.invite", token)
    request<InviteInfo>(`/invitations/${encodeURIComponent(token)}`).then(setInfo, () => setInfo("invalid"))
  }, [token])
  if (info === null || signedIn === undefined) return null
  if (info === "invalid") return <Card title="This invitation is not valid" sub="It may have expired or been withdrawn. Ask the person who invited you to send a new one."><Button className="w-full" render={<Link to="/login" />}>Go to sign in</Button></Card>
  const accept = async () => {
    setBusy(true)
    try {
      await request(`/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", idempotent: true })
      localStorage.removeItem("venn.invite")
      const m = (await fetchMe()).memberships.find((x) => x.status === "active")
      if (m) setActiveOrg(m.organization_id)
      A.finishOnboarding()
      nav("/app", { replace: true })
    } catch (x) { setBusy(false); setErr(errorMessage(x)) }
  }
  return (
    <Card title={`Join ${info.organization_name}`} sub={`You were invited as ${info.role_name}.`}>
      {signedIn ? (
        <div className="space-y-3">
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <Button className="w-full" disabled={busy} onClick={accept}>Accept invitation</Button>
          <p className="text-xs text-hushed">Signed in with the wrong address? The invitation is for {info.email}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="mb-3 text-sm text-hushed">Use <b className="font-normal text-foreground">{info.email}</b> to accept.</p>
          <Button className="w-full" render={<Link to="/signup" />}>Create an account</Button>
          <Button className="w-full" variant="outline" render={<Link to="/login" />}>I already have an account</Button>
        </div>
      )}
    </Card>
  )
}
export const Invite = () => (config.authSource === "supabase" ? <RemoteInvite /> : <LocalInvite />)

/* ----------------------------------------------------------------- onboarding */
const STEPS = [["organization", "Organization", false], ["sources", "Financial sources", true], ["email", "Email", true], ["import", "Import", true], ["team", "Team", true], ["preferences", "Preferences", true]] as const
const Opt = ({ name, desc, on, set, tag }: { id?: string; name: string; desc: string; on: boolean; set: () => void; tag?: string }) => <button type="button" aria-pressed={on} onClick={set} className={cn("flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors", on ? "border-foreground bg-lime/30" : "border-border hover:bg-muted/60")}><span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border", on ? "border-foreground bg-foreground text-white" : "border-gray-medium")}>{on && <Check className="size-3" />}</span><span className="flex-1"><span className="block">{name} {tag && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-hushed">{tag}</span>}</span><span className="block text-sm text-hushed">{desc}</span></span></button>

export function Onboarding() {
  const { step = "organization" } = useParams(), nav = useNavigate(), s = useApp()
  const idx = Math.max(0, STEPS.findIndex(([k]) => k === step))
  const [org, setOrg] = useState({ name: s.settings.company.name === "Your workspace" ? "" : s.settings.company.name, industry: "Software agency", size: "11 to 50", country: "United States", currency: "USD", website: "" })
  const [rows, setRows] = useState<{ email: string; role: Role }[]>([{ email: "", role: "ar" }])
  const [prefs, setPrefs] = useState({ tz: "America/Chicago", terms: 30, auto: true })
  const [src, setSrc] = useState<string[]>(["csv"]), [mail, setMail] = useState<string | null>(null), [err, setErr] = useState("")
  const next = () => { setErr(""); if (idx === STEPS.length - 1) { A.saveSettings("financial", { ...s.settings.financial, timezone: prefs.tz, terms: prefs.terms, autoApply: prefs.auto }); A.finishOnboarding(); nav("/app"); return } nav("/onboarding/" + STEPS[idx + 1][0]) }
  const cont = async () => {
    if (idx === 0) {
      if (!org.name.trim()) return setErr("Organization name is required.")
      if (config.authSource === "supabase" && !activeOrg()) {
        try { setActiveOrg((await createOrganization({ name: org.name.trim(), industry: org.industry, company_size: org.size, website: org.website || undefined })).id) }
        catch (x) { toastApiError(x); return setErr(errorMessage(x)) }
      }
      A.saveSettings("company", { ...s.settings.company, name: org.name, industry: org.industry, size: org.size, website: org.website })
    }
    if (idx === 4) { const bad = rows.find((r) => r.email && !email(r.email)); if (bad) return setErr(`${bad.email} is not a valid email address.`); rows.filter((r) => r.email).forEach((r) => A.invite(r.email, r.role)); A.setSetup("team", true) }
    if (idx === 1) A.setSetup("sources", true); if (idx === 2 && mail) A.setSetup("email", true); if (idx === 3) A.setSetup("import", true); if (idx === 5) A.setSetup("prefs", true)
    next()
  }
  const [, label, skip] = STEPS[idx]
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[320px_1fr]">
      <aside className="border-b border-border bg-muted p-6 lg:border-b-0 lg:border-r lg:p-8">
        <Link to="/"><Logo size={26} /></Link>
        <ol className="mt-8 flex gap-2 overflow-x-auto lg:block lg:space-y-1">{STEPS.map(([k, t, sk], i) => <li key={k}><button type="button" onClick={() => i <= idx && nav("/onboarding/" + k)} className={cn("flex w-full items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors", i === idx ? "bg-white shadow-sm" : "text-hushed")}><span className={cn("flex size-6 items-center justify-center rounded-full font-mono text-xs", i < idx ? "bg-lime" : i === idx ? "bg-foreground text-white" : "bg-white")}>{i < idx ? <Check className="size-3.5" /> : i + 1}</span>{t}{sk && <span className="ml-auto hidden text-[11px] text-hushed lg:inline">skippable</span>}</button></li>)}</ol>
      </aside>
      <main className="mx-auto w-full max-w-[640px] px-5 py-10 md:py-16">
        <div className="font-mono text-xs text-hushed">STEP {idx + 1} OF {STEPS.length}</div>
        <h1 className="mt-2 text-[32px] leading-10 tracking-[-0.015em]">{label}</h1>
        <div className="mt-6 space-y-3">
          {idx === 0 && <><Field label="Organization name *"><Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Industry *"><NativeSelect value={org.industry} onChange={(e) => setOrg({ ...org, industry: e.target.value })}>{["Software agency", "IT consultancy", "Managed service provider", "Staffing and recruitment", "Professional services"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field><Field label="Company size *"><NativeSelect value={org.size} onChange={(e) => setOrg({ ...org, size: e.target.value })}>{["1 to 10", "11 to 50", "51 to 200", "200+"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field><Field label="Country *"><NativeSelect value={org.country} onChange={(e) => setOrg({ ...org, country: e.target.value, currency: e.target.value === "United Kingdom" ? "GBP" : e.target.value === "Germany" ? "EUR" : "USD" })}>{["United States", "United Kingdom", "Germany", "Canada"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field><Field label="Default currency *"><NativeSelect value={org.currency} onChange={(e) => setOrg({ ...org, currency: e.target.value })}>{["USD", "EUR", "GBP", "CAD"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field></div><Field label="Website"><Input value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} /></Field></>}
          {idx === 1 && [["csv", "Upload CSV", "Available now. Invoice and payment exports.", ""], ["quickbooks", "QuickBooks Online", "Read invoices and payments.", "planned"], ["stripe", "Stripe", "Read charges and payouts. Read-only.", "planned"], ["xero", "Xero", "Read invoices and payments.", "planned"]].map(([id, n, d, tag]) => <Opt key={id} id={id} name={n} desc={d} tag={tag} on={src.includes(id)} set={() => setSrc(src.includes(id) ? src.filter((x) => x !== id) : [...src, id])} />)}
          {idx === 2 && <><p className="text-sm text-hushed">venn reads messages that match your filters and sends only what you approve. It never deletes or edits mail.</p>{[["gmail", "Gmail", "Read replies and remittances. Send approved reminders."], ["outlook", "Outlook", "Planned for the first release."]].map(([id, n, d]) => <Opt key={id} id={id} name={n} desc={d} tag={id === "outlook" ? "planned" : ""} on={mail === id} set={() => setMail(mail === id ? null : id)} />)}</>}
          {idx === 3 && <div className="grid gap-2">{[["Import invoices (CSV)", "/app/invoices/import"], ["Import payments (CSV)", "/app/payments/import"], ["Upload a remittance PDF", "/app/invoices/pdf-review"]].map(([t, to]) => <Button key={t} variant="outline" className="justify-start" onClick={() => { A.setSetup("import", true); nav(to) }}>{t}</Button>)}<Button onClick={() => { A.setSetup("import", true); next() }}>Explore with the sample workspace</Button></div>}
          {idx === 4 && <>{rows.map((r, i) => <div key={i} className="grid grid-cols-[1fr_140px_36px] items-center gap-2"><Input aria-label="Email" placeholder="name@company.com" value={r.email} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} /><NativeSelect aria-label="Role" value={r.role} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)))}><option value="ar">AR specialist</option><option value="owner">Owner</option></NativeSelect><Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}><X className="size-4" /></Button></div>)}<Button variant="outline" size="sm" onClick={() => setRows([...rows, { email: "", role: "ar" }])}><Plus className="size-4" />Add another</Button></>}
          {idx === 5 && <><div className="grid gap-3 sm:grid-cols-2"><Field label="Timezone"><NativeSelect value={prefs.tz} onChange={(e) => setPrefs({ ...prefs, tz: e.target.value })}>{["America/Chicago", "America/New_York", "Europe/London"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field><Field label="Default payment terms (days)"><Input type="number" value={prefs.terms} onChange={(e) => setPrefs({ ...prefs, terms: +e.target.value })} /></Field></div><Opt id="auto" name="Apply exact matches automatically" desc="Everything else waits for a person. You can change this in settings." on={prefs.auto} set={() => setPrefs({ ...prefs, auto: !prefs.auto })} /></>}
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border pt-5"><Button variant="outline" disabled={idx === 0} onClick={() => nav("/onboarding/" + STEPS[idx - 1][0])}>Back</Button>{skip && <Button variant="ghost" onClick={next}>Skip for now</Button>}<Button className="ml-auto" onClick={cont}>{idx === STEPS.length - 1 ? "Finish" : "Continue"}</Button></div>
      </main>
    </div>
  )
}
