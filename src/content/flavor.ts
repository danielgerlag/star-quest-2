import type { Hotspot } from "../game/types";

const sensations: Readonly<Record<string, Readonly<{ smell: string; taste: string }>>> = {
  console: {
    smell: "The shortcut button smells faintly of warm plastic. No smell of opportunity, despite Roger's expectations.",
    taste: "Roger gets close enough to fog the shortcut button. The computer adds a second warning label.",
  },
  diagnostics: {
    smell: "Dust baking behind a very expensive display. Apparently the diagnostics cannot diagnose housekeeping.",
    taste: "The diagnostic glass tastes of screen cleaner. Roger is now the only thing on the ship with a citrus reading.",
  },
  placard: {
    smell: "Old adhesive and laminate. This warning has survived several generations of people ignoring it.",
    taste: "The safety placard has a bitter coating. Procurement anticipated more than Roger expected.",
  },
  "tool-rack": {
    smell: "Rubber grips and machine oil. The closest engineering comes to a bouquet.",
    taste: "Roger reconsiders putting communal tools in his mouth. Professional growth can be very small.",
  },
  "coupling-bin": {
    smell: "Packing grease. The replacements are fresher than the coffee.",
    taste: "A grease warning on the bin persuades Roger to remain a visual inspector.",
  },
  bypass: {
    smell: "A sharp electrical tang around the insulated housing. Roger keeps his nose outside it.",
    taste: "The warning stripe is at tongue height only if you make several terrible decisions.",
  },
  pump: {
    smell: "Coolant has a sweet industrial smell. The label emphatically refuses to call it a flavor.",
    taste: "Roger reads NOT A BEVERAGE and, for once, accepts the manufacturer's advice.",
  },
  auxiliary: {
    smell: "Warm battery casings. Emergency power smells like the office during a printer crisis.",
    taste: "The backup-power cover is unexpectedly salty. Roger decides that is somebody else's maintenance ticket.",
  },
  command: {
    smell: "New electronics and furniture polish. Authority is mostly expensive cleaning products.",
    taste: "Emergency command declines Roger's attempt at biometric tongue authentication.",
  },
  "captain-chair": {
    smell: "Leather, polish, and a faint trace of tea. The chair has enjoyed better company.",
    taste: "Roger considers the armrest, then notices how many admirals may have leaned on it.",
  },
  intercom: {
    smell: "Nothing gets through the speaker grille except yesterday's dust.",
    taste: "The intercom transmits one damp squeak. Roger hopes it was not fleet-wide.",
  },
  "alert-log": {
    smell: "Hot circuitry behind the alert screen. Panic itself appears to be odorless.",
    taste: "Roger's tongue dismisses no alerts and opens one accessibility help window.",
  },
  "desk-drawer": {
    smell: "Wood polish and an abandoned mint. A captain's contingency plan has layers.",
    taste: "Roger declines to sample the drawer. Even temporary captains must draw a line somewhere.",
  },
  "fish-tank": {
    smell: "Pond water, fish food, and the only crew member who seems pleased with the humidity.",
    taste: "The fish watches Roger approach the glass. Roger decides not to become its cautionary tale.",
  },
  "nav-console": {
    smell: "Warm dust in the chart reader. Space is clean; card slots are not.",
    taste: "Navigation does not accept coordinates in saliva.",
  },
  "route-display": {
    smell: "The route to the depot has no detectable aroma. This rules out navigating by lunch.",
    taste: "The route display is not a food replicator, despite Roger's optimistic approach.",
  },
  "probe-rack": {
    smell: "Fresh packing foam. These probes have not yet experienced Roger in the field.",
    taste: "Roger spots the probe's environmental-sampling intake and withdraws before becoming a sample.",
  },
  "probe-bench": {
    smell: "Solder flux and stale coffee. Somebody here has already confused inspiration with a stimulant.",
    taste: "A tiny label says KEEP CONNECTORS DRY. Roger settles for reading it.",
  },
  "launch-tube": {
    smell: "A chilly draught from the launch seals. Outside air remains conspicuously absent.",
    taste: "The launch tube is cold enough to turn this into a very different rescue mission.",
  },
  "dock-manifest": {
    smell: "The manifest screen smells of disinfectant. Incoming captains apparently touch it a lot.",
    taste: "The dock manifest is public property. Roger decides not to make that everyone else's problem.",
  },
  "form-printer": {
    smell: "Warm paper. Bureaucracy has a remarkably comforting aroma.",
    taste: "The printer's label says NO ORGANIC MEDIA. Roger reluctantly accepts his classification.",
  },
  clerk: {
    smell: "The clerk raises an eyebrow. Roger claims to be checking the air recyclers.",
    taste: "The clerk points at the posted conduct policy. Roger abandons the proposal before it becomes a form.",
  },
  undock: {
    smell: "The docking switch smells clean. Nobody gets this far through the forms very often.",
    taste: "Roger does not lick the control that separates the ship from solid ground.",
  },
  "parts-locker": {
    smell: "Antistatic wrapping and sealed plastic. Even the smell requires authorization.",
    taste: "The locker is voucher-operated, not lick-operated. The distinction is printed in large type.",
  },
  recorder: {
    smell: "Warm insulation around the recorder latch. Its little memory cell is still working.",
    taste: "Roger refuses to leave more biological evidence on the evidence.",
  },
  "comms-bench": {
    smell: "Ozone around the damaged radio. No amount of shouting has improved the smell.",
    taste: "The microphone does not need to be quite that close.",
  },
  "purge-monitor": {
    smell: "Hot circuitry beside a very bad idea. The monitor insists its temperature is within specification.",
    taste: "The purge diagnostic reports an unauthorized input device. Roger retracts it.",
  },
  "purge-bypass": {
    smell: "The isolation housing smells hot. Its rubber seal is earning its keep.",
    taste: "Roger keeps his tongue on the safe side of the isolation warning.",
  },
  "controller-socket": {
    smell: "Overheated resin. That controller has been thinking far too hard about being helpful.",
    taste: "Roger recognizes the pin array as the wrong sort of fork.",
  },
  "module-cabinet": {
    smell: "Cool, unopened electronics. Replacement hardware smells less ambitious.",
    taste: "The antistatic bag crackles near Roger's face. He takes the hint.",
  },
  "relay-terminal": {
    smell: "The terminal smells of clean filters and expensive skepticism.",
    taste: "The relay rejects tongueprints as an evidence signature.",
  },
  "dish-control": {
    smell: "Warm servo electronics. The actual dish is mercifully outside smelling range.",
    taste: "Roger nearly acquires a very personal relationship with the dish-control trackball.",
  },
  transmit: {
    smell: "Fan-warmed air. The transmitter is preparing to circulate Roger's mistakes much more widely.",
    taste: "Roger decides a fleet-wide channel should not begin with this particular sound.",
  },
  "fleet-channel": {
    smell: "The Defiant does not transmit smells. Roger counts this as one successful communications feature.",
    taste: "Roger remembers the fleet channel is open and behaves like an officer for almost two seconds.",
  },
  "crew-status": {
    smell: "The crew manifest smells like every other screen. The relief is new.",
    taste: "Roger will not lick a list of the people who must eventually read his report.",
  },
  "core-sync": {
    smell: "Warm electronics and a faint ozone trace. Synchronization has not improved the ventilation.",
    taste: "The core console politely requests a less conductive operator.",
  },
  "engineering-kit": {
    smell: "Fresh rubber seals in the service kit. Starfleet's version of new-car smell.",
    taste: "Roger decides the service kit's emergency rations compartment is probably metaphorical.",
  },
  "original-interlock": {
    smell: "A trace of the original scorching. Roger recognizes his work with no pride whatsoever.",
    taste: "Roger has already bypassed this safety device once. He declines to bypass common sense as well.",
  },
  "deflector-relay": {
    smell: "A cool metallic smell from the relay casing. It is waiting to become somebody's responsibility.",
    taste: "The deflector relay has no taste-test procedure. Roger resists the urge to write one.",
  },
};

export function sensoryReply(verb: "smell" | "taste", hotspot: Hotspot): string {
  if (hotspot.id.endsWith("-exit")) {
    return verb === "smell"
      ? `Air drifts from ${hotspot.name.toLowerCase()}. Roger's nose has located another place to be underqualified.`
      : `Roger decides ${hotspot.name.toLowerCase()} is a destination, not a course on the menu.`;
  }
  const response = sensations[hotspot.id];
  if (!response) throw new Error(`Missing sensory responses for ${hotspot.id}`);
  return response[verb];
}
