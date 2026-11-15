/** Build-time settings. Everything is optional so the app runs without a backend. */
const env = import.meta.env
const supabaseUrl = (env.VITE_SUPABASE_URL as string | undefined) ?? ""
const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ""

export const config = {
  apiBase: (env.VITE_API_BASE as string | undefined) ?? "/api/v1",
  /** "local" keeps data in the browser. "remote" talks to the API once it exists. */
  dataSource: ((env.VITE_DATA_SOURCE as string | undefined) ?? "local") as "local" | "remote",
  supabaseUrl,
  /** The anon key is public by design (it only identifies the project); never put the service-role key here. */
  supabaseAnonKey,
  /** Real accounts when a Supabase project is configured, browser-only accounts otherwise. */
  authSource: (supabaseUrl && supabaseAnonKey ? "supabase" : "local") as "supabase" | "local",
}
