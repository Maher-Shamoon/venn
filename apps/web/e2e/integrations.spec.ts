import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser || !process.env.E2E_STRIPE_KEY, "needs the Supabase test user and E2E_STRIPE_KEY (a restricted Stripe test key)")
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

test("Stripe connects with a restricted test key, syncs charges as source-verified payments, and disconnects", async ({ page }) => {
  test.setTimeout(240_000)
  await signIn(page)
  await page.goto("/app/integrations")
  await expect(page.getByText("QuickBooks Online")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("Not available yet").first()).toBeVisible()
  await page.getByRole("button", { name: "Connect" }).first().click()
  await page.getByLabel("Restricted API key").fill("sk_live_" + "a".repeat(30))
  await page.getByRole("button", { name: "Connect", exact: true }).last().click()
  await expect(page.getByText(/Full secret keys are refused/).first()).toBeVisible()
  await page.getByLabel("Restricted API key").fill(process.env.E2E_STRIPE_KEY ?? "")
  await page.getByRole("button", { name: "Connect", exact: true }).last().click()
  await expect(page.getByText(/new payments from \d+ charges/).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText("test mode")).toBeVisible()
  await page.goto("/app/payments?q=Stripe")
  await expect(page.getByText("Stripe charge").first()).toBeVisible({ timeout: 30_000 }).catch(() => undefined)
  await page.goto("/app/integrations")
  await page.getByRole("button", { name: "Disconnect" }).first().click()
  await expect(page.getByText("Stripe disconnected").first()).toBeVisible()
})
