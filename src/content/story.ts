import { createBattle, DEFAULT_COMBAT_RULES, isBattle } from "../game/combat";
import { withinFloor } from "../game/navigation";
import type { Campaign, Command, Item, Room, RuleResult, World } from "../game/types";
import { openingCampaign, type OpeningProgress } from "./opening";
import { laterItems, laterRooms, laterSequences, missions, type ChapterStage, type LaterProgress } from "./story-content";
import { sensoryReply } from "./flavor";
import { reply as say, type DialogueOptions } from "./responses";

export type StoryProgress = OpeningProgress | LaterProgress;
type LaterWorld = World<LaterProgress>;
type Action = Extract<Command, { type: "interact" }>;
const rooms: Readonly<Record<string, Room>> = { ...openingCampaign.rooms, ...laterRooms };
const items: Readonly<Record<string, Item>> = { ...openingCampaign.items, ...laterItems };
const sequences = { ...openingCampaign.sequences, ...laterSequences };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChapterStage(value: unknown): value is ChapterStage {
  return typeof value === "string" && Object.hasOwn(missions, value);
}

export function isLaterProgress(value: unknown): value is LaterProgress {
  return record(value) && isChapterStage(value.stage) && typeof value.step === "string"
    && Object.hasOwn(missions[value.stage].steps, value.step);
}

export function stepHints(progress: LaterProgress): readonly [string, string, string] {
  switch (progress.stage) {
    case "chapter-2": return missions["chapter-2"].steps[progress.step];
    case "chapter-3": return missions["chapter-3"].steps[progress.step];
    case "chapter-4": return missions["chapter-4"].steps[progress.step];
    case "chapter-5": return missions["chapter-5"].steps[progress.step];
  }
}

export function chapterInfo(progress: StoryProgress) {
  if (!isLaterProgress(progress)) return {
    number: 1, title: "An entirely routine maintenance job.", label: "THE ACCIDENT",
    ending: "The core is stable and the crew and patrol are safe. The Enterprise is yours. The Defiant has just received a very confusing report.",
    log: "First day in engineering. Nobody has asked to see my qualifications. I intend to keep it that way.",
    next: "Acting captain",
  };
  const chapter = missions[progress.stage];
  const next = progress.stage === "chapter-2" ? missions["chapter-3"].title
    : progress.stage === "chapter-3" ? missions["chapter-4"].title
      : progress.stage === "chapter-4" ? missions["chapter-5"].title : null;
  return { number: chapter.number, title: chapter.title, label: chapter.label, ending: chapter.ending, log: chapter.log, next };
}

export function encounterRules(progress: StoryProgress) {
  return isLaterProgress(progress) ? missions[progress.stage].rules : DEFAULT_COMBAT_RULES;
}

function advance(
  world: LaterWorld, progress: LaterProgress, message: string,
  effect: DialogueOptions & { readonly consume?: string; readonly give?: string } = {},
): RuleResult<LaterProgress> {
  const inventory = world.inventory.filter(id => id !== effect.consume);
  if (effect.give && !inventory.includes(effect.give)) inventory.push(effect.give);
  return { ...say({ ...world, progress, inventory }, message, effect), checkpoint: true };
}

function collect(world: LaterWorld, id: keyof typeof laterItems, target: string): RuleResult<LaterProgress> {
  return world.inventory.includes(id) ? say(world, `You already have the ${laterItems[id].name.toLowerCase()}.`)
    : say({ ...world, inventory: [...world.inventory, id] }, `${laterItems[id].name} acquired.`,
      { animation: { kind: "pickup", target } });
}

function cinematic(world: LaterWorld, id: string): LaterWorld {
  return { ...world, scene: { kind: "cutscene", id, token: 0, frame: 0, elapsedMs: 0 } };
}

function depart(world: LaterWorld): RuleResult<LaterProgress> {
  return { world: cinematic({ ...world, progress: { ...world.progress, step: "encounter" } }, missions[world.progress.stage].departure), checkpoint: true };
}

