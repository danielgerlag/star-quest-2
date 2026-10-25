import { expect, test, type Page } from "@playwright/test";
import { storyCampaign, type StoryProgress } from "../../src/content/story";
import { laterRooms, missions } from "../../src/content/story-content";
import { createBattle } from "../../src/game/combat";
import { createSession } from "../../src/game/session";
import type { World } from "../../src/game/types";
import type { SavedGame } from "../../src/platform/saves";

async function resumeEncounter(page: Page, stage: "chapter-2" | "chapter-3"): Promise<void> {
  const room = stage === "chapter-2" ? laterRooms.shuttlebay : laterRooms.depot;
  const world: World<StoryProgress> = {
    progress: { stage, step: "encounter" }, room: room.id, actor: room.spawn,
    inventory: stage === "chapter-2" ? ["tool"] : ["tool", "flight-log"],
    countdownMs: null, scene: { kind: "combat", battle: createBattle(missions[stage].rules) },
  };
  const save: SavedGame = {
    format: 1, campaign: storyCampaign.id, label: "Encounter checkpoint",
    savedAt: new Date().toISOString(),
    resume: createSession(storyCampaign, { world, checkpoint: world }).capture(),
  };
  await page.addInitScript(value => localStorage.setItem("star-quest-2.save.auto", value), JSON.stringify(save));
  await page.goto("/");
  await page.locator("#continue-button").click();
  await page.locator("#scan-button").click();
}

async function disableTarget(page: Page, target: "engines" | "weapons"): Promise<void> {
  await page.locator(`[data-target="${target}"]`).click();
  for (let shot = 0; shot < 3; shot++) {
    await expect(page.locator("#fire-button")).toBeEnabled();
    await page.locator("#fire-button").click();
  }
  await expect(page.locator("#target-stat")).toHaveText("0%");
}

test("target selection survives a tactical render between pointer down and up", async ({ page }) => {
  await resumeEncounter(page, "chapter-3");
  await page.locator('[data-target="weapons"]').click({ delay: 250 });
  await expect(page.locator('[data-target="weapons"]')).toHaveClass(/active/);
  await expect(page.locator("#fire-button")).toContainText("tractor emitters");
});

test("chapter 2 can leave a disabled patrol without an evasive formation", async ({ page }) => {
  await resumeEncounter(page, "chapter-2");
  await disableTarget(page, "engines");
  await disableTarget(page, "weapons");
  await expect(page.locator("#tactical-status")).toBeVisible();
  await expect(page.locator("#tactical-status")).toContainText("Select Decoy escape");
  await expect(page.locator("#battle-readout")).not.toContainText("INCOMING");
  await page.locator('[data-maneuver="hold"]').click();
  await expect(page.locator("#battle-log")).not.toContainText("charging another shot");
  await page.locator('[data-power="engines"][data-delta="-1"]').click();
  await expect(page.locator("#escape-button")).toBeEnabled();
  await page.locator('[data-power="engines"][data-delta="-1"]').click();
  await expect(page.locator("#escape-button")).toBeDisabled();
  await expect(page.locator("#tactical-status")).toContainText("at least 1 power to engines");
  await page.locator('[data-power="engines"][data-delta="1"]').click();
  await page.locator("#escape-button").click();
  await expect(page.locator("#tactical-status")).toContainText("in progress");
  await expect(page.locator("#skip-button")).toBeVisible({ timeout: 25000 });
  await expect(page.locator("#subtitle-text")).not.toContainText("escorting");
  await page.locator("#skip-button").click();
  await expect(page.locator("#complete-label")).toHaveText("CHAPTER 02 COMPLETE");
  await page.locator("#next-chapter-button").click();
  await expect(page.locator("#chapter-number")).toContainText("CHAPTER 03");
});

test("chapter 2 keeps the evasive decoy route when the patrol can still pursue", async ({ page }) => {
  await resumeEncounter(page, "chapter-2");
  await expect(page.locator("#tactical-status")).toBeVisible();
  await expect(page.locator("#tactical-status")).toContainText("Select Evade");
  await page.locator('[data-maneuver="evade"]').click();
  await expect(page.locator("#tactical-status")).toContainText("at least 3 power to engines");
  await page.locator('[data-power="engines"][data-delta="1"]').click();
  await expect(page.locator("#tactical-status")).toContainText("Select Decoy escape");
  await expect(page.locator("#escape-button")).toBeEnabled();
  await page.locator("#escape-button").click();
  await page.waitForTimeout(300);
  await page.locator('[data-maneuver="hold"]').click();
  await expect(page.locator("#tactical-status")).toContainText("Paused: Select Evade");
  const stalled = await page.locator("#escape-meter").getAttribute("style");
  await page.waitForTimeout(300);
  await expect(page.locator("#escape-meter")).toHaveAttribute("style", stalled ?? "");
  await page.locator('[data-maneuver="evade"]').click();
  await expect(page.locator("#tactical-status")).toContainText("in progress");
  await expect(page.locator("#skip-button")).toBeVisible({ timeout: 15000 });
  await page.locator("#skip-button").click();
  await expect(page.locator("#complete-label")).toHaveText("CHAPTER 02 COMPLETE");
});

test("the Defiant encounter identifies tractor emitters after its engines are disabled", async ({ page }) => {
  await resumeEncounter(page, "chapter-3");
  await disableTarget(page, "engines");
  await expect(page.locator("#tactical-status")).toBeVisible();
  await expect(page.locator("#tactical-status")).toContainText("Disable tractor emitters");
  await disableTarget(page, "weapons");
  await expect(page.locator("#tactical-status")).toContainText("Select Break tractor lock");
  await page.locator("#escape-button").click();
  await expect(page.locator("#skip-button")).toBeVisible({ timeout: 15000 });
  await page.locator("#skip-button").click();
  await expect(page.locator("#complete-label")).toHaveText("CHAPTER 03 COMPLETE");
});
