import type { ChapterStage } from "../../src/content/story-content";

export type ChapterAction = readonly [target: string, verb: "look" | "use" | "talk", item?: string];

export const chapterPaths: Readonly<Record<ChapterStage, readonly ChapterAction[]>> = {
  "chapter-2": [
    ["alert-log", "look"], ["desk-drawer", "use"], ["command-bridge-exit", "use"],
    ["nav-console", "use", "nav-chip"], ["shuttlebay-exit", "use"], ["probe-rack", "use"],
    ["probe-bench", "use", "probe"], ["launch-tube", "use", "decoy"],
  ],
  "chapter-3": [
    ["dock-manifest", "look"], ["form-printer", "use"], ["clerk", "use", "service-form"],
    ["workshop-exit", "use"], ["parts-locker", "use", "voucher"], ["recorder", "use", "tool"],
    ["comms-bench", "use", "transceiver"], ["depot-exit", "use"], ["undock", "use"],
  ],
  "chapter-4": [
    ["relay-engineering-exit", "use"], ["purge-monitor", "look"], ["purge-bypass", "use", "tool"],
    ["relay-control-exit", "use"], ["module-cabinet", "use"], ["relay-engineering-exit", "use"],
    ["controller-socket", "use", "logic-module"], ["relay-control-exit", "use"],
    ["relay-terminal", "use", "flight-log"], ["dish-control", "use"], ["transmit", "use"],
  ],
  "chapter-5": [
    ["fleet-channel", "talk"], ["final-engineering-exit", "use"], ["engineering-kit", "use"],
    ["original-interlock", "use", "tool"], ["deflector-relay", "use", "inverter"],
    ["core-sync", "use", "containment-plan"], ["fleet-bridge-exit", "use"], ["fleet-channel", "use"],
  ],
};
