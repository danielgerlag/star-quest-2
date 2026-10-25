# Star Quest II

A desktop-browser point-and-click space comedy. Roger Wilco's first engineering shift aboard the Enterprise-D becomes an evacuation, an unauthorized command, and a pursuit by the Federation.

Play all five chapters, from the warp-core accident to the crew's return. Explore the deserted ship, negotiate depot paperwork, recover the flight log, repair a relay link, and coordinate containment with the Defiant.

## Run locally

Use Node.js 20.19 or newer.

```sh
npm install
npm run dev
```

Open the local address printed by Vite. Select **Begin your shift**. Nothing is uploaded, and no account is required.

## Play

Use the Space Quest IV-style icon toolbar at the top of the scene. Select **Walk**, **Look**, **Use**, **Talk**, **Smell**, or **Taste**, then left-click a target. Right-click the scene to cycle actions. The cursor shows the current action.

**Inventory** opens a paused item window. Select an item to use it as the cursor, or choose **Inspect** to read its description. The chosen item remains available in the toolbar and right-click cycle. **Objects** lists the room's interaction targets and works with keyboard focus.

| Key | Action |
|---|---|
| W, L, T, U | Walk, Look, Talk, Use |
| N, Y | Smell, Taste |
| I | Open or close inventory |
| H | Show room objects |
| Space | Continue dialogue |
| S | Skip the current animated sequence |
| Escape | Cancel an item selection or open the pause menu |

The breach countdown pauses during dialogue, hints, menus, cutscenes, and browser focus loss. Failures offer checkpoint retry.

Room descriptions and inventory provide clues, not a walkthrough. **Request a small hint** gives increasingly explicit help for the current puzzle. A new puzzle starts with a gentle hint again. Wrong item combinations preserve your items without revealing the solution.

Roger reacts visibly to inspections, conversations, pickups, repairs, and controls. Using the captain's chair seats him in it. These poses continue during dialogue, freeze in menus or when the browser loses focus, and end when you dismiss the dialogue. **Reduce motion & flashes** keeps a stationary version of each pose.

After each chapter, select **Continue to chapter** to advance. The final chapter ends the adventure.

In combat, read the briefing before issuing orders. Power is limited to six units. The opening teaches subsystem targeting and escape. Later encounters require a decoy escape, disabling tractor emitters, holding a relay upload, and containing a discharge with the Defiant's help. Keep the required maneuver and power allocation until the objective meter fills. Changing either can pause progress.

The tactical panel shows the next unmet requirement, when the objective is ready to start, and why progress has paused. Disabling a ship does not automatically finish an encounter.

In chapter 2, use **Evade** with engine power **3** to escape behind the decoy without firing. If you disable the patrol's engines instead, any maneuver and engine power **1** or higher permit escape. Both routes require a scan and the **Decoy escape** order. Disabling weapons stops incoming fire but does not stop pursuit. The Defiant's tractor encounter still requires disabling **Tractor emitters**, not its impulse engines.

## Save behavior

The game keeps an autosave and three manual slots in this browser's localStorage. Save from **Menu**. Clearing site data removes saves. Private browsing or browser policy may block persistence; the game then displays a warning and keeps in-memory retry available.

Adventure saves preserve the current repair timer. Cutscenes replay from their beginning after reload. Combat resumes at the encounter-start checkpoint. Retry restores the hazard checkpoint rather than the failed state.

Saves from the opening-only version still load, including tactical checkpoints. A completed opening save continues into chapter 2. **Replay adventure** and **Restart adventure** return to chapter 1 after confirmation. They replace the autosave but preserve manual slots.

## Build and check

```sh
npm run typecheck
npm test
npm run check:content
npm run build
npx playwright install
npm run test:e2e
npm run test:production
```

`dist/` is a static site. Serve it over HTTP, rather than opening its HTML through a `file:` URL. The relative asset base supports hosting under a subpath. No backend is needed.

Browser tests build the game and use a production preview, so development hot reload cannot reset a walkthrough. Set `STAR_QUEST_TEST_PORT` if the default test port, 4173, is already occupied.

The browser walkthrough covers all five chapters, their animated transitions, tactical retry, and later-chapter save recovery. On the current macOS host, bundled Firefox exits before loading the game with `Could not find profile folder`. Firefox remains unverified; the suite retains its Firefox project. [An upstream report](https://github.com/microsoft/playwright/issues/42768) describes a similar host-level failure. No browser profile or operating-system permissions were changed. A native Safari application run is also still pending.

To run the working browser targets independently:

```sh
npm run test:e2e -- --project=chromium --project=webkit
```

Rules and progression live in `src/game/` and `src/content/`. `story.ts` composes the opening with the remaining chapters. Phaser draws the scene in `src/presentation/`; HTML controls live in `src/main.ts`. See [adventure design](docs/opening-design.md) for puzzle dependencies and asset scope.

## Asset provenance and distribution

The ship art depicts the Enterprise-D and Defiant, and the room art follows the Enterprise-D engineering and bridge layouts. The pixel artwork, animation instructions, dialogue, toolbar icons, synthesized music, and effects are original source code. There are no copied game sprites, recorded television clips, commercial songs, remote fonts, or downloaded franchise assets.

This is an unofficial fan-adventure prototype, not a licensed product. Original art does not grant permission to use existing characters, names, or franchise likenesses. Resolve those rights before public distribution. The project is not affiliated with the franchise owners.
