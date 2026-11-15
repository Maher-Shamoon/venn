import { Reconciliation } from "@/components/app/Reconcile"
import { remote } from "@/features/identity/api"
import { RemoteReconciliation } from "./RemoteReconciliation"

export const ReconciliationRoute = () => (remote() ? <RemoteReconciliation /> : <Reconciliation />)
