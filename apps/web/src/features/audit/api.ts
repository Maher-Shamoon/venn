import { useInfiniteQuery } from "@tanstack/react-query"
import { request } from "@/api/http"

export type AuditEvent = {
  id: string; seq: number; occurred_at: string; actor_type: string; actor_name: string | null; action: string; group: string
  record_type: string | null; record_id: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null; request_id: string | null
}
type Page = { data: AuditEvent[]; next_cursor: number | null }

/** Newest first, 25 per page, filtered by group on the server. */
export const useAuditEvents = (group: string) =>
  useInfiniteQuery({
    queryKey: ["audit", group],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => request<Page>("/audit-events", { query: { group: group === "all" ? undefined : group, cursor: pageParam, limit: 25 } }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    meta: { silent: true },
  })
