import { expect, test, type Page } from "@playwright/test";
import { chapterPaths } from "../fixtures/chapter-paths";
import { laterRooms, laterSequences, missions, type ChapterStage } from "../../src/content/story-content";

async function clearDialogue(page: Page): Promise<void> {
  for (let line = 0; line < 20 && await page.locator("#dialogue").isVisible(); line += 1) {
    await page.locator("#next-button").click();
  }
  await expect(page.locator("#dialogue")).toBeHidden();
}

async function action(page: Page, target: string, verb: "look" | "use" | "talk" = "use", item?: string): Promise<void> {
  await page.locator(`[data-verb="${verb}"]`).click();
  if (item) {
    await page.locator("#inventory-button").click();
    await page.locator(`[data-item="${item}"]`).click();
  }
  await page.locator(`[data-hotspot="${target}"]`).click();
}

async function actAndRead(page: Page, target: string, verb: "look" | "use" | "talk" = "use", item?: string): Promise<void> {
  await action(page, target, verb, item);
  await expect(page.locator("#dialogue")).toBeVisible();
  await clearDialogue(page);
  if (item && await page.locator("#clear-item").isVisible()) await page.locator("#clear-item").click();
}

async function enterRoom(page: Page, exit: string, room: RegExp): Promise<void> {
  await action(page, exit);
  await expect(page.locator("#room-title")).toHaveText(room);
  await clearDialogue(page);
}

async function start(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#start-button").click();
  await page.locator("#skip-button").click();
  await clearDialogue(page);
  await page.locator("#objects-button").click();
}

async function watchScene(page: Page, id: string): Promise<void> {
  const sequence = laterSequences[id];
  if (!sequence) throw new Error(`Missing sequence: ${id}`);
  await expect(page.locator("#cutscene-title")).toHaveText(sequence.title);
  for (const [index, frame] of sequence.frames.entries()) {
    await expect(page.locator("#subtitle-text")).toHaveText(frame.text);
    if (index === 0) {
      const canvasFrame = () => page.locator("#viewport canvas").evaluate(canvas => {
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing game canvas");
        return canvas.toDataURL();
      });
      const before = await canvasFrame();
      await expect.poll(canvasFrame, { message: `${id} must animate its artwork` }).not.toBe(before);
    }
    await page.screenshot({ path: `test-results/${id}-${index}-${test.info().project.name}.png`, fullPage: true });
  }
  await expect(page.locator("#skip-button")).toBeHidden();
}

async function reloadFromSave(page: Page): Promise<void> {
  await page.locator("#menu-button").click();
  await page.getByRole("button", { name: "Save to slot 2", exact: true }).click();
  await page.locator("#resume-button").click();
  await page.reload();
  await page.locator("#continue-button").click();
}

