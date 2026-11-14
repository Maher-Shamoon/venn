import { useQuery } from "@tanstack/react-query"
import { request } from "@/api/http"
import { qk } from "@/lib/query"

export type Health = { status: "ok" }

/** Example feature hook: every feature follows api.ts (calls + hooks), components/, schemas/. */
export const useHealth = () => useQuery({ queryKey: qk.health.live, queryFn: () => request<Health>("/health") })
