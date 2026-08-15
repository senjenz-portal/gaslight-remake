/**
 * Verify the bento showcase page: it loads, the gallery images decode, the lightbox opens at
 * full resolution, and the king-demo index links here. Usage:
 *   node tools/bento-page-verify.mjs <base-url> <shot-path>
 */
import { chromium } from "playwright";

const base = (process.argv[2] || "http://127.0.0.1:8781/").replace(/\/$/, "");
const shot = process.argv[3] || "/tmp/bento-showcase.png";
const url = `${base}/king-demo/bento/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok: !!ok, detail });

await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });

check("title", (await page.title()) === "The Bento Engine Experiment", await page.title());
check("h1", (await page.locator("h1").innerText()) === "The Bento Engine Experiment");

// every image decoded with real pixels
const imgs = await page.evaluate(() =>
  Array.from(document.querySelectorAll(".gallery img, .zoom img")).map((i) => ({
    src: i.getAttribute("src"), w: i.naturalWidth, h: i.naturalHeight,
  })));
check("gallery+sheet images decoded", imgs.length >= 6 && imgs.every((i) => i.w > 0 && i.h > 0),
  imgs.map((i) => `${i.src} ${i.w}x${i.h}`).join(" | "));

const caps = await page.locator(".gallery figcaption").count();
check("gallery captions", caps === 5, `${caps} captions`);

// the measured table
const rows = await page.locator("table.measured tbody tr").count();
check("measured table rows", rows === 10, `${rows} rows`);
const body = await page.locator("body").innerText();
for (const n of ["49.0 MB", "4.2 MB", "240 ticks", "195.0 MB", "89.5 MB"]) {
  check(`number "${n}" present`, body.includes(n));
}
check("verdict cards", (await page.locator(".card").count()) === 3);
check("no-playable block", body.includes("Why there is no playable here"));

// lightbox: click the comparison sheet, it opens at the FULL-res jpeg
await page.locator('img[data-full]').click();
await page.waitForSelector("#lightbox.open", { timeout: 10_000 });
const lb = await page.evaluate(() => {
  const i = document.querySelector("#lightbox img");
  return { open: document.getElementById("lightbox").classList.contains("open"), src: i.src, w: i.naturalWidth, h: i.naturalHeight };
});
check("lightbox opens full-res sheet", lb.open && lb.src.endsWith("bento-vs-threejs.jpg") && lb.w === 3416 && lb.h === 3844,
  `${lb.src} ${lb.w}x${lb.h}`);
await page.keyboard.press("Escape");
await page.waitForFunction(() => !document.getElementById("lightbox").classList.contains("open"), { timeout: 10_000 });
check("lightbox closes on Escape", true);

await page.screenshot({ path: shot, fullPage: true });

// the king-demo index links here
await page.goto(`${base}/king-demo/`, { waitUntil: "networkidle", timeout: 60_000 });
const href = await page.locator('a[href="bento/"]').first().getAttribute("href").catch(() => null);
check("king-demo index links to bento/", href === "bento/");
const linkText = await page.locator('a[href="bento/"]').first().innerText().catch(() => "");
check("link text", /bento/i.test(linkText), linkText);

await browser.close();

const failed = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? "  — " + c.detail : ""}`);
if (errors.length) console.log("CONSOLE/NETWORK:\n" + errors.join("\n"));
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed; ${errors.length} page errors; screenshot ${shot}`);
process.exit(failed.length || errors.length ? 1 : 0);
