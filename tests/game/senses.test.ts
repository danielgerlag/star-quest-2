import { describe, expect, it } from "vitest";
import { openingCampaign } from "../../src/content/opening";

describe("comic sensory actions", () => {
  for (const verb of ["smell", "taste"] as const) {
    it(`${verb} gives feedback without activating a puzzle or consuming an item`, () => {
      const initial = openingCampaign.finishSequence(openingCampaign.initial()).world;
      for (const room of Object.values(openingCampaign.rooms)) {
        const world = { ...initial, room: room.id, actor: room.spawn, inventory: ["tool"] };
        for (const hotspot of room.hotspots) {
          const result = openingCampaign.interact(world, { type: "interact", verb, target: hotspot.id });
          expect(result.world).toEqual(world);
          expect(result.dialogue?.lines.length).toBeGreaterThan(0);
        }
      }
    });
  }
});
