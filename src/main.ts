import Phaser from "phaser";
import { chapterInfo, encounterRules, storyCampaign, upgradeStorySave } from "./content/story";
import { canAttack, chargeBlockReason, chargeRequirements } from "./game/combat";
import { createSession } from "./game/session";
import type { Battle, Hotspot, TacticalOrder, Verb } from "./game/types";
import { drawScene } from "./presentation/art";
import { itemDrawing, itemImage } from "./presentation/items";
import { ShipAudio } from "./presentation/audio";
import { describeError, readSave, writeSave, type Slot } from "./platform/saves";
import "./style.css";

function element<T extends HTMLElement>(id: string, kind: { new(): T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof kind)) throw new Error(`Missing interface element: ${id}`);
  return node;
}

const app = element("app", HTMLDivElement);
const icons = {
  walk: '<path d="M5 1h5v8l4 2v3H2v-3l3-3Z"/><path d="M2 12h12M6 4h3M6 6h3"/>',
  look: '<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5Z"/><circle cx="8" cy="8" r="2"/>',
  talk: '<path d="m1 8 4-4 3 1 3-1 4 4-4 4H5Z"/><path d="M2 8h12M5 9v2M8 9v2M11 9v2"/>',
  use: '<path d="M5 8V3a1 1 0 0 1 2 0v4-5a1 1 0 0 1 2 0v5-4a1 1 0 0 1 2 0v5-2a1 1 0 0 1 2 0v5l-3 4H6l-4-5a1 1 0 0 1 2-1Z"/>',
  smell: '<path d="M7 1v5l-4 4v2h4l2 2h3l1-3-2-2V2"/><path d="M4 11h2M10 11h1"/>',
  taste: '<path d="M2 3h12v5l-3 3H5L2 8Z"/><path d="M6 7h5v5a3 3 0 0 1-5 0ZM8 9v4"/>',
};
const verbOrder: readonly Verb[] = ["walk", "look", "use", "talk", "smell", "taste"];
const verbButton = (verb: Verb, key: string) => `<button class="verb ${verb === "walk" ? "active" : ""}" data-verb="${verb}" aria-label="${verb}" title="${verb} [${key}]" aria-pressed="${verb === "walk"}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">${icons[verb]}</svg><span>${verb[0]?.toUpperCase()}${verb.slice(1)}</span><kbd>${key}</kbd></button>`;

