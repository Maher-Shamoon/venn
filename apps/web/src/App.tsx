import { lazy, Suspense, useEffect } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { A, useApp } from "@/components/app/store"

const AppShell = lazy(() => import("@/components/app/Shell").then((m) => ({ default: m.AppShell })))
const Forgot = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Forgot })))
const Invite = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Invite })))
const Login = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Login })))
const Onboarding = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Onboarding })))
const Reset = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Reset })))
const Signup = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.Signup })))
const VerifyEmail = lazy(() => import("@/components/app/Auth").then((m) => ({ default: m.VerifyEmail })))
const Dashboard = lazy(() => import("@/components/app/Dash").then((m) => ({ default: m.Dashboard })))
const CustomerDetail = lazy(() => import("@/components/app/Customers").then((m) => ({ default: m.CustomerDetail })))
const Customers = lazy(() => import("@/components/app/Customers").then((m) => ({ default: m.Customers })))
const InvoiceDetail = lazy(() => import("@/components/app/Invoices").then((m) => ({ default: m.InvoiceDetail })))
const Invoices = lazy(() => import("@/components/app/Invoices").then((m) => ({ default: m.Invoices })))
const ImportInvoices = lazy(() => import("@/components/app/Import").then((m) => ({ default: m.ImportInvoices })))
const ImportPayments = lazy(() => import("@/components/app/Import").then((m) => ({ default: m.ImportPayments })))
const PdfReview = lazy(() => import("@/components/app/Import").then((m) => ({ default: m.PdfReview })))
const PaymentDetail = lazy(() => import("@/components/app/Payments").then((m) => ({ default: m.PaymentDetail })))
const Payments = lazy(() => import("@/components/app/Payments").then((m) => ({ default: m.Payments })))
const InvestigationDetail = lazy(() => import("@/components/app/Reconcile").then((m) => ({ default: m.InvestigationDetail })))
const Investigations = lazy(() => import("@/components/app/Reconcile").then((m) => ({ default: m.Investigations })))
const ReconRun = lazy(() => import("@/components/app/Reconcile").then((m) => ({ default: m.ReconRun })))
const Reconciliation = lazy(() => import("@/components/app/Reconcile").then((m) => ({ default: m.Reconciliation })))
const ApprovalDetail = lazy(() => import("@/components/app/Workflows").then((m) => ({ default: m.ApprovalDetail })))
const Approvals = lazy(() => import("@/components/app/Workflows").then((m) => ({ default: m.Approvals })))
const CollectionDetail = lazy(() => import("@/components/app/Workflows").then((m) => ({ default: m.CollectionDetail })))
const Collections = lazy(() => import("@/components/app/Workflows").then((m) => ({ default: m.Collections })))
const DisputeDetail = lazy(() => import("@/components/app/Workflows").then((m) => ({ default: m.DisputeDetail })))
const Disputes = lazy(() => import("@/components/app/Workflows").then((m) => ({ default: m.Disputes })))
const Analytics = lazy(() => import("@/components/app/Insight").then((m) => ({ default: m.Analytics })))
const Documents = lazy(() => import("@/components/app/Insight").then((m) => ({ default: m.Documents })))
const Report = lazy(() => import("@/components/app/Insight").then((m) => ({ default: m.Report })))
const AuditLog = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.AuditLog })))
const IntegrationDetail = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.IntegrationDetail })))
const Integrations = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.Integrations })))
const MemberDetail = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.MemberDetail })))
const Notifications = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.Notifications })))
const Profile = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.Profile })))
const Settings = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.Settings })))
const Tasks = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.Tasks })))
const Team = lazy(() => import("@/components/app/Admin").then((m) => ({ default: m.Team })))
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
  useEffect(() => { if (q.get("fresh")) A.startFresh("Dana Whitfield", "dana@northbeam.example"); else A.signIn("Dana Whitfield", "dana@brightpath.example"); nav(q.get("to") ?? "/app", { replace: true }) }, [nav, q])
  return null
}
function Guard({ children }: { children: React.ReactNode }) {
  const s = useApp(), loc = useLocation()
  return s.session ? <>{children}</> : <Navigate to="/login" state={{ from: loc.pathname }} replace />
}

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
