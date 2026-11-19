import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/venn/kit"

export const NotFound = ({ what, back }: { what: string; back: string }) => (
  <div className="mx-auto max-w-[520px] rounded-xl bg-muted p-10 text-center"><h1 className="text-2xl tracking-[-0.01em]">We could not find that {what}.</h1><p className="mt-2 text-hushed">It may have been removed, or the link may be wrong.</p><Button className="mt-5" render={<Link to={back} />}>Go back</Button></div>
)

export function SystemPage({ code, title, text, actions }: { code: string; title: string; text: string; actions?: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-white px-5 py-16">
      <div className="mx-auto max-w-[560px] text-center">
        <Link to="/" className="inline-block"><Logo size={26} /></Link>
        <div className="mt-10 font-mono text-sm text-hushed">{code}</div>
        <h1 className="mt-2 tracking-[-0.02em] text-d2">{title}</h1>
        <p className="mx-auto mt-3 max-w-[440px] text-lg text-hushed">{text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">{actions ?? <><Button render={<Link to="/" />}>Back to home</Button><Button variant="outline" render={<Link to="/app" />}>Open the app</Button></>}</div>
      </div>
    </div>
  )
}
export const Page404 = () => <SystemPage code="404" title="This page took a wrong turn." text="The link may be old, or the page may have moved." />
export const Page403 = () => <SystemPage code="403" title="You don't have access." text="Ask an owner of your organization to change your role, or sign in with a different account." actions={<Button render={<Link to="/login" />}>Sign in</Button>} />
export const Page500 = () => <SystemPage code="500" title="Something went wrong on our side." text="Nothing was lost. Try again in a moment." actions={<Button onClick={() => location.reload()}>Try again</Button>} />
export const PageMaintenance = () => <SystemPage code="503" title="Back in a few minutes." text="venn is being updated. Your data is safe." actions={<Button onClick={() => location.reload()}>Check again</Button>} />
export const PageExpired = () => <SystemPage code="Session expired" title="Please sign in again." text="For your security we ended your session after a long period of inactivity. You will return to the same page." actions={<Button render={<Link to="/login" />}>Sign in</Button>} />
