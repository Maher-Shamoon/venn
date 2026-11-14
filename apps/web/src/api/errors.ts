/** RFC 9457 problem details, as returned by the API (see docs/planning/API_SPECIFICATION.md 1.4). */
export type FieldError = { field: string; code: string; message: string }

export class ApiError extends Error {
  status: number
  code: string
  fields: FieldError[]
  requestId?: string
  constructor(status: number, code: string, message: string, fields: FieldError[] = [], requestId?: string) {
    super(message)
    this.status = status; this.code = code; this.fields = fields; this.requestId = requestId
    this.name = "ApiError"
  }
  get isAuth() { return this.status === 401 }
  get isConflict() { return this.status === 409 }
  get isValidation() { return this.status === 422 }
}

export async function toApiError(res: Response): Promise<ApiError> {
  try {
    const p = await res.json()
    return new ApiError(res.status, p.code ?? "internal_error", p.detail ?? p.title ?? res.statusText, p.errors ?? [], p.request_id)
  } catch {
    return new ApiError(res.status, res.status >= 500 ? "internal_error" : "bad_request", res.statusText || "Request failed")
  }
}
