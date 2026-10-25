import { describe, expect, it } from "vitest";
import { openingCampaign, REPAIR_DURATION_MS } from "../../src/content/opening";
import { createSession } from "../../src/game/session";
import type { Campaign, Point, World } from "../../src/game/types";
import { act, clearDialogue, interact, order, reachBattle, skip, startRepair } from "./helpers";

function otherCampaign(): Campaign<number> {
  return {
    id: "not-the-opening",
    rooms: {
      laboratory: {
        id: "laboratory", art: "laboratory", name: "Laboratory", caption: "",
        floor: { x: 0, y: 0, width: 500, height: 100 }, spawn: { x: 20, y: 20 },
        hotspots: [
          { id: "switch", name: "Switch", bounds: { x: 400, y: 0, width: 30, height: 40 }, approach: { x: 400, y: 20 } },
        ],
      },
    },
    items: {},
    sequences: {
      ceremony: {
        id: "ceremony", title: "A Different Story",
        frames: [{ art: "laboratory", speaker: "Scientist", text: "Proceed.", durationMs: 500 }],
      },
    },
    initial: () => ({
      progress: 0, room: "laboratory", actor: { x: 20, y: 20 }, inventory: [], countdownMs: 10_000,
      scene: { kind: "cutscene", id: "ceremony", token: 0, frame: 0, elapsedMs: 0 },
    }),
    interact: world => ({
      world: { ...world, progress: world.progress + 1 },
      dialogue: { speaker: "Scientist", lines: [`Arrived at ${world.actor.x}, with ${world.countdownMs}ms left.`] },
    }),
    finishSequence: world => ({ world: { ...world, scene: { kind: "adventure" } } }),
    finishBattle: world => ({ world: { ...world, scene: { kind: "complete" } } }),
    objective: world => `Find switch ${world.progress}.`,
    hint: () => ["Find it.", "The switch.", "Use the switch."],
    validateWorld: (value): value is World<number> => typeof (value as { progress?: unknown } | null)?.progress === "number",
  };
}

