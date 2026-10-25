import { applyOrder, COMBAT_STEP_MS, isBattle, stepBattle } from "./combat";
import { clampToFloor, moveToward, WALK_SPEED, withinFloor } from "./navigation";
import type {
  Campaign, Command, Dialogue, InteractionAnimation, Point, ResumePoint, RuleResult, Session, World,
} from "./types";

let sequenceGeneration = 0;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateWorld<P>(value: unknown, campaign: Campaign<P>, label: string): asserts value is World<P> {
  const fail = (message: string): never => { throw new Error(`Invalid ${label}: ${message}`); };
  if (!record(value)) return fail("expected a world object.");
  if (Object.hasOwn(value, "checkpoint")) fail("checkpoints must be nonrecursive world snapshots.");
  if (typeof value.room !== "string" || !Object.hasOwn(campaign.rooms, value.room)) fail("unknown room reference.");
  const room = campaign.rooms[String(value.room)];
  if (!room || !record(value.actor) || !finite(value.actor.x) || !finite(value.actor.y)
    || !withinFloor({ x: value.actor.x, y: value.actor.y }, room.floor)) fail("actor must be inside the room's walkable floor.");
  if (!Array.isArray(value.inventory)) return fail("inventory must be an array of known items.");
  if (value.inventory.some(item => typeof item !== "string" || !Object.hasOwn(campaign.items, item))) fail("inventory contains an unknown item.");
  if (new Set(value.inventory).size !== value.inventory.length) fail("inventory contains duplicate items.");
  if (value.countdownMs !== null && (!finite(value.countdownMs) || value.countdownMs < 0)) fail("countdown must be null or a finite nonnegative number.");
  if (!record(value.scene)) return fail("missing scene state.");
  const scene = value.scene;
  switch (scene.kind) {
    case "adventure":
    case "complete":
      break;
    case "failure":
      if (typeof scene.reason !== "string" || !scene.reason.trim()) fail("failure requires a reason.");
      break;
    case "combat":
      if (!isBattle(scene.battle) || scene.battle.hull <= 0 || scene.battle.charge >= 100) fail("invalid active battle state or power budget.");
      break;
    case "cutscene": {
      if (typeof scene.id !== "string" || !Object.hasOwn(campaign.sequences, scene.id)) fail("unknown cutscene reference.");
      const sequence = campaign.sequences[String(scene.id)];
      if (!finite(scene.frame)) return fail("invalid cutscene frame.");
      if (!sequence || !Number.isInteger(scene.frame)
        || scene.frame < 0 || scene.frame >= sequence.frames.length) fail("invalid cutscene frame.");
      const frame = sequence?.frames[scene.frame];
      if (!frame || !finite(scene.elapsedMs) || scene.elapsedMs < 0 || scene.elapsedMs >= frame.durationMs) fail("invalid cutscene elapsed time.");
      if (!finite(scene.token) || !Number.isSafeInteger(scene.token) || scene.token < 0) fail("invalid cutscene callback token.");
      break;
    }
    default:
      fail("unknown scene kind.");
  }
  let valid = false;
  try {
    valid = campaign.validateWorld(value);
  } catch {
    fail("campaign progress validation failed.");
  }
  if (!valid) fail("campaign progress or scene is inconsistent.");
}

function freshScene<P>(world: World<P>): World<P> {
  if (world.scene.kind !== "cutscene") return world;
  sequenceGeneration++;
  if (sequenceGeneration === world.scene.token) sequenceGeneration++;
  return {
    ...world,
    scene: { ...world.scene, token: sequenceGeneration, frame: 0, elapsedMs: 0 },
  };
}

