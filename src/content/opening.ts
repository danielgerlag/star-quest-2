import { createBattle, isBattle } from "../game/combat";
import { withinFloor } from "../game/navigation";
import type { Campaign, Command, RuleResult, World } from "../game/types";
import { openingRooms } from "./rooms";
import { openingSequences } from "./sequences";
import { sensoryReply } from "./flavor";
import { reply as say } from "./responses";

export type OpeningProgress =
  | { readonly stage: "routine-maintenance" }
  | { readonly stage: "evacuation" }
  | {
    readonly stage: "repair";
    readonly diagnostics: boolean;
    readonly placard: boolean;
    readonly bypassIsolated: boolean;
    readonly couplingFitted: boolean;
  }
  | { readonly stage: "restore-turbolift" }
  | { readonly stage: "take-command" }
  | { readonly stage: "tutorial-encounter" }
  | { readonly stage: "complete" };

type OpeningWorld = World<OpeningProgress>;
type Action = Extract<Command, { type: "interact" }>;

export const REPAIR_DURATION_MS = 180_000;

const items = {
  tool: {
    id: "tool", name: "Insulated tool", color: 0xeac052,
    description: "A regulation spanner with a six-sided head and a thick insulated grip. Rated for live service housings, not stirring coffee.",
  },
  coupling: {
    id: "coupling", name: "Replacement coupling", color: 0x68dce7,
    description: "A sealed coolant connector with two blue locking rings. Its pressure rating is reassuringly higher than Roger's.",
  },
} as const;

function sequence(world: OpeningWorld, id: keyof typeof openingSequences, progress: OpeningProgress): OpeningWorld {
  return { ...world, progress, scene: { kind: "cutscene", id, token: 0, frame: 0, elapsedMs: 0 } };
}

function travel(world: OpeningWorld, room: keyof typeof openingRooms): RuleResult<OpeningProgress> {
  return { world: { ...world, room, actor: { ...openingRooms[room].spawn } } };
}

function look(world: OpeningWorld, target: string) {
  const progress = world.progress;
  switch (target) {
    case "console":
      return say(world, progress.stage === "routine-maintenance"
        ? "Routine task: check coolant flow. A large SHORTCUT button says 'BYPASS SAFETY INTERLOCK — DO NOT USE'. Roger reads the large part first."
        : "The shortcut button is now labelled EVIDENCE. Diagnostics can tell us how to put things right.");
    case "diagnostics":
      if (progress.stage === "repair") {
        return say({ ...world, progress: { ...progress, diagnostics: true } },
          progress.bypassIsolated
            ? progress.couplingFitted
              ? "Line pressure safe. Connector seal intact. Pump motor: awaiting manual restart."
              : "Line pressure safe. Pump connector seal still open. The coolant circuit cannot hold pressure."
            : "FAULT: safety bypass stuck open; coolant connector ruptured. The repair warning refers to the alcove's pressure-isolation procedure.");
      }
      return say(world, progress.stage === "routine-maintenance"
        ? "All systems green. The display has not met me yet."
        : "Coolant circulating. Warp core stable. The display would like a different operator.");
    case "placard":
      return say(progress.stage === "repair" ? { ...world, progress: { ...progress, placard: true } } : world,
        ["PRESSURIZED COOLANT: isolate the supply before opening a connector. The motor must remain stopped until the circuit is sealed.",
          "LIVE SERVICE HOUSINGS: insulated equipment only. 'Do not improvise' is underlined by someone who apparently knew me."]);
    case "tool-rack":
      return say(world, world.inventory.includes("tool")
        ? "The tool-shaped space is empty. Its occupant is in my inventory."
        : "A yellow-gripped spanner hangs on the rack. Its insulated head fits a six-sided service socket.");
    case "coupling-bin":
      return say(world, world.inventory.includes("coupling")
        ? "I already took the serviceable coupling. The rest are display couplings, according to procurement."
        : progress.stage === "repair" && progress.couplingFitted || ["restore-turbolift", "take-command"].includes(progress.stage)
          ? "The replacement coupling is fitted to the pump. Taking it back would be an exciting mistake."
          : "One serviceable coolant coupling with blue locking rings. The others have been designated 'educational'.");
    case "bypass":
      if (progress.stage === "routine-maintenance") {
        return say(world, "A live service housing surrounds a six-sided socket. Its pressure gauge is comfortably in the green. Roger has not helped yet.");
      }
      return say(world, progress.stage === "repair" && progress.bypassIsolated || ["restore-turbolift", "take-command"].includes(progress.stage)
        ? "The damaged line is isolated. Its pressure needle rests at zero."
        : "A live service housing surrounds a six-sided socket. The pressure needle is buried in the red.");
    case "pump":
      return say(world, progress.stage === "repair"
        ? progress.couplingFitted
          ? "The new connector is sealed. A green MANUAL RESTART switch waits beside the silent motor."
          : "The coolant connector has split between its blue locking rings. Pressure still matters more than enthusiasm."
        : "A coolant pump. Its idea of a good day is being left alone.");
    case "auxiliary":
      return say(world, progress.stage === "take-command"
        ? "The auxiliary bus is feeding the turbolift. Its status light is green."
        : "The lift's auxiliary bus is on a separate circuit. A safety lock prevents switching it while the core is unstable.");
    case "command":
      return say(world, "Emergency command is available to the remaining crew member. An enormous confirmation button has suspiciously tiny print.");
    case "captain-chair":
      return say(world, "The captain's chair. Adjustable lumbar support, irreversible career consequences.");
    case "intercom":
      return say(world, progress.stage === "routine-maintenance"
        ? "The emergency intercom is idle. Roger would like it to remain that way."
        : "Evacuation complete: every other crew member reached safety. The automated voice sounds relieved on their behalf.");
    default:
      return say(world, `The way to ${openingRooms[world.room as keyof typeof openingRooms].hotspots.find(h => h.id === target)?.name ?? "somewhere"}. No queue, for once.`);
  }
}