const descriptions: Readonly<Record<string, string>> = {
  "alert-log": "The patrol is tracking our broadcast hazard signature, not our hull. The packet repeats unchanged. Navigation has quarantined every route in the active chart.",
  "desk-drawer": "A copper-edged navigation chip labelled OFFLINE CONTINGENCY CHART. The captain has filed it beside a much older contingency mint.",
  "fish-tank": "The fish remains calm. It has neither command authority nor access to the shortcut button.",
  "nav-console": "Every active chart is marked QUARANTINED. Beneath the display is an offline reader with a narrow copper-contact slot.",
  "route-display": "Harlow depot is on the far side of the containment cordon. The patrol is concentrating on the strongest hazard beacon.",
  "probe-rack": "Portable survey probes with programmable transmitters. One has an empty beacon memory and a full battery.",
  "probe-bench": "A cradle for portable transmitters. Its panel can copy a recorded beacon packet; autonomous flight also requires a valid navigation chart.",
  "launch-tube": "An empty survey-probe cradle points out through the hull. Its launch interlock checks the beacon memory before release.",
  "dock-manifest": "Dock 7: NCC-1701-D. Fault category: emergency communications. Written requests must match a registered vessel and category. Roger finally has two facts that look official.",
  "form-printer": "A blue emergency-request form waits under the roller. The printer refuses to print forms about printer problems.",
  clerk: "The clerk's stamp reads AUTHORIZED. The parts list behind the desk has a conspicuously empty signature box.",
  undock: "Departure requires working communications and preservation of the original recorder. The Defiant is outside.",
  "parts-locker": "One communications transceiver is reserved against a parts voucher.",
  recorder: "The recorder's live memory draws power from the old radio. Removing that radio would erase it. The export latch has a six-sided socket inside an insulated housing.",
  "comms-bench": "The damaged transceiver still powers the recorder's memory. A replacement bay has matching blue contacts and a warning about preserving volatile evidence.",
  "purge-monitor": "FAULT: the original bypass queued a purge toward the depot. The controller checksum is corrupt and its service circuit is LIVE. The isolation procedure is now displayed beside the fault.",
  "purge-bypass": "The controller's live service circuit runs through this housing. Its six-sided isolation socket is surrounded by an electrical warning.",
  "controller-socket": "A scorched logic module sits behind energized retaining clips. The identification plate reads EC-7.",
  "module-cabinet": "A sealed EC-7 emergency logic module. Its pin pattern matches the controller hardware aboard the Enterprise.",
  "relay-terminal": "Evidence authentication requires the original recorder signature. The terminal rejects manually edited accounts, however flattering.",
  "dish-control": "The dish has lost its fleet-beacon lock. Its tracking system accepts timing from authenticated navigation records.",
  transmit: "A fleet-wide channel, currently waiting for an authenticated source and a locked dish. Finally, a way to be misunderstood by everyone at once.",
  "fleet-channel": "The Defiant's coordination channel is open. Its commander is waiting for someone aboard this ship to listen.",
  "crew-status": "Every evacuated crew member is safe at Harlow depot. They return only after the discharge is contained.",
  "core-sync": "Local timing is out of step with the Defiant. A plan-data slot sits below two readiness lamps: interlock and deflector polarity.",
  "engineering-kit": "A deflector-feed inverter in a sealed service case. Two opposed arrows are stamped on the housing.",
  "original-interlock": "The original interlock remains in BYPASS. Its six-sided service socket is depressingly familiar. Fleet clearance is required before changing the field geometry.",
  "deflector-relay": "The emergency feed still points toward the depot. Its keyed expansion socket carries the same opposed-arrow marking used for polarity hardware.",
};

