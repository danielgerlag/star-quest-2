import type { Battle, CombatRules, PowerSystem, ShieldArc, TacticalOrder } from "./types";

export const COMBAT_STEP_MS = 50;
const arcs: readonly ShieldArc[] = ["forward", "starboard", "aft", "port"];
const systems = ["shields", "weapons", "engines"] as const;

export const DEFAULT_COMBAT_RULES: CombatRules = {
  name: "Federation patrol", action: "Escape", source: "ship",
  targetNames: { engines: "Engines", weapons: "Weapons" },
  requiredTarget: "engines", requiredManeuver: null,
  minimumPower: { shields: 0, weapons: 0, engines: 1 },
  chargeSystem: "engines", chargeDurationMs: 6000,
  attackIntervalMs: 4500, attackDamage: 42,
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bounded(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function isBattle(value: unknown): value is Battle {
  if (!record(value) || !record(value.power) || !record(value.shields)) return false;
  const power = value.power;
  const shields = value.shields;
  return systems.every(system => bounded(power[system], 0, 4) && Number.isInteger(power[system]))
    && Number(power.shields) + Number(power.weapons) + Number(power.engines) <= 6
    && arcs.every(arc => bounded(shields[arc], 0, 100))
    && ["hull", "enemyHull", "enemyEngines", "enemyWeapons", "charge"].every(key => bounded(value[key], 0, 100))
    && bounded(value.cooldownMs, 0, 3600) && bounded(value.enemyAttackMs, 0, 4500)
    && arcs.some(arc => arc === value.exposedArc)
    && ["hold", "evade", "turn"].includes(String(value.maneuver))
    && (value.target === "engines" || value.target === "weapons")
    && typeof value.scanned === "boolean" && typeof value.engaged === "boolean"
    && typeof value.log === "string"
    && (!value.engaged || value.scanned)
    && (value.charge === 0 || value.engaged);
}

export function createBattle(rules = DEFAULT_COMBAT_RULES): Battle {
  return {
    hull: 100,
    enemyHull: 100,
    enemyEngines: 100,
    enemyWeapons: 100,
    power: { shields: 2, weapons: 2, engines: 2 },
    shields: { forward: 100, aft: 100, port: 100, starboard: 100 },
    exposedArc: "forward",
    maneuver: "hold",
    target: "engines",
    scanned: false,
    cooldownMs: 0,
    enemyAttackMs: rules.attackIntervalMs,
    charge: 0,
    engaged: false,
    log: `${rules.name}: scan first. Objective: ${rules.action}. Read the tactical briefing before issuing orders.`,
  };
}

export function canAttack(battle: Battle, rules = DEFAULT_COMBAT_RULES): boolean {
  return rules.source === "hazard" || battle.enemyWeapons > 0;
}

export function chargeRequirements(
  battle: Battle, rules = DEFAULT_COMBAT_RULES,
): Pick<CombatRules, "requiredTarget" | "requiredManeuver" | "minimumPower"> {
  return rules.escapeAlternative === "disabled-engines" && battle.enemyEngines === 0
    ? { requiredTarget: null, requiredManeuver: null, minimumPower: { ...rules.minimumPower, engines: 1 } }
    : rules;
}

export function chargeBlockReason(battle: Battle, rules = DEFAULT_COMBAT_RULES): string | null {
  const requirements = chargeRequirements(battle, rules);
  if (!battle.scanned) return "Scan first to identify the objective.";
  if (requirements.requiredTarget !== null
    && (requirements.requiredTarget === "engines" ? battle.enemyEngines : battle.enemyWeapons) > 0) {
    return `Disable ${rules.targetNames[requirements.requiredTarget].toLowerCase()} before ${rules.action.toLowerCase()}.`;
  }
  if (requirements.requiredManeuver !== null && battle.maneuver !== requirements.requiredManeuver) {
    return `Select ${requirements.requiredManeuver === "hold" ? "Hold" : "Evade"} for ${rules.action.toLowerCase()}.`;
  }
  for (const system of systems) {
    if (battle.power[system] < requirements.minimumPower[system]) {
      return `Allocate at least ${requirements.minimumPower[system]} power to ${system}.`;
    }
  }
  if (battle.power[rules.chargeSystem] === 0) return `Allocate power to ${rules.chargeSystem}.`;
  return null;
}

export function applyOrder(battle: Battle, order: TacticalOrder, rules = DEFAULT_COMBAT_RULES): Battle {
  switch (order.type) {
    case "scan":
      return {
        ...battle, scanned: true,
        log: rules.requiredTarget === null
          ? `Scan complete. ${rules.action} requires the maneuver and power allocation in your briefing.`
          : `Scan complete. Target ${rules.targetNames[rules.requiredTarget].toLowerCase()} for ${rules.action.toLowerCase()}.`,
      };
    case "power": {
      const power = { ...battle.power };
      let log: string;
      if (order.delta < 0) {
        if (power[order.system] === 0) return { ...battle, log: "That system is already running on optimism alone." };
        power[order.system]--;
        log = `Released one power unit from ${order.system}. It is now available for another system.`;
      } else {
        if (power[order.system] === 4) return { ...battle, log: "Maximum allocation is four. The fifth light is decorative." };
        if (power.shields + power.weapons + power.engines === 6) {
          let donor: PowerSystem = order.system === "shields" ? "weapons" : "shields";
          for (const system of systems) {
            if (system !== order.system && power[system] > power[donor]) donor = system;
          }
          power[donor]--;
          log = `Transferred one power unit from ${donor} to ${order.system}.`;
        } else log = `Allocated one unused power unit to ${order.system}.`;
        power[order.system]++;
      }
      return { ...battle, power, log };
    }
    case "target":
      return battle.scanned
        ? { ...battle, target: order.target, log: `Targeting ${rules.targetNames[order.target]}. Precision fire leaves hulls intact.` }
        : { ...battle, log: "Scan first. Guessing is how we got promoted." };
    case "maneuver": {
      const exposedArc = order.maneuver === "turn"
        ? arcs[(arcs.indexOf(battle.exposedArc) + 1) % arcs.length] ?? "forward"
        : battle.exposedArc;
      return {
        ...battle, maneuver: order.maneuver, exposedArc,
        log: !canAttack(battle, rules)
          ? `${rules.targetNames.weapons} disabled. ${order.maneuver === "evade" ? "Evasive pattern maintained." : `Presenting ${exposedArc} shields.`}`
          : order.maneuver === "evade"
          ? "Evasive pattern engaged. Incoming damage reduced."
          : `Presenting ${exposedArc} shields. ${rules.source === "hazard" ? "Another discharge pulse is building." : "The enemy is charging another shot."}`,
      };
    }
    case "fire": {
      if (!battle.scanned) return { ...battle, log: "Scan before firing. This is an interception, not a blind date." };
      if (battle.power.weapons === 0) return { ...battle, log: "Allocate at least one power unit to weapons." };
      if (battle.cooldownMs > 0) return { ...battle, log: "Weapons are recharging. Threatening the progress bar will not help." };
      const key = battle.target === "engines" ? "enemyEngines" : "enemyWeapons";
      if (battle[key] === 0) return { ...battle, log: `That subsystem is already disabled. Objective: ${rules.action}.` };
      const health = Math.max(0, battle[key] - 36);
      return {
        ...battle,
        [key]: health,
        enemyAttackMs: key === "enemyWeapons" && health === 0 && rules.source === "ship" ? 0 : battle.enemyAttackMs,
        cooldownMs: 3600 / battle.power.weapons,
        log: health === 0
          ? `${rules.targetNames[battle.target]} disabled. Hulls intact. Objective: ${rules.action}.`
          : `Direct hit on ${rules.targetNames[battle.target].toLowerCase()}. Hulls undamaged.`,
      };
    }
    case "engage": {
      const blocked = chargeBlockReason(battle, rules);
      if (blocked !== null) return { ...battle, log: blocked };
      return {
        ...battle, engaged: true,
        log: `${rules.action} started. Maintain the required maneuver and power until the meter reaches 100%.`,
      };
    }
  }
}

export function stepBattle(battle: Battle, elapsedMs = COMBAT_STEP_MS, rules = DEFAULT_COMBAT_RULES): Battle {
  if (battle.hull === 0 || battle.charge >= 100) return battle;
  const shields = { ...battle.shields };
  for (const arc of arcs) {
    shields[arc] = Math.min(100, shields[arc] + battle.power.shields * elapsedMs / 1000);
  }
  let hull = battle.hull;
  const attacking = canAttack(battle, rules);
  let enemyAttackMs = attacking ? battle.enemyAttackMs - elapsedMs : 0;
  let log = battle.log;
  if (attacking && enemyAttackMs <= 0) {
    enemyAttackMs += rules.attackIntervalMs;
    const damage = rules.attackDamage
      * (rules.source === "hazard" || battle.enemyWeapons > 50 ? 1 : 24 / 42)
      * (battle.maneuver === "evade" ? 0.4 : 1);
    const absorbed = Math.min(shields[battle.exposedArc], damage);
    shields[battle.exposedArc] -= absorbed;
    hull = Math.max(0, hull - (damage - absorbed));
    log = `${rules.name} hit ${battle.exposedArc} shields. Rotate or evade, then restore your objective's maneuver.`;
  }
  const blocked = chargeBlockReason(battle, rules);
  if (battle.engaged && blocked !== null) log = `Objective paused: ${blocked}`;
  else if (battle.engaged && log.startsWith("Objective paused:")) log = `${rules.action} resumed.`;
  const progress = battle.engaged && blocked === null
    ? battle.charge + elapsedMs / rules.chargeDurationMs * 100 * battle.power[rules.chargeSystem] / 2
    : battle.charge;
  const charge = progress >= 100 - 1e-9 ? 100 : progress;
  return {
    ...battle, hull, shields, enemyAttackMs, log, charge,
    cooldownMs: Math.max(0, battle.cooldownMs - elapsedMs),
  };
}
