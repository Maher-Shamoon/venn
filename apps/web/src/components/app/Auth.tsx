import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { Check, Eye, EyeOff, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/venn/kit"
import { Showcase } from "./AuthShowcase"
import { config } from "@/config"
import { errorMessage, toastApiError } from "@/lib/errors"
import { endDemo, fetchMe, inDemo, setActiveOrg } from "@/features/identity/api"
import { AuthError, completeReset, googleAvailable, requestReset, resendVerification, signIn, signInWithGoogle, signUp, useResetReady, useSignedIn } from "@/auth"
import { request } from "@/api/http"
import { A, useApp } from "./store"
import { Field } from "./ui"
import { cn } from "@/lib/utils"

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
      <div className="relative py-1 text-center text-xs text-hushed"><span className="bg-white px-3">or</span><span className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" /></div>
      <Button type="button" variant="outline" size="lg" className="h-11 w-full gap-3 text-base" onClick={() => void signInWithGoogle().catch((e) => onError(e instanceof Error ? e.message : "Google sign-in failed."))}><GoogleG />Continue with Google</Button>
    </>
  )
}

export function Login() {
  const s = useApp(), nav = useNavigate(), from = (useLocation().state as { from?: string } | null)?.from
  useEffect(() => endDemo(), []) // opening sign-in leaves the demo
  const [f, setF] = useState({ email: "", password: "" }), [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  // Real accounts always enter their credentials here; only the local sample sign-in skips ahead.
  if (s.session && !busy && !inDemo() && config.authSource !== "supabase") return <Navigate to="/app" replace />
  const go = async (name: string, mail: string) => {
    setBusy(true)
    endDemo()
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
        <Field label="Work email"><Input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!err} className="h-11 text-base" /></Field>
        <Field label="Password"><PasswordInput autoComplete="current-password" value={f.password} onChange={(v) => setF({ ...f, password: v })} invalid={!!err} /></Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <div className="flex items-center justify-between text-sm"><label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="size-4 accent-[#f472b6]" />Keep me signed in</label><Link to="/forgot-password" className="underline underline-offset-4">Forgot password?</Link></div>
        <Submit busy={busy}>Sign in</Submit>
        {googleAvailable ? <GoogleButton onError={setErr} /> : <div className="relative py-1 text-center text-xs text-hushed"><span className="bg-white px-3">or</span><span className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" /></div>}
        <Button type="button" variant="outline" size="lg" disabled={busy} className="h-11 w-full text-base" onClick={() => go("Dana Whitfield", "dana@brightpath.example")}>Continue with the sample workspace</Button>
      </form>
    </Card>
  )
}

export function Signup() {
  const nav = useNavigate()
  useEffect(() => endDemo(), [])
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
        <Field label="Full name"><Input autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="h-11 text-base" /></Field>
        <Field label="Work email"><Input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="h-11 text-base" /></Field>
        <Field label="Password"><PasswordInput autoComplete="new-password" value={f.password} onChange={(v) => setF({ ...f, password: v })} /></Field>
        <div className="flex gap-1" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i < st ? (st < 3 ? "bg-[#e0b13a]" : "bg-[#2f9e44]") : "bg-muted")} />)}</div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">{rules.map(([t, ok]) => <li key={t} className={cn("flex items-center gap-1.5 transition-colors", ok ? "text-[#17692b]" : "text-hushed")}><Check className={cn("size-3.5", !ok && "opacity-30")} />{t}</li>)}</ul>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} className="mt-1 size-4 accent-[#f472b6]" />I agree to the terms and the privacy policy.</label>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Submit busy={busy}>Create account</Submit>
        <GoogleButton onError={setErr} />
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

export { Onboarding } from "./Onboarding"