describe("session ownership and navigation", () => {
  it("runs a campaign with unrelated room, sequence and progress identifiers", () => {
    const session = createSession(otherCampaign());
    session.advance(500);
    session.dispatch({ type: "interact", target: "switch", verb: "use" });
    session.advance(2000);
    expect(session.view().progress).toBe(0);
    expect(session.view().actor.x).toBe(260);
    session.advance(2000);
    expect(session.view().progress).toBe(1);
    expect(session.view().actor.x).toBe(400);
    expect(session.view().dialogue?.lines[0]).toContain("Arrived at 400");
    expect(session.view().countdownMs).toBeCloseTo(10_000 - 380 / 120 * 1000);
  });

  it("moves at 120 logical pixels/second and clamps destinations to the room floor", () => {
    const session = startRepair();
    session.dispatch({ type: "walk", destination: { x: 600, y: 312 } });
    session.advance(500);
    expect(session.view().actor).toEqual({ x: 380, y: 312 });
    session.dispatch({ type: "walk", destination: { x: 9999, y: -9999 } });
    expect(session.view().destination).toEqual({ x: 610, y: 238 });
    session.advance(5000);
    expect(session.view().actor).toEqual({ x: 610, y: 238 });
    expect(session.view().destination).toBeNull();
  });

  it("does not perform an interaction until arrival, and a new walk cancels it", () => {
    const session = startRepair();
    session.dispatch({ type: "interact", verb: "look", target: "diagnostics" });
    expect(session.view().progress).toMatchObject({ diagnostics: false });
    session.advance(50);
    expect(session.view().progress).toMatchObject({ diagnostics: false });
    session.dispatch({ type: "walk", destination: { x: 500, y: 300 } });
    session.advance(3000);
    expect(session.view().progress).toMatchObject({ diagnostics: false });
    expect(session.view().dialogue).toBeNull();
    interact(session, "diagnostics", "look");
    expect(session.view().progress).toMatchObject({ diagnostics: true });
  });

  it("rechecks target reachability on arrival", () => {
    const campaign = otherCampaign();
    const session = createSession(campaign);
    skip(session);
    session.dispatch({ type: "interact", verb: "use", target: "switch" });
    const hotspot = campaign.rooms.laboratory!.hotspots[0]!;
    const approach = hotspot.approach as { x: number; y: number };
    approach.x = 450;
    session.advance(4000);
    expect(session.view().progress).toBe(0);
    expect(session.view().dialogue?.lines[0]).toMatch(/reach/i);
  });

  it("refuses missing targets/items visibly and never walks to invalid points", () => {
    const session = startRepair();
    interact(session, "not-in-this-room");
    expect(session.view().dialogue).not.toBeNull();
    clearDialogue(session);
    interact(session, "bypass", "use", "tool");
    expect(session.view().dialogue?.lines[0]).toMatch(/do not have/);
    clearDialogue(session);
    const before = session.view().actor;
    session.dispatch({ type: "walk", destination: { x: Number.NaN, y: 250 } });
    expect(session.view().actor).toEqual(before);
    expect(session.view().destination).toBeNull();
  });

  it("leaves internal world, checkpoint, dialogue, actor, battle and destination immune to snapshot mutation", () => {
    const session = startRepair();
    act(session, "alcove-exit");
    act(session, "tool-rack");
    const view = session.view();
    (view.inventory as string[]).push("coupling");
    (view.actor as { x: number }).x = -100;
    (view.progress as { diagnostics: boolean }).diagnostics = true;
    expect(session.view().inventory).toEqual(["tool"]);
    expect(session.view().actor.x).toBeGreaterThanOrEqual(30);
    expect(session.view().progress).toMatchObject({ diagnostics: false });
    session.dispatch({ type: "walk", destination: { x: 500, y: 312 } });
    const moving = session.view();
    (moving.destination as { x: number }).x = 31;
    expect(session.view().destination?.x).toBe(500);
    const saved = session.capture();
    (saved.world.inventory as string[]).length = 0;
    (saved.checkpoint.inventory as string[]).push("coupling");
    expect(session.view().inventory).toEqual(["tool"]);
    expect(session.capture().checkpoint.inventory).toEqual([]);
    interact(session, "placard", "look");
    const text = session.view().dialogue!;
    (text.lines as string[])[0] = "Changed";
    expect(session.view().dialogue?.lines[0]).not.toBe("Changed");
    const combat = reachBattle();
    const battle = combat.view().scene;
    if (battle.kind !== "combat") throw new Error("Expected combat");
    (battle.battle.power as { engines: number }).engines = 99;
    expect(combat.view().scene).toMatchObject({ battle: { power: { engines: 2 } } });
  });

  it("capture cancels pending interaction at the current legal position without teleporting", () => {
    const session = startRepair();
    session.dispatch({ type: "interact", target: "alcove-exit", verb: "use" });
    session.advance(250);
    const position = session.view().actor;
    const saved = session.capture();
    expect(saved.world.actor).toEqual(position);
    expect(session.view().actor).toEqual(position);
    expect(session.view().destination).toBeNull();
    session.advance(5000);
    expect(session.view().room).toBe("engineering");
    expect(session.view().actor).toEqual(position);
    expect(saved.world.countdownMs).toBe(REPAIR_DURATION_MS - 250);
    expect(saved.checkpoint).not.toHaveProperty("checkpoint");
    expect(saved.checkpoint).not.toHaveProperty("world");
  });

  it("does not bump revision for each movement, timer, animation or combat tick", () => {
    const session = startRepair();
    const idle = session.view().revision;
    session.advance(500);
    expect(session.view().revision).toBe(idle);
    session.dispatch({ type: "walk", destination: { x: 600, y: 312 } });
    const moving = session.view().revision;
    for (let frame = 0; frame < 10; frame++) session.advance(16);
    expect(session.view().revision).toBe(moving);
    session.advance(5000);
    expect(session.view().revision).toBeGreaterThan(moving);
    const captured = session.view().revision;
    session.capture();
    session.capture();
    expect(session.view().revision).toBe(captured);
    const intro = createSession(openingCampaign);
    intro.advance(100);
    expect(intro.view().revision).toBe(0);
    const combat = reachBattle();
    const beforeCombat = combat.view().revision;
    combat.advance(500);
    expect(combat.view().revision).toBe(beforeCombat);
    order(combat, { type: "scan" });
    expect(combat.view().revision).toBeGreaterThan(beforeCombat);
  });
});