function description(world: LaterWorld, target: string, name: string): string {
  const p = world.progress;
  const has = (id: string) => world.inventory.includes(id);
  switch (p.stage) {
    case "chapter-2":
      if (target === "desk-drawer" && (has("nav-chip") || !["trace", "navigation"].includes(p.step))) return "The navigation chip's recess is empty. The mint remains in command.";
      if (target === "nav-console" && !["trace", "navigation"].includes(p.step)) return "The offline chart is loaded. Harlow depot is plotted beyond the cordon.";
      if (target === "probe-rack" && (has("probe") || p.step === "launch")) return "One probe cradle is empty. Its inventory tag now has Roger's name on it.";
      if (target === "probe-bench" && p.step === "launch") return "The copied beacon matches the Enterprise's hazard packet. The bench reports PROGRAMMING COMPLETE.";
      break;
    case "chapter-3":
      if (target === "form-printer" && (has("service-form") || !["manifest", "permit"].includes(p.step))) return "The printer's request counter reads ISSUED. It would prefer not to meet Roger twice.";
      if (target === "parts-locker" && !["manifest", "permit", "parts"].includes(p.step)) return "The authorized transceiver has been checked out. The voucher reader shows a spent authorization.";
      if (target === "recorder" && has("flight-log")) return "The export latch is open. The original log is safely preserved in Roger's inventory.";
      if (target === "comms-bench" && p.step === "undock") return "The new transceiver has a steady carrier signal. For once, static is not the ship's most eloquent spokesperson.";
      break;
    case "chapter-4":
      if (target === "purge-monitor" && !["diagnose", "isolate", "replace"].includes(p.step)) return "Purge commands inhibited. The accumulated plasma charge remains, but the controller can no longer increase it.";
      if (target === "purge-bypass" && !["diagnose", "isolate"].includes(p.step)) return "The controller circuit is isolated. Its service-voltage indicator reads zero.";
      if (target === "controller-socket" && !["diagnose", "isolate", "replace"].includes(p.step)) return "A clean EC-7 module is seated in the socket. Its checksum is valid.";
      if (target === "module-cabinet" && (has("logic-module") || !["diagnose", "isolate", "replace"].includes(p.step))) return "The EC-7 compartment is empty. One fewer spare; one fewer corrupted controller.";
      if (target === "relay-terminal" && ["align", "transmit"].includes(p.step)) return "The recorder signature is authenticated. The evidence is locked against further edits.";
      if (target === "dish-control" && p.step === "transmit") return "The fleet-beacon lock is steady. The dish is aligned.";
      break;
    case "chapter-5":
      if (target === "original-interlock" && !["briefing", "isolate"].includes(p.step)) return "The original interlock is back in SAFE. Roger is trying not to calculate how much trouble this position would have saved.";
      if (target === "deflector-relay" && ["synchronize", "authorize"].includes(p.step)) return "The inverter has reversed the feed away from the depot. Both opposed-arrow indicators agree.";
      if (target === "core-sync" && p.step === "authorize") return "The core and Defiant clocks agree. Both readiness lamps are green.";
      if (target === "engineering-kit" && (has("inverter") || !["briefing", "isolate", "invert"].includes(p.step))) return "The inverter's padded recess is empty. The service kit has fulfilled its modest ambitions.";
      if (target === "fleet-channel" && p.step !== "briefing") return "The Defiant has sent its containment timing. The channel remains open for the Enterprise's readiness report.";
      break;
  }
  return descriptions[target] ?? `The passage to ${name.toLowerCase()}. Roger can postpone his report, but not geography.`;
}

