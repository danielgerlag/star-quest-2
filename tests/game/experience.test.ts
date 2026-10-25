import { describe, expect, it } from "vitest";
import { openingCampaign, type OpeningProgress } from "../../src/content/opening";
import { storyCampaign, stepHints, type StoryProgress } from "../../src/content/story";
import { laterRooms, missions, type LaterProgress } from "../../src/content/story-content";
import { applyOrder, chargeBlockReason, createBattle, stepBattle } from "../../src/game/combat";
import type { Battle, World } from "../../src/game/types";
import { createSession } from "../../src/game/session";
import { sensoryReply } from "../../src/content/flavor";
import { act, clearDialogue } from "./helpers";

function laterWorld(progress: LaterProgress, room: keyof typeof laterRooms, inventory: readonly string[]): World<StoryProgress> {
  return {
    progress, room, actor: laterRooms[room].spawn, inventory,
    countdownMs: null, scene: { kind: "adventure" },
  };
}

describe("live-play experience regressions", () => {
  it("does not report a pressure emergency before Roger causes the accident", () => {
    const world: World<OpeningProgress> = {
      progress: { stage: "routine-maintenance" }, actor: { x: 320, y: 290 }, inventory: [],
      room: "engineering", scene: { kind: "adventure" }, countdownMs: null,
    };
    const result = openingCampaign.interact(world, { type: "interact", verb: "look", target: "bypass" });
    expect(result.dialogue?.lines.join(" ")).toMatch(/normal|green/i);
    expect(result.dialogue?.lines.join(" ")).not.toMatch(/buried in the red/i);
  });

  it("lets a scanned, disabled chapter-2 pursuer be left behind without an evasive formation", () => {
    const rules = missions["chapter-2"].rules;
    const battle: Battle = {
      ...createBattle(rules), scanned: true, enemyEngines: 0, enemyWeapons: 0,
      maneuver: "hold", power: { shields: 2, weapons: 2, engines: 1 },
    };
    expect(chargeBlockReason(battle, rules)).toBeNull();
    const engaged = applyOrder(battle, { type: "engage" }, rules);
    expect(engaged.engaged).toBe(true);
    expect(stepBattle(engaged, 50, rules).charge).toBeGreaterThan(0);
    expect(chargeBlockReason({ ...battle, power: { shields: 2, weapons: 2, engines: 0 } }, rules))
      .toMatch(/power.*engines|engines.*power/i);
  });

  it("stops the attack clock and threat announcements when a ship cannot fire", () => {
    const rules = missions["chapter-2"].rules;
    const disabled: Battle = {
      ...createBattle(rules), enemyWeapons: 0, enemyAttackMs: 500,
      log: "Weapons disabled.",
    };
    const held = applyOrder(disabled, { type: "maneuver", maneuver: "hold" }, rules);
    expect(held.log).not.toMatch(/charging another shot/i);
    expect(stepBattle(held, 1000, rules)).toMatchObject({
      enemyAttackMs: 0, hull: 100,
      shields: { forward: 100, aft: 100, port: 100, starboard: 100 },
    });
    expect(stepBattle(stepBattle(held, 1000, rules), 1000, rules).enemyAttackMs).toBe(0);
  });

  it("distinguishes disabling pursuit from disabling weapons", () => {
    const rules = missions["chapter-2"].rules;
    const scanned = { ...createBattle(rules), scanned: true };
    expect(chargeBlockReason({ ...scanned, enemyWeapons: 0 }, rules)).toContain("Evade");
    expect(chargeBlockReason({ ...scanned, enemyEngines: 0 }, rules)).toBeNull();
    expect(stepBattle({ ...scanned, enemyEngines: 0, enemyAttackMs: 50 }, 50, rules).shields.forward).toBeLessThan(100);
  });

  it.each(["chapter-3", "chapter-4", "chapter-5"] as const)("preserves the %s objective when engines are disabled", chapter => {
    const rules = missions[chapter].rules;
    const battle = { ...createBattle(rules), scanned: true, enemyEngines: 0 };
    if (chapter === "chapter-3") expect(chargeBlockReason(battle, rules)).toContain("tractor emitters");
    else expect(chargeBlockReason({ ...battle, enemyWeapons: 0, maneuver: "evade" }, rules)).toContain("Hold");
  });

  it("does not turn a stopped attack clock into continuous autosave revisions", () => {
    const world: World<StoryProgress> = {
      ...laterWorld({ stage: "chapter-2", step: "encounter" }, "shuttlebay", ["tool"]),
      scene: { kind: "combat", battle: { ...createBattle(missions["chapter-2"].rules), enemyWeapons: 0, enemyAttackMs: 0 } },
    };
    const session = createSession(storyCampaign, { world, checkpoint: world });
    const revision = session.view().revision;
    session.advance(1000);
    expect(session.view().revision).toBe(revision);
  });

  it("does not suppress a discharge hazard when its pulse focus reaches zero", () => {
    const rules = missions["chapter-5"].rules;
    const hazard: Battle = { ...createBattle(rules), enemyWeapons: 0, enemyAttackMs: 50 };
    const after = stepBattle(hazard, 50, rules);
    expect(after.shields.forward).toBeLessThan(100);
    expect(after.enemyAttackMs).toBe(rules.attackIntervalMs);
  });

  it.each(["restore-turbolift", "take-command"] as const)("acknowledges the repaired core during %s", stage => {
    const world: World<OpeningProgress> = {
      progress: { stage }, room: "corridor", actor: { x: 490, y: 290 },
      inventory: ["tool"], countdownMs: null, scene: { kind: "adventure" },
    };
    const result = openingCampaign.interact(world, { type: "interact", verb: "talk", target: "intercom" });
    expect(result.dialogue?.lines.join(" ")).toMatch(/core.*stable|breach.*averted|core.*safe/i);
    expect(result.dialogue?.lines.join(" ")).not.toMatch(/please repair the core/i);
    expect(result.world).toEqual(world);
  });

  it("keeps an exact recorder solution in optional hints rather than its ordinary description", () => {
    const progress: LaterProgress = { stage: "chapter-3", step: "recorder" };
    const world = laterWorld(progress, "workshop", ["tool", "transceiver"]);
    const description = storyCampaign.interact(world, { type: "interact", verb: "look", target: "recorder" });
    expect(description.dialogue?.lines.join(" ")).toMatch(/insulated|latch/i);
    expect(description.dialogue?.lines.join(" ")).not.toMatch(/use the insulated tool/i);
    expect(storyCampaign.hint(world)[2]).toMatch(/Use the Insulated tool on the Ship's recorder/);
    expect(description.world).toEqual(world);
  });

  it("does not reveal the current puzzle solution for an unrelated wrong item", () => {
    const progress: LaterProgress = { stage: "chapter-2", step: "decoy" };
    const world = laterWorld(progress, "shuttlebay", ["tool", "probe"]);
    const result = storyCampaign.interact(world, { type: "interact", verb: "use", target: "probe-bench", item: "tool" });
    expect(result.world).toEqual(world);
    expect(result.dialogue?.lines.join(" ")).not.toContain(stepHints(progress)[2]);
    expect(result.dialogue?.lines.join(" ")).toMatch(/tool|spanner/i);
  });

  it("gives the aquarium and alert terminal distinct smell responses", () => {
    const world = laterWorld({ stage: "chapter-2", step: "trace" }, "ready-room", ["tool"]);
    const smell = (target: string) => storyCampaign.interact(world, { type: "interact", verb: "smell", target });
    expect(smell("fish-tank").dialogue?.lines).not.toEqual(smell("alert-log").dialogue?.lines);
    expect(smell("fish-tank").world).toEqual(world);
    expect(smell("alert-log").world).toEqual(world);
  });

  it("provides authored sensory responses for every room object", () => {
    for (const room of Object.values(storyCampaign.rooms)) {
      const objects = room.hotspots.filter(hotspot => !hotspot.id.endsWith("-exit"));
      for (const verb of ["smell", "taste"] as const) {
        const responses = objects.map(hotspot => sensoryReply(verb, hotspot));
        expect(new Set(responses).size, `${room.id}: ${verb}`).toBe(objects.length);
        expect(responses.every(response => response.length > 20)).toBe(true);
      }
    }
  });

  it("starts gentle hints anew when the puzzle changes but its overall goal does not", () => {
    const world = laterWorld({ stage: "chapter-2", step: "trace" }, "ready-room", ["tool"]);
    const session = createSession(storyCampaign, { world, checkpoint: world });
    const objective = session.view().objective;
    session.dispatch({ type: "hint" });
    clearDialogue(session);
    session.dispatch({ type: "hint" });
    clearDialogue(session);
    act(session, "alert-log", "look");
    expect(session.view().objective).toBe(objective);
    session.dispatch({ type: "hint" });
    expect(session.view().dialogue?.lines).toEqual([missions["chapter-2"].steps.navigation[0]]);
    expect(session.view().dialogue?.animation).toBeUndefined();
    clearDialogue(session);
    session.dispatch({ type: "hint" });
    clearDialogue(session);
    session.dispatch({ type: "hint" });
    expect(session.view().dialogue?.lines).toEqual([missions["chapter-2"].steps.navigation[2]]);
  });

  it("identifies the depot clerk as the speaker and acknowledges an approved request", () => {
    const request = laterWorld({ stage: "chapter-3", step: "permit" }, "depot", ["tool", "service-form"]);
    const approved = storyCampaign.interact(request, { type: "interact", verb: "use", target: "clerk", item: "service-form" });
    expect(approved.dialogue?.speaker).toBe("Depot clerk");
    const followUp = storyCampaign.interact(approved.world, { type: "interact", verb: "talk", target: "clerk" });
    expect(followUp.dialogue?.speaker).toBe("Depot clerk");
    expect(followUp.dialogue?.lines.join(" ")).not.toMatch(/print a service request|hand the form to me/i);
  });
});
