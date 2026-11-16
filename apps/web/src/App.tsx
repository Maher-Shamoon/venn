import { lazy, Suspense, useEffect } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { A, getState, useApp } from "@/components/app/store"
import { config } from "@/config"
import { onAuthChange } from "@/auth/supabaseAuth"
import { useSignedIn } from "@/auth"
import { activeOrg, fetchMe, inDemo, setActiveOrg, startDemo } from "@/features/identity/api"
import { toastApiError } from "@/lib/errors"
import { ErrorBoundary } from "@/components/app/ErrorBoundary"

const AppShell = lazy(() => import("@/components/app/Shell").then((m) => ({ default: m.AppShell })))
const Forgot = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Forgot })))
const Invite = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Invite })))
const Login = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Login })))
const Onboarding = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Onboarding })))
const Reset = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Reset })))
const Signup = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Signup })))
const VerifyEmail = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.VerifyEmail })))
const Dashboard = lazy(() => import("@/features/dashboard/routes").then((m) => ({ default: m.DashboardRoute })))
const CustomerDetail = lazy(() => import("@/features/ledger/routes").then((m) => ({ default: m.CustomerRoute })))
const Customers = lazy(() => import("@/features/ledger/routes").then((m) => ({ default: m.CustomersRoute })))
const InvoiceDetail = lazy(() => import("@/features/ledger/routes").then((m) => ({ default: m.InvoiceRoute })))
const Invoices = lazy(() => import("@/features/ledger/routes").then((m) => ({ default: m.InvoicesRoute })))
const ImportInvoices = lazy(() => import("@/features/imports/routes").then((m) => ({ default: m.ImportInvoicesRoute })))
const ImportPayments = lazy(() => import("@/features/imports/routes").then((m) => ({ default: m.ImportPaymentsRoute })))
const PdfReview = lazy(() => import("@/components/app/Import").then((m) => ({ default: m.PdfReview })))
const PaymentDetail = lazy(() => import("@/features/ledger/routes").then((m) => ({ default: m.PaymentRoute })))
const Payments = lazy(() => import("@/features/ledger/routes").then((m) => ({ default: m.PaymentsRoute })))
const InvestigationDetail = lazy(() => import("@/features/investigations/routes").then((m) => ({ default: m.InvestigationRoute })))
const Investigations = lazy(() => import("@/features/investigations/routes").then((m) => ({ default: m.InvestigationsRoute })))
const ReconRun = lazy(() => import("@/components/app/Reconcile").then((m) => ({ default: m.ReconRun })))
const Reconciliation = lazy(() => import("@/features/reconciliation/routes").then((m) => ({ default: m.ReconciliationRoute })))
const ApprovalDetail = lazy(() => import("@/features/approvals/routes").then((m) => ({ default: m.ApprovalRoute })))
const Approvals = lazy(() => import("@/features/approvals/routes").then((m) => ({ default: m.ApprovalsRoute })))
const CollectionDetail = lazy(() => import("@/features/workflow/routes").then((m) => ({ default: m.CollectionRoute })))
const Collections = lazy(() => import("@/features/workflow/routes").then((m) => ({ default: m.CollectionsRoute })))
const DisputeDetail = lazy(() => import("@/features/workflow/routes").then((m) => ({ default: m.DisputeRoute })))
const Disputes = lazy(() => import("@/features/workflow/routes").then((m) => ({ default: m.DisputesRoute })))
const Analytics = lazy(() => import("@/features/dashboard/routes").then((m) => ({ default: m.AnalyticsRoute })))
const Documents = lazy(() => import("@/features/documents/routes").then((m) => ({ default: m.DocumentsRoute })))
const Report = lazy(() => import("@/features/dashboard/routes").then((m) => ({ default: m.ReportRoute })))
const AuditLog = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.AuditLog })))
const IntegrationDetail = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.IntegrationDetail })))
const Integrations = lazy(() => import("@/features/workflow/routes").then((m) => ({ default: m.IntegrationsRoute })))
const MemberDetail = lazy(() => import("@/features/team/routes").then((m) => ({ default: m.MemberRoute })))
const Notifications = lazy(() => import("@/features/workflow/routes").then((m) => ({ default: m.NotificationsRoute })))
const Profile = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.Profile })))
const Settings = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.Settings })))
const Tasks = lazy(() => import("@/features/workflow/routes").then((m) => ({ default: m.TasksRoute })))
const Team = lazy(() => import("@/features/team/routes").then((m) => ({ default: m.TeamRoute })))
const NotFound = lazy(() => import("@/components/app/System").then((m) => ({ default: m.NotFound })))
const Page403 = lazy(() => import("@/components/app/System").then((m) => ({ default: m.Page403 })))
const Page404 = lazy(() => import("@/components/app/System").then((m) => ({ default: m.Page404 })))
const Page500 = lazy(() => import("@/components/app/System").then((m) => ({ default: m.Page500 })))
const PageExpired = lazy(() => import("@/components/app/System").then((m) => ({ default: m.PageExpired })))
const PageMaintenance = lazy(() => import("@/components/app/System").then((m) => ({ default: m.PageMaintenance })))
const Content = lazy(() => import("@/components/site/Content").then((m) => ({ default: m.Content })))
const Home = lazy(() => import("@/components/site/Home").then((m) => ({ default: m.Home })))
const Pricing = lazy(() => import("@/components/site/Pricing").then((m) => ({ default: m.Pricing })))
const About = lazy(() => import("@/components/site/Company").then((m) => ({ default: m.About })))
const Contact = lazy(() => import("@/components/site/Company").then((m) => ({ default: m.Contact })))
const Privacy = lazy(() => import("@/components/site/Company").then((m) => ({ default: m.Privacy })))
const Terms = lazy(() => import("@/components/site/Company").then((m) => ({ default: m.Terms })))
const SiteLayout = lazy(() => import("@/components/site/SiteLayout").then((m) => ({ default: m.SiteLayout })))