function interactLater(world: LaterWorld, action: Action): RuleResult<LaterProgress> {
  const hotspot = rooms[world.room]?.hotspots.find(candidate => candidate.id === action.target);
  if (!hotspot) return say(world, "That object is not in this room.");
  const p = world.progress;
  const target = action.target;
  if (action.verb === "look") {
    const observed = description(world, target, hotspot.name);
    const animation = { kind: "inspect", target } as const;
    if (p.stage === "chapter-2" && p.step === "trace" && target === "alert-log") {
      return advance(world, { ...p, step: "navigation" }, observed, { animation });
    }
    if (p.stage === "chapter-3" && p.step === "manifest" && target === "dock-manifest") {
      return advance(world, { ...p, step: "permit" }, observed, { animation });
    }
    if (p.stage === "chapter-4" && p.step === "diagnose" && target === "purge-monitor") {
      return advance(world, { ...p, step: "isolate" }, observed, { animation });
    }
    return say(world, observed, { animation });
  }
  if (action.verb === "smell" || action.verb === "taste") return say(world, sensoryReply(action.verb, hotspot),
    { animation: { kind: action.verb === "smell" ? "sniff" : "recoil", target } });
  if (action.verb === "talk") {
    const animation = { kind: "talk", target } as const;
    if (p.stage === "chapter-5" && p.step === "briefing" && target === "fleet-channel") {
      return advance(world, { ...p, step: "isolate" },
        "We will shield the depot. Your bypass and forward-pointing feed prevent a safe field. Our timing plan is attached; report ready once your core can join our formation.",
        { give: "containment-plan", speaker: "Defiant", animation });
    }
    if (target === "clerk" && p.stage === "chapter-3") return say(world,
      ["manifest", "permit"].includes(p.step)
        ? "I need a written request matching a registered vessel and fault category. I do not accept interpretive apologies."
        : p.step === "parts" ? "Your authorization is approved. The workshop will honor the voucher. My stamp and I have done our part."
          : p.step === "undock" ? "Your repair is logged and departure is cleared. Please leave the station in the condition you found it."
            : "Your parts are issued. Keep the original recorder evidence; I am not stamping a rewritten history.",
      { speaker: "Depot clerk", animation });
    if (target === "fleet-channel" && p.stage === "chapter-5") return say(world,
      p.step === "authorize" ? "We confirm synchronized clocks and safe geometry. Standing by for your authorization."
        : "The depot is under our shields. Your engineering readiness lamps are still incomplete. We will hold position.",
      { speaker: "Defiant", animation });
    return say(world, target === "fish-tank"
      ? "Roger asks the fish for command advice. It opens its mouth, closes it, and improves on his last briefing."
      : target === "recorder" ? "Roger offers his side of the story. The recorder already has it, with timestamps."
        : target === "crew-status" ? "Roger rehearses an apology to the names on the screen. He has enough material for a fleet address."
          : `${hotspot.name} offers no verbal response. Its display remains a more reliable conversational partner.`,
    { animation });
  }
  if (action.item && !world.inventory.includes(action.item)) return say(world, "That item is not in your inventory.");
  if (!action.item && target.endsWith("-exit")) {
    const destination = target.slice(0, -5);
    const allowed: readonly string[] = missions[p.stage].rooms;
    const room = rooms[destination];
    if (!room || !allowed.includes(destination)) return say(world, "That route is unavailable in this chapter.");
    return { world: { ...world, room: destination, actor: { ...room.spawn } } };
  }
  let refusal: string | null = null;
  switch (p.stage) {
    case "chapter-2":
      if (!action.item && target === "desk-drawer" && ["trace", "navigation"].includes(p.step)) return collect(world, "nav-chip", target);
      if (!action.item && target === "probe-rack" && ["trace", "navigation", "decoy"].includes(p.step)) return collect(world, "probe", target);
      if (action.item === "nav-chip" && target === "nav-console" && p.step === "navigation") {
        return advance(world, { ...p, step: "decoy" }, "The offline chart loads. Harlow is reachable, but the alert still points every patrol at this ship.",
          { consume: "nav-chip", animation: { kind: "operate", target } });
      }
      if (action.item === "probe" && target === "probe-bench" && p.step === "decoy") {
        return advance(world, { ...p, step: "launch" }, "The probe repeats our hazard packet perfectly. Roger has finally trained a replacement.",
          { consume: "probe", give: "decoy", animation: { kind: "operate", target } });
      }
      if (action.item === "decoy" && target === "launch-tube" && p.step === "launch") {
        return depart({ ...world, inventory: world.inventory.filter(id => id !== "decoy") });
      }
      if (target === "nav-console" && p.step === "trace") {
        refusal = "The chart reader has no record of the current hazard exclusion. Roger has not checked the outgoing alert.";
      } else if (target === "probe-bench" && ["trace", "navigation"].includes(p.step)) {
        refusal = "The programming cradle refuses autonomous flight without a valid navigation chart.";
      } else if (target === "launch-tube" && action.item === "probe") {
        refusal = "The probe's beacon memory is blank. The patrol would recognize ordinary survey telemetry.";
      }
      break;
    case "chapter-3":
      if (!action.item && target === "form-printer" && ["manifest", "permit"].includes(p.step)) return collect(world, "service-form", target);
      if (action.item === "service-form" && target === "clerk" && p.step === "permit") {
        return advance(world, { ...p, step: "parts" }, "Approved. One transceiver, one voucher, absolutely no complimentary captain's hat.",
          { consume: "service-form", give: "voucher", speaker: "Depot clerk", animation: { kind: "operate", target } });
      }
      if (action.item === "voucher" && target === "parts-locker" && p.step === "parts") {
        return advance(world, { ...p, step: "recorder" }, "The voucher disappears into the reader. A replacement transceiver slides out, wrapped more carefully than Roger's career.",
          { consume: "voucher", give: "transceiver", animation: { kind: "pickup", target } });
      }
      if (action.item === "tool" && target === "recorder" && p.step === "recorder") {
        return advance(world, { ...p, step: "install" }, "The latch opens. Roger copies the unedited record: crew safe, shortcut logged, operator unmistakable. The evidence is preserved.",
          { give: "flight-log", animation: { kind: "repair", target } });
      }
      if (action.item === "transceiver" && target === "comms-bench" && p.step === "install") {
        return advance(world, { ...p, step: "undock" }, "The carrier signal steadies. Communications are repaired, and the depot acknowledges the completed service.",
          { consume: "transceiver", animation: { kind: "repair", target } });
      }
      if (!action.item && target === "undock" && p.step === "undock") return depart(world);
      if (target === "recorder" && ["manifest", "permit", "parts"].includes(p.step)) {
        refusal = "The workshop interlock is waiting for the authorized replacement to be checked out before disassembly.";
      } else if (target === "comms-bench" && p.step === "recorder") {
        refusal = "The recorder's live memory still depends on this unit. Removing it now would erase the original evidence.";
      }
      break;
    case "chapter-4":
      if (!action.item && target === "module-cabinet" && ["diagnose", "isolate", "replace"].includes(p.step)) return collect(world, "logic-module", target);
      if (action.item === "tool" && target === "purge-bypass" && p.step === "isolate") {
        return advance(world, { ...p, step: "replace" }, "The service-voltage indicator drops to zero. The controller's retaining clips release.",
          { animation: { kind: "repair", target } });
      }
      if (action.item === "logic-module" && target === "controller-socket" && p.step === "replace") {
        return advance(world, { ...p, step: "authenticate" }, "The clean module boots. Purge commands stop; the accumulated plasma charge remains. The outgoing channel is no longer being overwritten.",
          { consume: "logic-module", animation: { kind: "repair", target } });
      }
      if (action.item === "flight-log" && target === "relay-terminal" && p.step === "authenticate") {
        return advance(world, { ...p, step: "align" }, "The recorder signature verifies. The relay extracts the fleet timing and locks the evidence against edits. Roger's original copy stays with him.",
          { animation: { kind: "operate", target } });
      }
      if (!action.item && target === "dish-control" && p.step === "align") {
        return advance(world, { ...p, step: "transmit" }, "The dish turns onto the fleet beacon. The channel-ready lamp illuminates.",
          { animation: { kind: "operate", target } });
      }
      if (!action.item && target === "transmit" && p.step === "transmit") return depart(world);
      if (target === "controller-socket" && ["diagnose", "isolate"].includes(p.step)) {
        refusal = "The retaining clips are energized. Roger keeps the replacement clear of them.";
      } else if (target === "relay-terminal" && ["diagnose", "isolate", "replace"].includes(p.step)) {
        refusal = "The emergency controller is still overwriting the outgoing channel. Authentication cannot hold.";
      }
      break;
    case "chapter-5":
      if (!action.item && target === "engineering-kit" && ["briefing", "isolate", "invert"].includes(p.step)) return collect(world, "inverter", target);
      if (action.item === "tool" && target === "original-interlock" && p.step === "isolate") {
        return advance(world, { ...p, step: "invert" }, "The original interlock clicks back to SAFE. That position would have been useful several chapters ago.",
          { animation: { kind: "repair", target } });
      }
      if (action.item === "inverter" && target === "deflector-relay" && p.step === "invert") {
        return advance(world, { ...p, step: "synchronize" }, "The opposed arrows illuminate. The deflector feed now points away from the depot.",
          { consume: "inverter", animation: { kind: "repair", target } });
      }
      if (action.item === "containment-plan" && target === "core-sync" && p.step === "synchronize") {
        return advance(world, { ...p, step: "authorize" }, "The two clocks converge. Engineering reports ready; the Defiant acknowledges and awaits authorization.",
          { consume: "containment-plan", animation: { kind: "operate", target } });
      }
      if (!action.item && target === "fleet-channel" && p.step === "authorize") return depart(world);
      if (target === "deflector-relay" && ["briefing", "isolate"].includes(p.step)) {
        refusal = "The original bypass prevents a safe polarity change. The relay's interlock stays closed.";
      }
      break;
  }
  return say(world, refusal ?? (action.item
    ? `${items[action.item]?.name ?? "That item"} does not help with ${hotspot.name.toLowerCase()}. Roger keeps it.`
    : description(world, target, hotspot.name)),
  { animation: { kind: action.item ? "recoil" : "inspect", target } });
}

