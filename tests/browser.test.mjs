import { chromium } from "playwright";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
const bundle = await build({
  entryPoints: [new URL("fixture.jsx", import.meta.url).pathname],
  bundle: true,
  write: false,
  format: "esm",
  external: ["/pi/*"],
});
let mode = "ok",
  delay = 0;
const skills = [
  { name: "code-review", description: "检查代码" },
  { name: "commit", description: "提交" },
  { name: "frontend-design", description: "<img src=x onerror=alert(1)>" },
];
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/pi/") {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<style>textarea{width:450px;height:80px}body{padding-top:300px}output{display:block}</style><div id="root"></div><script type="module" src="/fixture.js"></script>',
    );
  } else if (path === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else if (path.startsWith("/pi/plugins/skill-mention/client/")) {
    const file = path.split("/").pop();
    if (!["entry.mjs", "core.mjs"].includes(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader("Content-Type", "text/javascript");
    res.end(await readFile(new URL(`../client/${file}`, import.meta.url)));
  } else if (path === "/pi/plugins-api/skill-mention/skills") {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    res.setHeader("Content-Type", "application/json");
    if (mode === "error") {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: "测试错误" }));
    } else res.end(JSON.stringify({ ok: true, skills }));
  } else if (path === "/pi/plugins-api/skill-mention/status") {
    res.setHeader("Content-Type", "application/json");
    res.end('{"ok":true}');
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const chrome =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(chrome) ? { executablePath: chrome } : {}),
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ta = page.locator('[data-pi-anchor="composer"] textarea');
const panel = page.locator("#pi-skill-mention-list");
async function ready(count) {
  await page.waitForFunction(
    (n) =>
      document.querySelectorAll("#pi-skill-mention-list button").length === n,
    count,
  );
}
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/pi/`);
  await ta.fill("$");
  await ready(3);
  assert.equal(await panel.isVisible(), true);
  await ta.press("ArrowDown");
  await ta.press("Tab");
  assert.equal(await ta.inputValue(), "$commit ");
  assert.equal(await page.locator("output").textContent(), "$commit ");
  await ta.pressSequentially("$co");
  await ready(2);
  await ta.press("Enter");
  assert.equal(await ta.inputValue(), "$commit $code-review ");
  assert.equal(await page.evaluate(() => window.submits), 0);
  await ta.fill("$fr");
  await ready(1);
  assert.equal(await panel.locator("img").count(), 0);
  await ta.press("Escape");
  assert.equal(await panel.isVisible(), false);
  await ta.press("Enter");
  assert.equal(await page.evaluate(() => window.submits), 1);
  await ta.fill("$zzz");
  await page.waitForFunction(() =>
    document
      .querySelector("#pi-skill-mention-list")
      .textContent.includes("没有匹配"),
  );
  await ta.press("Enter");
  assert.equal(await page.evaluate(() => window.submits), 2);
  await ta.fill("检查 $co-old 后文");
  await ta.evaluate((el) => {
    el.setSelectionRange(6, 6);
    el.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await ready(2);
  await ta.press("Enter");
  assert.equal(await ta.inputValue(), "检查 $code-review 后文");
  await ta.fill("$co");
  await ready(2);
  await ta.press("ArrowUp");
  await ta.press("Tab");
  assert.equal(await ta.inputValue(), "$commit ");
  await ta.fill("$fr");
  await ready(1);
  await panel.locator("button").click();
  assert.equal(await ta.inputValue(), "$frontend-design ");
  await page.locator("#other").fill("$co");
  assert.equal(await panel.isVisible(), false);
  await ta.fill("$co");
  await ready(2);
  await ta.evaluate((el) =>
    el.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    ),
  );
  assert.equal(await panel.isVisible(), false);
  await ta.evaluate((el) =>
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        isComposing: true,
      }),
    ),
  );
  assert.equal(await ta.inputValue(), "$co");
  await ta.evaluate((el) =>
    el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })),
  );
  await ready(2);
  const bounds = await panel.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.y >= 0);
  // Out-of-order metadata must not reopen a dismissed picker.
  delay = 100;
  await ta.fill("plain");
  await ta.fill("$");
  await ta.press("Escape");
  await page.waitForTimeout(150);
  assert.equal(await panel.isVisible(), false);
  delay = 0;
  mode = "error";
  await ta.fill("plain");
  await ta.fill("$");
  await page.waitForFunction(() =>
    document
      .querySelector("#pi-skill-mention-list")
      .textContent.includes("测试错误"),
  );
  mode = "ok";
  await ta.fill("plain");
  await ta.fill("$co");
  await ready(2);
  // Hot reload replaces the singleton without duplicate panels or key handlers.
  await page.evaluate(
    () => import("/pi/plugins/skill-mention/client/entry.mjs?e=2"),
  );
  await ready(2);
  assert.equal(await panel.count(), 1);
  await ta.press("Tab");
  assert.equal(await ta.inputValue(), "$code-review ");
  await page.evaluate(() =>
    window[Symbol.for("pi-web-ui.skill-mention.dispose")](),
  );
  assert.equal(await panel.count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser checks with React 19 controlled textarea; filtering, keyboard, multiple tokens, IME, errors, reload, cleanup and proxy prefix.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
