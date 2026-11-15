import { InvestigationDetail, Investigations } from "@/components/app/Reconcile"
import { remote } from "@/features/identity/api"
import { RemoteInvestigationDetail, RemoteInvestigations } from "./RemoteInvestigations"

export const InvestigationsRoute = () => (remote() ? <RemoteInvestigations /> : <Investigations />)
export const InvestigationRoute = () => (remote() ? <RemoteInvestigationDetail /> : <InvestigationDetail />)