function enterChapter(progress: LaterProgress): RuleResult<StoryProgress> {
  const mission = missions[progress.stage];
  const room = laterRooms[mission.entry];
  return {
    world: {
      progress, room: room.id, actor: { ...room.spawn },
      inventory: mission.number >= 4 ? ["tool", "flight-log"] : ["tool"],
      countdownMs: null,
      scene: { kind: "cutscene", id: mission.intro, token: 0, frame: 0, elapsedMs: 0 },
    },
    checkpoint: true,
  };
}

function finishLaterSequence(world: LaterWorld): RuleResult<LaterProgress> {
  if (world.scene.kind !== "cutscene") return { world };
  const mission = missions[world.progress.stage];
  if (world.scene.id === mission.intro) return { world: { ...world, scene: { kind: "adventure" } }, checkpoint: true };
  if (world.scene.id === mission.departure) return {
    world: { ...world, scene: { kind: "combat", battle: createBattle(mission.rules) } },
    dialogue: { speaker: "Tactical assistant", lines: mission.briefing }, checkpoint: true,
  };
  if (world.scene.id === mission.outro) return {
    world: { ...world, progress: { ...world.progress, step: "complete" }, scene: { kind: "complete" } }, checkpoint: true,
  };
  throw new Error(`Unexpected chapter sequence: ${world.scene.id}`);
}

