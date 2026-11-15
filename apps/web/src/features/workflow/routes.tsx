import { Integrations, Notifications, Tasks } from "@/components/app/Admin"
import { CollectionDetail, Collections, DisputeDetail, Disputes } from "@/components/app/Workflows"
import { remote } from "@/features/identity/api"
import { RemoteCollectionDetail, RemoteCollections } from "./RemoteCollections"
import { RemoteDisputeDetail, RemoteDisputes } from "./RemoteDisputes"
import { RemoteIntegrations, RemoteNotifications, RemoteTasks } from "./RemoteInbox"

export const CollectionsRoute = () => (remote() ? <RemoteCollections /> : <Collections />)
export const CollectionRoute = () => (remote() ? <RemoteCollectionDetail /> : <CollectionDetail />)
export const DisputesRoute = () => (remote() ? <RemoteDisputes /> : <Disputes />)
export const DisputeRoute = () => (remote() ? <RemoteDisputeDetail /> : <DisputeDetail />)
export const NotificationsRoute = () => (remote() ? <RemoteNotifications /> : <Notifications />)
export const TasksRoute = () => (remote() ? <RemoteTasks /> : <Tasks />)
export const IntegrationsRoute = () => (remote() ? <RemoteIntegrations /> : <Integrations />)
