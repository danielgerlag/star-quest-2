import { openingCampaign, type OpeningProgress } from "../../src/content/opening";
import { createSession } from "../../src/game/session";
import type { Session, TacticalOrder } from "../../src/game/types";

export function clearDialogue<P>(session: Session<P>): void {
  for (let count = 0; session.view().dialogue && count < 30; count++) {
    session.dispatch({ type: "dialogue-next" });
  }
  if (session.view().dialogue) throw new Error("Dialogue did not terminate.");
}

export function skip<P>(session: Session<P>): void {
  const scene = session.view().scene;
  if (scene.kind !== "cutscene") throw new Error("Expected a cutscene to skip.");
  session.dispatch({ type: "finish-cutscene", token: scene.token });
}

export function interact<P>(
  session: Session<P>, target: string, verb: "look" | "talk" | "use" = "use", item?: string,
): void {
  session.dispatch({ type: "interact", verb, target, ...(item ? { item } : {}) });
  for (let ticks = 0; session.view().destination && ticks < 150; ticks++) session.advance(50);
  if (session.view().destination) throw new Error(`Could not reach ${target}.`);
}

export function act<P>(
  session: Session<P>, target: string, verb: "look" | "talk" | "use" = "use", item?: string,
): void {
  clearDialogue(session);
  interact(session, target, verb, item);
  clearDialogue(session);
}

export function startRepair(): Session<OpeningProgress> {
  const session = createSession(openingCampaign);
  skip(session);
  act(session, "console");
  skip(session);
  clearDialogue(session);
  return session;
}

export function finishRepair<P>(session: Session<P>): void {
  act(session, "diagnostics", "look");
  act(session, "alcove-exit");
  act(session, "placard", "look");
  act(session, "tool-rack");
  act(session, "coupling-bin");
  act(session, "engineering-exit");
  act(session, "bypass", "use", "tool");
  act(session, "pump", "use", "coupling");
  act(session, "pump");
}

export function reachTakeover(): Session<OpeningProgress> {
  const session = startRepair();
  finishRepair(session);
  act(session, "auxiliary");
  act(session, "corridor-exit");
  act(session, "turbolift-exit");
  act(session, "bridge-exit");
  act(session, "command", "look");
  act(session, "command");
  return session;
}

export function reachBattle(): Session<OpeningProgress> {
  const session = reachTakeover();
  skip(session);
  clearDialogue(session);
  return session;
}

export function order<P>(session: Session<P>, command: TacticalOrder): void {
  session.dispatch({ type: "order", order: command });
}

export function winBattle<P>(session: Session<P>): void {
  order(session, { type: "scan" });
  order(session, { type: "maneuver", maneuver: "evade" });
  order(session, { type: "target", target: "engines" });
  for (let shot = 0; shot < 3; shot++) {
    order(session, { type: "fire" });
    session.advance(1800);
  }
  order(session, { type: "power", system: "engines", delta: 1 });
  order(session, { type: "engage" });
  session.advance(6000);
}
