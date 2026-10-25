import { describe, expect, it } from "vitest";
import { chapterInfo, encounterRules, storyCampaign, upgradeStorySave, type StoryProgress } from "../../src/content/story";
import { laterItems, laterRooms, laterSequences, missions, type ChapterStage } from "../../src/content/story-content";
import { applyOrder, chargeBlockReason, createBattle, stepBattle } from "../../src/game/combat";
import { createSession } from "../../src/game/session";
import { withinFloor } from "../../src/game/navigation";
import type { Session } from "../../src/game/types";
import { itemDrawing } from "../../src/presentation/items";
import { roomArtIds } from "../../src/presentation/art";
import { chapterPaths } from "../fixtures/chapter-paths";
import { act, clearDialogue, finishRepair, order, reachBattle, skip, winBattle } from "./helpers";

const chapters: readonly ChapterStage[] = ["chapter-2", "chapter-3", "chapter-4", "chapter-5"];

function completedOpening(): Session<StoryProgress> {
  const session = createSession(storyCampaign);
  skip(session);
  act(session, "console");
  skip(session);
  clearDialogue(session);
  finishRepair(session);
  for (const target of ["auxiliary", "corridor-exit", "turbolift-exit", "bridge-exit", "command"]) act(session, target);
  skip(session);
  clearDialogue(session);
  winBattle(session);
  skip(session);
  return session;
}

function reload(session: Session<StoryProgress>): Session<StoryProgress> {
  const save = session.capture();
  expect(storyCampaign.validateWorld(save.world), JSON.stringify(save.world)).toBe(true);
  expect(storyCampaign.validateWorld(save.checkpoint), JSON.stringify(save.checkpoint)).toBe(true);
  return createSession(storyCampaign, JSON.parse(JSON.stringify(save)));
}

function playPuzzle(session: Session<StoryProgress>, chapter: ChapterStage): Session<StoryProgress> {
  session.dispatch({ type: "continue-chapter" });
  session.dispatch({ type: "continue-chapter" });
  expect(session.view().progress.stage).toBe(chapter);
  const watched = createSession(storyCampaign, session.capture());
  watched.advance(100_000);
  skip(session);
  expect(watched.capture()).toEqual(session.capture());
  for (const [target, verb, item] of chapterPaths[chapter]) {
    act(session, target, verb, item);
    session = reload(session);
  }
  expect(session.view().scene).toMatchObject({ kind: "cutscene", id: missions[chapter].departure });
  const watchedDeparture = createSession(storyCampaign, session.capture());
  watchedDeparture.advance(100_000);
  skip(session);
  expect(watchedDeparture.capture()).toEqual(session.capture());
  clearDialogue(session);
  return reload(session);
}

function winMission(session: Session<StoryProgress>): void {
  const rules = encounterRules(session.view().progress);
  order(session, { type: "scan" });
  order(session, { type: "maneuver", maneuver: "evade" });
  if (rules.requiredTarget) {
    order(session, { type: "target", target: rules.requiredTarget });
    for (let shot = 0; shot < 3; shot++) {
      order(session, { type: "fire" });
      session.advance(1800);
    }
  }
  for (const system of ["shields", "weapons", "engines"] as const) {
    for (let moves = 0; moves < 4; moves++) {
      const scene = session.view().scene;
      if (scene.kind !== "combat") throw new Error("Encounter ended unexpectedly");
      if (scene.battle.power[system] >= rules.minimumPower[system]) break;
      order(session, { type: "power", system, delta: 1 });
    }
  }
  order(session, { type: "maneuver", maneuver: rules.requiredManeuver ?? "evade" });
  const ready = session.view().scene;
  if (ready.kind !== "combat") throw new Error("Expected active encounter");
  expect(chargeBlockReason(ready.battle, rules)).toBeNull();
  expect(ready.battle.enemyHull).toBe(100);
  if (session.view().progress.stage === "chapter-3") expect(ready.battle.enemyEngines).toBe(100);
  order(session, { type: "engage" });
  session.advance(30_000);
  expect(session.view().scene.kind).toBe("cutscene");
  const watched = createSession(storyCampaign, session.capture());
  watched.advance(100_000);
  skip(session);
  expect(watched.capture()).toEqual(session.capture());
}