function inventoryMatches(world: Pick<LaterWorld, "progress" | "inventory">): boolean {
  const has = (id: string) => world.inventory.includes(id);
  const p = world.progress;
  if (!has("tool")) return false;
  const allowed = new Set<string>(missions[p.stage].items);
  if (world.inventory.some(id => !allowed.has(id))) return false;
  switch (p.stage) {
    case "chapter-2":
      if (["trace", "navigation"].includes(p.step)) return !has("decoy");
      if (p.step === "decoy") return !has("nav-chip") && !has("decoy");
      if (p.step === "launch") return has("decoy") && !has("probe") && !has("nav-chip");
      return world.inventory.length === 1;
    case "chapter-3":
      if (["manifest", "permit"].includes(p.step)) return !has("voucher") && !has("transceiver") && !has("flight-log");
      if (has("service-form")) return false;
      if (p.step === "parts") return has("voucher") && !has("transceiver") && !has("flight-log");
      if (has("voucher")) return false;
      if (p.step === "recorder") return has("transceiver") && !has("flight-log");
      if (p.step === "install") return has("transceiver") && has("flight-log");
      return has("flight-log") && !has("transceiver");
    case "chapter-4":
      return has("flight-log") && (["diagnose", "isolate", "replace"].includes(p.step) || !has("logic-module"));
    case "chapter-5":
      if (!has("flight-log")) return false;
      if (p.step === "briefing") return !has("containment-plan");
      if (["isolate", "invert"].includes(p.step)) return has("containment-plan");
      if (p.step === "synchronize") return has("containment-plan") && !has("inverter");
      return !has("containment-plan") && !has("inverter");
  }
}

