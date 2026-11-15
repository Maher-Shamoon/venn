import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser, "Supabase test user is not configured")
// These tests change shared data in one organization, so they run once (desktop) instead of in parallel per project.
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

test("owner sees real members, invites someone and withdraws the invitation", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/team")
  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible()
  await expect(page.getByText(testUser!.email)).toBeVisible()

  const email = `invitee.${Date.now()}@venn-dev.test`
  await page.getByRole("button", { name: "Invite" }).click()
  await page.getByLabel("Work email").fill("not-an-email")
  await page.getByRole("button", { name: "Send invitation" }).click()
  await expect(page.getByRole("alert")).toHaveText("Enter a valid email address.")
  await page.getByLabel("Work email").fill(email)
  await page.getByRole("button", { name: "Send invitation" }).click()
  await expect(page.getByText(email)).toBeVisible()

  // Inviting the same address again is refused by the server with a plain message.
  await page.getByRole("button", { name: "Invite" }).click()
  await page.getByLabel("Work email").fill(email)
  await page.getByRole("button", { name: "Send invitation" }).click()
  await expect(page.getByRole("alert")).toContainText("already has a pending invitation")
  await page.getByRole("button", { name: "Cancel" }).click()

  await page.getByRole("row", { name: new RegExp(email) }).getByRole("button", { name: "Revoke" }).click()
  await expect(page.getByText(email)).toHaveCount(0)
})

test("the owner cannot demote or suspend themselves as the only owner", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/team")
  await page.getByRole("row", { name: new RegExp(testUser!.email) }).click()
  await expect(page.getByRole("combobox", { name: "Role" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Suspend" })).toBeDisabled()
  await expect(page.getByText("The last owner cannot be changed or suspended.")).toBeVisible()
})

test("real organizations have no view-as switcher and show the owner navigation", async ({ page }) => {
  await signIn(page)
  await page.goto("/app")
  await expect(page.getByRole("group", { name: "Role switcher" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Team" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Audit log" })).toBeVisible()
})