app.innerHTML = `
  <main class="shell">
    <header class="masthead">
      <div class="brand"><div class="brand-mark" aria-hidden="true"><span>+</span></div><div><div class="brand-name">STAR QUEST <b>II</b></div><div class="brand-caption">An unauthorized adventure</div></div></div>
      <div class="header-right"><span class="eyebrow"><i class="status-dot"></i>Single player / local saves</span></div>
    </header>
    <div class="chapter-heading"><div><div id="chapter-number" class="chapter-number">CHAPTER 01 / THE ACCIDENT</div><h1 id="chapter-title">An entirely routine maintenance job.</h1></div><div class="chapter-note">SPACE IS VAST. YOUR QUALIFICATIONS ARE NOT.</div></div>
    <div id="notice" class="toast" role="alert" hidden><button id="dismiss-notice" aria-label="Dismiss notification">x</button><span id="notice-text"></span></div>
    <div class="game-layout">
      <section>
        <div class="console">
          <nav id="action-row" class="action-row" aria-label="Adventure actions">
            ${verbButton("walk", "W")}${verbButton("look", "L")}${verbButton("use", "U")}${verbButton("talk", "T")}${verbButton("smell", "N")}${verbButton("taste", "Y")}
            <span class="toolbar-divider"></span>
            <button id="selected-item-button" class="toolbar-item" title="Use selected inventory item" disabled><span id="selected-item-icon" class="item-icon" aria-hidden="true"></span><span id="selected-item-name">No item</span></button>
            <button id="clear-item" class="quiet-button" aria-label="Cancel inventory cursor" hidden>x</button>
            <button id="inventory-button" class="verb toolbar-utility" aria-label="Inventory" title="Inventory [I]"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M2 6h12v8H2ZM5 6V3h6v3M2 9h12M7 8h2v3H7Z"/></svg><span>Inventory</span></button>
            <span class="action-spacer"></span>
            <button id="objects-button" class="quiet-button" aria-expanded="false" title="Room objects [H]">Objects</button>
            <button id="menu-button" class="quiet-button" title="Pause, save, load & settings [Escape]">Menu</button>
          </nav>
          <div class="room-heading"><div><div id="room-title" class="room-title">Main engineering</div><div id="room-caption" class="room-location">USS ENTERPRISE-D / DECK 36</div></div><div id="timer" class="timer">SYSTEMS NOMINAL<small id="timer-status">PROBABLY</small></div></div>
          <div class="stage">
            <div id="viewport" role="img" aria-label="Animated point-and-click adventure. Use the Objects panel for keyboard-accessible room interactions."></div>
            <div id="hover-label" class="hover-label" hidden></div>
            <button id="skip-button" class="quiet-button stage-control" hidden>Skip scene [S]</button>
            <div id="cutscene-title" class="cutscene-title" hidden></div>
            <div id="dialogue" class="dialogue" aria-live="polite" hidden><div id="speaker" class="speaker"></div><div id="dialogue-text" class="dialogue-text"></div><div class="dialogue-bottom"><span id="dialogue-position">TIME IS PAUSED</span><button id="next-button" class="next-button">Continue &gt; <span aria-hidden="true">[space]</span></button></div></div>
            <div id="subtitle" class="dialogue cinematic" aria-live="polite" hidden><div id="subtitle-speaker" class="speaker"></div><div id="subtitle-text" class="dialogue-text"></div></div>
            <div id="battle-readout" class="battle-readout" hidden></div><div id="battle-log" class="battle-log" aria-live="polite" hidden></div>
            <div id="title-screen" class="scene-overlay"><div class="overlay-label">A POINT-AND-CLICK SPACE COMEDY</div><h2>The ship is in<br>very capable hands.<br>Unfortunately, not yours.</h2><p>You are Ensign Roger Wilco. Your assignment is routine maintenance. Please try to keep it that way.</p><div class="button-group"><button id="start-button" class="primary">Begin your shift &gt;</button><button id="continue-button" class="overlay-secondary" hidden>Continue</button></div></div>
            <div id="failure-screen" class="scene-overlay" hidden><div class="overlay-label">AN ENTIRELY AVOIDABLE INCIDENT</div><h2>That's going in your file.</h2><p id="failure-reason"></p><div class="button-group"><button id="retry-button" class="primary">Try that again &gt;</button><button id="failure-load" class="overlay-secondary">Load game</button></div></div>
            <div id="complete-screen" class="scene-overlay" hidden><div id="complete-label" class="overlay-label"></div><h2 id="complete-title"></h2><p id="complete-description"></p><div class="button-group"><button id="next-chapter-button" class="primary">Continue to next chapter</button><button id="complete-save" class="overlay-secondary">Save your progress</button><button id="replay-button" class="overlay-secondary">Replay adventure</button></div><p id="complete-next" style="margin-top:14px;font-size:10px"></p></div>
            <div id="inventory-panel" class="inventory-backdrop" hidden>
              <section class="inventory-window" role="dialog" aria-modal="true" aria-labelledby="inventory-heading">
                <div class="inventory-heading"><h2 id="inventory-heading">Roger's inventory</h2><button id="close-inventory" class="quiet-button" aria-label="Close inventory">x</button></div>
                <p id="inventory-help">Select an item to use it as your cursor.</p>
                <div id="inventory-items" class="inventory-items"></div>
                <div class="inventory-actions"><button id="inventory-select" class="quiet-button active">Select</button><button id="inventory-look" class="quiet-button">Inspect</button><span class="eyebrow">TIME IS PAUSED</span></div>
              </section>
            </div>
          </div>
        </div>
        <div class="footnote"><span id="action-help">Click to walk. Select an action, then an object.</span><span id="save-status" role="status">READY FOR DUTY</span></div>
      </section>
      <aside>
        <div id="mission-card" class="aside-card"><div class="card-title"><i class="status-dot"></i>Current assignment<span id="chapter-tag" class="tag">01</span></div><p id="objective" class="objective">Report to your maintenance console. Read the instructions. Or don't.</p><button id="hint-button" class="hint-button">Request a small hint <span>?</span></button></div>
        <div id="tactical-card" class="aside-card" hidden>
          <div class="card-title"><i class="status-dot"></i>Tactical control</div>
          <p id="tactical-objective"></p>
          <p id="tactical-status" role="status" aria-live="polite" aria-atomic="true"></p>
          <div class="stat"><span>Hull integrity</span><b id="hull-stat">100%</b></div><div class="meter"><i id="hull-meter"></i></div><div class="stat"><span id="shield-label">Forward shield</span><b id="shield-stat">100%</b></div><div class="meter"><i id="shield-meter"></i></div>
          <div class="tactical-heading">Power allocation / 6</div>${(["shields", "weapons", "engines"] as const).map(system => `<div class="power-row"><span>${system[0]?.toUpperCase()}${system.slice(1)}</span><button class="mini" data-power="${system}" data-delta="-1" aria-label="Decrease ${system} power">-</button><strong id="power-${system}">2</strong><button class="mini" data-power="${system}" data-delta="1" aria-label="Increase ${system} power">+</button></div>`).join("")}
          <div class="tactical-heading">Target subsystem</div><div class="tactical-buttons"><button data-target="engines" class="active">Engines</button><button data-target="weapons">Weapons</button></div><div class="stat"><span>Target integrity</span><b id="target-stat">100%</b></div>
          <div class="tactical-heading">Maneuver</div><div class="tactical-buttons"><button data-maneuver="hold" class="active">Hold</button><button data-maneuver="evade">Evade</button><button data-maneuver="turn">Turn</button></div>
          <button id="scan-button" class="combat-action">Scan pursuer</button><button id="fire-button" class="combat-action fire">Fire at engines</button><button id="escape-button" class="combat-action" aria-describedby="tactical-status">Charge escape</button><div class="meter" style="margin-top:9px"><i id="escape-meter" style="width:0"></i></div>
        </div>
        <div id="objects-card" class="aside-card" hidden><div class="card-title">Room objects</div><div id="objects-list" class="objects"></div></div>
        <div id="log-card" class="aside-card"><div class="card-title">Ensign's log</div><p id="chapter-log" class="log-text"></p></div>
        <div class="aside-card crew-card"><div class="portrait" aria-hidden="true"></div><div><div class="crew-name">Roger Wilco</div><div class="crew-rank">ENSIGN / ENGINEERING<br>Confidence: unwarranted</div></div></div>
      </aside>
    </div>
    <footer><span>ORIGINAL FAN-ADVENTURE PROTOTYPE / NOT AFFILIATED WITH THE FRANCHISE OWNERS</span><span>NO ACCOUNTS. NO SERVER. JUST YOU AND A VERY EXPENSIVE SHIP.</span></footer>
  </main>
  <div id="modal-backdrop" class="modal-backdrop" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><div><div class="eyebrow">SHIP COMPUTER / PERSONAL TERMINAL</div><h2 id="modal-title">A brief interruption.</h2></div><button id="close-modal" class="quiet-button" aria-label="Close menu">x</button></div><p id="modal-description">The universe will wait. All gameplay timers are paused.</p><div id="menu-content"><h3>Save & restore</h3><p>Browser saves stay on this device. Clearing site data removes them. Combat resumes at encounter start; cutscenes replay from their beginning.</p><div id="save-slots"></div><h3>Audio & comfort</h3><label class="setting">Music<input id="music-volume" aria-label="Music volume" type="range" min="0" max="100" value="22"></label><label class="setting">Sound effects<input id="effects-volume" aria-label="Sound effects volume" type="range" min="0" max="100" value="45"></label><label class="setting">Reduce motion & flashes<input id="reduced-motion" type="checkbox"></label><p>W: Walk &nbsp; L: Look &nbsp; T: Talk &nbsp; U: Use<br>H: Room objects &nbsp; S: Skip scene &nbsp; Space: Continue<br>Escape: Cancel item or pause</p><div class="modal-footer"><button id="new-game-button" class="overlay-secondary">Restart chapter</button><button id="resume-button" class="primary">Return to duty &gt;</button></div></div></section></div>
`;

