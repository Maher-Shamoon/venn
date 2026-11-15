import { CustomerDetail, Customers } from "@/components/app/Customers"
import { InvoiceDetail, Invoices } from "@/components/app/Invoices"
import { PaymentDetail, Payments } from "@/components/app/Payments"
import { remote } from "@/features/identity/api"
import { RemoteCustomerDetail, RemoteCustomers } from "./RemoteCustomers"
import { RemoteInvoiceDetail, RemoteInvoices } from "./RemoteInvoices"
import { RemotePaymentDetail, RemotePayments } from "./RemotePayments"

/** Real organizations read the API; sandbox and sample workspaces keep their local data. */
export const CustomersRoute = () => (remote() ? <RemoteCustomers /> : <Customers />)
export const CustomerRoute = () => (remote() ? <RemoteCustomerDetail /> : <CustomerDetail />)
export const InvoicesRoute = () => (remote() ? <RemoteInvoices /> : <Invoices />)
export const InvoiceRoute = () => (remote() ? <RemoteInvoiceDetail /> : <InvoiceDetail />)
export const PaymentsRoute = () => (remote() ? <RemotePayments /> : <Payments />)
export const PaymentRoute = () => (remote() ? <RemotePaymentDetail /> : <PaymentDetail />)
