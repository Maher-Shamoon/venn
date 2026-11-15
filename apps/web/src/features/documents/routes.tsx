import { Documents } from "@/components/app/Insight"
import { remote } from "@/features/identity/api"
import { RemoteDocuments } from "./RemoteDocuments"

export const DocumentsRoute = () => (remote() ? <RemoteDocuments /> : <Documents />)
