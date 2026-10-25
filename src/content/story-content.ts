import { DEFAULT_COMBAT_RULES } from "../game/combat";
import type { CombatRules, Item, Room, Sequence } from "../game/types";
import { floor, hotspot, spawn } from "./rooms";

export const laterItems = {
  "nav-chip": { id: "nav-chip", name: "Navigation chip", color: 0xd9b773, description: "The captain's offline contingency chart, stored on a copper-edged chip. Harlow depot is marked outside the quarantine cordon." },
  probe: { id: "probe", name: "Survey probe", color: 0x91adc3, description: "A portable transmitter with an empty beacon memory and its own flight computer. A small cradle connector runs along its underside." },
  decoy: { id: "decoy", name: "Hazard decoy", color: 0xed7285, description: "The probe now repeats the Enterprise's hazard packet. Its telemetry is indistinguishable from Roger's working day." },
  "service-form": { id: "service-form", name: "Service request", color: 0xe0d2b8, description: "A blue emergency-service request with fields for vessel registry and fault category. There is no field for mitigating embarrassment." },
  voucher: { id: "voucher", name: "Parts voucher", color: 0xb3a5cf, description: "Authorizes one communications transceiver from the workshop parts locker. Not redeemable for snacks." },
  transceiver: { id: "transceiver", name: "Communications transceiver", color: 0x66b6fa, description: "A replacement communications unit with blue contacts. Its service label warns that swapping radios disconnects the recorder's volatile memory supply." },
  "flight-log": { id: "flight-log", name: "Unedited flight log", color: 0x55dcc5, description: "The complete record: Roger bypassed the interlock. The crew survived; a purge was queued. The original recorder signature and navigation timestamps are intact." },
  "logic-module": { id: "logic-module", name: "Emergency logic module", color: 0xb3a5cf, description: "A clean EC-7 controller module. Its pin pattern and retaining clips are distinctive; its checksum is blessedly ordinary." },
  inverter: { id: "inverter", name: "Deflector inverter", color: 0x66b6fa, description: "A keyed expansion unit marked with opposed arrows. It reverses an emergency deflector feed's polarity." },
  "containment-plan": { id: "containment-plan", name: "Fleet containment plan", color: 0xe7a36d, description: "The Defiant's timing and field geometry. It assumes a safe original interlock and a feed directed away from the depot." },
} as const satisfies Record<string, Item>;