let session = createSession(storyCampaign);
let started = false;
let selectedVerb: Verb = "walk";
let selectedItem: string | undefined;
let lastItem: string | undefined;
let inventoryOpen = false;
let inventoryMode: "select" | "look" = "select";
let releaseInventory: (() => void) | null = null;
let releaseMenu: (() => void) | null = null;
let releaseBlur: (() => void) | null = null;
let menuOpen = false;
let modalReturnFocus: HTMLElement | null = null;
let showObjects = false;
let highlighted: string | null = null;
let inventoryKey = "";
let objectsKey = "";
let lastSavedRevision = -1;
let storageFailed = false;
let lastSoundTime = 0;
let lastAlarmTime = 0;
let clock = 0;
let fatal = false;
let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const audio = new ShipAudio(notify);
const reducedMotionInput = element("reduced-motion", HTMLInputElement);
reducedMotionInput.checked = reducedMotion;

function text(id: string, value: string): void {
  const node = document.getElementById(id);
  if (node && node.textContent !== value) node.textContent = value;
}

function visible(id: string, value: boolean): void {
  const node = document.getElementById(id);
  if (node) node.hidden = !value;
}

function notify(message: string): void {
  text("notice-text", message);
  visible("notice", true);
}

function safeSave(slot: Slot, label: string): boolean {
  try {
    writeSave(slot, storyCampaign.id, session.capture(), label);
    text("save-status", slot === "auto" ? "AUTOSAVED ON THIS DEVICE" : `SAVED TO SLOT ${slot}`);
    storageFailed = false;
    lastSavedRevision = session.view().revision;
    return true;
  } catch (error) {
    storageFailed = true;
    text("save-status", "UNSAVED / MEMORY ONLY");
    notify(`Your progress could not be saved. You can still play and retry. ${describeError(error)}`);
    return false;
  }
}

function begin(resume?: unknown): void {
  try {
    const next = createSession(storyCampaign, upgradeStorySave(resume));
    releaseMenu?.();
    releaseBlur?.();
    releaseInventory?.();
    releaseMenu = null;
    releaseBlur = null;
    releaseInventory = null;
    inventoryOpen = false;
    menuOpen = false;
    session = next;
    started = true;
    selectedItem = undefined;
    lastItem = undefined;
    highlighted = null;
    inventoryKey = "";
    objectsKey = "";
    lastSavedRevision = -1;
    storageFailed = false;
    visible("modal-backdrop", false);
    visible("inventory-panel", false);
    visible("title-screen", false);
    audio.start();
    audio.setPaused(false);
    selectVerb("walk");
    render();
  } catch (error) {
    notify(`Unable to load this game. Your save was not changed. ${describeError(error)}`);
  }
}

function load(slot: Slot): void {
  try {
    const save = readSave(slot, storyCampaign.id);
    if (!save) {
      notify("There is no game in that slot yet.");
      return;
    }
    begin(save.resume);
  } catch (error) {
    notify(`Unable to read this save. ${describeError(error)}`);
  }
}