describe("the complete five-chapter adventure", () => {
  it("plays every chapter, reloads every puzzle gate, and reaches the crew-return ending", () => {
    let session = reload(completedOpening());
    expect(chapterInfo(session.view().progress).next).toBe("Acting captain");
    for (const chapter of chapters) {
      session = playPuzzle(session, chapter);
      winMission(session);
      session = reload(session);
      expect(session.view().scene.kind).toBe("complete");
      expect(session.view().progress).toMatchObject({ stage: chapter, step: "complete" });
    }
    expect(chapterInfo(session.view().progress).next).toBeNull();
    expect(chapterInfo(session.view().progress).ending).toMatch(/entire crew are safe/i);
    const ending = session.capture();
    session.dispatch({ type: "continue-chapter" });
    expect(session.capture()).toEqual(ending);
    expect(session.view().inventory).toEqual(["tool", "flight-log"]);
  });

  it("restores each failed encounter with its chapter evidence and full health", () => {
    let session = completedOpening();
    for (const chapter of chapters) {
      session = playPuzzle(session, chapter);
      const inventory = session.view().inventory;
      order(session, { type: "power", system: "shields", delta: -1 });
      order(session, { type: "power", system: "shields", delta: -1 });
      session.advance(40_000);
      expect(session.view().scene.kind).toBe("failure");
      session = reload(session);
      session.dispatch({ type: "retry" });
      expect(session.view().inventory).toEqual(inventory);
      expect(session.view().scene).toMatchObject({ kind: "combat", battle: { hull: 100, charge: 0, engaged: false, scanned: false } });
      winMission(session);
    }
  });

  it("preserves completed opening saves and upgrades both legacy battle snapshots at the boundary", () => {
    const oldComplete = completedOpening().capture();
    const completed = createSession(storyCampaign, upgradeStorySave(oldComplete));
    completed.dispatch({ type: "continue-chapter" });
    expect(completed.view().progress.stage).toBe("chapter-2");
    const current = reachBattle().capture();
    const legacyWorld = (world: typeof current.world) => {
      if (world.scene.kind !== "combat") throw new Error("Expected combat snapshot");
      const { charge, engaged, ...battle } = world.scene.battle;
      return { ...world, scene: { ...world.scene, battle: { ...battle, escapeCharge: charge, escaping: engaged } } };
    };
    const legacy = { world: legacyWorld(current.world), checkpoint: legacyWorld(current.checkpoint) };
    const restored = createSession(storyCampaign, upgradeStorySave(legacy));
    expect(restored.view().scene).toMatchObject({ kind: "combat", battle: { charge: 0, engaged: false } });
    expect(legacy.world.scene.battle).toHaveProperty("escapeCharge");
    expect(restored.capture().world.scene).not.toHaveProperty("battle.escapeCharge");
    expect(() => createSession(storyCampaign, upgradeStorySave({
      ...legacy, world: { ...legacy.world, scene: { ...legacy.world.scene, battle: { ...legacy.world.scene.battle, escapeCharge: -1 } } },
    }))).toThrow(/Invalid/);
  });

  it("allows early supplies, refuses wrong ordering/items, and makes collection and continuation idempotent", () => {
    const session = completedOpening();
    session.dispatch({ type: "continue-chapter" });
    const token = session.view().scene;
    skip(session);
    act(session, "desk-drawer");
    act(session, "desk-drawer");
    act(session, "command-bridge-exit");
    act(session, "nav-console", "use", "nav-chip");
    expect(session.view().inventory).toContain("nav-chip");
    expect(session.view().progress).toMatchObject({ step: "trace" });
    session.dispatch({ type: "continue-chapter" });
    if (token.kind === "cutscene") session.dispatch({ type: "finish-cutscene", token: token.token });
    expect(session.view().progress.stage).toBe("chapter-2");
    act(session, "ready-room-exit");
    act(session, "alert-log", "look");
    act(session, "command-bridge-exit");
    act(session, "nav-console", "use", "nav-chip");
    act(session, "shuttlebay-exit");
    act(session, "probe-rack");
    act(session, "probe-rack");
    act(session, "probe-bench", "use", "tool");
    expect(session.view().inventory).toEqual(["tool", "probe"]);
    expect(session.view().progress).toMatchObject({ step: "decoy" });
    const saved = session.capture();
    expect(() => createSession(storyCampaign, { ...saved, world: { ...saved.world, progress: { stage: "chapter-3", step: "install" } } })).toThrow(/Invalid/);
    expect(() => createSession(storyCampaign, { ...saved, world: { ...saved.world, inventory: ["tool", "decoy"] } })).toThrow(/Invalid/);
    expect(() => createSession(storyCampaign, { ...saved, checkpoint: { ...saved.checkpoint, progress: { stage: "chapter-5", step: "complete" } } })).toThrow(/Invalid/);
  });
});

