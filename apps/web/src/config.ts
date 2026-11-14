/** Build-time settings. Everything is optional so the app runs without a backend. */
export const config = {
  apiBase: (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api/v1",
  /** "local" keeps data in the browser. "remote" talks to the API once it exists. */
  dataSource: ((import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? "local") as "local" | "remote",
}