function saveRows(): void {
  const container = element("save-slots", HTMLDivElement);
  container.replaceChildren();
  for (const slot of ["auto", "1", "2", "3"] as const) {
    const row = document.createElement("div");
    row.className = "save-row";
    const description = document.createElement("div");
    description.className = "save-description";
    const name = document.createElement("div");
    const detail = document.createElement("small");
    name.textContent = slot === "auto" ? "Autosave" : `Personal log ${slot}`;
    let available = false;
    try {
      const save = readSave(slot, storyCampaign.id);
      available = save !== null;
      detail.textContent = save ? `${save.label} / ${new Date(save.savedAt).toLocaleString()}` : "Empty slot";
    } catch (error) {
      detail.className = "save-error";
      detail.textContent = describeError(error);
    }
    description.append(name, detail);
    row.append(description);
    if (slot !== "auto") {
      const saveButton = document.createElement("button");
      saveButton.className = "quiet-button";
      saveButton.textContent = "Save";
      saveButton.setAttribute("aria-label", `Save to slot ${slot}`);
      saveButton.disabled = !started;
      saveButton.onclick = () => {
        if (safeSave(slot, session.view().objective)) saveRows();
      };
      row.append(saveButton);
    }
    const loadButton = document.createElement("button");
    loadButton.className = "quiet-button";
    loadButton.textContent = "Load";
    loadButton.setAttribute("aria-label", `Load ${slot === "auto" ? "autosave" : `slot ${slot}`}`);
    loadButton.disabled = !available;
    loadButton.onclick = () => load(slot);
    row.append(loadButton);
    container.append(row);
  }
}

function openMenu(title = "A brief interruption.", description?: string): void {
  if (menuOpen) return;
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  menuOpen = true;
  releaseMenu = session.pause("menu");
  if (started && !storageFailed) safeSave("auto", session.view().objective);
  text("modal-title", title);
  text("modal-description", description ?? "The universe will wait. All gameplay timers are paused.");
  visible("menu-content", description === undefined);
  visible("modal-backdrop", true);
  if (description === undefined) saveRows();
  audio.setPaused(true);
  render();
  element("close-modal", HTMLButtonElement).focus();
}

function closeMenu(): void {
  releaseMenu?.();
  releaseMenu = null;
  menuOpen = false;
  visible("modal-backdrop", false);
  audio.setPaused(!started || releaseBlur !== null);
  render();
  modalReturnFocus?.focus();
}

function selectVerb(verb: Verb): void {
  selectedVerb = verb;
  selectedItem = undefined;
  updateCursor();
}

