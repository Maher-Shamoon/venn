import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

/** Default API handlers for component tests. Override per test with server.use(...). */
export const handlers = [http.get("*/api/v1/health", () => HttpResponse.json({ status: "ok" }))]
export const server = setupServer(...handlers)
export { http, HttpResponse }
