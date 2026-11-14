import { toast } from "sonner"
import { ApiError } from "@/api/errors"

/** Plain-language message for an API failure, safe to show to a user. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Something went wrong. Check your connection and try again."
  if (err.status === 401) return "Your session has ended. Sign in again."
  if (err.status === 403) return "You do not have permission to do that."
  if (err.code === "version_conflict") return "Someone else changed this record. Reload to see the latest version."
  if (err.status >= 500) return "Something went wrong on our side. Nothing was lost."
  return err.message
}

/** Shows the failure with its request id so support can find the exact log line. */
export function toastApiError(err: unknown) {
  const id = err instanceof ApiError ? err.requestId : undefined
  toast.error(errorMessage(err), id ? { description: `Reference ${id}` } : undefined)
}
