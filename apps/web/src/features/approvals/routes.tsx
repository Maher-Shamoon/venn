import { ApprovalDetail, Approvals } from "@/components/app/Workflows"
import { remote } from "@/features/identity/api"
import { RemoteApprovalDetail, RemoteApprovals } from "./RemoteApprovals"

export const ApprovalsRoute = () => (remote() ? <RemoteApprovals /> : <Approvals />)
export const ApprovalRoute = () => (remote() ? <RemoteApprovalDetail /> : <ApprovalDetail />)