async function playLaterChapter(page: Page, stage: ChapterStage): Promise<void> {
  const mission = missions[stage];
  await reloadFromSave(page);
  await expect(page.locator("#complete-screen")).toBeVisible();
  await page.locator("#next-chapter-button").click();
  await expect(page.locator("#chapter-number")).toContainText(`0${mission.number}`);
  await watchScene(page, mission.intro);
  await expect(page.locator("#room-title")).toHaveText(laterRooms[mission.entry].name);
  await page.locator("#objects-button").click();
  await page.screenshot({ path: `test-results/${stage}-room-${test.info().project.name}.png`, fullPage: true });
  for (const [index, [target, verb, item]] of chapterPaths[stage].entries()) {
    if (target.endsWith("-exit")) {
      const previousRoom = await page.locator("#room-title").innerText();
      await action(page, target, verb);
      await expect(page.locator("#room-title")).not.toHaveText(previousRoom);
      await page.screenshot({ path: `test-results/${stage}-${target}-${test.info().project.name}.png`, fullPage: true });
    } else if (index === chapterPaths[stage].length - 1) {
      await action(page, target, verb, item);
      await watchScene(page, mission.departure);
    } else {
      await actAndRead(page, target, verb, item);
      if (stage === "chapter-3" && target === "recorder") {
        await reloadFromSave(page);
        await page.locator("#objects-button").click();
        await page.locator("#inventory-button").click();
        await expect(page.locator('[data-item="flight-log"]')).toBeVisible();
        await expect(page.locator('[data-item="transceiver"]')).toBeVisible();
        await page.locator("#close-inventory").click();
      }
    }
  }
  await clearDialogue(page);
  await expect(page.locator("#tactical-card")).toBeVisible();
  if (stage === "chapter-3") {
    await page.clock.install();
    await page.locator('[data-power="shields"][data-delta="-1"]').click({ clickCount: 2 });
    await page.clock.runFor(40000);
    await expect(page.locator("#failure-screen")).toBeVisible();
    await page.locator("#retry-button").click();
    await expect(page.locator("#failure-screen")).toBeHidden();
    await expect(page.locator("#tactical-card")).toBeVisible();
    await expect(page.locator("#hull-stat")).toHaveText("100%");
  }
  if (stage === "chapter-4") {
    await page.locator("#scan-button").click();
    await page.locator('[data-power="shields"][data-delta="1"]').click();
    await page.locator("#escape-button").click();
    await expect.poll(async () => {
      const style = await page.locator("#escape-meter").getAttribute("style");
      return Number(style?.match(/width:\s*([\d.]+)/)?.[1] ?? 0);
    }).toBeGreaterThan(10);
    await reloadFromSave(page);
    await expect(page.locator("#power-shields")).toHaveText("2");
    await expect(page.locator("#escape-meter")).toHaveAttribute("style", /width: 0%/);
    await expect(page.locator("#scan-button")).toBeEnabled();
    await expect(page.locator("#tactical-objective")).toContainText("Hold, shields power 3+, engines power 1+");
  }
  await page.locator("#scan-button").click();
  await clearDialogue(page);
  await page.locator('[data-maneuver="evade"]').click();
  if (mission.rules.requiredTarget !== null) {
    await page.locator(`[data-target="${mission.rules.requiredTarget}"]`).click();
    for (let shot = 0; shot < 3; shot++) {
      await expect(page.locator("#fire-button")).toBeEnabled();
      await page.locator("#fire-button").click();
    }
    await expect(page.locator("#target-stat")).toHaveText("0%");
  }
  for (const system of ["shields", "weapons", "engines"] as const) {
    while (Number(await page.locator(`#power-${system}`).innerText()) < mission.rules.minimumPower[system]) {
      await page.locator(`[data-power="${system}"][data-delta="1"]`).click();
    }
  }
  if (mission.rules.requiredManeuver !== null) {
    await page.locator(`[data-maneuver="${mission.rules.requiredManeuver}"]`).click();
  }
  await expect(page.locator("#escape-button")).toBeEnabled();
  await page.locator("#escape-button").click();
  await page.screenshot({ path: `test-results/${stage}-battle-${test.info().project.name}.png`, fullPage: true });
  await expect(page.locator("#skip-button")).toBeVisible({ timeout: 20000 });
  await watchScene(page, mission.outro);
  await expect(page.locator("#complete-screen")).toBeVisible();
}