export const laterRooms = {
  "ready-room": {
    id: "ready-room", name: "Captain's Ready Room", art: "ready-room",
    caption: "Deck 1 / temporary authority, permanent paperwork.", floor, spawn,
    hotspots: [
      hotspot("alert-log", "Hazard alert log", 76, 88, 117, 79, 135),
      hotspot("desk-drawer", "Captain's desk drawer", 274, 177, 146, 61, 335),
      hotspot("fish-tank", "Aquarium", 478, 110, 95, 110, 524),
      hotspot("command-bridge-exit", "Bridge", 0, 175, 30, 120, 35),
    ],
  },
  "command-bridge": {
    id: "command-bridge", name: "Navigation Bridge", art: "bridge",
    caption: "Deck 1 / looking aft from the main viewscreen.", floor, spawn,
    hotspots: [
      hotspot("nav-console", "Navigation console", 84, 188, 140, 60, 154),
      hotspot("route-display", "Patrol route display", 400, 180, 150, 65, 475),
      hotspot("ready-room-exit", "Ready room", 0, 175, 30, 120, 35),
      hotspot("shuttlebay-exit", "Shuttlebay turbolift", 573, 182, 25, 27, 583),
    ],
  },
  shuttlebay: {
    id: "shuttlebay", name: "Main Shuttlebay", art: "shuttlebay",
    caption: "Deck 4 / the large doors are not a shortcut.", floor, spawn,
    hotspots: [
      hotspot("probe-rack", "Survey probe rack", 74, 135, 113, 97, 130),
      hotspot("probe-bench", "Probe programming bench", 262, 169, 146, 66, 332),
      hotspot("launch-tube", "Probe launch tube", 487, 112, 94, 122, 530),
      hotspot("command-bridge-exit", "Bridge", 0, 175, 30, 120, 35),
    ],
  },
  depot: {
    id: "depot", name: "Depot Reception", art: "depot",
    caption: "Harlow repair depot / emergencies require the blue form.", floor, spawn,
    hotspots: [
      hotspot("dock-manifest", "Dock manifest", 66, 84, 118, 78, 126),
      hotspot("form-printer", "Service form printer", 212, 160, 79, 74, 250),
      hotspot("clerk", "Depot clerk", 320, 135, 107, 99, 370),
      hotspot("undock", "Undocking control", 485, 147, 88, 86, 528),
      hotspot("workshop-exit", "Workshop", 610, 170, 30, 125, 605),
    ],
  },
  workshop: {
    id: "workshop", name: "Depot Workshop", art: "workshop",
    caption: "Parts, evidence, and no promise of discretion.", floor, spawn,
    hotspots: [
      hotspot("parts-locker", "Communications parts locker", 67, 119, 135, 111, 135),
      hotspot("recorder", "Ship's recorder", 261, 154, 116, 79, 319),
      hotspot("comms-bench", "Communications bench", 451, 139, 135, 94, 516),
      hotspot("depot-exit", "Reception", 0, 175, 30, 120, 35),
    ],
  },
  "relay-control": {
    id: "relay-control", name: "Federation Relay Control", art: "relay",
    caption: "A long-range connection to some very short tempers.", floor, spawn,
    hotspots: [
      hotspot("module-cabinet", "Controller spares", 66, 143, 94, 91, 112),
      hotspot("relay-terminal", "Authentication terminal", 206, 158, 116, 76, 264),
      hotspot("dish-control", "Dish alignment", 357, 164, 90, 69, 401),
      hotspot("transmit", "Transmission control", 496, 138, 85, 96, 534),
      hotspot("relay-engineering-exit", "Enterprise engineering", 0, 175, 30, 120, 35),
    ],
  },
  "relay-engineering": {
    id: "relay-engineering", name: "Emergency Controller Bay", art: "engineering",
    caption: "The core is stable. Its emergency software is not.", floor, spawn,
    hotspots: [
      hotspot("purge-monitor", "Queued purge diagnostic", 36, 155, 116, 78, 95),
      hotspot("purge-bypass", "Emergency controller bypass", 398, 160, 66, 75, 430),
      hotspot("controller-socket", "Logic module socket", 467, 167, 65, 64, 498),
      hotspot("relay-control-exit", "Relay transporter", 610, 170, 30, 125, 605),
    ],
  },
  "fleet-bridge": {
    id: "fleet-bridge", name: "Joint Operations Bridge", art: "bridge",
    caption: "The Defiant is on your side. Try to keep it that way.", floor, spawn,
    hotspots: [
      hotspot("fleet-channel", "Fleet coordination channel", 400, 180, 150, 65, 475),
      hotspot("crew-status", "Evacuated crew status", 84, 188, 140, 60, 154),
      hotspot("final-engineering-exit", "Engineering turbolift", 0, 175, 30, 120, 35),
    ],
  },
  "final-engineering": {
    id: "final-engineering", name: "Containment Engineering", art: "engineering",
    caption: "Step one: undo the thing you did in chapter one.", floor, spawn,
    hotspots: [
      hotspot("core-sync", "Core synchronization console", 36, 155, 116, 78, 95),
      hotspot("engineering-kit", "Deflector service kit", 248, 75, 43, 38, 270),
      hotspot("original-interlock", "Original safety interlock", 398, 160, 66, 75, 430),
      hotspot("deflector-relay", "Emergency deflector relay", 548, 140, 63, 85, 574),
      hotspot("fleet-bridge-exit", "Bridge", 610, 170, 30, 125, 605),
    ],
  },
} as const satisfies Record<string, Room>;

type MissionDefinition = {
  number: number; title: string; label: string; entry: keyof typeof laterRooms;
  rooms: readonly string[]; items: readonly string[]; intro: string; departure: string; outro: string;
  objective: string; ending: string; log: string; briefing: readonly string[]; rules: CombatRules;
  steps: Record<string, readonly [string, string, string]>;
};