/** Signs into the sample workspace, then goes where the visitor was headed. */
function Demo() {
  const [q] = useSearchParams(), nav = useNavigate()
  useEffect(() => { startDemo(); if (q.get("fresh")) A.startFresh("Dana Whitfield", "dana@northbeam.example"); else A.signIn("Dana Whitfield", "dana@brightpath.example"); nav(q.get("to") ?? "/app", { replace: true }) }, [nav, q])
  return null
}
/** Whoever has a real (Supabase) session, however they signed in (password, Google, an emailed link), is put in their own organization, or sent to create one.
 * Without this a Google sign-in would keep showing whatever sample data the browser held. */
function SessionBridge() {
  const nav = useNavigate()
  useEffect(() => {
    if (config.authSource !== "supabase") return
    let busy = false
    return onAuthChange((e) => {
      const me = e.signedIn
      if (!me || busy || inDemo() || !/^\/app/.test(window.location.pathname) || (activeOrg() && getState().session?.email === me.email)) return
      busy = true
      // Deferred on purpose: calling the auth client from inside its own change callback can deadlock it.
      setTimeout(() => void fetchMe().then((m) => {
        const mem = m.memberships.find((x) => x.status === "active"), pending = localStorage.getItem("venn.invite")
        if (mem) { setActiveOrg(mem.organization_id); A.finishOnboarding(); A.signIn(me.name, me.email); /^\/app/.test(window.location.pathname) ? window.location.reload() : window.location.replace("/app") }
        else { setActiveOrg(null); A.signIn(me.name, me.email); if (!/^\/(onboarding|invite)/.test(window.location.pathname)) nav(pending ? `/invite/${pending}` : "/onboarding/organization", { replace: true }) }
      }).catch((e) => { toastApiError(e); nav("/login", { replace: true }) }).finally(() => { busy = false }), 0)
    })
  }, [nav])
  return null
}
function Guard({ children }: { children: React.ReactNode }) {
  const s = useApp(), loc = useLocation(), signedIn = useSignedIn()
  // A real session with no organization chosen yet is sent to set one up (SessionBridge); never flash sample data meanwhile.
  if (config.authSource === "supabase" && signedIn && !activeOrg() && !inDemo()) return <div className="h-1 w-full animate-pulse bg-[#f9a8d4]" role="status" aria-label="Loading" />
  return s.session ? <>{children}</> : <Navigate to="/login" state={{ from: loc.pathname }} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <SessionBridge />
      <Suspense fallback={<div className="h-1 w-full animate-pulse bg-[#f9a8d4]" role="status" aria-label="Loading" />}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/p/:slug" element={<Content />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/product" element={<Navigate to="/p/reconciliation" replace />} />
          <Route path="/solutions" element={<Navigate to="/p/owners" replace />} />
          <Route path="/security" element={<Navigate to="/p/security" replace />} />
        </Route>
        <Route path="/demo" element={<Demo />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<Forgot />} />
        <Route path="/reset-password" element={<Reset />} />
        <Route path="/invite/:token" element={<Invite />} />
        <Route path="/onboarding" element={<Navigate to="/onboarding/organization" replace />} />
        <Route path="/onboarding/:step" element={<Guard><Onboarding /></Guard>} />
        <Route path="/app" element={<Guard><AppShell /></Guard>}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/import" element={<ImportInvoices />} />
          <Route path="invoices/pdf-review" element={<PdfReview />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="payments" element={<Payments />} />
          <Route path="payments/import" element={<ImportPayments />} />
          <Route path="payments/:id" element={<PaymentDetail />} />
          <Route path="reconciliation" element={<Reconciliation />} />
          <Route path="reconciliation/runs/:id" element={<ReconRun />} />
          <Route path="investigations" element={<Investigations />} />
          <Route path="investigations/:id" element={<InvestigationDetail />} />
          <Route path="collections" element={<Collections />} />
          <Route path="collections/:id" element={<CollectionDetail />} />
          <Route path="disputes" element={<Disputes />} />
          <Route path="disputes/:id" element={<DisputeDetail />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="approvals/:id" element={<ApprovalDetail />} />
          <Route path="reports" element={<Analytics />} />
          <Route path="reports/:slug" element={<Report />} />
          <Route path="documents" element={<Documents />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="integrations/:id" element={<IntegrationDetail />} />
          <Route path="team" element={<Team />} />
          <Route path="team/:id" element={<MemberDetail />} />
          <Route path="audit-log" element={<AuditLog />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/:tab" element={<Settings />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<NotFound what="page" back="/app" />} />
        </Route>
        <Route path="/403" element={<Page403 />} />
        <Route path="/500" element={<Page500 />} />
        <Route path="/maintenance" element={<PageMaintenance />} />
        <Route path="/session-expired" element={<PageExpired />} />
        <Route path="*" element={<Page404 />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