describe("authored mission objectives", () => {
  it.each(chapters)("enforces %s prerequisites and stalls when formation/power is lost", chapter => {
    const rules = missions[chapter].rules;
    let battle = applyOrder(createBattle(rules), { type: "engage" }, rules);
    expect(battle.engaged).toBe(false);
    battle = {
      ...battle, scanned: true, enemyEngines: rules.requiredTarget === "engines" ? 0 : 100,
      enemyWeapons: rules.requiredTarget === "weapons" ? 0 : 100,
      maneuver: rules.requiredManeuver ?? "hold",
      power: chapter === "chapter-2" ? { shields: 1, weapons: 2, engines: 3 }
        : chapter === "chapter-4" ? { shields: 3, weapons: 1, engines: 2 } : { shields: 2, weapons: 2, engines: 2 },
    };
    battle = applyOrder(battle, { type: "engage" }, rules);
    expect(battle.engaged).toBe(true);
    battle = stepBattle(battle, 50, rules);
    expect(battle.charge).toBeGreaterThan(0);
    const stalled = stepBattle({ ...battle, power: { ...battle.power, [rules.chargeSystem]: 0 } }, 50, rules);
    expect(stalled.charge).toBe(battle.charge);
    expect(stalled.log).toContain("paused");
    if (rules.requiredManeuver) {
      expect(stepBattle({ ...battle, maneuver: "turn" }, 50, rules).charge).toBe(battle.charge);
    }
  });

  it("keeps incoming discharge dangerous even if its pulse focus is disabled", () => {
    const rules = missions["chapter-5"].rules;
    const battle = stepBattle({ ...createBattle(rules), enemyWeapons: 0, enemyAttackMs: 50 }, 50, rules);
    expect(battle.shields.forward).toBeLessThan(100);
  });
});

describe("later chapter content", () => {
  it("connects every exit, draws every inventory item, and supplies reachable hotspots and three-frame transitions", () => {
    for (const room of Object.values(laterRooms)) {
      expect(roomArtIds).toContain(room.art);
      expect(withinFloor(room.spawn, room.floor)).toBe(true);
      for (const hotspot of room.hotspots) {
        expect(withinFloor(hotspot.approach, room.floor)).toBe(true);
        if (hotspot.id.endsWith("-exit")) expect(laterRooms).toHaveProperty(hotspot.id.slice(0, -5));
      }
    }
    for (const id of Object.keys(laterItems)) expect(itemDrawing(id)).toContain("<");
    const art = new Set(Object.values(storyCampaign.rooms).map(room => room.art));
    for (const sequence of Object.values(laterSequences)) {
      expect(sequence.frames.length).toBeGreaterThanOrEqual(3);
      for (const frame of sequence.frames) {
        expect(art.has(frame.art)).toBe(true);
        expect(frame.durationMs).toBeGreaterThanOrEqual(3000);
      }
    }
    for (const mission of Object.values(missions)) {
      for (const hints of Object.values(mission.steps)) expect(hints).toHaveLength(3);
    }
  });
});