export const missions = {
  "chapter-2": {
    number: 2, title: "Acting captain", label: "UNSUPERVISED AUTHORITY", entry: "ready-room",
    rooms: ["ready-room", "command-bridge", "shuttlebay"], items: ["tool", "nav-chip", "probe", "decoy"],
    intro: "c2-intro", departure: "c2-departure", outro: "c2-outro",
    objective: "Reach Harlow repair depot without leading the containment patrol there.",
    ending: "The corridor to Harlow depot is clear. The patrol's hull is intact, and your appointment with the depot's paperwork awaits.",
    log: "The captain's desk has a drawer labelled contingency. I believe that means me.",
    briefing: [
      "The decoy is broadcasting. Scan the patrol so navigation can find its blind spot. There is no need to shoot.",
      "Select Evade and allocate at least 3 power to engines. Then order Decoy escape.",
      "Keep that formation while the patrol can pursue. If its engines are disabled instead, any maneuver and engine power 1 or higher allow escape. The escape order is still required.",
    ],
    rules: { ...DEFAULT_COMBAT_RULES, name: "Decoy pursuit", action: "Decoy escape", requiredTarget: null, requiredManeuver: "evade", minimumPower: { shields: 0, weapons: 0, engines: 3 }, chargeDurationMs: 9000, escapeAlternative: "disabled-engines" },
    steps: {
      trace: ["Find out why the fleet thinks this ship is hazardous.", "The ready-room terminal has the outgoing alert.", "Look at the Hazard alert log in the ready room."],
      navigation: ["The active chart has been quarantined, but a backup would not be.", "The captain kept an offline chip in his desk.", "Use the desk drawer, then use its Navigation chip on the bridge Navigation console."],
      decoy: ["The patrol is following a signal. It need not come from this hull.", "The shuttlebay's survey equipment can reproduce beacon packets.", "Take a Survey probe from the rack and use it on the Probe programming bench."],
      launch: ["A false signal is not much use while it is still aboard.", "The launch tube accepts a loaded probe.", "Use the Hazard decoy on the Probe launch tube."],
      encounter: ["Escape without destroying the patrol.", "Evasive movement keeps the decoy convincing; disabled pursuit engines offer another way out.", "Scan, select Evade, set engines to 3 and order Decoy escape. Alternatively, disable its engines, keep at least 1 engine power and issue the same escape order."],
      complete: ["Reach Harlow repair depot.", "The next chapter begins at the depot.", "Select Continue to chapter 3 on the completion screen."],
    },
  },
  "chapter-3": {
    number: 3, title: "Please stand by for inspection", label: "FORMS OF PURSUIT", entry: "depot",
    rooms: ["depot", "workshop"], items: ["tool", "service-form", "voucher", "transceiver", "flight-log"],
    intro: "c3-intro", departure: "c3-departure", outro: "c3-outro",
    objective: "Restore communications and preserve an unaltered record of what happened.",
    ending: "Communications are repaired and the original log is safe. The Defiant survived, but still refuses to take your word for anything.",
    log: "I asked whether the form could be expedited. The clerk gave it a smaller envelope.",
    briefing: [
      "The Defiant has a tractor lock. Scan it, then select Tractor emitters, the right-hand target.",
      "Use precision fire to disable the tractor emitters. Its impulse engines and hull can remain intact. Evade reduces incoming damage.",
      "After three hits, order Break tractor lock with at least 1 engine power. More engine power shortens escape.",
    ],
    rules: { ...DEFAULT_COMBAT_RULES, name: "USS Defiant / tractor lock", action: "Break tractor lock", targetNames: { engines: "Impulse engines", weapons: "Tractor emitters" }, requiredTarget: "weapons", attackIntervalMs: 3500, attackDamage: 52 },
    steps: {
      manifest: ["Find the depot's emergency repair procedure.", "The dock manifest identifies your ship and its request category.", "Look at the Dock manifest before submitting any paperwork."],
      permit: ["Obtain authorization for communications parts.", "The clerk needs the printed emergency request.", "Use the Service form printer, then use the Service request on the Depot clerk."],
      parts: ["Collect the authorized communications transceiver.", "The workshop locker accepts your voucher.", "Go to the workshop and use the Parts voucher on the Communications parts locker."],
      recorder: ["Recover the unedited log before replacing communications.", "The recorder's insulated latch protects the original data.", "Use the Insulated tool on the Ship's recorder in the workshop."],
      install: ["Install the replacement communications hardware.", "The evidence is safe, so the damaged unit can be replaced.", "Use the Communications transceiver on the Communications bench."],
      undock: ["Return to reception and request departure.", "You have working communications and the original log.", "Use the Undocking control in depot reception."],
      encounter: ["Break the Defiant's tractor lock, not its hull.", "Its tractor emitters are attached to the weapons system.", "Scan, select Tractor emitters, fire three times, then order Break tractor lock."],
      complete: ["Find a relay that can authenticate the evidence.", "A repaired radio is not enough to retract an automated alert.", "Select Continue to chapter 4."],
    },
  },
  "chapter-4": {
    number: 4, title: "The wrong kind of help", label: "PLEASE HOLD POSITION", entry: "relay-control",
    rooms: ["relay-control", "relay-engineering"], items: ["tool", "flight-log", "logic-module"],
    intro: "c4-intro", departure: "c4-departure", outro: "c4-outro",
    objective: "Stop the queued purge and get the fleet to accept the original log.",
    ending: "The fleet has the authenticated log. The alert is withdrawn. Your shortcut still left a charged emergency discharge, and now everyone knows who must fix it.",
    log: "The computer describes a purge as helpful. I am beginning to question its performance objectives.",
    briefing: [
      "The log is authenticated. A containment patrol is still enforcing the old alert while the relay opens a fleet channel.",
      "Scan, select Hold, allocate at least 3 power to shields and 1 to engines, then order Transmit log. Firing is optional.",
      "Hold keeps the dish aligned. Shields power the protected data link. A different maneuver or insufficient power pauses the upload. Restore the conditions to resume.",
    ],
    rules: { ...DEFAULT_COMBAT_RULES, name: "Containment patrol", action: "Transmit log", requiredTarget: null, requiredManeuver: "hold", minimumPower: { shields: 3, weapons: 0, engines: 1 }, chargeSystem: "shields", chargeDurationMs: 12000, attackIntervalMs: 3500, attackDamage: 56 },
    steps: {
      diagnose: ["Read the queued-purge diagnostic aboard the Enterprise.", "The relay transporter returns you to engineering.", "Travel to Enterprise engineering and Look at the Queued purge diagnostic."],
      isolate: ["Isolate the emergency controller before replacing it.", "The bypass takes your insulated tool.", "Use the Insulated tool on the Emergency controller bypass."],
      replace: ["Fit a clean emergency logic module.", "Relay control keeps spare controller hardware.", "Collect a module from Controller spares, return to engineering, and use it on the Logic module socket."],
      authenticate: ["Authenticate the original flight log.", "The relay can verify the recorder's signature.", "Use the Unedited flight log on the Authentication terminal in relay control."],
      align: ["Align the relay dish with the fleet.", "The verified log supplies the correct navigation timing.", "Use Dish alignment in relay control."],
      transmit: ["Open the fleet-wide transmission.", "Alignment is complete. The patrol must wait for the evidence.", "Use Transmission control to begin the defended upload."],
      encounter: ["Hold the relay link while the log uploads.", "The dish needs Hold, powered shields, and station-keeping engines.", "Scan, select Hold, set shields to 3 or more and engines to 1 or more, then order Transmit log."],
      complete: ["Coordinate containment with the former pursuers.", "The log cleared up the story, not the charged discharge.", "Select Continue to chapter 5."],
    },
  },
  "chapter-5": {
    number: 5, title: "An acceptable level of disaster", label: "QUALIFIED COMMENDATION", entry: "fleet-bridge",
    rooms: ["fleet-bridge", "final-engineering"], items: ["tool", "flight-log", "inverter", "containment-plan"],
    intro: "c5-intro", departure: "c5-departure", outro: "c5-outro",
    objective: "Prepare joint containment so the evacuated crew can return safely.",
    ending: "The discharge is contained. Harlow depot and the entire crew are safe. The Enterprise is back under proper command. Roger receives a commendation, followed by a remarkably comprehensive cleaning assignment.",
    log: "The Defiant is helping. Apparently the alternative was to leave me unsupervised again.",
    briefing: [
      "The Defiant is covering the depot. Your target is the emergency discharge, not your allies.",
      "Scan the discharge. Target Emitter and fire three stabilizing pulses. These tune the field without harming any ship.",
      "Then select Hold, maintain at least 2 power each in shields and engines, and order Contain discharge. Maintain formation until 100%. The crew stays safely off-ship until containment is complete.",
    ],
    rules: { ...DEFAULT_COMBAT_RULES, name: "Emergency discharge", action: "Contain discharge", source: "hazard", targetNames: { engines: "Emitter", weapons: "Pulse focus" }, requiredManeuver: "hold", minimumPower: { shields: 2, weapons: 0, engines: 2 }, chargeDurationMs: 10000, attackIntervalMs: 3500, attackDamage: 50 },
    steps: {
      briefing: ["Get the fleet's containment instructions.", "This is the part where listening counts as engineering.", "Talk to the Fleet coordination channel on the bridge."],
      isolate: ["Undo the original interlock bypass.", "Return to engineering with the insulated tool.", "Use the Insulated tool on the Original safety interlock."],
      invert: ["Install the deflector inverter.", "The deflector service kit is beside the core diagnostics.", "Collect the Deflector service kit, then use the Deflector inverter on the Emergency deflector relay."],
      synchronize: ["Synchronize the core with the fleet plan.", "The inverter is fitted; the core needs the Defiant's timing.", "Use the Fleet containment plan on the Core synchronization console."],
      authorize: ["Authorize the joint containment operation.", "The ship is prepared. Return to the bridge.", "Use the Fleet coordination channel to begin containment."],
      encounter: ["Contain the discharge while the Defiant protects the depot.", "Tune the emitter, then maintain a powered holding formation.", "Scan, target Emitter, fire three times, select Hold, keep shields and engines at least 2, then order Contain discharge."],
      complete: ["The adventure is complete. Everyone survived.", "Your commendation is real. So is the cleaning roster.", "Save your completed adventure, or replay from the beginning."],
    },
  },
} as const satisfies Record<string, MissionDefinition>;

