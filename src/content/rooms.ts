import type { Hotspot, Room } from "../game/types";

export const floor = { x: 30, y: 238, width: 580, height: 95 };
export const spawn = { x: 320, y: 312 };

export function hotspot(id: string, name: string, x: number, y: number, width: number, height: number, approachX: number): Hotspot {
  return { id, name, bounds: { x, y, width, height }, approach: { x: approachX, y: 290 } };
}

export const openingRooms = {
  engineering: {
    id: "engineering", name: "Main Engineering", art: "engineering",
    caption: "Warp power. Coolant pressure. An ensign with a shortcut.",
    floor, spawn,
    hotspots: [
      hotspot("console", "Maintenance console", 36, 155, 116, 78, 95),
      hotspot("diagnostics", "Diagnostic display", 248, 75, 144, 38, 320),
      hotspot("bypass", "Damaged bypass", 398, 160, 66, 75, 430),
      hotspot("pump", "Coolant pump", 467, 167, 65, 64, 498),
      hotspot("auxiliary", "Auxiliary power", 548, 140, 63, 85, 574),
      hotspot("alcove-exit", "Maintenance alcove", 0, 175, 30, 120, 35),
      hotspot("corridor-exit", "Evacuation corridor", 610, 170, 30, 125, 605),
    ],
  },
  alcove: {
    id: "alcove", name: "Maintenance Alcove", art: "alcove",
    caption: "Everything you need, filed under miscellaneous.",
    floor, spawn,
    hotspots: [
      hotspot("tool-rack", "Insulated tool", 70, 130, 125, 95, 132),
      hotspot("coupling-bin", "Replacement coupling", 420, 140, 140, 75, 490),
      hotspot("placard", "Safety placard", 248, 95, 120, 76, 308),
      hotspot("engineering-exit", "Main engineering", 610, 175, 30, 120, 605),
    ],
  },
  corridor: {
    id: "corridor", name: "Evacuation Corridor", art: "corridor",
    caption: "All crew accounted for. Roger is under Other.",
    floor, spawn,
    hotspots: [
      hotspot("engineering-exit", "Main engineering", 0, 175, 30, 120, 35),
      hotspot("turbolift-exit", "Turbolift", 280, 110, 100, 145, 330),
      hotspot("intercom", "Emergency intercom", 460, 145, 60, 80, 490),
    ],
  },
  turbolift: {
    id: "turbolift", name: "Turbolift", art: "turbolift",
    caption: "Express service. The queue evacuated.",
    floor, spawn,
    hotspots: [
      hotspot("bridge-exit", "Bridge level", 280, 100, 100, 150, 330),
      hotspot("corridor-exit", "Engineering level", 0, 175, 30, 120, 35),
    ],
  },
  bridge: {
    id: "bridge", name: "Main Bridge", art: "bridge",
    caption: "Deck 1 / looking aft from the main viewscreen.",
    floor, spawn,
    hotspots: [
      hotspot("command", "Emergency command", 400, 180, 150, 65, 475),
      hotspot("captain-chair", "Captain's chair", 280, 155, 75, 80, 318),
      hotspot("turbolift-exit", "Turbolift", 0, 175, 30, 120, 35),
    ],
  },
} as const satisfies Record<string, Room>;
