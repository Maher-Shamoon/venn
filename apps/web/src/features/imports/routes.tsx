import { ImportInvoices, ImportPayments } from "@/components/app/Import"
import { remote } from "@/features/identity/api"
import { RemoteImport } from "./RemoteImport"

export const ImportInvoicesRoute = () => (remote() ? <RemoteImport kind="invoices" /> : <ImportInvoices />)
export const ImportPaymentsRoute = () => (remote() ? <RemoteImport kind="payments" /> : <ImportPayments />)