export type ChapterStage = keyof typeof missions;
export type LaterProgress = {
  [K in ChapterStage]: { readonly stage: K; readonly step: keyof typeof missions[K]["steps"] }
}[ChapterStage];

function scene(id: string, title: string, art: string, lines: readonly [string, string][]): Sequence {
  return { id, title, frames: lines.map(([speaker, text]) => ({ art, speaker, text, durationMs: 4400 })) };
}

export const laterSequences: Readonly<Record<string, Sequence>> = {
  "c2-intro": scene("c2-intro", "Acting Captain", "ready-room", [
    ["Computer", "The patrol survived. Unfortunately, so did its incident report. The ship is still broadcasting a hazardous-vessel alert."],
    ["Roger", "A whole ship to myself, and somehow still no room for a promotion. Perhaps the captain left instructions."],
    ["Computer", "Harlow depot can repair communications, but our active chart has been quarantined. The outgoing alert is still available in the ready room."],
  ]),
  "c2-departure": scene("c2-departure", "A Convincing Bad Example", "shuttlebay", [
    ["Roger", "Survey probe, your new mission is to look dangerously incompetent. I have included a recording of my shift."],
    ["Computer", "Decoy launched. It is reproducing our hazard signature with troubling accuracy. Patrol vessels are turning."],
    ["Roger", "Nobody fire. We are leaving quietly. Well, quietly apart from the giant fraudulent distress beacon."],
  ]),
  "c2-outro": scene("c2-outro", "The Other Hazardous Object", "bridge", [
    ["Computer", "Our corridor to Harlow depot is clear. The patrol's hull remains intact. The probe continues broadcasting its extremely convincing bad example."],
    ["Patrol", "We are receiving an apology to a coolant pump on your hazard frequency. This is not simplifying our report."],
    ["Roger", "Set course for the depot. I would like a repair performed by somebody who has completed training."],
  ]),
  "c3-intro": scene("c3-intro", "Please Stand By", "depot", [
    ["Depot clerk", "Welcome to Harlow. Emergency parts require an emergency form. Complaints about the form require another form."],
    ["Roger", "I have a starship, a broken radio, and no reasonable explanation. Which queue is that?"],
    ["Depot clerk", "Parts require a written request matching a registered vessel and fault category. Your damaged radio and recorder are in the workshop. I hope you have not edited your account."],
  ]),
  "c3-departure": scene("c3-departure", "A Less Patient Inspection", "depot", [
    ["Computer", "Communications restored. The unedited log confirms your bypass caused both the evacuation and the hazardous-vessel alert."],
    ["Defiant", "Enterprise, hold position for inspection. Your unsecured emergency controller is a risk to the depot. Engaging tractor beam."],
    ["Roger", "The controller is queuing a purge! We need to get clear of these people. Disable only the tractor emitters. Keep their hull intact."],
  ]),
  "c3-outro": scene("c3-outro", "Evidence In Transit", "workshop", [
    ["Computer", "Tractor lock broken. Defiant hull intact. Depot undamaged. A Federation relay can authenticate our original log."],
    ["Defiant", "We received your explanation. We also received seventeen automated warnings contradicting it. Authentication is required."],
    ["Roger", "At last, a bureaucracy with a useful purpose. Find that relay before the emergency controller becomes any more helpful."],
  ]),
  "c4-intro": scene("c4-intro", "Automatic Assistance", "relay", [
    ["Computer", "Relay link established. The original bypass queued an emergency purge. The controller intends to clear stored plasma toward the depot."],
    ["Roger", "Its idea of helping and mine are becoming worryingly similar. Isolate that controller before we send anything."],
    ["Computer", "Engineering has the purge fault record. The relay can verify recorder signatures, but the emergency controller is still overwriting our outgoing messages."],
  ]),
  "c4-departure": scene("c4-departure", "Please Hold Position", "relay", [
    ["Computer", "Purge commands isolated. Existing plasma charge remains. Log authenticated and relay aligned. Opening a fleet-wide channel."],
    ["Patrol", "Hazard alert remains in effect until evidence verification completes. Maintain a safe distance from the depot."],
    ["Roger", "I am trying to explain the safe distance! Hold the dish on target and keep the shielded data link powered."],
  ]),
  "c4-outro": scene("c4-outro", "The Entire Inconvenient Truth", "relay", [
    ["Fleet relay", "Evidence verified. Crew safe. No sabotage detected. Initiating cause: Ensign Roger Wilco selected the clearly labelled shortcut."],
    ["Defiant", "Stand down pursuit. Enterprise, we will help contain the charged discharge. Do exactly what the containment plan says."],
    ["Roger", "I was hoping the full story would make me look better. It has instead made me accurately described."],
  ]),
  "c5-intro": scene("c5-intro", "With Actual Supervision", "bridge", [
    ["Defiant", "We will shield the depot. You must restore the original interlock and reverse the emergency deflector feed before we contain the discharge."],
    ["Roger", "A plan with another qualified operator involved. I can already feel the improvement."],
    ["Computer", "The fleet coordination channel is open. Engineering's readiness lamps are still red. The evacuated crew will remain at the depot until the operation is safe."],
  ]),
  "c5-departure": scene("c5-departure", "One Last Manual Procedure", "engineering", [
    ["Computer", "Original interlock restored. Deflector inverter installed. Fleet timing synchronized. Diverting the charge into a remote containment field."],
    ["Defiant", "We have the depot covered. Tune the discharge emitter with stabilizing pulses, then hold the containment geometry."],
    ["Roger", "No shortcuts. Nobody gets hurt. I would like those two statements to become my entire report."],
  ]),
  "c5-outro": scene("c5-outro", "An Acceptable Level Of Disaster", "bridge", [
    ["Computer", "Containment complete. Discharge dissipated away from inhabited space. Harlow depot and every ship are safe."],
    ["Crew", "Transport complete. The crew is back aboard the Enterprise. Someone has adjusted every chair on the bridge."],
    ["Command", "Ensign Wilco, your persistence and cooperation merit a commendation. Your original conduct merits this cleaning roster."],
    ["Roger", "All forty-two decks? At least the mop has no shortcut button. Why is the computer laughing?"],
  ]),
};