describe("pause, countdown, hint and cutscene ownership", () => {
  it("pauses the countdown for dialogue, stacked menus/blur and repeated token releases", () => {
    const session = startRepair();
    interact(session, "diagnostics", "look");
    const timer = session.view().countdownMs;
    const closeMenu = session.pause("menu");
    const focus = session.pause("blur");
    session.advance(30_000);
    expect(session.view().countdownMs).toBe(timer);
    clearDialogue(session);
    closeMenu();
    closeMenu();
    session.advance(30_000);
    expect(session.view().paused).toBe(true);
    expect(session.view().countdownMs).toBe(timer);
    focus();
    session.advance(1000);
    expect(session.view().countdownMs).toBe(timer! - 1000);
    expect(session.view().paused).toBe(false);
  });

  it("blocks movement and orders while paused but permits dialogue continuation", () => {
    const session = reachBattle();
    const unpause = session.pause("menu");
    order(session, { type: "scan" });
    expect(session.view().scene).toMatchObject({ battle: { scanned: false } });
    session.advance(10000);
    expect(session.view().scene).toMatchObject({ battle: { enemyAttackMs: 4500 } });
    unpause();
    order(session, { type: "scan" });
    expect(session.view().scene).toMatchObject({ battle: { scanned: true } });
    const repair = startRepair();
    const release = repair.pause("blur");
    repair.dispatch({ type: "walk", destination: { x: 500, y: 312 } });
    expect(repair.view().destination).toBeNull();
    release();
  });

  it("freezes a cutscene under pause and never spends countdown time in it", () => {
    const session = createSession(otherCampaign());
    const release = session.pause("menu");
    session.advance(1000);
    expect(session.view().scene).toMatchObject({ kind: "cutscene", frame: 0, elapsedMs: 0 });
    release();
    session.advance(250);
    expect(session.view().scene).toMatchObject({ elapsedMs: 250 });
    expect(session.view().countdownMs).toBe(10_000);
    session.advance(5000);
    expect(session.view().scene.kind).toBe("adventure");
    expect(session.view().countdownMs).toBe(10_000);
  });

  it("produces equivalent watched/skipped story state and ignores duplicate callbacks", () => {
    const watched = createSession(openingCampaign);
    const skipped = createSession(openingCampaign);
    const first = skipped.view().scene;
    if (first.kind !== "cutscene") throw new Error("Expected intro");
    skip(skipped);
    watched.advance(100_000);
    expect(watched.capture()).toEqual(skipped.capture());
    act(watched, "console");
    act(skipped, "console");
    const active = skipped.view().scene;
    skipped.dispatch({ type: "finish-cutscene", token: first.token });
    expect(skipped.view().scene).toEqual(active);
    skip(skipped);
    watched.advance(100_000);
    expect(watched.capture()).toEqual(skipped.capture());
    expect(watched.view().countdownMs).toBe(REPAIR_DURATION_MS);
  });

  it("refreshes callback tokens on restore and retry, including the same scene id", () => {
    const campaign = otherCampaign();
    const session = createSession(campaign);
    const first = session.view().scene;
    if (first.kind !== "cutscene") throw new Error("Expected ceremony");
    session.advance(200);
    const restored = createSession(campaign, session.capture());
    expect(restored.view().scene).toMatchObject({ id: "ceremony", frame: 0, elapsedMs: 0 });
    const restoredScene = restored.view().scene;
    if (restoredScene.kind !== "cutscene") throw new Error("Expected restored ceremony");
    expect(restoredScene.token).not.toBe(first.token);
    restored.dispatch({ type: "finish-cutscene", token: first.token });
    expect(restored.view().scene.kind).toBe("cutscene");
    skip(session);
    session.advance(10000);
    expect(session.view().scene.kind).toBe("failure");
    session.dispatch({ type: "retry" });
    const retryScene = session.view().scene;
    if (retryScene.kind !== "cutscene") throw new Error("Expected checkpoint ceremony");
    expect(retryScene.token).not.toBe(first.token);
    session.dispatch({ type: "finish-cutscene", token: first.token });
    expect(session.view().scene.kind).toBe("cutscene");
    skip(session);
    expect(session.view().scene.kind).toBe("adventure");
  });

  it("old pause-release callbacks cannot release a new pause", () => {
    const session = startRepair();
    const oldRelease = session.pause("menu");
    oldRelease();
    const newRelease = session.pause("menu");
    oldRelease();
    expect(session.view().paused).toBe(true);
    newRelease();
    expect(session.view().paused).toBe(false);
  });

  it("offers three escalating hints, caps at the third, and resets for the next objective", () => {
    const session = startRepair();
    const clues: string[] = [];
    for (let index = 0; index < 4; index++) {
      session.dispatch({ type: "hint" });
      clues.push(session.view().dialogue!.lines[0]!);
      const timer = session.view().countdownMs;
      session.advance(10000);
      expect(session.view().countdownMs).toBe(timer);
      clearDialogue(session);
    }
    expect(new Set(clues).size).toBe(3);
    expect(clues[2]).toEqual(clues[3]);
    act(session, "diagnostics", "look");
    act(session, "alcove-exit");
    act(session, "placard", "look");
    session.dispatch({ type: "hint" });
    expect(session.view().dialogue?.lines).toEqual([openingCampaign.hint(session.view())[0]]);
  });

  it("expires countdown before a late interaction can repair the ship", () => {
    const session = startRepair();
    session.advance(REPAIR_DURATION_MS - 50);
    session.dispatch({ type: "interact", target: "alcove-exit", verb: "use" });
    session.advance(1000);
    expect(session.view().scene.kind).toBe("failure");
    expect(session.view().room).toBe("engineering");
    expect(session.view().destination).toBeNull();
  });
});

