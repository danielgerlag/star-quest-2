import { describe, expect, it } from "vitest";
import { openingCampaign } from "../src/content/opening";
import { withinFloor } from "../src/game/navigation";
import { createSession } from "../src/game/session";
import type { World } from "../src/game/types";
import type { OpeningProgress } from "../src/content/opening";
import { act, clearDialogue, finishRepair, reachTakeover, skip, startRepair, winBattle } from "./game/helpers";

describe("opening content catalog", () => {
  it("contains only the five first-release rooms and two mandatory items", () => {
    expect(Object.keys(openingCampaign.rooms).sort()).toEqual(["alcove", "bridge", "corridor", "engineering", "turbolift"]);
    expect(Object.keys(openingCampaign.items).sort()).toEqual(["coupling", "tool"]);
    expect(Object.keys(openingCampaign.sequences).sort()).toEqual(["evacuation", "intro", "outro", "takeover"]);
    expect(openingCampaign.validateWorld(openingCampaign.initial())).toBe(true);
  });

  it("has consistent catalog IDs, known art references and readable sequence frames", () => {
    for (const [key, room] of Object.entries(openingCampaign.rooms)) {
      expect(room.id).toBe(key);
      expect(room.art).toBe(key);
      expect(room.floor).toEqual({ x: 30, y: 238, width: 580, height: 95 });
      expect(room.spawn).toEqual({ x: 320, y: 312 });
      expect(withinFloor(room.spawn, room.floor)).toBe(true);
      expect(new Set(room.hotspots.map(hotspot => hotspot.id)).size).toBe(room.hotspots.length);
      for (const hotspot of room.hotspots) {
        expect(hotspot.name.length).toBeGreaterThan(0);
        expect(withinFloor(hotspot.approach, room.floor)).toBe(true);
        expect(hotspot.bounds.x).toBeGreaterThanOrEqual(0);
        expect(hotspot.bounds.y).toBeGreaterThanOrEqual(0);
        expect(hotspot.bounds.x + hotspot.bounds.width).toBeLessThanOrEqual(640);
        expect(hotspot.bounds.y + hotspot.bounds.height).toBeLessThanOrEqual(360);
      }
    }
    for (const [key, item] of Object.entries(openingCampaign.items)) {
      expect(item.id).toBe(key);
      expect(item.description.length).toBeGreaterThan(20);
    }
    for (const [key, sequence] of Object.entries(openingCampaign.sequences)) {
      expect(sequence.id).toBe(key);
      expect(sequence.frames.length).toBeGreaterThanOrEqual(3);
      for (const frame of sequence.frames) {
        expect(openingCampaign.rooms).toHaveProperty(frame.art);
        expect(frame.speaker.length).toBeGreaterThan(0);
        expect(frame.text.length).toBeGreaterThan(10);
        expect(frame.durationMs).toBeGreaterThanOrEqual(3000);
      }
    }
  });

  it("matches every required hotspot to the shared room artwork", () => {
    const expected: Record<string, Record<string, readonly [number, number, number, number]>> = {
      engineering: {
        console: [36, 155, 116, 78], diagnostics: [248, 75, 144, 38], bypass: [398, 160, 66, 75],
        pump: [467, 167, 65, 64], auxiliary: [548, 140, 63, 85],
        "alcove-exit": [0, 175, 30, 120], "corridor-exit": [610, 170, 30, 125],
      },
      alcove: {
        "tool-rack": [70, 130, 125, 95], "coupling-bin": [420, 140, 140, 75],
        placard: [248, 95, 120, 76], "engineering-exit": [610, 175, 30, 120],
      },
      corridor: {
        "engineering-exit": [0, 175, 30, 120], "turbolift-exit": [280, 110, 100, 145], intercom: [460, 145, 60, 80],
      },
      turbolift: { "bridge-exit": [280, 100, 100, 150], "corridor-exit": [0, 175, 30, 120] },
      bridge: {
        command: [400, 180, 150, 65], "captain-chair": [280, 155, 75, 80], "turbolift-exit": [0, 175, 30, 120],
      },
    };
    for (const [roomId, hotspots] of Object.entries(expected)) {
      const room = openingCampaign.rooms[roomId]!;
      for (const [id, [x, y, width, height]] of Object.entries(hotspots)) {
        expect(room.hotspots.find(hotspot => hotspot.id === id)?.bounds).toEqual({ x, y, width, height });
      }
    }
  });

  it("ensures every authored exit reaches an existing room with a legal actor position", () => {
    const before = startRepair();
    finishRepair(before);
    act(before, "auxiliary");
    const base = before.capture().world;
    for (const room of Object.values(openingCampaign.rooms)) {
      for (const hotspot of room.hotspots.filter(hotspot => hotspot.id.endsWith("-exit"))) {
        const world = { ...base, room: room.id, actor: room.spawn };
        const result = openingCampaign.interact(world, { type: "interact", verb: "use", target: hotspot.id });
        expect(result.world.room).not.toBe(room.id);
        expect(openingCampaign.validateWorld(result.world)).toBe(true);
      }
    }
  });

  it("has a visible look, talk and wrong-item response for every room hotspot", () => {
    const base: World<OpeningProgress> = {
      ...openingCampaign.initial(), scene: { kind: "adventure" }, progress: { stage: "take-command" }, inventory: ["tool"],
    };
    for (const room of Object.values(openingCampaign.rooms)) {
      for (const hotspot of room.hotspots) {
        const world = { ...base, room: room.id, actor: room.spawn };
        for (const verb of ["look", "talk", "use"] as const) {
          const response = openingCampaign.interact(world, {
            type: "interact", verb, target: hotspot.id, ...(verb === "use" ? { item: "tool" } : {}),
          });
          expect(response.dialogue?.lines.length, `${room.id}:${verb}:${hotspot.id}`).toBeGreaterThan(0);
          expect(response.world.inventory).toEqual(["tool"]);
        }
      }
    }
  });

  it("keeps every intended-path transition and its retry checkpoint valid and supplies three hints", () => {
    const session = createSession(openingCampaign);
    const validate = (): void => {
      const saved = session.capture();
      expect(openingCampaign.validateWorld(saved.world)).toBe(true);
      expect(openingCampaign.validateWorld(saved.checkpoint)).toBe(true);
      expect(openingCampaign.hint(saved.world)).toHaveLength(3);
      expect(openingCampaign.objective(saved.world).length).toBeGreaterThan(0);
    };
    validate();
    skip(session);
    validate();
    act(session, "console");
    validate();
    skip(session);
    clearDialogue(session);
    validate();
    const path: readonly [string, "look" | "use", string?][] = [
      ["diagnostics", "look"], ["alcove-exit", "use"], ["placard", "look"],
      ["tool-rack", "use"], ["coupling-bin", "use"], ["engineering-exit", "use"],
      ["bypass", "use", "tool"], ["pump", "use", "coupling"], ["pump", "use"],
      ["auxiliary", "use"], ["corridor-exit", "use"], ["turbolift-exit", "use"], ["bridge-exit", "use"], ["command", "use"],
    ];
    for (const [target, verb, item] of path) {
      act(session, target, verb, item);
      validate();
    }
    skip(session);
    clearDialogue(session);
    validate();
    winBattle(session);
    validate();
    skip(session);
    validate();
    expect(session.view().scene.kind).toBe("complete");
  });

  it("watching versus skipping takeover and outro produces equivalent rewards", () => {
    const skipped = reachTakeover();
    const watched = createSession(openingCampaign, skipped.capture());
    skip(skipped);
    watched.advance(100_000);
    expect(watched.capture()).toEqual(skipped.capture());
    clearDialogue(skipped);
    clearDialogue(watched);
    winBattle(skipped);
    winBattle(watched);
    skip(skipped);
    watched.advance(100_000);
    expect(watched.capture()).toEqual(skipped.capture());
    expect(watched.view().progress.stage).toBe("complete");
  });
});