test("the complete five-chapter adventure through public controls, pause, retry and save reload", async ({ page }) => {
  test.setTimeout(480000);
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await start(page);
  await page.screenshot({ path: `test-results/engineering-${test.info().project.name}.png`, fullPage: true });
  await action(page, "console");
  if (await page.locator("#dialogue").isVisible()) await clearDialogue(page);
  await expect(page.locator("#skip-button")).toBeVisible();
  await page.locator("#skip-button").click();
  await clearDialogue(page);
  await expect(page.locator("#timer")).toContainText("WARP CORE BREACH");

  await page.locator("#menu-button").click();
  await expect(page.locator("#timer")).toContainText("PAUSED");
  const pausedTimer = await page.locator("#timer").textContent();
  await page.waitForTimeout(1200);
  await expect(page.locator("#timer")).toHaveText(pausedTimer ?? "");
  await page.locator("#resume-button").click();
  await page.locator("#inventory-button").click();
  await expect(page.locator("#timer")).toContainText("PAUSED");
  const inventoryTimer = await page.locator("#timer").textContent();
  await page.locator("#menu-button").click();
  await page.locator("#resume-button").click();
  await expect(page.locator("#inventory-panel")).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator("#timer")).toHaveText(inventoryTimer ?? "");
  await page.locator("#close-inventory").click();

  await actAndRead(page, "diagnostics", "look");
  await enterRoom(page, "alcove-exit", /alcove/i);
  await actAndRead(page, "placard", "look");
  await actAndRead(page, "tool-rack");
  await actAndRead(page, "coupling-bin");
  await page.locator("#inventory-button").click();
  await expect(page.locator("[data-item=tool]")).toBeVisible();
  await expect(page.locator("[data-item=coupling]")).toBeVisible();
  await page.locator("#close-inventory").click();
  await enterRoom(page, "engineering-exit", /engineering/i);
  await actAndRead(page, "bypass", "use", "tool");
  await actAndRead(page, "pump", "use", "coupling");
  await actAndRead(page, "pump");
  await expect(page.locator("#timer")).toContainText("SYSTEMS NOMINAL");

  await page.locator("#menu-button").click();
  await page.getByRole("button", { name: "Save to slot 1", exact: true }).click();
  await page.locator("#resume-button").click();
  await page.reload();
  await page.locator("#continue-button").click();
  await expect(page.locator("#timer")).toContainText("SYSTEMS NOMINAL");
  await page.locator("#objects-button").click();
  await actAndRead(page, "auxiliary");
  await enterRoom(page, "corridor-exit", /corridor/i);
  await enterRoom(page, "turbolift-exit", /turbolift/i);
  await enterRoom(page, "bridge-exit", /bridge/i);
  await page.screenshot({ path: `test-results/bridge-${test.info().project.name}.png`, fullPage: true });
  await action(page, "command");
  if (await page.locator("#dialogue").isVisible()) await clearDialogue(page);
  await expect(page.locator("#skip-button")).toBeVisible();
  await page.locator("#skip-button").click();
  await clearDialogue(page);
  await expect(page.locator("#tactical-card")).toBeVisible();
  await page.locator("#scan-button").click();
  await clearDialogue(page);
  await page.locator('[data-maneuver="evade"]').click();
  await expect(page.locator('[data-maneuver="evade"]')).toHaveClass(/active/);
  await expect(page.locator('[data-maneuver="hold"]')).not.toHaveClass(/active/);
  await page.screenshot({ path: `test-results/battle-${test.info().project.name}.png`, fullPage: true });
  const hullGaps = await page.locator("#viewport canvas").evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing game canvas");
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Missing canvas drawing context");
    // Sample inside the saucer, away from windows, at its non-integer battle scale.
    const { data, width, height } = context.getImageData(217, 112, 28, 18);
    const gaps: number[] = [];
    for (let row = 0; row < height; row += 1) {
      let darkPixels = 0;
      for (let column = 0; column < width; column += 1) {
        const offset = (row * width + column) * 4;
        if (data.subarray(offset, offset + 3).every(channel => channel < 60)) darkPixels += 1;
      }
      if (darkPixels > width * 0.9) gaps.push(row);
    }
    return gaps;
  });
  expect(hullGaps, "Scaled hull plating must not contain background-colored horizontal gaps").toEqual([]);
  for (let shot = 0; shot < 12; shot += 1) {
    if ((await page.locator("#target-stat").innerText()).trim() === "0%") break;
    await expect(page.locator("#fire-button")).toBeEnabled();
    await page.locator("#fire-button").click();
    await clearDialogue(page);
  }
  await expect(page.locator("#target-stat")).toHaveText("0%");
  await page.locator('[data-power="engines"][data-delta="1"]').click();
  await page.locator("#escape-button").click();
  await clearDialogue(page);
  await expect(page.locator("#skip-button")).toBeVisible({ timeout: 20000 });
  await page.locator("#skip-button").click();
  await expect(page.locator("#complete-screen")).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: `test-results/opening-${test.info().project.name}.png`, fullPage: true });
  for (const stage of ["chapter-2", "chapter-3", "chapter-4", "chapter-5"] as const) {
    await playLaterChapter(page, stage);
  }
  await expect(page.locator("#complete-label")).toHaveText("ALL FIVE CHAPTERS COMPLETE");
  await expect(page.locator("#complete-description")).toContainText("entire crew are safe");
  await expect(page.locator("#next-chapter-button")).toBeHidden();
  await reloadFromSave(page);
  await expect(page.locator("#complete-label")).toHaveText("ALL FIVE CHAPTERS COMPLETE");
  await expect(page.locator("#next-chapter-button")).toBeHidden();
  await page.screenshot({ path: `test-results/ending-${test.info().project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
  await expect(page.locator("#notice")).toBeHidden();
});

test("blocked storage reports memory-only play and still starts the adventure", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  });
  await start(page);
  await expect(page.locator("#notice")).toContainText("could not be saved");
  await expect(page.locator("#save-status")).toHaveText("UNSAVED / MEMORY ONLY");
  await expect(page.locator("#objects-card")).toBeVisible();
});

test("corrupt saves remain intact until the player chooses a new game", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("star-quest-2.save.auto", "{damaged");
  });
  await page.goto("/");
  await expect(page.locator("#notice")).toContainText("not been overwritten");
  expect(await page.evaluate(() => localStorage.getItem("star-quest-2.save.auto"))).toBe("{damaged");
  await expect(page.locator("#title-screen")).toBeVisible();
});

test("reduced motion holds the room lighting and idle sprite still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  const frame = () => page.locator("#viewport canvas").evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing game canvas");
    return canvas.toDataURL();
  });
  const stillFrame = await frame();
  await page.waitForTimeout(300);
  expect(await frame(), "Reduced-motion room pixels should stay unchanged").toBe(stillFrame);

  await page.locator("#menu-button").click();
  await expect(page.locator("#reduced-motion")).toBeChecked();
  await page.locator("#reduced-motion").uncheck();
  await page.locator("#resume-button").click();
  await expect.poll(frame, { message: "Ambient animation should resume when reduced motion is disabled" })
    .not.toBe(stillFrame);
});

test("scaled canvas hotspots resolve to their visible objects", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await start(page);
  await page.locator('[data-verb="look"]').click();
  const canvas = page.locator("#viewport canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("The adventure canvas is not visible.");
  await page.mouse.click(bounds.x + bounds.width * 310 / 640, bounds.y + bounds.height * 92 / 360);
  await expect(page.locator("#dialogue")).toBeVisible();
  await expect(page.locator("#dialogue-text")).not.toHaveText("");
});

test("a timed failure restores the repair checkpoint without a page reload", async ({ page }) => {
  await page.clock.install();
  await start(page);
  await page.clock.runFor(100);
  await action(page, "console");
  await page.clock.runFor(4000);
  if (await page.locator("#dialogue").isVisible()) await clearDialogue(page);
  await page.locator("#skip-button").click();
  await clearDialogue(page);
  await page.clock.runFor(181000);
  await expect(page.locator("#failure-screen")).toBeVisible();
  await page.locator("#retry-button").click();
  await expect(page.locator("#failure-screen")).toBeHidden();
  await expect(page.locator("#timer")).toContainText("3:00");
  await expect(page.locator("#room-title")).toContainText("Engineering");
  await expect(page.locator("#title-screen")).toBeHidden();
});

test("the top icon toolbar cycles cursors and inventory like a Sierra adventure", async ({ page }) => {
  await start(page);
  const toolbar = await page.locator("#action-row").boundingBox();
  const canvas = await page.locator("#viewport canvas").boundingBox();
  if (!toolbar || !canvas) throw new Error("Missing toolbar or canvas.");
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(canvas.y);
  for (const verb of ["look", "use", "talk", "smell", "taste", "walk"]) {
    await page.locator("#viewport canvas").click({ button: "right", position: { x: 120, y: 120 } });
    await expect(page.locator("#viewport")).toHaveAttribute("data-cursor", verb);
    await expect(page.locator(`[data-verb="${verb}"]`)).toHaveAttribute("aria-pressed", "true");
  }
  await page.locator('[data-verb="smell"]').click();
  await page.locator('[data-hotspot="console"]').click();
  await expect(page.locator("#dialogue")).toBeVisible();
  await clearDialogue(page);
  await expect(page.locator("#timer")).toContainText("SYSTEMS NOMINAL");
  await enterRoom(page, "alcove-exit", /alcove/i);
  await actAndRead(page, "tool-rack");
  await page.locator("#inventory-button").click();
  await page.locator("#inventory-look").click();
  await page.locator('[data-item="tool"]').click();
  await expect(page.locator("#modal-description")).toContainText("spanner");
  await page.locator("#close-modal").click();
  await page.locator("#inventory-select").click();
  await page.locator('[data-item="tool"]').click();
  await expect(page.locator("#inventory-panel")).toBeHidden();
  await expect(page.locator("#viewport")).toHaveAttribute("data-cursor", "item:tool");
  await expect(page.locator("#selected-item-button")).toContainText("Insulated tool");
  for (const cursor of ["walk", "look", "use", "talk", "smell", "taste", "item:tool"]) {
    await page.locator("#viewport canvas").click({ button: "right", position: { x: 120, y: 120 } });
    await expect(page.locator("#viewport")).toHaveAttribute("data-cursor", cursor);
  }
});