describe("restore boundaries", () => {
  it("rejects malformed worlds with explicit errors identifying the invalid resume field", () => {
    const valid = startRepair().capture();
    const badWorlds: unknown[] = [
      null,
      { ...valid.world, room: "missing" },
      { ...valid.world, actor: { x: -1, y: 250 } },
      { ...valid.world, actor: { x: Number.NaN, y: 250 } },
      { ...valid.world, inventory: ["not-an-item"] },
      { ...valid.world, inventory: ["tool", "tool"] },
      { ...valid.world, countdownMs: -1 },
      { ...valid.world, countdownMs: Number.POSITIVE_INFINITY },
      { ...valid.world, countdownMs: 999_999 },
      { ...valid.world, scene: { kind: "made-up" } },
      { ...valid.world, scene: { kind: "cutscene", id: "missing", token: 1, frame: 0, elapsedMs: 0 } },
      { ...valid.world, scene: { kind: "cutscene", id: "intro", token: 1, frame: 99, elapsedMs: 0 } },
      { ...valid.world, scene: { kind: "cutscene", id: "intro", token: -1, frame: 0, elapsedMs: 0 } },
      { ...valid.world, progress: { stage: "repair", diagnostics: true, placard: false, bypassIsolated: true, couplingFitted: false } },
      { ...valid.world, progress: { stage: "chapter-five" } },
      { ...valid.world, checkpoint: valid.checkpoint },
    ];
    for (const world of badWorlds) {
      expect(() => createSession(openingCampaign, { ...valid, world })).toThrow(/Invalid resume\.world:/);
    }
    for (const bad of [null, 1, {}, [], { world: valid.world }]) {
      expect(() => createSession(openingCampaign, bad)).toThrow(/Invalid resume/);
    }
    expect(() => createSession(openingCampaign, { ...valid, checkpoint: {} })).toThrow(/Invalid resume\.checkpoint:/);
    expect(() => createSession(openingCampaign, {
      ...valid, checkpoint: { ...valid.checkpoint, countdownMs: 0, scene: { kind: "failure", reason: "Expired" } },
    })).toThrow(/failure cannot be a retry checkpoint/);
  });

  it("normalizes combat saves to encounter start, not the current health or orders", () => {
    const session = reachBattle();
    const start = session.capture();
    order(session, { type: "scan" });
    order(session, { type: "power", system: "weapons", delta: 1 });
    order(session, { type: "fire" });
    session.advance(5000);
    const saved = session.capture();
    expect(saved).toEqual(start);
    expect(session.view().scene).toMatchObject({ battle: { scanned: true, enemyEngines: 64 } });
    const restored = createSession(openingCampaign, saved);
    expect(restored.view().scene).toMatchObject({ battle: { scanned: false, enemyEngines: 100, hull: 100 } });
  });

  it("normalizes cutscene saves to scene start and never mutates the caller's resume", () => {
    const original = createSession(openingCampaign);
    original.advance(6000);
    expect(original.view().scene).toMatchObject({ frame: 1 });
    const saved = original.capture();
    expect(saved.world.scene).toMatchObject({ frame: 0, elapsedMs: 0 });
    const savedToken = saved.world.scene.kind === "cutscene" ? saved.world.scene.token : -1;
    const restored = createSession(openingCampaign, saved);
    expect(saved.world.scene).toMatchObject({ token: savedToken });
    (saved.world.actor as { x: number }).x = 33;
    expect(restored.view().actor.x).toBe(320);
  });

  it("uses a fixed combat step independent of animation frame subdivision", () => {
    const first = reachBattle();
    const second = createSession(openingCampaign, first.capture());
    order(first, { type: "scan" });
    order(second, { type: "scan" });
    first.advance(4777);
    for (let frame = 0; frame < 298; frame++) second.advance(16);
    second.advance(9);
    expect(first.view().scene).toEqual(second.view().scene);
    first.advance(23);
    second.advance(23);
    expect(first.view().scene).toEqual(second.view().scene);
  });

  it("rejects invalid elapsed time without corrupting the session", () => {
    const session = startRepair();
    const before = session.capture();
    for (const elapsed of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => session.advance(elapsed)).toThrow(/Invalid elapsed time/);
    }
    expect(session.capture()).toEqual(before);
  });

  it("clones input destinations so later caller edits do not redirect movement", () => {
    const session = startRepair();
    const destination: { x: number; y: number } = { x: 500, y: 300 };
    session.dispatch({ type: "walk", destination: destination as Point });
    destination.x = 50;
    expect(session.view().destination?.x).toBe(500);
  });
});
