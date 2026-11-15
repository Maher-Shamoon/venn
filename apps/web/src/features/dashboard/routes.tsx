import { Dashboard } from "@/components/app/Dash"
import { Analytics, Report } from "@/components/app/Insight"
import { remote } from "@/features/identity/api"
import { RemoteDashboard } from "./RemoteDashboard"
import { RemoteAnalytics, RemoteReport } from "./RemoteReports"

export const DashboardRoute = () => (remote() ? <RemoteDashboard /> : <Dashboard />)
export const AnalyticsRoute = () => (remote() ? <RemoteAnalytics /> : <Analytics />)
export const ReportRoute = () => (remote() ? <RemoteReport /> : <Report />)