function interact(world: OpeningWorld, action: Action): RuleResult<OpeningProgress> {
  const room = openingRooms[world.room as keyof typeof openingRooms];
  const hotspot = room?.hotspots.find(candidate => candidate.id === action.target);
  if (!hotspot) return say(world, "That object is not in this room. My confidence, however, remains inexplicably nearby.");
  if (action.verb === "look") {
    const result = look(world, action.target);
    return { ...result, dialogue: { ...result.dialogue, animation: { kind: "inspect", target: action.target } } };
  }
  if (action.verb === "smell" || action.verb === "taste") {
    return say(world, sensoryReply(action.verb, hotspot),
      { animation: { kind: action.verb === "smell" ? "sniff" : "recoil", target: action.target } });
  }
  if (action.verb === "talk") {
    return say(world, action.target === "intercom"
      ? world.progress.stage === "routine-maintenance"
        ? "No emergency reported. Please keep this channel clear."
        : world.countdownMs !== null
          ? "All evacuated crew are safe. Core pressure remains critical."
          : "The core is stable. All evacuated crew are safe. Your apology can now be recorded without a countdown."
      : action.target === "command" || action.target === "console"
        ? "Please use the controls. Negotiating with a button does not count as maintenance."
        : `${hotspot.name} declines to comment. Finally, someone respecting the chain of command.`,
    { speaker: ["intercom", "command", "console"].includes(action.target) ? "Computer" : "Roger",
      animation: { kind: "talk", target: action.target } });
  }
  const progress = world.progress;
  if (action.item) {
    if (!world.inventory.includes(action.item)) return say(world, "That item is not in your inventory.");
    if (action.item === "tool" && action.target === "bypass") {
      if (progress.stage !== "repair") return say(world, "The bypass doesn't need further attention. I have caused enough preventative maintenance.");
      if (progress.bypassIsolated) return say(world, "The bypass is already isolated. Leave this successful thing alone.");
      if (!progress.diagnostics || !progress.placard) return say(world, "The housing's safety latch is still locked. Roger has not checked both the fault record and the pressure-isolation warning.");
      return say({ ...world, progress: { ...progress, bypassIsolated: true } },
        "The spanner turns. Pressure falls to zero, and the line stops rattling.",
        { animation: { kind: "repair", target: action.target } });
    }
    if (action.item === "coupling" && action.target === "pump") {
      if (progress.stage !== "repair") return say(world, "No pump repair is needed right now.");
      if (!progress.bypassIsolated) return say(world, "The line is still under pressure. Roger stops before the new coupling becomes a projectile.");
      if (progress.couplingFitted) return say(world, "The coupling is already fitted. This pump is a one-coupling establishment.");
      return say({
        ...world, inventory: world.inventory.filter(item => item !== "coupling"),
        progress: { ...progress, couplingFitted: true },
      }, "Both blue rings lock into place. The new seal holds, but the motor is still silent.",
      { animation: { kind: "repair", target: action.target } });
    }
    return say(world, `${items[action.item as keyof typeof items]?.name ?? "That item"} does not help with ${hotspot.name.toLowerCase()}. Nothing was consumed except dignity.`,
      { animation: { kind: "recoil", target: action.target } });
  }
  switch (action.target) {
    case "tool-rack":
      return world.inventory.includes("tool")
        ? say(world, "You already have the insulated tool. Two would only double the paperwork.")
        : say({ ...world, inventory: [...world.inventory, "tool"] }, "Roger takes the insulated spanner. It has a reassuring amount of rubber between him and engineering.",
          { animation: { kind: "pickup", target: action.target } });
    case "coupling-bin":
      if (world.inventory.includes("coupling")) return say(world, "You already have the replacement coupling.");
      if (progress.stage === "repair" && progress.couplingFitted || ["restore-turbolift", "take-command"].includes(progress.stage)) {
        return say(world, "The good coupling is already fitted. No need to undo your own repair.");
      }
      return say({ ...world, inventory: [...world.inventory, "coupling"] }, "Roger pockets the intact coupling. Procurement will probably bill him for the pocket.",
        { animation: { kind: "pickup", target: action.target } });
    case "console":
      if (progress.stage !== "routine-maintenance") return say(world, "The console refuses to offer another shortcut. Even it has learned something.");
      return { world: sequence({ ...world, room: "engineering", actor: openingRooms.engineering.spawn }, "evacuation", { stage: "evacuation" }) };
    case "bypass":
      return say(world, progress.stage === "repair" && !progress.bypassIsolated
        ? "Roger stops short of the live housing. The six-sided socket is not designed for fingers."
        : "The bypass needs no further adjustment. Roger leaves a successful thing alone.");
    case "pump":
      if (progress.stage !== "repair") return say(world, "The pump is already running. Please do not improve it.");
      if (!progress.couplingFitted) return say(world, "The motor interlock refuses to start with a broken coolant seal.");
      return {
        ...say({ ...world, countdownMs: null, progress: { stage: "restore-turbolift" } },
          ["Coolant circulating. BREACH AVERTED. Countdown stopped!",
            "The lights settle. Somewhere upstairs, the bridge remains conspicuously empty."],
          { animation: { kind: "operate", target: action.target } }),
        checkpoint: true,
      };
    case "auxiliary":
      if (progress.stage === "take-command") return say(world, "Emergency power is already routed. The lift indicator is green.");
      if (progress.stage !== "restore-turbolift") return say(world, "Emergency power is locked while the warp core is unstable.");
      return {
        ...say({ ...world, progress: { stage: "take-command" } }, "The auxiliary bus engages. A turbolift chimes in the corridor.",
          { animation: { kind: "operate", target: action.target } }),
        checkpoint: true,
      };
    case "command":
      if (progress.stage !== "take-command") return say(world, "Emergency command has nothing further to authorize.");
      return { world: sequence(world, "takeover", { stage: "tutorial-encounter" }) };
    case "alcove-exit":
      return travel(world, "alcove");
    case "engineering-exit":
      return travel(world, "engineering");
    case "corridor-exit":
      return travel(world, "corridor");
    case "turbolift-exit":
      return progress.stage === "take-command" || progress.stage === "tutorial-encounter"
        ? travel(world, "turbolift")
        : say(world, "The turbolift has no power. Its display reports an isolated auxiliary bus.");
    case "bridge-exit":
      return progress.stage === "take-command"
        ? travel(world, "bridge")
        : say(world, "The bridge lift needs auxiliary power from engineering.");
    case "intercom":
      return say(world, "All crew safe. Outgoing apologies queued behind the hazardous-vessel alert.");
    case "captain-chair":
      return say(world, "Roger settles into the chair. It swivels with more authority than he possesses.",
        { animation: { kind: "sit", target: action.target } });
    case "diagnostics":
    case "placard":
      return say(world, "Select Look to read it. Poking the instructions is not the same as following them.");
    default:
      return say(world, "Nothing happens. On this ship, that qualifies as a successful experiment.");
  }
}

