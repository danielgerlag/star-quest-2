import { describe, expect, it } from "vitest";
import { openingRooms } from "../../src/content/rooms";
import { DEFAULT_COMBAT_RULES, createBattle } from "../../src/game/combat";
import type { InteractionAnimation, Room, SessionView } from "../../src/game/types";
import { drawScene, type SceneGraphics } from "../../src/presentation/art";

type Mark = { operation: string; args: unknown[]; color: number };

function render(view: SessionView<unknown>, room: Room, ambient = 2, reducedMotion = false): Mark[] {
  const marks: Mark[] = [];
  let color = 0;
  const record = (operation: string) => (...args: unknown[]) => marks.push({ operation, args, color });
  const graphics = {
    clear() { marks.length = 0; },
    fillStyle(value = 0, alpha = 1) { color = value; record("fillStyle")(value, alpha); },
    lineStyle: record("lineStyle"),
    fillRect: record("rect"),
    lineBetween: record("line"),
    fillTriangle: record("triangle"),
    fillEllipse: record("ellipse"),
    fillCircle: record("circle"),
    fillPoints: record("points"),
  } satisfies SceneGraphics;
  drawScene(graphics, view, room, ambient, reducedMotion, {
    chapter: 2, combat: DEFAULT_COMBAT_RULES,
  });
  return marks;
}

function view(animation?: InteractionAnimation, elapsedMs = 0): SessionView<unknown> {
  return {
    progress: {}, room: "bridge", actor: { x: 318, y: 290 }, inventory: [],
    countdownMs: null, scene: { kind: "adventure" }, destination: null, objective: "",
    paused: true, revision: 0,
    dialogue: { speaker: "Roger", lines: ["Working."], index: 0, elapsedMs, ...(animation ? { animation } : {}) },
  };
}

function skinInChair(marks: Mark[]): Mark[] {
  return marks.filter((mark) => mark.operation === "rect" && mark.color === 0xe4b596
    && typeof mark.args[0] === "number" && mark.args[0] >= 297 && mark.args[0] < 340
    && typeof mark.args[1] === "number" && mark.args[1] >= 166 && mark.args[1] < 227);
}

describe("dialogue interaction artwork", () => {
  it("occupies the real chair immediately, swivels there, and leaves it empty after dismissal", () => {
    const sitting = view({ kind: "sit", target: "captain-chair" });
    const original = JSON.stringify(sitting);
    const first = render(sitting, openingRooms.bridge);
    const turned = render(view(sitting.dialogue?.animation, 700), openingRooms.bridge);
    const idle = render({ ...sitting, dialogue: null }, openingRooms.bridge);
    expect(skinInChair(first).length).toBeGreaterThan(0);
    expect(skinInChair(turned).length).toBeGreaterThan(0);
    expect(skinInChair(first)).not.toEqual(skinInChair(turned));
    expect(skinInChair(idle)).toEqual([]);
    expect(JSON.stringify(sitting)).toBe(original);
    expect(render(view(), openingRooms.bridge)).toEqual(idle);
  });

  it.each([
    ["sit", "captain-chair", openingRooms.bridge],
    ["repair", "bypass", openingRooms.engineering],
    ["pickup", "tool-rack", openingRooms.alcove],
    ["operate", "console", openingRooms.engineering],
    ["talk", "console", openingRooms.engineering],
    ["inspect", "console", openingRooms.engineering],
    ["sniff", "console", openingRooms.engineering],
    ["recoil", "console", openingRooms.engineering],
  ] satisfies readonly [InteractionAnimation["kind"], string, Room][])(
    "%s has static reduced-motion feedback instead of becoming idle",
    (kind, target, room) => {
      const animation = { kind, target };
      const first = render(view(animation, 0), room, 0, true);
      const later = render(view(animation, 5000), room, 50, true);
      expect(first).toEqual(later);
      expect(first).not.toEqual(render(view(), room, 0, true));
      const skin = first.filter((mark) => mark.operation === "rect" && mark.color === 0xe4b596);
      const lefts = skin.map((mark) => Number(mark.args[0]));
      const rights = skin.map((mark) => Number(mark.args[0]) + Number(mark.args[2]));
      expect(Math.max(...rights) - Math.min(...lefts)).toBeLessThanOrEqual(48);
    },
  );

  it("uses dialogue time for work and keeps the frozen frame through an external pause", () => {
    const animation = { kind: "repair", target: "bypass" } as const;
    const first = render(view(animation, 0), openingRooms.engineering, 4);
    const later = render(view(animation, 200), openingRooms.engineering, 4);
    expect(later).not.toEqual(first);
    expect(render(view(animation, 200), openingRooms.engineering, 4)).toEqual(later);
  });

  it("does not reset ambient, walking, combat or cutscene poses when paused toggles", () => {
    const idle = { ...view(), dialogue: null, paused: false };
    const cases: SessionView<unknown>[] = [
      { ...idle, destination: { x: 460, y: 290 } },
      { ...idle, scene: { kind: "combat", battle: createBattle() } },
      { ...idle, scene: { kind: "cutscene", id: "c2-outro", frame: 2, token: 0, elapsedMs: 1200 } },
    ];
    for (const current of cases) {
      expect(render({ ...current, paused: true }, openingRooms.bridge, 3.2))
        .toEqual(render(current, openingRooms.bridge, 3.2));
    }
  });

  it("keeps the chapter-two outbound/depot shot animated", () => {
    const current: SessionView<unknown> = {
      ...view(), dialogue: null,
      scene: { kind: "cutscene", id: "c2-outro", frame: 2, token: 0, elapsedMs: 1200 },
    };
    expect(render(current, openingRooms.bridge, 2)).not.toEqual(render(current, openingRooms.bridge, 3));
  });
});
