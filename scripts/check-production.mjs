import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const reservation = createServer();
await new Promise((resolve, reject) => {
  reservation.once("error", reject);
  reservation.listen(0, "127.0.0.1", resolve);
});
const address = reservation.address();
if (!address || typeof address === "string") throw new Error("Unable to reserve a local preview port.");
const port = address.port;
await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));

const server = spawn(process.execPath, [
  fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
  "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--base", "/star-quest-2/",
], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += String(chunk); });
server.stderr.on("data", chunk => { serverOutput += String(chunk); });
const origin = `http://127.0.0.1:${port}/star-quest-2/`;
let browser;

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview exited before it was ready:\n${serverOutput}`);
    try {
      ready = (await fetch(origin)).ok;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
    if (ready) break;
    await setTimeout(100);
  }
  if (!ready) throw new Error(`Preview did not become ready:\n${serverOutput}`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const assets = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on("response", response => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
    if (/\.(js|css|svg)(?:\?|$)/.test(response.url())) assets.push(response.url());
  });
  await page.goto(origin);
  await page.locator("#start-button").click();
  await page.locator("#skip-button").click();
  for (let line = 0; line < 20 && await page.locator("#dialogue").isVisible(); line++) {
    await page.locator("#next-button").click();
  }
  await page.locator("#objects-button").click();
  await page.locator('[data-verb="look"]').click();
  await page.locator('[data-hotspot="diagnostics"]').click();
  await page.locator("#dialogue").waitFor({ state: "visible" });
  if (errors.length) throw new Error(errors.join("\n"));
  if (!assets.length || assets.some(url => !url.startsWith(origin))) {
    throw new Error(`Production assets did not stay beneath the hosting subpath:\n${assets.join("\n")}`);
  }
  console.log(`Production subpath smoke passed: ${assets.length} assets loaded and a real room interaction completed.`);
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise(resolve => server.once("exit", resolve));
  }
}
