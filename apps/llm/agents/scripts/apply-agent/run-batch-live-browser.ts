#!/usr/bin/env tsx
/**
 * Batch visible-browser demo — 5 Playwright windows filling Greenhouse apps live.
 * Opens 5 real Chromium windows on your Mac so you can watch everything in real time.
 */
import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../../..");

// Candidate data
const C = {
  firstName: "Lam Anh",
  lastName: "Truong",
  fullName: "Lam Anh Truong",
  email: "npnallstar@gmail.com",
  phone: "5514049519",
  resumeUrl: "https://drive.google.com/file/d/1wKb7hlbshHesim7XOc5pAx5dTjCptCdy/view?usp=sharing",
  school: "George Mason University",
  degree: "Master's Degree",
  discipline: "Computer Science",
  linkedin: "https://linkedin.com/in/lamtruong",
  github: "https://github.com/lamtruong",
  website: "https://lamtruong.dev",
  address: "4400 University Dr",
  city: "Fairfax",
  state: "Virginia",
  zip: "22030",
  country: "United States",
  coverLetter:
    "Hi there!\n\n" +
    "I am writing because I am genuinely obsessed with the idea of rebuilding business processes as " +
    '"AI-native" rather than just slapping AI on top of old workflows.\n\n' +
    "I love building things that solve real problems. Recently, I built a tool using DeepSeek and " +
    "a RAG pipeline to turn natural language into SQL queries for real-time reports. " +
    "I've also architected event-driven systems on the cloud that boosted efficiency by 80%.\n\n" +
    "I am currently finishing my Master's in Computer Science at George Mason University.\n\n" +
    "Best,\nLam Anh Truong",
};

const JOBS = [
  {
    url: "https://boards.greenhouse.io/neuralink/jobs/6083322003",
    company: "Neuralink",
    role: "Software Engineer Intern",
    provider: "greenhouse",
  },
  {
    url: "https://boards.greenhouse.io/verkada/jobs/4665498007",
    company: "Verkada",
    role: "SWE Intern Backend",
    provider: "greenhouse",
  },
  {
    url: "https://jobs.ashbyhq.com/AeroVect/cb3ec12d-5f24-4047-bdc5-f262b60bd3ad/application?utm_source=Simplify&ref=Simplify",
    company: "AeroVect",
    role: "Application via Ashby",
    provider: "ashby",
  },
  {
    url: "https://jobs.lever.co/palantir/030ece08-c341-4959-bdfe-314e89b691ce/apply?utm_source=Simplify&ref=Simplify",
    company: "Palantir",
    role: "Application via Lever",
    provider: "lever",
  },
  {
    url: "https://kiongroup.wd3.myworkdayjobs.com/kiongroup/job/Atlanta-GA-United-States/AI-Internships_JR-0088855-1?utm_source=Simplify&ref=Simplify",
    company: "KION Group",
    role: "AI Internships",
    provider: "workday",
  },
];

function log(i: number, msg: string) {
  const c = JOBS[i]!.company;
  const time = new Date().toLocaleTimeString();
  console.error(`[${time}] [Job ${i + 1}/${JOBS.length} — ${c}] ${msg}`);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Try to fill an input by selector, returns true if filled. */
async function tryFill(page: Page, selector: string, value: string, label: string, i: number): Promise<boolean> {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 1500 })) {
      await el.scrollIntoViewIfNeeded();
      await el.fill(value);
      log(i, `✍️  Filled "${label}" → ${value.length > 40 ? value.slice(0, 40) + "..." : value}`);
      return true;
    }
  } catch { /* not found */ }
  return false;
}

/** Try to click a visible element by selector. */
async function tryClick(page: Page, selector: string, label: string, i: number): Promise<boolean> {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 1500 })) {
      await el.scrollIntoViewIfNeeded();
      await el.click();
      log(i, `🖱️  Clicked "${label}"`);
      return true;
    }
  } catch { /* not found */ }
  return false;
}

