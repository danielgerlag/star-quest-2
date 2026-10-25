# Adventure design

The adventure contains five chapters. The opening establishes the repair puzzle and tutorial interception. Each later chapter has an explicit puzzle chain, a tactical objective, and animated transitions.

## Rooms and progression

Engineering connects to the maintenance alcove and evacuation corridor. The corridor leads to the turbolift. The powered turbolift leads to the bridge. Each room has a wide walkable foreground and explicit interaction points.

The maintenance console starts the accident. The evacuation scene returns control to Roger with a repair checkpoint. Look at the diagnostic display, inspect the alcove placard, collect the insulated tool and coupling, isolate the bypass, fit the coupling, and restart circulation. Restore auxiliary power, take the turbolift, and activate emergency command.

The repair supplies remain available after evacuation. They cannot be discarded. Wrong actions produce short responses without consuming indispensable items.

## Interface

The interface follows Space Quest IV's icon-driven interaction. A persistent toolbar above the scene contains Walk, Look, Use, Talk, Smell, Taste, the selected inventory item, Inventory, and Menu. The icons are original artwork, not extracted Sierra assets.

Right-click on the scene cycles through the actions and then the selected inventory item, when available. The cursor changes to match the action. Left-click applies it to the target. Smell and Taste give comic responses without changing puzzle progression.

Inventory opens a paused window for selecting or inspecting items. Selecting an item closes the window and uses its image as the cursor. A separate Objects button lists the current room's hotspots for discoverability and keyboard access. The countdown pauses during text, inventory inspection, hints, and menus.

## Assets

All graphics are drawn from original geometric pixel-art instructions. No extracted game, television, music, font, or logo files are included.

The asset set contains ten room backgrounds, a Roger sprite and portrait, crew silhouettes, a warp-core animation, doors, consoles, starfields, and scene-specific cutscene staging. Roger wears a gold-and-black engineering uniform in his walk poses, portrait, and failure pose.

Authored dialogue cues animate Roger's seated, repair, pickup, control, talking, inspection, smell, and recoil poses. The session starts a cue only after reaching its target. Dialogue time advances independently of the paused gameplay clock; menu and browser-focus pauses freeze both. Cues are transient and never change the saved actor position. Reduced motion retains a static pose.

Interaction dialogue appears at the top of the scene so it does not cover Roger's working hands. Cutscene captions and tactical briefings keep their lower placement.

Ordinary descriptions expose observable clues and changed equipment states. Item mismatches do not append solutions. Explicit action sequences remain in the three requested hint levels, which reset when puzzle progress changes. Chapter objectives describe the overall goal rather than repeat a hint.

The ready room, shuttlebay, depot reception, workshop, and relay extend the opening's five backgrounds. Later ship interiors reuse engineering and the bridge with chapter-specific hotspots. Inventory items have original SVG art shared by the inventory window, toolbar, and cursor.

Ship silhouettes depict the actual Galaxy-class Enterprise-D and the compact Defiant, rather than generic spacecraft. The Enterprise-D has its broad oval saucer, secondary hull, swept pylons, and paired nacelles. Engineering uses the TNG vertical warp core, warm neutral structure, upper catwalk, and broad LCARS worktable.

The bridge camera looks aft from the main viewscreen. The helm and operations consoles are in the foreground, with the command seats and horseshoe tactical station behind them. The aft wall contains LCARS systems displays, not a second viewscreen. These are original pixel-art interpretations informed by visual references.

Room lighting has soft falloff, shadows beneath furniture, and blue reflections below the warp core. Ships have shaded hull plating and nacelle glow. Continuous hull polygons and shared rounded pixel boundaries prevent gaps at fractional ship scales. The reduced-motion setting freezes ambient animation while retaining the lighting.

Visual references: [Galaxy class](https://www.ex-astris-scientia.org/scans/galaxy1.htm), [Defiant class](https://www.ex-astris-scientia.org/scans/defiant1.htm), [Enterprise-D bridge](https://www.ex-astris-scientia.org/inconsistencies/enterprise-d-bridge.htm), and [engineering set design](https://forgottentrek.com/the-next-generation/designing-the-next-generations-engineering/).

Short synthesized sounds provide interface feedback, footsteps, warning pulses, engine hum, and tactical effects. Browser audio starts only after a click. Music and effects can be controlled independently.

## Storyboards

The intro introduces the impossible maintenance form. The evacuation shows the alarms, departing crew, and Roger finding the one instruction nobody should take literally. The takeover shows an empty bridge, emergency authority, and the wrong confirmation button. The outro shows the pursuing ship surviving, the Enterprise escaping, and the Defiant receiving an alert.

Each frame has original subtitles and animated staging. Skip completes the same story transition as normal playback.

## Tutorial battle

Scan the pursuer, distribute a fixed pool of power, protect the exposed shield arc through maneuvers, target engines, and fire. Disabling the pursuit engines creates an escape window. Divert power to engines and charge escape.

Failure restores the encounter-start checkpoint. The pursuer need not be destroyed.

## Remaining chapters

| Chapter | Puzzle chain | Tactical objective |
|---|---|---|
| 2. Acting captain | Read the ready-room alert, collect the navigation chip, restore the bridge route, program a survey probe, and launch the decoy. | Scan, select Evade, and keep engine power at least 3. Alternatively, disable pursuit engines and escape with any maneuver and engine power at least 1. Both routes require an explicit escape order. |
| 3. Please stand by for inspection | Read the manifest, exchange a service request for a voucher, collect the transceiver, recover the original log, install communications, and undock. | Disable the Defiant's tractor emitters, then escape. Its engines and hull can remain intact. |
| 4. The wrong kind of help | Diagnose and isolate the queued purge, install a clean controller, authenticate the log, align the dish, and transmit. | Scan and Hold with shields at least 3 and engines at least 1 during the protected upload. |
| 5. An acceptable level of disaster | Get the fleet plan, restore the original interlock, install the inverter, synchronize the core, and authorize containment. | Tune the discharge emitter with three pulses, then Hold with shields and engines at least 2. The Defiant protects the depot. |

Every chapter has an intro, a departure sequence, and an outro. The new scenes show the decoy launch, docking, tractor interception, relay transmission, and joint containment. The final outro returns the crew and gives Roger a commendation and a cleaning assignment.

The decoy outro does not assume that the patrol can still move. Combat requirements come from the same state-derived rules in the UI and simulation. A disabled ship's weapons stop its attack clock and threat indicators; discharge hazards continue emitting pulses.

The original shortcut causes the whole incident. The flight log explains the pursuit but does not excuse Roger. Precision targeting preserves other ships, and the crew remains at the depot until containment succeeds.

## Progression and recovery

`storyCampaign` composes the original opening rules with chapter-tagged progress in one session. Chapter completion waits for an explicit continuation command. The final completion screen has no continuation.

`CombatRules` configures the existing tactical engine's target, maneuver, power requirements, and incoming attacks. Missing formation or power pauses an engaged objective without losing its progress. The final discharge remains dangerous even if its pulse focus is disabled.

The campaign retains the `opening` save identity and format 1. `upgradeStorySave` converts the old battle field names before validation. Both the saved world and the independent retry checkpoint must have valid chapter, room, inventory, and scene combinations.

`tests/game/campaign.test.ts` follows every chapter, reloads each puzzle gate, compares watched and skipped transitions, and retries every encounter. `tests/browser/opening.spec.ts` follows the same action fixtures through visible controls and captures the new rooms, sequences, encounters, and ending.
