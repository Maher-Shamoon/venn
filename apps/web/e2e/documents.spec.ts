import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser, "Supabase test user is not configured")
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

test("upload a document, read its text, search for it, download it and delete it; unsupported files are refused", async ({ page }) => {
  test.setTimeout(240_000)
  await signIn(page)
  const s = Date.now() % 1_000_000, name = `qa-remittance-${s}.txt`
  await page.goto("/app/documents")
  const pick = (n: string, body: string | Buffer, mime = "text/plain") => page.getByLabel("Upload document").setInputFiles({ name: n, mimeType: mime, buffer: Buffer.isBuffer(body) ? body : Buffer.from(body) })
  await pick(`qa-program-${s}.pdf`, Buffer.from("MZ\x90 not a pdf at all"), "application/pdf")
  await expect(page.getByText(/file type is not accepted/).first()).toBeVisible()
  await pick(name, `Customer ${s} deducted 25.00 as a bank fee`)
  await expect(page.getByText(`${name} uploaded and read`).first()).toBeVisible()
  await page.getByLabel("Search documents").fill(`deducted 25.00 as a bank fee`)
  await page.getByRole("row", { name: new RegExp(name) }).click()
  await expect(page.getByText(`Customer ${s} deducted 25.00 as a bank fee`)).toBeVisible()
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download" }).click()
  expect((await download).suggestedFilename()).toBe(name)
  await page.getByRole("button", { name: "Delete" }).click()
  await expect(page.getByText("Document deleted").first()).toBeVisible()
  await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0)
})