/** Try to select from a dropdown. */
async function trySelect(page: Page, selector: string, value: string, label: string, i: number): Promise<boolean> {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 1500 })) {
      await el.selectOption({ label: value });
      log(i, `📋 Selected "${label}" → ${value}`);
      return true;
    }
  } catch { /* not found */ }
  return false;
}

async function fillJobApplication(page: Page, i: number): Promise<void> {
  const job = JOBS[i]!;

  // ── Step 1: Navigate ──
  log(i, `🌐 Opening ${job.url}`);
  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await wait(2500);

  if (job.provider === "greenhouse") {
    await fillGreenhouse(page, i);
  } else if (job.provider === "ashby") {
    await fillAshby(page, i);
  } else if (job.provider === "lever") {
    await fillLever(page, i);
  } else if (job.provider === "workday") {
    await fillWorkday(page, i);
  }

  // ── Final: Highlight submit button (safe-stop) ──
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(800);

  const submitSelectors = [
    'button:has-text("Submit")',
    'input[type="submit"]',
    'button[type="submit"]',
    'button:has-text("Apply")',
    'button:has-text("Send")',
  ];
  for (const sel of submitSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.scrollIntoViewIfNeeded();
      await btn.evaluate((el: HTMLElement) => {
        el.style.border = "4px solid #ff0000";
        el.style.boxShadow = "0 0 30px rgba(255,0,0,0.6)";
        el.style.transform = "scale(1.05)";
        el.style.transition = "all 0.3s ease";
      });
      log(i, `🛑 SAFE STOP — Submit button highlighted in red (NOT clicking)`);
      break;
    }
  }

  log(i, `✅ Done! Form for ${job.company} is filled.`);
}

// ══════════════════════════════════════════
// GREENHOUSE
// ══════════════════════════════════════════
async function fillGreenhouse(page: Page, i: number): Promise<void> {
  // Click Apply button if needed
  await tryClick(page, 'a:has-text("Apply for this job"), a:has-text("Apply")', "Apply", i);
  await wait(2000);

  // Basic fields
  await tryFill(page, 'input[name="first_name"], input#first_name', C.firstName, "First Name", i);
  await tryFill(page, 'input[name="last_name"], input#last_name', C.lastName, "Last Name", i);
  await tryFill(page, 'input[name="email"], input#email, input[type="email"]', C.email, "Email", i);
  await tryFill(page, 'input[name="phone"], input#phone, input[type="tel"]', C.phone, "Phone", i);

  // Resume — "Enter manually"
  const resumeClicked = await tryClick(page, 'button:has-text("Enter manually"), a:has-text("Enter manually")', "Enter manually (Resume)", i);
  if (resumeClicked) {
    await wait(800);
    const ta = page.locator('textarea:visible').first();
    if (await ta.isVisible({ timeout: 1500 }).catch(() => false)) {
      await ta.fill(C.resumeUrl);
      log(i, `✍️  Pasted resume URL`);
    }
  }

  await page.evaluate(() => window.scrollBy(0, 600));
  await wait(800);

  // Cover letter — second "Enter manually"
  const clManual = page.locator('button:has-text("Enter manually"), a:has-text("Enter manually")').first();
  if (await clManual.isVisible({ timeout: 1500 }).catch(() => false)) {
    await clManual.click();
    log(i, `🖱️  Clicked "Enter manually (Cover Letter)"`);
    await wait(800);
    const ta = page.locator('textarea:visible').last();
    if (await ta.isVisible({ timeout: 1500 }).catch(() => false)) {
      await ta.fill(C.coverLetter);
      log(i, `✍️  Filled Cover Letter`);
    }
  }

  // LinkedIn / GitHub
  await tryFill(page, 'input[name*="linkedin" i], input[id*="linkedin" i]', C.linkedin, "LinkedIn", i);
  await tryFill(page, 'input[name*="github" i], input[id*="github" i]', C.github, "GitHub", i);
  await tryFill(page, 'input[name*="website" i], input[id*="website" i], input[name*="portfolio" i]', C.website, "Website/Portfolio", i);

  await page.evaluate(() => window.scrollBy(0, 600));
  await wait(800);

  // School autocomplete
  const schoolInput = page.locator('input[name*="school" i], input[id*="school" i], input[aria-label*="School" i]').first();
  if (await schoolInput.isVisible({ timeout: 1500 }).catch(() => false)) {
    await schoolInput.fill("George Mason");
    log(i, `✍️  Typed "George Mason" into School search`);
    await wait(1500);
    const opt = page.locator(`text="${C.school}"`).first();
    if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await opt.click();
      log(i, `📋 Selected "${C.school}"`);
    }
  }

  await trySelect(page, 'select[name*="degree" i]', C.degree, "Degree", i);
  await trySelect(page, 'select[name*="discipline" i]', C.discipline, "Discipline", i);
  await trySelect(page, 'select:has(option:has-text("United States"))', "United States", "Country", i);

  // Scroll and auto-answer yes/no dropdowns
  await page.evaluate(() => window.scrollBy(0, 600));
  await wait(500);
  await autoAnswerYesNo(page, i);
}

