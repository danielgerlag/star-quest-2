import { describe, expect, it } from "vitest";
import { openingCampaign, type OpeningProgress } from "../../src/content/opening";
import { createSession } from "../../src/game/session";
import type { World } from "../../src/game/types";

function chairSession(actor = { x: 318, y: 290 }) {
  const world: World<OpeningProgress> = {
    progress: { stage: "take-command" }, room: "bridge", actor, inventory: ["tool"],
    countdownMs: null, scene: { kind: "adventure" },
  };
  return createSession(openingCampaign, { world, checkpoint: world });
}

describe("dialogue-owned interaction animation", () => {
  it("starts a chair pose on arrival, never on the initial click", () => {
    const session = chairSession({ x: 78, y: 290 });
    session.dispatch({ type: "interact", verb: "use", target: "captain-chair" });
    session.advance(1000);
    expect(session.view().dialogue).toBeNull();
    session.advance(1250);
    expect(session.view().dialogue).toMatchObject({
      animation: { kind: "sit", target: "captain-chair" }, elapsedMs: 250,
    });
    expect(session.view().actor).toEqual({ x: 318, y: 290 });
  });

  it("advances a dialogue pose but freezes its exact time across overlapping external pauses", () => {
    const session = chairSession();
    session.dispatch({ type: "interact", verb: "use", target: "captain-chair" });
    session.advance(300);
    expect(session.view().paused).toBe(true);
    expect(session.view().dialogue?.elapsedMs).toBe(300);
    const releaseMenu = session.pause("menu");
    const releaseBlur = session.pause("blur");
    session.advance(500);
    releaseMenu();
    session.advance(500);
    expect(session.view().dialogue?.elapsedMs).toBe(300);
    releaseBlur();
    session.advance(200);
    expect(session.view().dialogue?.elapsedMs).toBe(500);
  });

  it("does not persist, replay or manufacture a chair pose through saves, hints or rejected items", () => {
    const session = chairSession();
    session.dispatch({ type: "interact", verb: "use", target: "captain-chair" });
    const saved = session.capture();
    expect(saved.world.actor).toEqual({ x: 318, y: 290 });
    expect(saved.world).not.toHaveProperty("dialogue");
    expect(saved.world).not.toHaveProperty("animation");
    expect(createSession(openingCampaign, saved).view().dialogue).toBeNull();
    session.dispatch({ type: "dialogue-next" });
    expect(session.view().dialogue).toBeNull();
    session.dispatch({ type: "hint" });
    expect(session.view().dialogue?.animation).toBeUndefined();
    session.dispatch({ type: "dialogue-next" });
    session.dispatch({ type: "interact", verb: "use", target: "captain-chair", item: "tool" });
    expect(session.view().dialogue?.animation?.kind).not.toBe("sit");
  });

  it("animates inspection without spending the repair countdown", () => {
    const world: World<OpeningProgress> = {
      progress: { stage: "repair", diagnostics: false, placard: false, bypassIsolated: false, couplingFitted: false },
      room: "engineering", actor: { x: 320, y: 290 }, inventory: [],
      countdownMs: 60_000, scene: { kind: "adventure" },
    };
    const session = createSession(openingCampaign, { world, checkpoint: world });
    session.dispatch({ type: "interact", verb: "look", target: "diagnostics" });
    session.advance(1000);
    expect(session.view().dialogue).toMatchObject({ elapsedMs: 1000, animation: { kind: "inspect" } });
    expect(session.view().countdownMs).toBe(60_000);
    session.dispatch({ type: "dialogue-next" });
    session.advance(100);
    expect(session.view().countdownMs).toBe(59_900);
  });
});