function finishSequence(world: OpeningWorld): RuleResult<OpeningProgress> {
  if (world.scene.kind !== "cutscene") return { world };
  switch (world.scene.id) {
    case "intro":
      return { world: { ...world, scene: { kind: "adventure" } }, checkpoint: true };
    case "evacuation":
      return {
        world: {
          ...world, room: "engineering", actor: openingRooms.engineering.spawn, scene: { kind: "adventure" },
          countdownMs: REPAIR_DURATION_MS,
          progress: { stage: "repair", diagnostics: false, placard: false, bypassIsolated: false, couplingFitted: false },
        },
        dialogue: { speaker: "Computer", lines: [
          "Three minutes to breach. Time pauses during dialogue, hints, menus, and when you leave this tab.",
          "The fault record and the maintenance alcove's safety warning are still available. Everyone else is safe. Please avoid a second shortcut.",
        ] },
        checkpoint: true,
      };
    case "takeover":
      return {
        world: { ...world, scene: { kind: "combat", battle: createBattle() } },
        dialogue: { speaker: "Tactical assistant", lines: [
          "Tutorial interception: keep your hull above zero. Scan the patrol first; we can disable its engines without harming its hull.",
          "Six power units are shared by shields, weapons and engines. Plus reallocates a unit; minus leaves it unused. Evade reduces incoming damage; Turn presents a fresh shield arc.",
          "Target engines, then Fire three times as weapons recharge. Once pursuit engines reach zero, order Escape. More engine power charges escape faster. Retry always restores this encounter.",
        ] },
        checkpoint: true,
      };
    case "outro":
      return { world: { ...world, progress: { stage: "complete" }, scene: { kind: "complete" } }, checkpoint: true };
    default:
      return { world };
  }
}