// ══════════════════════════════════════════
// ASHBY
// ══════════════════════════════════════════
async function fillAshby(page: Page, i: number): Promise<void> {
  // Ashby forms use various input fields
  await tryFill(page, 'input[name="name"], input[name*="Name" i]', C.fullName, "Full Name", i);
  await tryFill(page, 'input[name*="first" i]', C.firstName, "First Name", i);
  await tryFill(page, 'input[name*="last" i]', C.lastName, "Last Name", i);
  await tryFill(page, 'input[name="email"], input[type="email"]', C.email, "Email", i);
  await tryFill(page, 'input[name="phone"], input[type="tel"]', C.phone, "Phone", i);
  await tryFill(page, 'input[name*="linkedin" i]', C.linkedin, "LinkedIn", i);
  await tryFill(page, 'input[name*="github" i]', C.github, "GitHub", i);
  await tryFill(page, 'input[name*="website" i], input[name*="portfolio" i]', C.website, "Website", i);

  await page.evaluate(() => window.scrollBy(0, 500));
  await wait(800);

  // Fill textareas (cover letter, etc.)
  const textareas = page.locator('textarea:visible');
  const taCount = await textareas.count();
  for (let t = 0; t < taCount; t++) {
    const ta = textareas.nth(t);
    const val = await ta.inputValue();
    if (!val) {
      await ta.fill(C.coverLetter);
      log(i, `✍️  Filled textarea #${t + 1} with cover letter`);
      break;
    }
  }

  await page.evaluate(() => window.scrollBy(0, 500));
  await wait(500);
}

// ══════════════════════════════════════════
// LEVER
// ══════════════════════════════════════════
async function fillLever(page: Page, i: number): Promise<void> {
  // Lever has a clean form with specific input names
  await tryFill(page, 'input[name="name"]', C.fullName, "Full Name", i);
  await tryFill(page, 'input[name="email"]', C.email, "Email", i);
  await tryFill(page, 'input[name="phone"]', C.phone, "Phone", i);
  await tryFill(page, 'input[name="org"], input[name*="company" i], input[name*="current" i]', C.school, "Current Company/Org", i);
  await tryFill(page, 'input[name*="urls[LinkedIn]" i], input[name*="linkedin" i]', C.linkedin, "LinkedIn", i);
  await tryFill(page, 'input[name*="urls[GitHub]" i], input[name*="github" i]', C.github, "GitHub", i);
  await tryFill(page, 'input[name*="urls[Portfolio]" i], input[name*="portfolio" i], input[name*="urls[Other]" i]', C.website, "Portfolio", i);

  await page.evaluate(() => window.scrollBy(0, 500));
  await wait(800);

  // Lever often has additional questions as text fields
  const textareas = page.locator('textarea:visible');
  const taCount = await textareas.count();
  for (let t = 0; t < taCount; t++) {
    const ta = textareas.nth(t);
    const val = await ta.inputValue();
    if (!val) {
      await ta.fill(C.coverLetter);
      log(i, `✍️  Filled textarea #${t + 1} with cover letter`);
      break;
    }
  }

  await page.evaluate(() => window.scrollBy(0, 500));
  await wait(500);
}