function validateStoryWorld(value: unknown): value is World<StoryProgress> {
  if (openingCampaign.validateWorld(value)) return true;
  if (!record(value) || !isLaterProgress(value.progress) || !record(value.scene) || !record(value.actor)) return false;
  const progress = value.progress;
  const mission = missions[progress.stage];
  const allowedRooms: readonly string[] = mission.rooms;
  if (typeof value.room !== "string" || !allowedRooms.includes(value.room)) return false;
  const room = rooms[value.room];
  if (!room || typeof value.actor.x !== "number" || typeof value.actor.y !== "number"
    || !withinFloor({ x: value.actor.x, y: value.actor.y }, room.floor)) return false;
  if (value.countdownMs !== null || !Array.isArray(value.inventory)
    || !value.inventory.every((id: unknown): id is string => typeof id === "string" && Object.hasOwn(items, id))
    || new Set(value.inventory).size !== value.inventory.length) return false;
  const scene = value.scene;
  let validScene = false;
  if (scene.kind === "adventure") validScene = progress.step !== "encounter" && progress.step !== "complete";
  if (scene.kind === "complete") validScene = progress.step === "complete";
  if (scene.kind === "failure") validScene = progress.step === "encounter" && typeof scene.reason === "string" && scene.reason.trim().length > 0;
  if (scene.kind === "combat" && progress.step === "encounter" && isBattle(scene.battle)) {
    validScene = scene.battle.hull > 0 && scene.battle.charge < 100;
    if (scene.battle.engaged && mission.rules.requiredTarget !== null) {
      const health = mission.rules.requiredTarget === "engines" ? scene.battle.enemyEngines : scene.battle.enemyWeapons;
      if (health !== 0) return false;
    }
  }
  if (scene.kind === "cutscene" && typeof scene.id === "string") {
    const entryStep = progress.stage === "chapter-2" ? "trace" : progress.stage === "chapter-3" ? "manifest"
      : progress.stage === "chapter-4" ? "diagnose" : "briefing";
    const permitted = scene.id === mission.intro ? progress.step === entryStep
      : (scene.id === mission.departure || scene.id === mission.outro) && progress.step === "encounter";
    const sequence = laterSequences[scene.id];
    if (!permitted || !sequence || typeof scene.frame !== "number" || !Number.isInteger(scene.frame)) return false;
    const frame = sequence.frames[scene.frame];
    validScene = !!frame && typeof scene.elapsedMs === "number" && Number.isFinite(scene.elapsedMs)
      && scene.elapsedMs >= 0 && scene.elapsedMs < frame.durationMs
      && typeof scene.token === "number" && Number.isSafeInteger(scene.token) && scene.token >= 0;
  }
  if (!validScene) return false;
  return inventoryMatches({ progress, inventory: value.inventory });
}

export function upgradeStorySave(value: unknown): unknown {
  if (!record(value)) return value;
  const upgradeWorld = (world: unknown): unknown => {
    if (!record(world) || !record(world.scene) || world.scene.kind !== "combat" || !record(world.scene.battle)) return world;
    const old = world.scene.battle;
    if (Object.hasOwn(old, "charge") || Object.hasOwn(old, "engaged")
      || !Object.hasOwn(old, "escapeCharge") || !Object.hasOwn(old, "escaping")) return world;
    const { escapeCharge, escaping, ...battle } = old;
    return { ...world, scene: { ...world.scene, battle: { ...battle, charge: escapeCharge, engaged: escaping } } };
  };
  return { ...value, world: upgradeWorld(value.world), checkpoint: upgradeWorld(value.checkpoint) };
}

export const storyCampaign: Campaign<StoryProgress> = {
  id: openingCampaign.id, rooms, items, sequences,
  initial: openingCampaign.initial,
  interact: (world, action) => isLaterProgress(world.progress)
    ? interactLater({ ...world, progress: world.progress }, action)
    : openingCampaign.interact({ ...world, progress: world.progress }, action),
  finishSequence: world => isLaterProgress(world.progress)
    ? finishLaterSequence({ ...world, progress: world.progress })
    : openingCampaign.finishSequence({ ...world, progress: world.progress }),
  finishBattle: world => isLaterProgress(world.progress)
    ? { world: cinematic({ ...world, progress: world.progress }, missions[world.progress.stage].outro) }
    : openingCampaign.finishBattle({ ...world, progress: world.progress }),
  continueChapter: world => {
    if (world.scene.kind !== "complete") return { world };
    switch (world.progress.stage) {
      case "complete": return enterChapter({ stage: "chapter-2", step: "trace" });
      case "chapter-2": return enterChapter({ stage: "chapter-3", step: "manifest" });
      case "chapter-3": return enterChapter({ stage: "chapter-4", step: "diagnose" });
      case "chapter-4": return enterChapter({ stage: "chapter-5", step: "briefing" });
      default: return { world };
    }
  },
  combatRules: world => encounterRules(world.progress),
  objective: world => isLaterProgress(world.progress)
    ? world.progress.step === "encounter" || world.progress.step === "complete"
      ? stepHints(world.progress)[0] : missions[world.progress.stage].objective
    : world.progress.stage === "complete" ? "Chapter 1 complete. Continue to chapter 2: Acting captain."
      : openingCampaign.objective({ ...world, progress: world.progress }),
  hint: world => isLaterProgress(world.progress) ? stepHints(world.progress)
    : world.progress.stage === "complete" ? ["The crew is safe.", "The adventure continues.", "Select Continue to chapter 2."]
      : openingCampaign.hint({ ...world, progress: world.progress }),
  validateWorld: validateStoryWorld,
};
