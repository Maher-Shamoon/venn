import { useEffect } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { A, useApp } from "@/components/app/store"
import { AppShell } from "@/components/app/Shell"
import { Forgot, Invite, Login, Onboarding, Reset, Signup, VerifyEmail } from "@/components/app/Auth"
import { Dashboard } from "@/components/app/Dash"
import { CustomerDetail, Customers } from "@/components/app/Customers"
import { InvoiceDetail, Invoices } from "@/components/app/Invoices"
import { ImportInvoices, ImportPayments, PdfReview } from "@/components/app/Import"
import { PaymentDetail, Payments } from "@/components/app/Payments"
import { InvestigationDetail, Investigations, ReconRun, Reconciliation } from "@/components/app/Reconcile"
import { ApprovalDetail, Approvals, CollectionDetail, Collections, DisputeDetail, Disputes } from "@/components/app/Workflows"
import { Analytics, Documents, Report } from "@/components/app/Insight"
import { AuditLog, IntegrationDetail, Integrations, MemberDetail, Notifications, Profile, Settings, Tasks, Team } from "@/components/app/Admin"
import { NotFound, Page403, Page404, Page500, PageExpired, PageMaintenance } from "@/components/app/System"
import { Content } from "@/components/site/Content"
import { Home } from "@/components/site/Home"
import { Pricing } from "@/components/site/Pricing"
import { About, Contact, Privacy, Terms } from "@/components/site/Company"
import { SiteLayout } from "@/components/site/SiteLayout"

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
    </BrowserRouter>
  )
}