// ══════════════════════════════════════════
// WORKDAY
// ══════════════════════════════════════════
async function fillWorkday(page: Page, i: number): Promise<void> {
  // Workday often requires clicking "Apply" first
  await wait(3000); // Workday pages are slow to load
  await tryClick(page, 'a:has-text("Apply"), button:has-text("Apply")', "Apply", i);
  await wait(3000);

  // Workday might ask to sign in or continue as guest
  await tryClick(page, 'button:has-text("Use My Last Application"), a:has-text("Apply Manually")', "Apply Manually", i);
  await wait(1000);
  await tryClick(page, 'button:has-text("Create Account")', "Create Account", i); // Changed from a:has-text to button:has-text
  await wait(1000);

  // Fill basic fields (Workday uses data-automation-id attributes)
  await tryFill(page, 'input[data-automation-id="name"], input[aria-label*="Name" i]', C.fullName, "Full Name", i);
  await tryFill(page, 'input[data-automation-id="email"], input[aria-label*="email" i], input[type="email"]', C.email, "Email", i);
  await tryFill(page, 'input[data-automation-id="phone"], input[aria-label*="phone" i], input[type="tel"]', C.phone, "Phone", i);

  // Fill any visible text inputs
  const allInputs = page.locator('input[type="text"]:visible');
  const inputCount = await allInputs.count();
  log(i, `Found ${inputCount} visible text inputs on Workday form`);

  await page.evaluate(() => window.scrollBy(0, 600));
  await wait(800);

  // Fill any visible textareas
  const textareas = page.locator('textarea:visible');
  const taCount = await textareas.count();
  for (let t = 0; t < taCount; t++) {
    const ta = textareas.nth(t);
    const val = await ta.inputValue();
    if (!val) {
      await ta.fill(C.coverLetter);
      log(i, `✍️  Filled textarea #${t + 1}`);
      break;
    }
  }

  await page.evaluate(() => window.scrollBy(0, 600));
  await wait(500);
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
async function autoAnswerYesNo(page: Page, i: number): Promise<void> {
  const allSelects = page.locator('select:visible');
  const selectCount = await allSelects.count();
  for (let s = 0; s < selectCount; s++) {
    const sel = allSelects.nth(s);
    const opts = await sel.locator('option').allTextContents();
    const hasYes = opts.some((o) => o.trim().toLowerCase() === "yes");
    const hasNo = opts.some((o) => o.trim().toLowerCase() === "no");
    if (hasYes && hasNo) {
      const currentVal = await sel.inputValue();
      if (!currentVal) {
        await sel.selectOption({ label: "Yes" });
        log(i, `📋 Auto-answered Yes/No dropdown (#${s + 1})`);
      }
    }
  }
}

async function main() {
  console.error(`\n${"═".repeat(80)}`);
  console.error(`  🚀 BATCH LIVE BROWSER — 5 visible Chromium windows filling 5 job apps live!`);
  console.error(`  👀 Watch all 5 browsers on your screen in real time.`);
  console.error(`${"═".repeat(80)}\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 150,
    args: ["--window-size=750,850"],
  });

  const start = Date.now();

  // Each job gets its own browser context (own window)
  const pages = await Promise.all(
    JOBS.map(async (_job, i) => {
      const ctx = await browser.newContext({
        viewport: { width: 750, height: 850 },
      });
      const page = await ctx.newPage();
      return page;
    }),
  );

  // Fill all 5 forms in parallel
  await Promise.all(
    pages.map((page, i) =>
      fillJobApplication(page, i).catch((err: unknown) => log(i, `❌ Error: ${err}`)),
    ),
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.error(`\n${"═".repeat(80)}`);
  console.error(`  ✅ All ${JOBS.length} jobs filled in ${elapsed}s`);
  console.error(`  🖥️  Browser windows stay open — inspect the forms!`);
  console.error(`  ⌨️  Press Ctrl+C when done.`);
  console.error(`${"═".repeat(80)}\n`);

  // Keep alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[BATCH_LIVE_BROWSER] Fatal:", err);
  process.exit(1);
});
