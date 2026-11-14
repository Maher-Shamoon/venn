import { BarChart3, Building2, Code2, FileSearch, GitMerge, Landmark, Mail, Scale, ScrollText, Server, ShieldCheck, Users, Cpu, Lock, type LucideIcon } from "lucide-react"

export type NavItem = { icon: LucideIcon; t: string; d: string; to: string }
export const PLATFORM: NavItem[] = [
  { icon: GitMerge, t: "Reconciliation", d: "Matches that explain themselves", to: "/p/reconciliation" },
  { icon: FileSearch, t: "Investigations", d: "Evidence-backed case files", to: "/p/investigations" },
  { icon: Mail, t: "Collections", d: "Reminders drafted from facts", to: "/p/collections" },
  { icon: Scale, t: "Disputes", d: "Claims tracked to resolution", to: "/p/disputes" },
  { icon: ShieldCheck, t: "Approvals", d: "Decisions on the record", to: "/p/approvals" },
  { icon: BarChart3, t: "Reports", d: "Numbers that link to records", to: "/p/reports" },
]
export const TEAMS: NavItem[] = [
  { icon: Landmark, t: "Business owners", d: "See exposure, decide with proof", to: "/p/owners" },
  { icon: Users, t: "AR specialists", d: "Work the queue, ask for approval", to: "/p/ar-specialists" },
  { icon: Code2, t: "Software agencies", d: "Milestones and change requests", to: "/p/agencies" },
  { icon: Server, t: "Managed service providers", d: "Recurring invoices and credits", to: "/p/msps" },
  { icon: Building2, t: "Staffing firms", d: "Timesheet-driven short pays", to: "/p/staffing" },
]
export const TRUST: NavItem[] = [
  { icon: Cpu, t: "How the engine decides", d: "Facts, calculations, claims", to: "/p/engine" },
  { icon: Lock, t: "Security", d: "Roles enforced on the server", to: "/p/security" },
  { icon: ScrollText, t: "Audit trail", d: "Every decision, immutable", to: "/p/audit-trail" },
]
