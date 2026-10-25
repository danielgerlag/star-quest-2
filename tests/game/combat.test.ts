import { describe, expect, it } from "vitest";
import { applyOrder, createBattle, isBattle, stepBattle } from "../../src/game/combat";
import type { Battle, PowerSystem } from "../../src/game/types";

function advance(battle: Battle, elapsedMs: number): Battle {
  for (let elapsed = 0; elapsed < elapsedMs; elapsed += 50) battle = stepBattle(battle);
  return battle;
}

function disableEngines(): Battle {
  let battle = applyOrder(createBattle(), { type: "scan" });
  for (let shot = 0; shot < 3; shot++) {
    battle = applyOrder(battle, { type: "fire" });
    battle = advance(battle, 1800);
  }
  return battle;
}

describe("deterministic tactical rules", () => {
  it("starts with the specified full-health encounter and six allocated power units", () => {
    expect(createBattle()).toMatchObject({
      hull: 100, enemyHull: 100, enemyEngines: 100, enemyWeapons: 100,
      shields: { forward: 100, aft: 100, port: 100, starboard: 100 },
      power: { shields: 2, weapons: 2, engines: 2 }, enemyAttackMs: 4500,
    });
  });

  it("conserves the power budget through a deterministic stress sequence", () => {
    let battle = createBattle();
    const systems: readonly PowerSystem[] = ["shields", "weapons", "engines"];
    for (let index = 0; index < 1000; index++) {
      battle = applyOrder(battle, {
        type: "power", system: systems[(index * 17) % 3]!, delta: index % 5 < 3 ? 1 : -1,
      });
      const values = Object.values(battle.power);
      expect(values.every(value => Number.isInteger(value) && value >= 0 && value <= 4)).toBe(true);
      expect(values.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(6);
    }
  });

  it("plus reallocates at the cap, while minus releases an unused unit", () => {
    let battle = applyOrder(createBattle(), { type: "power", system: "engines", delta: 1 });
    expect(battle.power).toEqual({ shields: 1, weapons: 2, engines: 3 });
    battle = applyOrder(battle, { type: "power", system: "engines", delta: -1 });
    expect(Object.values(battle.power).reduce((sum, value) => sum + value)).toBe(5);
    battle = applyOrder(battle, { type: "power", system: "weapons", delta: 1 });
    expect(battle.power).toEqual({ shields: 1, weapons: 3, engines: 2 });
  });

  it("requires scan and weapon power, and rejects premature refiring", () => {
    let battle = createBattle();
    battle = applyOrder(battle, { type: "fire" });
    expect(battle.enemyEngines).toBe(100);
    battle = applyOrder(battle, { type: "target", target: "weapons" });
    expect(battle.target).toBe("engines");
    battle = applyOrder(battle, { type: "scan" });
    battle = applyOrder(battle, { type: "power", system: "weapons", delta: -1 });
    battle = applyOrder(battle, { type: "power", system: "weapons", delta: -1 });
    battle = applyOrder(battle, { type: "fire" });
    expect(battle.enemyEngines).toBe(100);
    battle = applyOrder(battle, { type: "power", system: "weapons", delta: 1 });
    battle = applyOrder(battle, { type: "fire" });
    expect(battle.enemyEngines).toBe(64);
    expect(battle.cooldownMs).toBe(3600);
    battle = applyOrder(battle, { type: "fire" });
    expect(battle.enemyEngines).toBe(64);
  });

  it("disables pursuit in three aimed shots without reducing enemy hull", () => {
    expect(disableEngines()).toMatchObject({ enemyEngines: 0, enemyHull: 100, enemyWeapons: 100 });
    let battle = applyOrder(createBattle(), { type: "scan" });
    battle = applyOrder(battle, { type: "target", target: "weapons" });
    battle = applyOrder(battle, { type: "fire" });
    expect(battle).toMatchObject({ enemyWeapons: 64, enemyEngines: 100, enemyHull: 100 });
  });

  it("weapon allocation controls firing cooldown", () => {
    let battle = applyOrder(createBattle(), { type: "scan" });
    battle = applyOrder(battle, { type: "power", system: "weapons", delta: 1 });
    battle = applyOrder(battle, { type: "power", system: "weapons", delta: 1 });
    battle = applyOrder(battle, { type: "fire" });
    expect(battle.cooldownMs).toBe(900);
    battle = advance(battle, 900);
    expect(battle.cooldownMs).toBe(0);
  });

  it("telegraphs a shot for 4500ms and absorbs damage in the exposed shield", () => {
    let battle = advance(createBattle(), 4450);
    expect(battle.enemyAttackMs).toBe(50);
    expect(battle.shields.forward).toBe(100);
    battle = stepBattle(battle);
    expect(battle.enemyAttackMs).toBe(4500);
    expect(battle.shields.forward).toBe(58);
    expect(battle.hull).toBe(100);
    expect(battle.shields.aft).toBe(100);
  });

  it("evading reduces damage and repeated turns rotate all four arcs", () => {
    const hold = advance(createBattle(), 4500);
    const evade = advance(applyOrder(createBattle(), { type: "maneuver", maneuver: "evade" }), 4500);
    expect(evade.shields.forward).toBeGreaterThan(hold.shields.forward);
    let turning = createBattle();
    const visited = new Set([turning.exposedArc]);
    for (let index = 0; index < 4; index++) {
      turning = applyOrder(turning, { type: "maneuver", maneuver: "turn" });
      visited.add(turning.exposedArc);
    }
    expect(visited.size).toBe(4);
    expect(turning.exposedArc).toBe("forward");
  });

  it("cannot escape before disabling engines or without an explicit order", () => {
    const premature = applyOrder(applyOrder(createBattle(), { type: "scan" }), { type: "engage" });
    expect(premature.engaged).toBe(false);
    const disabled = advance(disableEngines(), 6000);
    expect(disabled.charge).toBe(0);
    const charging = applyOrder(disabled, { type: "engage" });
    expect(advance(charging, 6000).charge).toBe(100);
  });

  it("engine power speeds escape and zero power stalls it", () => {
    let battle = disableEngines();
    battle = applyOrder(battle, { type: "power", system: "engines", delta: 1 });
    battle = applyOrder(battle, { type: "engage" });
    expect(advance(battle, 4000).charge).toBe(100);
    battle = applyOrder(battle, { type: "power", system: "engines", delta: -1 });
    battle = applyOrder(battle, { type: "power", system: "engines", delta: -1 });
    battle = applyOrder(battle, { type: "power", system: "engines", delta: -1 });
    expect(advance(battle, 1000).charge).toBe(0);
  });

  it("depleted shields expose hull and failure is attainable", () => {
    const vulnerable: Battle = {
      ...createBattle(), power: { shields: 0, weapons: 2, engines: 2 },
    };
    expect(advance(vulnerable, 22_500).hull).toBe(0);
    expect(advance(vulnerable, 22_500).enemyHull).toBe(100);
  });

  it("rejects impossible saved battles", () => {
    expect(isBattle(createBattle())).toBe(true);
    expect(isBattle({ ...createBattle(), power: { shields: 4, weapons: 4, engines: 4 } })).toBe(false);
    expect(isBattle({ ...createBattle(), power: { shields: -1, weapons: 2, engines: 2 } })).toBe(false);
    expect(isBattle({ ...createBattle(), charge: 10, engaged: false })).toBe(false);
    expect(isBattle({ ...createBattle(), enemyAttackMs: Number.NaN })).toBe(false);
  });
});