function objective(world: OpeningWorld): string {
  switch (world.progress.stage) {
    case "routine-maintenance": return "Complete the routine coolant check at the maintenance console.";
    case "evacuation": return "Evacuate! Or at least read the entire sign.";
    case "repair":
      if (!world.progress.diagnostics || !world.progress.placard) return "Understand the coolant fault and the safe repair procedure.";
      if (!world.progress.bypassIsolated) return "Make the damaged line safe to service.";
      if (!world.progress.couplingFitted) return "Restore a sealed coolant circuit.";
      return "Get coolant circulating again.";
    case "restore-turbolift": return "Restore a way to reach the bridge.";
    case "take-command": return "Find a way to report the repaired ship from the bridge.";
    case "tutorial-encounter":
      if (world.scene.kind !== "combat") return "Escape the interception without destroying the patrol.";
      if (!world.scene.battle.scanned) return "Scan the patrol. Keep your hull above zero.";
      if (world.scene.battle.enemyEngines > 0) return "Target engines and fire when ready; evade to protect the hull.";
      return "Order Escape. Allocate power to engines to charge faster.";
    case "complete": return "Chapter complete — the crew and patrol are safe. The Defiant has questions.";
  }
}

function hint(world: OpeningWorld): readonly string[] {
  switch (world.progress.stage) {
    case "routine-maintenance":
      return ["Your shift starts with one ordinary maintenance task.", "The console on the left has the coolant check.", "Use the maintenance console to start the story. Looking first reveals the questionable shortcut."];
    case "evacuation":
      return ["The evacuation is in progress.", "The crew is getting to safety.", "Wait for the sequence, or Skip; both begin the repair with a full countdown."];
    case "repair":
      if (!world.progress.diagnostics || !world.progress.placard) {
        return ["The fault has a cause, and someone wrote down a safe repair order.", "There is information in engineering and in its left-hand maintenance alcove.", "Look at the engineering diagnostics and the alcove placard. Use the tool rack and coupling bin with empty hands to collect supplies."];
      }
      if (!world.progress.bypassIsolated) {
        return ["Keep the damaged line out of the repair.", "The bypass has a socket for an insulated tool.", "Collect the tool from the alcove rack, select it in inventory, then Use it on the damaged bypass in engineering."];
      }
      if (!world.progress.couplingFitted) {
        return ["The pump cannot circulate coolant with a broken connector.", "The right-hand bin in the alcove has a replacement coupling.", "Use the coupling bin with empty hands to collect it. Select the coupling, then Use it on the coolant pump."];
      }
      return ["The new part is installed, but coolant still is not moving.", "The pump needs a manual restart.", "Clear the selected inventory item, select Use, and activate the coolant pump. That stops the countdown."];
    case "restore-turbolift":
      return ["The core is safe. Now restore a way upstairs.", "Emergency power is separate from the coolant controls.", "Use the auxiliary power panel at the far right of engineering."];
    case "take-command":
      return ["Someone should tell the bridge the ship is safe.", "The turbolift is reached through the corridor to the right of engineering.", "Use the corridor exit, the turbolift door, Bridge level, then the emergency command panel on the right."];
    case "tutorial-encounter":
      return ["Escape, don't destroy. Scanning identifies a nonlethal target.", "Evade or turn for protection. Target engines and fire when the weapon cooldown clears.", "Scan, target engines, fire three times about 1.8 seconds apart, then order Escape. Engine power 3 or 4 makes escape faster."];
    case "complete":
      return ["You completed the opening chapter.", "The crew and pursuing ship survived.", "Continue to chapter 2 from the chapter-complete screen."];
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateWorld(value: unknown): value is OpeningWorld {
  if (!record(value) || !record(value.progress) || !record(value.scene) || !record(value.actor)) return false;
  if (typeof value.room !== "string" || !Object.hasOwn(openingRooms, value.room)) return false;
  const room = openingRooms[value.room as keyof typeof openingRooms];
  if (typeof value.actor.x !== "number" || typeof value.actor.y !== "number"
    || !withinFloor({ x: value.actor.x, y: value.actor.y }, room.floor)) return false;
  if (!Array.isArray(value.inventory) || value.inventory.some(item => typeof item !== "string" || !Object.hasOwn(items, item))
    || new Set(value.inventory).size !== value.inventory.length) return false;
  const progress = value.progress;
  const scene = value.scene;
  if (scene.kind === "cutscene") {
    if (typeof scene.id !== "string" || !Object.hasOwn(openingSequences, scene.id)) return false;
    const frames = openingSequences[scene.id as keyof typeof openingSequences].frames;
    if (typeof scene.token !== "number" || !Number.isSafeInteger(scene.token) || scene.token < 0
      || typeof scene.frame !== "number" || !Number.isInteger(scene.frame)
      || scene.frame < 0 || scene.frame >= frames.length) return false;
    const frame = frames[scene.frame];
    if (!frame || typeof scene.elapsedMs !== "number" || !Number.isFinite(scene.elapsedMs)
      || scene.elapsedMs < 0 || scene.elapsedMs >= frame.durationMs) return false;
  } else if (scene.kind === "combat") {
    if (!isBattle(scene.battle) || scene.battle.hull <= 0 || scene.battle.charge >= 100) return false;
    if (scene.battle.engaged && scene.battle.enemyEngines !== 0) return false;
  } else if (scene.kind === "failure") {
    if (typeof scene.reason !== "string" || !scene.reason.trim()) return false;
  } else if (scene.kind !== "adventure" && scene.kind !== "complete") return false;
  if (progress.stage === "repair") {
    if (typeof value.countdownMs !== "number" || !Number.isFinite(value.countdownMs)
      || value.countdownMs < 0 || value.countdownMs > REPAIR_DURATION_MS) return false;
    if (!["diagnostics", "placard", "bypassIsolated", "couplingFitted"].every(key => typeof progress[key] === "boolean")) return false;
    if (progress.bypassIsolated && (!progress.diagnostics || !progress.placard || !value.inventory.includes("tool"))) return false;
    if (progress.couplingFitted && (!progress.bypassIsolated || value.inventory.includes("coupling"))) return false;
    return ["engineering", "alcove", "corridor"].includes(value.room)
      && ((scene.kind === "adventure" && value.countdownMs > 0) || (scene.kind === "failure" && value.countdownMs === 0));
  }
  if (value.countdownMs !== null) return false;
  switch (progress.stage) {
    case "routine-maintenance":
      return ["engineering", "alcove", "corridor"].includes(value.room)
        && (scene.kind === "adventure" || (scene.kind === "cutscene" && scene.id === "intro" && value.room === "engineering"));
    case "evacuation":
      return value.room === "engineering" && scene.kind === "cutscene" && scene.id === "evacuation";
    case "restore-turbolift":
      return ["engineering", "alcove", "corridor"].includes(value.room) && scene.kind === "adventure"
        && value.inventory.includes("tool") && !value.inventory.includes("coupling");
    case "take-command":
      return scene.kind === "adventure" && value.inventory.includes("tool") && !value.inventory.includes("coupling");
    case "tutorial-encounter":
      return value.room === "bridge" && value.inventory.includes("tool") && !value.inventory.includes("coupling")
        && (scene.kind === "combat" || scene.kind === "failure"
          || (scene.kind === "cutscene" && (scene.id === "takeover" || scene.id === "outro")));
    case "complete":
      return value.room === "bridge" && scene.kind === "complete" && value.inventory.includes("tool") && !value.inventory.includes("coupling");
    default:
      return false;
  }
}

export const openingCampaign: Campaign<OpeningProgress> = {
  id: "opening",
  rooms: openingRooms,
  items,
  sequences: openingSequences,
  initial: () => ({
    progress: { stage: "routine-maintenance" },
    room: "engineering",
    actor: { ...openingRooms.engineering.spawn },
    inventory: [],
    countdownMs: null,
    scene: { kind: "cutscene", id: "intro", token: 0, frame: 0, elapsedMs: 0 },
  }),
  interact,
  finishSequence,
  finishBattle: world => ({ world: sequence(world, "outro", { stage: "tutorial-encounter" }) }),
  objective,
  hint,
  validateWorld,
};
