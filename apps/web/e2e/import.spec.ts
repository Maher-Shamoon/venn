import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser, "Supabase test user is not configured")
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

test("import invoices: review, fix nothing silently, confirm, and a repeat adds nothing", async ({ page }) => {
  test.setTimeout(300_000)
  await signIn(page)
  const s = Date.now() % 1_000_000, cust = `QA Import ${s}`
  const csv = [
    "invoice_number,customer,issue_date,due_date,total_amount,currency",
    `QI-${s}-1,${cust},2026-10-01,2026-11-01,"5,000.00",USD`,
    `QI-${s}-2,${cust},2026-10-05,2026-11-05,1200.50,USD`,
    `QI-${s}-1,${cust},2026-10-01,2026-11-01,5000.00,USD`,
    `QI-${s}-3,${cust},2026-10-09,2026-09-01,10,USD`,
  ].join("\n")
  const upload = (name: string) => page.getByLabel("Choose CSV file").setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(csv) })

  await page.goto("/app/invoices/import")
  await upload("invoices.csv")
  await expect(page.getByText("invoices.csv · 4 rows")).toBeVisible()
  const tile = (name: RegExp) => page.getByRole("button", { name })
  await expect(tile(/^Valid\s*0/i)).toBeVisible()
  await expect(tile(/^Warnings\s*2/i)).toBeVisible()
  await expect(tile(/^Errors\s*1/i)).toBeVisible()
  await expect(tile(/^Duplicates\s*1/i)).toBeVisible()
  await tile(/^Errors/i).click()
  await expect(page.getByText("The due date is before the issue date.")).toBeVisible()
  await tile(/^Warnings/i).click()
  await expect(page.getByText(/will be created/).first()).toBeVisible()

  await page.getByRole("button", { name: "Confirm and save 2 rows" }).click()
  await expect(page.getByRole("heading", { name: "2 invoices saved" })).toBeVisible()
  await expect(page.getByText("1 new customers created")).toBeVisible()
  await page.getByText("View invoices", { exact: true }).click()
  await page.getByLabel("Search table").fill(`QI-${s}`)
  await expect(page.getByRole("row", { name: new RegExp(`QI-${s}-2`) })).toBeVisible()
  await expect(page.getByRole("row", { name: new RegExp(`QI-${s}-3`) })).toHaveCount(0)

  // The same file again: everything that was saved is now a duplicate, and nothing can be saved.
  await page.goto("/app/invoices/import")
  await upload("again.csv")
  await expect(tile(/^Duplicates\s*3/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /Confirm and save/ })).toBeDisabled()
})

test("import payments, and a missing column can be matched by hand", async ({ page }) => {
  test.setTimeout(240_000)
  await signIn(page)
  const s = Date.now() % 1_000_000
  await page.goto("/app/payments/import")
  await page.getByLabel("Choose CSV file").setInputFiles({ name: "weird.csv", mimeType: "text/csv", buffer: Buffer.from(`When,Money,Who\n2026-11-10,100.00,QA Payer ${s}\n`) })
  await expect(page.getByText("Match the columns")).toBeVisible()
  await page.getByRole("combobox", { name: /^Date/ }).selectOption("When")
  await page.getByRole("combobox", { name: /^Amount/ }).selectOption("Money")
  await page.getByRole("combobox", { name: /^Payer name/ }).selectOption("Who")
  await page.getByRole("button", { name: "Apply columns" }).click()
  await expect(page.getByRole("button", { name: "Confirm and save 1 row" })).toBeEnabled()
  await page.getByRole("button", { name: "Confirm and save 1 row" }).click()
  await expect(page.getByRole("heading", { name: "1 payments saved" })).toBeVisible()
})

test("ambiguous dates need an explicit choice", async ({ page }) => {
  test.setTimeout(240_000)
  await signIn(page)
  const s = Date.now() % 1_000_000
  await page.goto("/app/invoices/import")
  await page.getByLabel("Choose CSV file").setInputFiles({ name: "dates.csv", mimeType: "text/csv", buffer: Buffer.from(`invoice_number,customer,issue_date,due_date,total_amount,currency\nQD-${s},QA Dates ${s},03/04/2026,05/06/2026,100,USD\n`) })
  await expect(page.getByText("Confirm the date format")).toBeVisible()
  await expect(page.getByRole("button", { name: /Confirm and save/ })).toBeDisabled()
  await page.getByRole("button", { name: "Use this format" }).click()
  await expect(page.getByRole("button", { name: "Confirm and save 1 row" })).toBeEnabled()
})

function pdf(lines: string[]): Buffer {
  const stream = `BT /F1 12 Tf 50 750 Td 16 TL ${lines.map((l) => `(${l}) Tj T*`).join(" ")} ET`
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
  let out = "%PDF-1.4\n"; const offs: number[] = []
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const x = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`
  return Buffer.from(out)
}

test("a PDF is read by AI, every row is reviewed, and nothing is saved until confirmed", async ({ page }) => {
  test.setTimeout(360_000)
  await signIn(page)
  const s = Date.now() % 1_000_000
  await page.goto("/app/settings/financial")
  const sw = page.getByRole("switch", { name: "Explain investigations with AI" })
  await expect(sw).toBeVisible({ timeout: 30_000 })
  if ((await sw.getAttribute("aria-checked")) !== "true") { await sw.click(); await page.getByRole("button", { name: "Save changes" }).click(); await expect(page.getByText("Settings saved").first()).toBeVisible() }
  await page.goto("/app/invoices/import")
  const doc = pdf([`Invoice QPDF-${s}-1 for QA Pdf ${s}`, "Issued 2026-10-01, due 2026-11-01. Total 2,400.00 USD", `Invoice QPDF-${s}-2 for QA Pdf ${s}`, "Issued 2026-10-05, due 2026-11-05. Total 610.50 USD"])
  await page.getByLabel("Choose CSV file").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: doc })
  await expect(page.getByText(/read from PDF · 2 rows/)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole("button", { name: "Confirm and save 2 rows" })).toBeEnabled()
  await page.getByRole("button", { name: "Confirm and save 2 rows" }).click()
  await expect(page.getByRole("heading", { name: "2 invoices saved" })).toBeVisible()
})
