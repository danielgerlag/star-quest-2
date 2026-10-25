import { expect, test, type Page } from "@playwright/test";
import { storyCampaign, type StoryProgress } from "../../src/content/story";
import { createSession } from "../../src/game/session";
import type { World } from "../../src/game/types";
import type { SavedGame } from "../../src/platform/saves";

async function enterCheckpoint(page: Page, world: World<StoryProgress>): Promise<void> {
  const save: SavedGame = {
    format: 1, campaign: storyCampaign.id, label: "Interaction checkpoint",
    savedAt: new Date().toISOString(),
    resume: createSession(storyCampaign, { world, checkpoint: world }).capture(),
  };
  await page.addInitScript(value => localStorage.setItem("star-quest-2.save.auto", value), JSON.stringify(save));
  await page.goto("/");
  await page.locator("#continue-button").click();
  await page.locator("#objects-button").click();
}

async function enterBridge(page: Page): Promise<void> {
  await enterCheckpoint(page, {
    progress: { stage: "take-command" }, room: "bridge", actor: { x: 318, y: 290 },
    inventory: ["tool"], countdownMs: null, scene: { kind: "adventure" },
  });
}

async function chairPixels(page: Page): Promise<number[]> {
  return page.locator("#viewport canvas").evaluate(canvas => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing game canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Missing canvas context");
    return Array.from(context.getImageData(297, 166, 43, 61).data);
  });
}

test("using the chair visibly seats Roger and freezes the pose while the menu is open", async ({ page }) => {
  await enterBridge(page);
  const emptySeat = await chairPixels(page);
  await page.locator('[data-verb="use"]').click();
  await page.locator('[data-hotspot="captain-chair"]').click();
  await expect(page.locator("#dialogue")).toBeVisible();
  await expect.poll(() => chairPixels(page), { message: "Roger must appear in the actual chair, not remain in the aisle" })
    .not.toEqual(emptySeat);
  await page.locator("#menu-button").click();
  const paused = await chairPixels(page);
  await page.waitForTimeout(300);
  expect(await chairPixels(page)).toEqual(paused);
  await page.locator("#resume-button").click();
  await expect(page.locator("#dialogue")).toBeVisible();
  await page.screenshot({ path: `test-results/roger-seated-${test.info().project.name}.png`, fullPage: true });
  await page.locator("#next-button").click();
  await expect.poll(() => chairPixels(page)).toEqual(emptySeat);
});

test("reduced motion preserves a visible, stationary seated pose", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterBridge(page);
  const emptySeat = await chairPixels(page);
  await page.locator('[data-verb="use"]').click();
  await page.locator('[data-hotspot="captain-chair"]').click();
  await expect(page.locator("#dialogue")).toBeVisible();
  await expect.poll(() => chairPixels(page)).not.toEqual(emptySeat);
  const seated = await chairPixels(page);
  await page.waitForTimeout(1200);
  expect(await chairPixels(page)).toEqual(seated);
  await page.screenshot({ path: `test-results/roger-seated-reduced-${test.info().project.name}.png`, fullPage: true });
});

test("repair dialogue does not cover Roger's interaction pose", async ({ page }) => {
  const bypass = storyCampaign.rooms.engineering?.hotspots.find(target => target.id === "bypass");
  if (!bypass) throw new Error("Missing bypass fixture");
  await enterCheckpoint(page, {
    progress: { stage: "repair", diagnostics: true, placard: true, bypassIsolated: false, couplingFitted: false },
    room: "engineering", actor: bypass.approach, inventory: ["tool", "coupling"],
    countdownMs: 180_000, scene: { kind: "adventure" },
  });
  await page.locator("#inventory-button").click();
  await page.locator('[data-item="tool"]').click();
  await page.locator('[data-hotspot="bypass"]').click();
  await expect(page.locator("#dialogue")).toContainText("Pressure falls to zero");
  const canvas = await page.locator("#viewport canvas").boundingBox();
  const dialogue = await page.locator("#dialogue").boundingBox();
  if (!canvas || !dialogue) throw new Error("Missing canvas or dialogue bounds");
  const actorTop = canvas.y + (bypass.approach.y - 52) * canvas.height / 360;
  const actorBottom = canvas.y + bypass.approach.y * canvas.height / 360;
  expect(dialogue.y + dialogue.height <= actorTop || dialogue.y >= actorBottom,
    "Dialogue must leave Roger's body and working hands visible").toBe(true);
  await page.screenshot({ path: `test-results/roger-repair-${test.info().project.name}.png`, fullPage: true });
});
