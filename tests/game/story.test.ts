import { describe, expect, it } from "vitest";
import { openingCampaign, REPAIR_DURATION_MS } from "../../src/content/opening";
import { createSession } from "../../src/game/session";
import { act, clearDialogue, finishRepair, interact, order, reachBattle, skip, startRepair, winBattle } from "./helpers";

describe("first playable chapter", () => {
  it("plays the entire intended route and ends without killing the pursuer", () => {
    const session = createSession(openingCampaign);
    expect(session.view().scene).toMatchObject({ kind: "cutscene", id: "intro" });
    skip(session);
    expect(session.view().progress.stage).toBe("routine-maintenance");
    expect(session.view().countdownMs).toBeNull();
    act(session, "console", "look");
    act(session, "console");
    expect(session.view().scene).toMatchObject({ kind: "cutscene", id: "evacuation" });
    expect(session.view().countdownMs).toBeNull();
    skip(session);
    expect(session.view().countdownMs).toBe(REPAIR_DURATION_MS);
    clearDialogue(session);
    finishRepair(session);
    expect(session.view().progress.stage).toBe("restore-turbolift");
    expect(session.view().countdownMs).toBeNull();
    act(session, "auxiliary");
    act(session, "corridor-exit");
    act(session, "turbolift-exit");
    act(session, "bridge-exit");
    act(session, "command");
    expect(session.view().scene).toMatchObject({ kind: "cutscene", id: "takeover" });
    skip(session);
    expect(session.view().dialogue?.lines.length).toBeGreaterThanOrEqual(3);
    clearDialogue(session);
    order(session, { type: "scan" });
    order(session, { type: "maneuver", maneuver: "evade" });
    order(session, { type: "power", system: "engines", delta: 1 });
    order(session, { type: "target", target: "engines" });
    for (let shot = 0; shot < 3; shot++) {
      order(session, { type: "fire" });
      session.advance(1800);
    }
    expect(session.view().scene).toMatchObject({ kind: "combat", battle: { enemyEngines: 0, enemyHull: 100 } });
    order(session, { type: "engage" });
    session.advance(6000);
    expect(session.view().scene).toMatchObject({ kind: "cutscene", id: "outro" });
    skip(session);
    expect(session.view().scene.kind).toBe("complete");
    expect(session.view().progress.stage).toBe("complete");
    const resumed = createSession(openingCampaign, session.capture());
    expect(resumed.view().scene.kind).toBe("complete");
    expect(resumed.view().inventory).toEqual(["tool"]);
  });

  it("keeps both supplies reachable when optional pre-accident exploration was skipped", () => {
    const session = startRepair();
    expect(session.view().inventory).toEqual([]);
    act(session, "alcove-exit");
    act(session, "tool-rack");
    act(session, "coupling-bin");
    expect(session.view().inventory).toEqual(["tool", "coupling"]);
    expect(session.view().countdownMs).toBeGreaterThan(160_000);
  });

  it("retains supplies collected before the accident and through repair retry", () => {
    const session = createSession(openingCampaign);
    skip(session);
    act(session, "alcove-exit");
    act(session, "tool-rack");
    act(session, "coupling-bin");
    act(session, "engineering-exit");
    act(session, "console");
    skip(session);
    clearDialogue(session);
    session.advance(REPAIR_DURATION_MS);
    expect(session.view().scene.kind).toBe("failure");
    session.dispatch({ type: "retry" });
    expect(session.view().inventory).toEqual(["tool", "coupling"]);
    finishRepair(session);
    expect(session.view().progress.stage).toBe("restore-turbolift");
  });

  it("requires looking at BOTH clues and safe repair ordering", () => {
    const session = startRepair();
    act(session, "alcove-exit");
    act(session, "tool-rack");
    act(session, "coupling-bin");
    act(session, "placard", "look");
    act(session, "engineering-exit");
    interact(session, "bypass", "use", "tool");
    expect(session.view().dialogue).not.toBeNull();
    expect(session.view().progress).toMatchObject({ bypassIsolated: false, diagnostics: false });
    act(session, "pump", "use", "coupling");
    expect(session.view().inventory).toContain("coupling");
    act(session, "pump");
    expect(session.view().countdownMs).not.toBeNull();
    act(session, "diagnostics");
    expect(session.view().progress).toMatchObject({ diagnostics: false });
    act(session, "diagnostics", "look");
    act(session, "bypass", "use", "tool");
    expect(session.view().progress).toMatchObject({ bypassIsolated: true });
    act(session, "pump", "use", "coupling");
    expect(session.view().countdownMs).not.toBeNull();
    act(session, "pump");
    expect(session.view().countdownMs).toBeNull();
  });

  it("cannot unlock the turbolift before restoring coolant and auxiliary power", () => {
    const session = startRepair();
    act(session, "auxiliary");
    expect(session.view().progress.stage).toBe("repair");
    act(session, "corridor-exit");
    interact(session, "turbolift-exit");
    expect(session.view().room).toBe("corridor");
    expect(session.view().dialogue).not.toBeNull();
    act(session, "engineering-exit");
    finishRepair(session);
    act(session, "corridor-exit");
    act(session, "turbolift-exit");
    expect(session.view().room).toBe("corridor");
    act(session, "engineering-exit");
    act(session, "auxiliary");
    act(session, "corridor-exit");
    act(session, "turbolift-exit");
    expect(session.view().room).toBe("turbolift");
  });

  it("responds visibly to every wrong verb and item combination without consuming supplies", () => {
    const session = startRepair();
    act(session, "alcove-exit");
    act(session, "tool-rack");
    act(session, "coupling-bin");
    for (const verb of ["look", "talk", "use"] as const) {
      for (const hotspot of openingCampaign.rooms.alcove!.hotspots.filter(hotspot => hotspot.id !== "engineering-exit")) {
        clearDialogue(session);
        interact(session, hotspot.id, verb, verb === "use" ? "tool" : undefined);
        expect(session.view().dialogue, `${verb} ${hotspot.id}`).not.toBeNull();
        expect(session.view().inventory).toEqual(["tool", "coupling"]);
      }
    }
    clearDialogue(session);
    interact(session, "engineering-exit", "use", "tool");
    expect(session.view().room).toBe("alcove");
    expect(session.view().dialogue).not.toBeNull();
  });

  it("makes repeated collection and solved interactions harmless", () => {
    const session = startRepair();
    act(session, "alcove-exit");
    act(session, "tool-rack");
    act(session, "tool-rack");
    act(session, "coupling-bin");
    act(session, "coupling-bin");
    expect(session.view().inventory).toEqual(["tool", "coupling"]);
    act(session, "engineering-exit");
    finishRepair(session);
    act(session, "bypass", "use", "tool");
    act(session, "pump");
    act(session, "alcove-exit");
    act(session, "coupling-bin");
    expect(session.view().inventory).toEqual(["tool"]);
    expect(session.view().progress.stage).toBe("restore-turbolift");
  });

  it("saves at each puzzle gate and remains playable after every reload", () => {
    let session = startRepair();
    const steps: readonly [string, "look" | "talk" | "use", string?][] = [
      ["diagnostics", "look"], ["alcove-exit", "use"], ["placard", "look"],
      ["tool-rack", "use"], ["coupling-bin", "use"], ["engineering-exit", "use"],
      ["bypass", "use", "tool"], ["pump", "use", "coupling"], ["pump", "use"],
      ["auxiliary", "use"], ["corridor-exit", "use"], ["turbolift-exit", "use"],
      ["bridge-exit", "use"], ["command", "use"],
    ];
    for (const [target, verb, item] of steps) {
      act(session, target, verb, item);
      session = createSession(openingCampaign, JSON.parse(JSON.stringify(session.capture())) as unknown);
    }
    expect(session.view().scene).toMatchObject({ kind: "cutscene", id: "takeover" });
    skip(session);
    clearDialogue(session);
    winBattle(session);
    session = createSession(openingCampaign, session.capture());
    skip(session);
    expect(session.view().scene.kind).toBe("complete");
  });

  it("retries countdown failure indefinitely without missing supplies or rolling back to title", () => {
    const session = startRepair();
    for (let attempt = 0; attempt < 3; attempt++) {
      act(session, "alcove-exit");
      act(session, "tool-rack");
      session.advance(REPAIR_DURATION_MS);
      expect(session.view().scene.kind).toBe("failure");
      expect(session.view().countdownMs).toBe(0);
      const savedFailure = session.capture();
      expect(createSession(openingCampaign, savedFailure).view().scene.kind).toBe("failure");
      session.dispatch({ type: "retry" });
      expect(session.view().room).toBe("engineering");
      expect(session.view().scene.kind).toBe("adventure");
      expect(session.view().progress.stage).toBe("repair");
      expect(session.view().inventory).toEqual([]);
      expect(session.view().countdownMs).toBe(REPAIR_DURATION_MS);
    }
    finishRepair(session);
    expect(session.view().countdownMs).toBeNull();
  });

  it("retries a lost battle with full health and succeeds afterward", () => {
    const session = reachBattle();
    order(session, { type: "power", system: "shields", delta: -1 });
    order(session, { type: "power", system: "shields", delta: -1 });
    session.advance(30_000);
    expect(session.view().scene.kind).toBe("failure");
    const restored = createSession(openingCampaign, session.capture());
    restored.dispatch({ type: "retry" });
    expect(restored.view().scene).toMatchObject({
      kind: "combat", battle: {
        hull: 100, enemyHull: 100, enemyEngines: 100, scanned: false,
        power: { shields: 2, weapons: 2, engines: 2 }, charge: 0,
      },
    });
    winBattle(restored);
    skip(restored);
    expect(restored.view().scene.kind).toBe("complete");
  });
});
