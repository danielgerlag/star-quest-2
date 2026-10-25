import type { Sequence } from "../game/types";

export const openingSequences = {
  intro: {
    id: "intro", title: "An Entirely Routine Maintenance Job",
    frames: [
      { art: "engineering", speaker: "Computer", text: "Enterprise-D. Engineering. Ensign Roger Wilco's first unsupervised shift. This is not a recommendation.", durationMs: 4600 },
      { art: "engineering", speaker: "Roger", text: "A 900-page maintenance form? Surely the console has a button for people with other plans.", durationMs: 4000 },
      { art: "engineering", speaker: "Computer", text: "Look at objects for clues. Use the maintenance console to complete your routine coolant check. The word routine is doing substantial work.", durationMs: 5000 },
    ],
  },
  evacuation: {
    id: "evacuation", title: "Please Remain Calm, Elsewhere",
    frames: [
      { art: "engineering", speaker: "Computer", text: "Safety interlock bypassed. Warp-core breach imminent. Shortcut saved: eleven seconds.", durationMs: 4100 },
      { art: "corridor", speaker: "Crew", text: "All hands evacuating. Every escape pod has launched safely! Wilco, stop waiting for your queue number!", durationMs: 4700 },
      { art: "engineering", speaker: "Roger", text: "The sign said remain at your station. For once I followed a sign. I'd like that recorded.", durationMs: 4500 },
      { art: "engineering", speaker: "Computer", text: "Crew confirmed safe. One ensign remains aboard. Inspect diagnostics and the alcove safety placard. Repair supplies are still available.", durationMs: 5100 },
    ],
  },
  takeover: {
    id: "takeover", title: "Acting Captain, Technically",
    frames: [
      { art: "bridge", speaker: "Computer", text: "Emergency command passes to the only remaining crew member. Standards have been temporarily suspended.", durationMs: 4700 },
      { art: "bridge", speaker: "Roger", text: "I just want to report the repair. 'Confirm departure'? That probably means departure of the problem.", durationMs: 4600 },
      { art: "bridge", speaker: "Computer", text: "Departure confirmed. Hazardous-vessel alert transmitted. Communications damaged. A Federation patrol is moving to intercept.", durationMs: 5000 },
      { art: "bridge", speaker: "Roger", text: "Right. Nobody gets hurt. Disable their pursuit engines, then leave before they ask to see my qualifications.", durationMs: 4400 },
    ],
  },
  outro: {
    id: "outro", title: "An Acceptable Amount of Escaping",
    frames: [
      { art: "bridge", speaker: "Computer", text: "Escape successful. Patrol hull intact, crew unharmed. Your incident report now requires a table of contents.", durationMs: 4700 },
      { art: "bridge", speaker: "Roger", text: "We saved the Enterprise, and nobody exploded. I'm calling that a very selective success.", durationMs: 4300 },
      { art: "bridge", speaker: "Federation relay", text: "Hazardous-vessel alert received by the Defiant. Please stand by for a considerably less patient inspection.", durationMs: 5000 },
    ],
  },
} as const satisfies Record<string, Sequence>;
