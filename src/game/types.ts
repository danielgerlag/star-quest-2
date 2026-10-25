export type Point = Readonly<{ x: number; y: number }>;
export type Bounds = Readonly<{ x: number; y: number; width: number; height: number }>;
export type Verb = "walk" | "look" | "use" | "talk" | "smell" | "taste";
export type PauseReason = "menu" | "blur" | "loading";

export interface Hotspot {
  readonly id: string;
  readonly name: string;
  readonly bounds: Bounds;
  readonly approach: Point;
}

export interface Room {
  readonly id: string;
  readonly name: string;
  readonly caption: string;
  readonly art: string;
  readonly floor: Bounds;
  readonly spawn: Point;
  readonly hotspots: readonly Hotspot[];
}

export interface Item {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly color: number;
}

export interface InteractionAnimation {
  readonly kind: "sit" | "repair" | "pickup" | "operate" | "talk" | "inspect" | "sniff" | "recoil";
  readonly target: string;
}

export interface DialogueContent {
  readonly speaker: string;
  readonly lines: readonly string[];
  readonly animation?: InteractionAnimation;
}

export interface Dialogue extends DialogueContent {
  readonly index: number;
  readonly elapsedMs: number;
}

export interface Sequence {
  readonly id: string;
  readonly title: string;
  readonly frames: readonly {
    readonly art: string;
    readonly speaker: string;
    readonly text: string;
    readonly durationMs: number;
  }[];
}

export type PowerSystem = "shields" | "weapons" | "engines";
export type ShieldArc = "forward" | "aft" | "port" | "starboard";
export type Maneuver = "hold" | "evade" | "turn";
export interface CombatRules {
  readonly name: string;
  readonly action: string;
  readonly source: "ship" | "hazard";
  readonly targetNames: Readonly<Record<"engines" | "weapons", string>>;
  readonly requiredTarget: "engines" | "weapons" | null;
  readonly requiredManeuver: "hold" | "evade" | null;
  readonly minimumPower: Readonly<Record<PowerSystem, number>>;
  readonly chargeSystem: PowerSystem;
  readonly chargeDurationMs: number;
  readonly attackIntervalMs: number;
  readonly attackDamage: number;
  readonly escapeAlternative?: "disabled-engines";
}

export type TacticalOrder =
  | { type: "power"; system: PowerSystem; delta: -1 | 1 }
  | { type: "target"; target: "engines" | "weapons" }
  | { type: "maneuver"; maneuver: Maneuver }
  | { type: "scan" }
  | { type: "fire" }
  | { type: "engage" };

export interface Battle {
  readonly hull: number;
  readonly enemyHull: number;
  readonly enemyEngines: number;
  readonly enemyWeapons: number;
  readonly power: Readonly<Record<PowerSystem, number>>;
  readonly shields: Readonly<Record<ShieldArc, number>>;
  readonly exposedArc: ShieldArc;
  readonly maneuver: Maneuver;
  readonly target: "engines" | "weapons";
  readonly scanned: boolean;
  readonly cooldownMs: number;
  readonly enemyAttackMs: number;
  readonly charge: number;
  readonly engaged: boolean;
  readonly log: string;
}

export type SceneState =
  | { readonly kind: "adventure" }
  | { readonly kind: "cutscene"; readonly id: string; readonly token: number; readonly frame: number; readonly elapsedMs: number }
  | { readonly kind: "combat"; readonly battle: Battle }
  | { readonly kind: "failure"; readonly reason: string }
  | { readonly kind: "complete" };

export interface World<P> {
  readonly progress: P;
  readonly room: string;
  readonly actor: Point;
  readonly inventory: readonly string[];
  readonly countdownMs: number | null;
  readonly scene: SceneState;
}

export interface ResumePoint<P> {
  readonly world: World<P>;
  readonly checkpoint: World<P>;
}

export interface SessionView<P> extends World<P> {
  readonly dialogue: Dialogue | null;
  readonly destination: Point | null;
  readonly objective: string;
  readonly paused: boolean;
  readonly revision: number;
}

export type Command =
  | { type: "walk"; destination: Point }
  | { type: "interact"; verb: Exclude<Verb, "walk">; target: string; item?: string }
  | { type: "dialogue-next" }
  | { type: "finish-cutscene"; token: number }
  | { type: "order"; order: TacticalOrder }
  | { type: "continue-chapter" }
  | { type: "retry" }
  | { type: "hint" };

export interface RuleResult<P> {
  readonly world: World<P>;
  readonly dialogue?: DialogueContent;
  readonly checkpoint?: boolean;
}

export interface Campaign<P> {
  readonly id: string;
  readonly rooms: Readonly<Record<string, Room>>;
  readonly items: Readonly<Record<string, Item>>;
  readonly sequences: Readonly<Record<string, Sequence>>;
  initial(): World<P>;
  interact(world: World<P>, action: Extract<Command, { type: "interact" }>): RuleResult<P>;
  finishSequence(world: World<P>): RuleResult<P>;
  finishBattle(world: World<P>): RuleResult<P>;
  continueChapter?(world: World<P>): RuleResult<P>;
  combatRules?(world: World<P>): CombatRules;
  objective(world: World<P>): string;
  hint(world: World<P>): readonly string[];
  validateWorld(value: unknown): value is World<P>;
}

export interface Session<P> {
  view(): SessionView<P>;
  dispatch(command: Command): void;
  advance(elapsedMs: number): void;
  pause(reason: PauseReason): () => void;
  capture(): ResumePoint<P>;
}