function updateCursor(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-verb]")) {
    const active = selectedItem === undefined && button.dataset.verb === selectedVerb;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  text("action-help", selectedItem
    ? `Use ${storyCampaign.items[selectedItem]?.name ?? selectedItem} on an object. Escape cancels.`
    : `${selectedVerb[0]?.toUpperCase()}${selectedVerb.slice(1)} selected. Right-click to cycle actions.`);
  const drawing = selectedItem ? itemDrawing(selectedItem) : icons[selectedVerb];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16"><g fill="none" stroke="#111827" stroke-width="3">${drawing}</g><g fill="none" stroke="#fff2ca" stroke-width="1.2">${drawing}</g></svg>`;
  element("viewport", HTMLDivElement).style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, crosshair`;
  element("viewport", HTMLDivElement).dataset.cursor = selectedItem ? `item:${selectedItem}` : selectedVerb;
  inventoryKey = "";
}

function selectItem(id: string): void {
  if (!session.view().inventory.includes(id)) return;
  lastItem = id;
  selectedItem = id;
  selectedVerb = "use";
  updateCursor();
}

function openInventory(): void {
  const view = session.view();
  if (!started || menuOpen || view.scene.kind !== "adventure" || view.dialogue) return;
  inventoryOpen = true;
  inventoryMode = selectedVerb === "look" ? "look" : "select";
  releaseInventory = session.pause("menu");
  visible("inventory-panel", true);
  render();
  element("close-inventory", HTMLButtonElement).focus();
}

function closeInventory(): void {
  releaseInventory?.();
  releaseInventory = null;
  inventoryOpen = false;
  visible("inventory-panel", false);
  render();
  element("inventory-button", HTMLButtonElement).focus();
}

function cycleCursor(): void {
  const view = session.view();
  if (!started || menuOpen || inventoryOpen || view.dialogue || view.scene.kind !== "adventure") return;
  if (selectedItem) selectVerb("walk");
  else {
    const index = verbOrder.indexOf(selectedVerb);
    if (index === verbOrder.length - 1 && lastItem) selectItem(lastItem);
    else selectVerb(verbOrder[(index + 1) % verbOrder.length] ?? "walk");
  }
  audio.play("click");
  render();
}

function interact(hotspot: Hotspot): void {
  if (!started || menuOpen || inventoryOpen) return;
  if (selectedVerb === "walk") {
    session.dispatch({ type: "walk", destination: hotspot.approach });
  } else {
    session.dispatch({ type: "interact", verb: selectedVerb, target: hotspot.id, ...(selectedItem ? { item: selectedItem } : {}) });
  }
  audio.play("click");
}

function order(value: TacticalOrder): void {
  if (!started || menuOpen) return;
  session.dispatch({ type: "order", order: value });
  audio.play(value.type === "fire" ? "fire" : value.type === "engage" ? "warp" : "click");
  render();
}

function renderBattle(battle: Battle): void {
  const rules = encounterRules(session.view().progress);
  const blocked = chargeBlockReason(battle, rules);
  const effective = chargeRequirements(battle, rules);
  const requirements = ["Scan first"];
  if (effective.requiredTarget !== null) requirements.push(`${rules.targetNames[effective.requiredTarget]} to 0%`);
  if (effective.requiredManeuver !== null) requirements.push(effective.requiredManeuver === "hold" ? "Hold" : "Evade");
  for (const system of ["shields", "weapons", "engines"] as const) {
    if (effective.minimumPower[system] > 0) requirements.push(`${system} power ${effective.minimumPower[system]}+`);
  }
  text("tactical-objective", `${rules.action}: ${requirements.join(", ")}. Maintain until 100%.`);
  text("tactical-status", blocked !== null
    ? `${battle.engaged ? "Paused" : "Next"}: ${blocked}`
    : battle.engaged ? `${rules.action} in progress. Maintain formation and power.`
      : `Ready. Select ${rules.action}.`);
  text("hull-stat", `${Math.ceil(battle.hull)}%`);
  text("shield-label", `${battle.exposedArc[0]?.toUpperCase()}${battle.exposedArc.slice(1)} shield`);
  text("shield-stat", `${Math.ceil(battle.shields[battle.exposedArc])}%`);
  element("hull-meter", HTMLElement).style.width = `${battle.hull}%`;
  element("shield-meter", HTMLElement).style.width = `${battle.shields[battle.exposedArc]}%`;
  element("escape-meter", HTMLElement).style.width = `${battle.charge}%`;
  for (const system of ["shields", "weapons", "engines"] as const) text(`power-${system}`, String(battle.power[system]));
  text("target-stat", `${Math.ceil(battle.target === "engines" ? battle.enemyEngines : battle.enemyWeapons)}%`);
  text("scan-button", battle.scanned ? "Scan complete" : rules.source === "hazard" ? "Scan discharge" : "Scan pursuer");
  text("fire-button", battle.cooldownMs > 0 ? `Weapons charging ${Math.ceil(battle.cooldownMs / 1000)}s` : `Fire at ${rules.targetNames[battle.target].toLowerCase()}`);
  text("escape-button", battle.engaged ? `${rules.action} ${Math.floor(battle.charge)}%` : rules.action);
  element("scan-button", HTMLButtonElement).disabled = battle.scanned;
  element("fire-button", HTMLButtonElement).disabled = battle.cooldownMs > 0 || !battle.scanned || battle.power.weapons === 0
    || (battle.target === "engines" ? battle.enemyEngines : battle.enemyWeapons) === 0;
  element("escape-button", HTMLButtonElement).disabled = battle.engaged || blocked !== null;
  element("escape-button", HTMLButtonElement).title = blocked ?? `Begin ${rules.action.toLowerCase()}`;
  const threat = canAttack(battle, rules)
    ? `INCOMING ${Math.max(0, Math.ceil(battle.enemyAttackMs / 1000))}s`
    : `${rules.targetNames.weapons.toUpperCase()} OFFLINE`;
  text("battle-readout", `USS ENTERPRISE-D / NCC-1701-D\n${rules.name.toUpperCase()}\n${rules.action.toUpperCase()} ${Math.floor(battle.charge)}% / ${threat}`);
  element("battle-readout", HTMLDivElement).style.whiteSpace = "pre-line";
  text("battle-log", battle.log);
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-target]")) {
    button.classList.toggle("active", button.dataset.target === battle.target);
    const label = button.dataset.target === "engines" ? rules.targetNames.engines : rules.targetNames.weapons;
    if (button.textContent !== label) button.textContent = label;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-maneuver]")) {
    button.classList.toggle("active", button.dataset.maneuver === battle.maneuver);
  }
}

function render(): void {
  const view = session.view();
  const room = storyCampaign.rooms[view.room];
  if (!room) throw new Error(`Unknown room: ${view.room}`);
  const chapter = chapterInfo(view.progress);
  text("chapter-number", `CHAPTER ${String(chapter.number).padStart(2, "0")} / ${chapter.label}`);
  text("chapter-title", chapter.title);
  text("chapter-tag", String(chapter.number).padStart(2, "0"));
  text("chapter-log", `"${chapter.log}"`);
  text("new-game-button", "Restart adventure");
  text("room-title", room.name);
  text("room-caption", room.caption);
  text("objective", view.objective);
  const timer = element("timer", HTMLDivElement);
  const seconds = view.countdownMs === null ? null : Math.max(0, Math.ceil(view.countdownMs / 1000));
  const timerValue = seconds === null ? "SYSTEMS NOMINAL" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const timerState = seconds === null ? "PROBABLY" : view.paused || view.scene.kind !== "adventure" ? "BREACH COUNTDOWN / PAUSED" : "WARP CORE BREACH";
  if (timer.dataset.value !== `${timerValue}|${timerState}`) {
    timer.replaceChildren(document.createTextNode(timerValue));
    const label = document.createElement("small");
    label.textContent = timerState;
    timer.append(label);
    timer.dataset.value = `${timerValue}|${timerState}`;
  }
  timer.classList.toggle("danger", seconds !== null);
  const canUseInventory = started && view.scene.kind === "adventure" && view.dialogue === null && !menuOpen;
  const playable = canUseInventory && !inventoryOpen;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-verb]")) button.disabled = !playable;
  element("hint-button", HTMLButtonElement).disabled = !playable;
  element("objects-button", HTMLButtonElement).disabled = !playable;
  element("inventory-button", HTMLButtonElement).disabled = !canUseInventory;
  if (lastItem && !view.inventory.includes(lastItem)) lastItem = undefined;
  if (selectedItem && !view.inventory.includes(selectedItem)) {
    selectedItem = undefined;
    selectVerb("use");
  }
  text("selected-item-name", lastItem ? storyCampaign.items[lastItem]?.name ?? lastItem : "No item");
  element("selected-item-icon", HTMLSpanElement).className = `item-icon ${lastItem ?? ""}`;
  const selected = lastItem ? storyCampaign.items[lastItem] : undefined;
  element("selected-item-icon", HTMLSpanElement).style.backgroundImage = selected ? itemImage(selected.id, selected.color) : "";
  element("selected-item-button", HTMLButtonElement).disabled = !playable || !lastItem;
  element("selected-item-button", HTMLButtonElement).classList.toggle("active", selectedItem !== undefined);
  element("inventory-select", HTMLButtonElement).classList.toggle("active", inventoryMode === "select");
  element("inventory-look", HTMLButtonElement).classList.toggle("active", inventoryMode === "look");
  text("inventory-help", inventoryMode === "look" ? "Choose an item to inspect it." : "Select an item to use it as your cursor.");
  const nextInventoryKey = `${view.inventory.join("|")}:${selectedItem}:${inventoryMode}:${canUseInventory}`;
  if (inventoryKey !== nextInventoryKey) {
    inventoryKey = nextInventoryKey;
    const inventory = element("inventory-items", HTMLDivElement);
    inventory.replaceChildren();
    if (view.inventory.length === 0) {
      const empty = document.createElement("span");
      empty.className = "empty-inventory";
      empty.textContent = "Your pockets are impressively unprepared.";
      inventory.append(empty);
    }
    for (const id of view.inventory) {
      const item = storyCampaign.items[id];
      if (!item) continue;
      const button = document.createElement("button");
      button.className = `item ${id === selectedItem ? "active" : ""}`;
      button.dataset.item = id;
      button.disabled = !canUseInventory;
      button.setAttribute("aria-label", item.name);
      button.setAttribute("aria-pressed", String(id === selectedItem));
      const icon = document.createElement("span");
      icon.className = `item-icon ${id}`;
      icon.style.backgroundImage = itemImage(id, item.color);
      icon.setAttribute("aria-hidden", "true");
      button.append(icon, document.createTextNode(item.name));
      button.onclick = () => {
        if (inventoryMode === "look") openMenu(item.name, item.description);
        else {
          selectItem(id);
          closeInventory();
          audio.play("click");
          render();
        }
      };
      inventory.append(button);
    }
  }
  visible("clear-item", selectedItem !== undefined);
  const nextObjectsKey = `${view.room}:${selectedVerb}:${playable}`;
  if (objectsKey !== nextObjectsKey) {
    objectsKey = nextObjectsKey;
    const list = element("objects-list", HTMLDivElement);
    list.replaceChildren();
    for (const hotspot of room.hotspots) {
      const button = document.createElement("button");
      button.className = "object-button";
      button.dataset.hotspot = hotspot.id;
      button.disabled = !playable;
      button.textContent = hotspot.name;
      button.onmouseenter = () => { highlighted = hotspot.id; };
      button.onmouseleave = () => { highlighted = null; };
      button.onclick = () => interact(hotspot);
      list.append(button);
    }
  }
  visible("objects-card", showObjects && view.scene.kind === "adventure" && started);
  visible("dialogue", started && view.dialogue !== null);
  element("dialogue", HTMLDivElement).classList.toggle("interaction", Boolean(view.dialogue?.animation));
  if (view.dialogue) {
    text("speaker", view.dialogue.speaker);
    text("dialogue-text", view.dialogue.lines[view.dialogue.index] ?? "");
    text("dialogue-position", `TIME IS PAUSED / ${view.dialogue.index + 1} OF ${view.dialogue.lines.length}`);
  }
  const cinematic = started && view.scene.kind === "cutscene";
  visible("subtitle", cinematic && view.dialogue === null);
  visible("skip-button", cinematic);
  visible("cutscene-title", cinematic);
  if (view.scene.kind === "cutscene") {
    const sequence = storyCampaign.sequences[view.scene.id];
    const frame = sequence?.frames[view.scene.frame];
    text("subtitle-speaker", frame?.speaker ?? "");
    text("subtitle-text", frame?.text ?? "");
    text("cutscene-title", sequence?.title ?? "");
  }
  const combat = started && view.scene.kind === "combat";
  visible("tactical-card", combat);
  visible("battle-readout", combat);
  visible("battle-log", combat);
  visible("mission-card", !combat);
  visible("log-card", !combat);
  if (view.scene.kind === "combat") renderBattle(view.scene.battle);
  visible("failure-screen", started && view.scene.kind === "failure");
  if (view.scene.kind === "failure") text("failure-reason", view.scene.reason);
  visible("complete-screen", started && view.scene.kind === "complete");
  text("complete-label", chapter.next ? `CHAPTER ${String(chapter.number).padStart(2, "0")} COMPLETE` : "ALL FIVE CHAPTERS COMPLETE");
  text("complete-title", chapter.next ? `${chapter.title.replace(/\.$/, "")} complete.` : "Your shift is finally over.");
  text("complete-description", chapter.ending);
  text("complete-next", chapter.next ? `Next: ${chapter.next}` : "The crew is home. The ship is safe. The mop is yours.");
  text("next-chapter-button", `Continue to chapter ${chapter.number + 1}`);
  visible("next-chapter-button", chapter.next !== null);
  if (started && !storageFailed && !view.destination && view.revision !== lastSavedRevision && !menuOpen) {
    safeSave("auto", view.objective);
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-verb]")) {
  button.onclick = () => {
    const verb = button.dataset.verb;
    if (verb === "walk" || verb === "look" || verb === "talk" || verb === "use" || verb === "smell" || verb === "taste") {
      selectVerb(verb);
      audio.play("click");
      render();
    }
  };
}

function bind(id: string, handler: () => void): void {
  element(id, HTMLButtonElement).onclick = handler;
}

function confirmRestart(): void {
  if (!started) { begin(); return; }
  openMenu("Start another shift?", "This restarts the whole adventure from chapter one and replaces the autosave. Your three manual save slots remain unchanged.");
  const description = element("modal-description", HTMLParagraphElement);
  const confirm = document.createElement("button");
  confirm.className = "primary";
  confirm.textContent = "Restart adventure";
  confirm.style.display = "block";
  confirm.style.marginTop = "20px";
  confirm.onclick = () => begin();
  description.append(confirm);
}

bind("start-button", () => begin());
bind("continue-button", () => load("auto"));
bind("menu-button", () => menuOpen ? closeMenu() : openMenu());
bind("close-modal", closeMenu);
bind("resume-button", closeMenu);
bind("failure-load", () => openMenu());
bind("complete-save", () => openMenu());
bind("next-chapter-button", () => {
  session.dispatch({ type: "continue-chapter" });
  highlighted = null;
  render();
});
bind("new-game-button", () => { closeMenu(); confirmRestart(); });
bind("replay-button", confirmRestart);
bind("dismiss-notice", () => visible("notice", false));
bind("clear-item", () => { selectedItem = undefined; selectVerb("use"); render(); });
bind("inventory-button", () => inventoryOpen ? closeInventory() : openInventory());
bind("close-inventory", closeInventory);
bind("inventory-select", () => { inventoryMode = "select"; render(); });
bind("inventory-look", () => { inventoryMode = "look"; render(); });
bind("selected-item-button", () => { if (lastItem) selectItem(lastItem); render(); });
bind("retry-button", () => {
  session.dispatch({ type: "retry" });
  selectedItem = undefined;
  inventoryKey = "";
  lastSavedRevision = -1;
  render();
});
bind("next-button", () => { session.dispatch({ type: "dialogue-next" }); audio.play("click"); render(); });
bind("hint-button", () => { session.dispatch({ type: "hint" }); render(); });
bind("skip-button", () => {
  const scene = session.view().scene;
  if (scene.kind === "cutscene") session.dispatch({ type: "finish-cutscene", token: scene.token });
  render();
});
bind("objects-button", () => {
  showObjects = !showObjects;
  element("objects-button", HTMLButtonElement).setAttribute("aria-expanded", String(showObjects));
  render();
});
bind("scan-button", () => order({ type: "scan" }));
bind("fire-button", () => order({ type: "fire" }));
bind("escape-button", () => order({ type: "engage" }));
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-power]")) {
  button.onclick = () => {
    const system = button.dataset.power;
    if (system === "shields" || system === "weapons" || system === "engines") {
      order({ type: "power", system, delta: button.dataset.delta === "1" ? 1 : -1 });
    }
  };
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-target]")) {
  button.onclick = () => order({ type: "target", target: button.dataset.target === "weapons" ? "weapons" : "engines" });
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-maneuver]")) {
  button.onclick = () => {
    const maneuver = button.dataset.maneuver;
    if (maneuver === "hold" || maneuver === "evade" || maneuver === "turn") order({ type: "maneuver", maneuver });
  };
}

const musicVolume = element("music-volume", HTMLInputElement);
const effectsVolume = element("effects-volume", HTMLInputElement);
const updateVolumes = () => audio.setVolumes(Number(musicVolume.value) / 100, Number(effectsVolume.value) / 100);
musicVolume.oninput = updateVolumes;
effectsVolume.oninput = updateVolumes;
reducedMotionInput.onchange = () => { reducedMotion = reducedMotionInput.checked; };

document.addEventListener("keydown", event => {
  if (event.key === "Tab" && (menuOpen || inventoryOpen)) {
    const controls = Array.from(element(menuOpen ? "modal-backdrop" : "inventory-panel", HTMLDivElement).querySelectorAll<HTMLElement>("button:not(:disabled), input"))
      .filter(node => node.offsetParent !== null);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    return;
  }
  if (event.target instanceof HTMLInputElement && event.key !== "Escape") return;
  if (event.key === "Escape") {
    event.preventDefault();
    if (menuOpen) closeMenu();
    else if (inventoryOpen) closeInventory();
    else if (selectedItem) { selectedItem = undefined; selectVerb("use"); render(); }
    else openMenu();
    return;
  }
  if (!started || menuOpen || event.repeat) return;
  if (event.key.toLowerCase() === "i") {
    inventoryOpen ? closeInventory() : openInventory();
    return;
  }
  if (inventoryOpen) return;
  const view = session.view();
  if (event.code === "Space" && view.dialogue) {
    event.preventDefault();
    session.dispatch({ type: "dialogue-next" });
  } else if (event.key.toLowerCase() === "s" && view.scene.kind === "cutscene") {
    session.dispatch({ type: "finish-cutscene", token: view.scene.token });
  } else if (view.scene.kind === "adventure" && view.dialogue === null) {
    const verbs: Record<string, Verb> = { w: "walk", l: "look", t: "talk", u: "use", n: "smell", y: "taste" };
    const verb = verbs[event.key.toLowerCase()];
    if (verb) selectVerb(verb);
    if (event.key.toLowerCase() === "h") {
      showObjects = !showObjects;
      element("objects-button", HTMLButtonElement).setAttribute("aria-expanded", String(showObjects));
    }
  }
  render();
});

function blur(): void {
  if (releaseBlur) return;
  releaseBlur = session.pause("blur");
  if (started && !storageFailed) safeSave("auto", session.view().objective);
  audio.setPaused(true);
}

function focus(): void {
  if (document.hidden) return;
  releaseBlur?.();
  releaseBlur = null;
  audio.setPaused(menuOpen || !started);
}
window.addEventListener("blur", blur);
window.addEventListener("focus", focus);
document.addEventListener("visibilitychange", () => document.hidden ? blur() : focus());
window.addEventListener("pagehide", () => { if (started && !storageFailed) safeSave("auto", session.view().objective); });
element("viewport", HTMLDivElement).addEventListener("contextmenu", event => {
  event.preventDefault();
  cycleCursor();
});

class AdventureScene extends Phaser.Scene {
  private paint!: Phaser.GameObjects.Graphics;
  private focusPaint!: Phaser.GameObjects.Graphics;

  create(): void {
    this.paint = this.add.graphics();
    this.focusPaint = this.add.graphics();
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const view = session.view();
      const room = storyCampaign.rooms[view.room];
      const hit = room?.hotspots.find(hotspot => Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(
        hotspot.bounds.x, hotspot.bounds.y, hotspot.bounds.width, hotspot.bounds.height,
      ), pointer.x, pointer.y));
      highlighted = hit?.id ?? null;
    });
    this.input.on("gameout", () => { highlighted = null; });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown() || !started || menuOpen || inventoryOpen) return;
      const view = session.view();
      if (view.dialogue || view.scene.kind !== "adventure") return;
      const room = storyCampaign.rooms[view.room];
      const hit = room?.hotspots.find(hotspot => pointer.x >= hotspot.bounds.x && pointer.x <= hotspot.bounds.x + hotspot.bounds.width &&
        pointer.y >= hotspot.bounds.y && pointer.y <= hotspot.bounds.y + hotspot.bounds.height);
      if (hit) interact(hit);
      else if (selectedVerb === "walk") session.dispatch({ type: "walk", destination: { x: pointer.x, y: pointer.y } });
      else openMenu(room?.name ?? "No target", selectedVerb === "look" ? room?.caption ?? "Nothing unusual here." : "Choose a room object for that action.");
    });
  }

  update(_time: number, delta: number): void {
    if (fatal) return;
    try {
      if (!session.view().paused) clock += Math.min(delta, 100) / 1000;
      if (started) session.advance(Math.min(delta, 100));
      const view = session.view();
      const room = storyCampaign.rooms[view.room];
      if (!room) throw new Error(`Room "${view.room}" is missing.`);
      drawScene(this.paint, view, room, clock, reducedMotion, {
        chapter: chapterInfo(view.progress).number, combat: encounterRules(view.progress),
      });
      this.focusPaint.clear();
      const hit = room.hotspots.find(hotspot => hotspot.id === highlighted);
      if (hit && started && view.scene.kind === "adventure" && !view.dialogue && !menuOpen) {
        this.focusPaint.lineStyle(1, 0xa8ead2, 0.8);
        this.focusPaint.strokeRect(hit.bounds.x, hit.bounds.y, hit.bounds.width, hit.bounds.height);
        text("hover-label", `${selectedItem ? storyCampaign.items[selectedItem]?.name ?? selectedItem : selectedVerb} / ${hit.name}`);
        visible("hover-label", true);
      } else visible("hover-label", false);
      if (started && view.destination && !view.paused && clock - lastSoundTime > 0.33) {
        audio.play("step");
        lastSoundTime = clock;
      }
      if (started && view.countdownMs !== null && view.countdownMs < 60000 && !view.paused && clock - lastAlarmTime > 2.4) {
        audio.play("alarm");
        lastAlarmTime = clock;
      }
      audio.tick();
      render();
    } catch (error) {
      fatal = true;
      console.error(error);
      notify(`The ship computer encountered an error. Your last save is preserved. Reload to recover. ${describeError(error)}`);
    }
  }
}

try {
  const save = readSave("auto", storyCampaign.id);
  visible("continue-button", save !== null);
} catch (error) {
  notify(`Saved progress could not be read. It has not been overwritten. ${describeError(error)}`);
}

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "viewport",
  width: 640,
  height: 360,
  backgroundColor: "#080e1b",
  pixelArt: true,
  roundPixels: true,
  render: { antialias: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: AdventureScene,
  audio: { noAudio: true },
});
render();
