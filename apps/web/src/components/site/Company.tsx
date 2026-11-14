import { useState, type FormEvent, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Reveal, TwoTone } from "@/components/venn/kit"

const wrap = "mx-auto max-w-[1280px] px-5 md:px-10"
const Hero = ({ tag, lead, rest, children }: { tag: string; lead: string; rest: string; children?: ReactNode }) => (
  <section className={`${wrap} pb-10 pt-16 md:pt-24`}><Reveal>
    <p className="font-mono text-[11px] uppercase tracking-[0.02em] text-hushed">{tag}</p>
    <h1 className="mt-4 max-w-[900px] text-[40px] leading-[42px] tracking-[-0.02em] md:text-[64px] md:leading-[64px]"><TwoTone lead={lead} rest={rest} /></h1>
    {children}
  </Reveal></section>
)

export function About() {
  const principles: [string, string][] = [["Evidence first", "Every finding points to a stored record. If a record does not exist, venn says so."], ["A person decides", "venn proposes. Owners approve write-offs, credits and refunds. The system cannot approve, allocate or send on its own."], ["Calculated, not guessed", "Amounts and dates come from code that reads your records. The assistant explains. It never does the arithmetic."], ["No promises about recovery", "venn finds and explains what is open. It does not claim it will collect anything."]]
  return (
    <>
      <Hero tag="About" lead="We help teams that bill for their time" rest="find the money that slipped between systems." />
      <section className={`${wrap} pb-20 md:pb-28`}>
        <Reveal><p className="max-w-[760px] text-xl text-hushed">Agencies, consultancies, managed service providers and staffing firms send invoices from one system, receive payments in another and chase customers by email. venn reads all three, finds where they disagree and gives your team a case file to resolve each gap.</p></Reveal>
        <div className="mt-12 grid gap-3 md:grid-cols-2">{principles.map(([t, d], i) => <Reveal key={t} delay={i * 80}><div className="h-full rounded-xl border-[0.8px] border-border bg-muted p-7 transition-all duration-500 hover:-translate-y-1 hover:bg-lime"><h2 className="text-2xl">{t}</h2><p className="mt-2 text-base text-hushed">{d}</p></div></Reveal>)}</div>
      </section>
    </>
  )
}

export function Contact() {
  const [f, setF] = useState({ name: "", email: "", company: "", size: "11 to 50", msg: "", consent: false, hp: "" }), [err, setErr] = useState(""), [done, setDone] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (f.hp) return setDone(true)
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Enter your name and a valid work email address.")
    if (!f.consent) return setErr("Please agree to be contacted about your request.")
    setErr(""); setDone(true)
  }
  const lbl = "mb-1.5 block text-sm"
  return (
    <>
      <Hero tag="Contact" lead="Book a walkthrough" rest="using your own CSV exports." />
      <section className={`${wrap} pb-24`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <Reveal><ul className="space-y-4 text-lg">{["A 30-minute call with someone who knows receivables", "Bring invoice and payment exports. We reconcile them live", "No card, no commitment"].map((t) => <li key={t} className="flex gap-3"><Check className="mt-1.5 size-4 shrink-0" />{t}</li>)}</ul></Reveal>
          <Reveal delay={100}>
            <div className="rounded-2xl border-[0.8px] border-border bg-muted p-6 sm:p-8">
              {done ? <div role="status"><div className="text-2xl">Thank you, {f.name.split(" ")[0] || "there"}.</div><p className="mt-2 text-hushed">We will reply to {f.email || "your email"} within one working day.</p><Button className="mt-5" variant="outline" render={<Link to="/" />}>Back to home</Button></div> : (
                <form onSubmit={submit} className="space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2"><label><span className={lbl}>Name</span><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="h-10 bg-white" /></label><label><span className={lbl}>Work email</span><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="h-10 bg-white" /></label></div>
                  <div className="grid gap-4 sm:grid-cols-2"><label><span className={lbl}>Company</span><Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} className="h-10 bg-white" /></label><label><span className={lbl}>Company size</span><select value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm">{["1 to 10", "11 to 50", "51 to 200", "200+"].map((o) => <option key={o}>{o}</option>)}</select></label></div>
                  <label className="block"><span className={lbl}>What would you like to see?</span><textarea value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} className="min-h-[110px] w-full rounded-lg border border-input bg-white px-2.5 py-2 text-sm" /></label>
                  <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="sr-only" value={f.hp} onChange={(e) => setF({ ...f, hp: e.target.value })} name="website" />
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-1 size-4 accent-[#f472b6]" />I agree that venn may contact me about this request.</label>
                  {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
                  <Button type="submit" size="lg" variant="lime">Request a walkthrough</Button>
                </form>)}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}

const Legal = ({ title, sections }: { title: string; sections: [string, string][] }) => (
  <>
    <Hero tag="Draft · pending legal review" lead={title} rest="" />
    <section className={`${wrap} pb-24`}><div className="max-w-[760px] space-y-8">{sections.map(([h, t], i) => <Reveal key={h}><h2 className="text-2xl">{i + 1}. {h}</h2><p className="mt-2 text-base text-hushed">{t}</p></Reveal>)}</div></section>
  </>
)
export const Privacy = () => <Legal title="Privacy policy" sections={[["What we collect", "Account details you give us, and the invoice, payment and email data you choose to connect."], ["How we use it", "To reconcile payments, build case files and draft messages for your team. We do not sell your data."], ["Email access", "Connections are read-only unless you approve a send. venn never deletes or edits mail."], ["Your controls", "Export or delete your data at any time from Settings. Owners can request organization deletion."], ["Contact", "Questions about privacy can be sent through the contact page."]]} />
export const Terms = () => <Legal title="Terms of service" sections={[["Using venn", "venn helps you find and explain payment discrepancies. Your accounting system remains the book of record."], ["No movement of money", "venn recommends and records. It does not send, refund or collect payments."], ["Your responsibilities", "You decide what to approve and send. Keep your credentials secure."], ["No guarantees", "venn does not promise recovery of any amount."], ["Changes", "We will tell you before material changes to these terms."]]} />
