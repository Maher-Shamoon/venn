import { MemberDetail, Team } from "@/components/app/Admin"
import { remote } from "@/features/identity/api"
import { RemoteMemberDetail, RemoteTeam } from "./RemoteTeam"

/** Real organizations read the API; sandbox and sample workspaces keep their local data. */
export const TeamRoute = () => (remote() ? <RemoteTeam /> : <Team />)
export const MemberRoute = () => (remote() ? <RemoteMemberDetail /> : <MemberDetail />)