export function createSession<P>(campaign: Campaign<P>, resume?: unknown): Session<P> {
  let initial: World<P>;
  let checkpoint: World<P>;
  if (resume !== undefined) {
    if (!record(resume)) throw new Error("Invalid resume: expected world and checkpoint snapshots.");
    validateWorld(resume.world, campaign, "resume.world");
    validateWorld(resume.checkpoint, campaign, "resume.checkpoint");
    if (resume.checkpoint.scene.kind === "failure") throw new Error("Invalid resume.checkpoint: a failure cannot be a retry checkpoint.");
    try {
      initial = clone(resume.world);
      checkpoint = clone(resume.checkpoint);
    } catch {
      throw new Error("Invalid resume: snapshots must contain cloneable data, not callbacks or runtime objects.");
    }
  } else {
    initial = clone(campaign.initial());
    validateWorld(initial, campaign, "campaign initial state");
    checkpoint = clone(initial);
  }
  let world = freshScene(initial);
  let sceneStart = clone(world);
  let destination: Point | null = null;
  let pending: Extract<Command, { type: "interact" }> | null = null;
  let dialogue: Dialogue | null = null;
  let revision = 0;
  let combatRemainderMs = 0;
  const pauses = new Set<symbol>();
  const hints = new Map<string, number>();

  function paused(): boolean {
    return dialogue !== null || pauses.size > 0;
  }

  function stopWalking(): void {
    destination = null;
    pending = null;
  }

  function speak(speaker: string, lines: readonly string[], animation?: InteractionAnimation): void {
    if (lines.length === 0) return;
    stopWalking();
    dialogue = { speaker, lines: [...lines], index: 0, elapsedMs: 0, ...(animation ? { animation } : {}) };
    revision++;
  }

  function apply(result: RuleResult<P>): void {
    const previousScene = world.scene;
    const previousRoom = world.room;
    const nextWorld = clone(result.world);
    const enteringScene = nextWorld.scene.kind !== previousScene.kind
      || (nextWorld.scene.kind === "cutscene"
        && (previousScene.kind !== "cutscene" || previousScene.id !== nextWorld.scene.id || previousScene.token !== nextWorld.scene.token));
    const changed = JSON.stringify(nextWorld) !== JSON.stringify(world);
    world = enteringScene ? freshScene(nextWorld) : nextWorld;
    if (enteringScene) {
      sceneStart = clone(world);
      combatRemainderMs = 0;
      stopWalking();
      dialogue = null;
    }
    if (result.checkpoint) checkpoint = clone(world);
    if (changed || result.checkpoint) revision++;
    if (previousRoom !== world.room) dialogue = null;
    if (result.dialogue) speak(result.dialogue.speaker, result.dialogue.lines,
      world.scene.kind === "adventure" && previousRoom === world.room ? result.dialogue.animation : undefined);
  }

  function fail(reason: string): void {
    stopWalking();
    dialogue = null;
    combatRemainderMs = 0;
    world = { ...world, scene: { kind: "failure", reason } };
    revision++;
  }

  function finishCutscene(token: number): void {
    if (world.scene.kind !== "cutscene" || token !== world.scene.token) return;
    apply(campaign.finishSequence(clone(world)));
  }

  function arrive(): void {
    const action = pending;
    stopWalking();
    revision++;
    if (!action || world.scene.kind !== "adventure" || paused()) return;
    const hotspot = campaign.rooms[world.room]?.hotspots.find(target => target.id === action.target);
    if (!hotspot || !withinFloor(hotspot.approach, campaign.rooms[world.room]!.floor)
      || Math.hypot(world.actor.x - hotspot.approach.x, world.actor.y - hotspot.approach.y) > 0.01) {
      speak("Computer", ["That object is no longer within reach."]);
      return;
    }
    if (action.item && !world.inventory.includes(action.item)) {
      speak("Computer", ["That item is no longer in your inventory."]);
      return;
    }
    apply(campaign.interact(clone(world), clone(action)));
  }

  function advanceCutscene(elapsedMs: number): void {
    if (world.scene.kind !== "cutscene") return;
    const scene = world.scene;
    const sequence = campaign.sequences[scene.id];
    if (!sequence) return;
    let frame = scene.frame;
    let elapsed = scene.elapsedMs + elapsedMs;
    while (frame < sequence.frames.length) {
      const duration = sequence.frames[frame]?.durationMs ?? 0;
      if (elapsed < duration) break;
      elapsed -= duration;
      frame++;
    }
    if (frame >= sequence.frames.length) {
      finishCutscene(scene.token);
    } else {
      world = { ...world, scene: { ...scene, frame, elapsedMs: elapsed } };
    }
  }

  function advanceCombat(elapsedMs: number): void {
    combatRemainderMs += elapsedMs;
    while (combatRemainderMs >= COMBAT_STEP_MS && world.scene.kind === "combat") {
      combatRemainderMs -= COMBAT_STEP_MS;
      const before = world.scene.battle;
      const battle = stepBattle(before, COMBAT_STEP_MS, campaign.combatRules?.(world));
      world = { ...world, scene: { kind: "combat", battle } };
      if (before.enemyAttackMs > 0 && before.enemyAttackMs <= COMBAT_STEP_MS) revision++;
      if (battle.hull <= 0) {
        fail("Hull integrity lost. Emergency transport saved you, but not the mission. Retry restores this encounter with full shields and hull.");
        return;
      }
      if (battle.charge >= 100) {
        apply(campaign.finishBattle(clone(world)));
        return;
      }
    }
  }

  function dispatch(command: Command): void {
    switch (command.type) {
      case "dialogue-next":
        if (dialogue) {
          dialogue = dialogue.index + 1 < dialogue.lines.length ? { ...dialogue, index: dialogue.index + 1 } : null;
          revision++;
        }
        return;
      case "finish-cutscene":
        finishCutscene(command.token);
        return;
      case "retry":
        if (world.scene.kind !== "failure") return;
        world = freshScene(clone(checkpoint));
        sceneStart = clone(world);
        stopWalking();
        dialogue = null;
        combatRemainderMs = 0;
        hints.clear();
        revision++;
        return;
      case "continue-chapter":
        if (world.scene.kind === "complete" && !paused() && campaign.continueChapter) {
          apply(campaign.continueChapter(clone(world)));
        }
        return;
      case "hint": {
        if (dialogue || (world.scene.kind !== "adventure" && world.scene.kind !== "combat")) return;
        const hintKey = `${campaign.objective(clone(world))}:${JSON.stringify(world.progress)}`;
        const lines = campaign.hint(clone(world));
        if (lines.length === 0) return;
        const index = Math.min(hints.get(hintKey) ?? 0, lines.length - 1);
        hints.set(hintKey, index + 1);
        speak("Hint", [lines[index]!]);
        return;
      }
      case "walk":
        if (world.scene.kind !== "adventure" || paused()) return;
        if (!Number.isFinite(command.destination.x) || !Number.isFinite(command.destination.y)) {
          speak("Computer", ["That destination is not reachable."]);
          return;
        }
        stopWalking();
        destination = clampToFloor(command.destination, campaign.rooms[world.room]!.floor);
        revision++;
        if (world.actor.x === destination.x && world.actor.y === destination.y) arrive();
        return;
      case "interact": {
        if (world.scene.kind !== "adventure" || paused()) return;
        stopWalking();
        const room = campaign.rooms[world.room]!;
        const hotspot = room.hotspots.find(target => target.id === command.target);
        if (!hotspot) {
          speak("Computer", ["That object is not in this room."]);
          return;
        }
        if (!withinFloor(hotspot.approach, room.floor)) {
          speak("Computer", ["That object cannot be reached from the walkable floor."]);
          return;
        }
        if (command.item && !world.inventory.includes(command.item)) {
          speak("Computer", ["You do not have that item."]);
          return;
        }
        pending = clone(command);
        destination = { ...hotspot.approach };
        revision++;
        if (world.actor.x === destination.x && world.actor.y === destination.y) arrive();
        return;
      }
      case "order": {
        if (world.scene.kind !== "combat" || paused()) return;
        const before = world.scene.battle;
        const battle = applyOrder(before, command.order, campaign.combatRules?.(world));
        if (JSON.stringify(before) !== JSON.stringify(battle)) {
          world = { ...world, scene: { kind: "combat", battle } };
          revision++;
        }
        return;
      }
    }
  }

  function advance(elapsedMs: number): void {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error("Invalid elapsed time: expected finite nonnegative milliseconds.");
    if (elapsedMs === 0 || pauses.size > 0) return;
    if (dialogue) {
      dialogue = { ...dialogue, elapsedMs: dialogue.elapsedMs + elapsedMs };
      return;
    }
    if (world.scene.kind === "cutscene") {
      advanceCutscene(elapsedMs);
      return;
    }
    if (world.scene.kind === "combat") {
      advanceCombat(elapsedMs);
      return;
    }
    if (world.scene.kind !== "adventure") return;
    const travelMs = destination
      ? Math.hypot(destination.x - world.actor.x, destination.y - world.actor.y) / WALK_SPEED * 1000
      : Number.POSITIVE_INFINITY;
    const activeMs = Math.min(elapsedMs, travelMs, world.countdownMs ?? Number.POSITIVE_INFINITY);
    world = {
      ...world,
      actor: destination ? moveToward(world.actor, destination, activeMs) : world.actor,
      countdownMs: world.countdownMs === null ? null : Math.max(0, world.countdownMs - activeMs),
    };
    if (world.countdownMs === 0) {
      fail("Countdown expired. Emergency transport saves the operator, but not the performance review. Retry from the last checkpoint.");
      return;
    }
    if (destination && activeMs >= travelMs) {
      arrive();
      const remaining = elapsedMs - activeMs;
      if (remaining > 0 && world.scene.kind === "adventure") advance(remaining);
    }
  }

  function capture(): ResumePoint<P> {
    if (destination || pending) {
      stopWalking();
      revision++;
    }
    return clone({
      world: world.scene.kind === "cutscene" || world.scene.kind === "combat" ? sceneStart : world,
      checkpoint,
    });
  }

  return {
    view: () => clone({
      ...world,
      dialogue,
      destination,
      objective: campaign.objective(clone(world)),
      paused: paused(),
      revision,
    }),
    dispatch,
    advance,
    pause: () => {
      const token = Symbol("pause");
      pauses.add(token);
      revision++;
      return () => {
        if (pauses.delete(token)) revision++;
      };
    },
    capture,
  };
}
