export type Slot = "auto" | "1" | "2" | "3";

export interface SavedGame {
  readonly format: 1;
  readonly campaign: string;
  readonly label: string;
  readonly savedAt: string;
  readonly resume: unknown;
}

const prefix = "star-quest-2.save.";

export function readSave(slot: Slot, campaign: string): SavedGame | null {
  const value = localStorage.getItem(prefix + slot);
  if (value === null) return null;
  const data: unknown = JSON.parse(value);
  if (
    typeof data !== "object" || data === null ||
    !("format" in data) || data.format !== 1 ||
    !("campaign" in data) || data.campaign !== campaign ||
    !("label" in data) || typeof data.label !== "string" ||
    !("savedAt" in data) || typeof data.savedAt !== "string" ||
    !("resume" in data)
  ) {
    throw new Error("This save is damaged or belongs to an unsupported version. It has not been overwritten.");
  }
  return {
    format: 1,
    campaign: data.campaign,
    label: data.label,
    savedAt: data.savedAt,
    resume: data.resume,
  };
}

export function writeSave(slot: Slot, campaign: string, resume: unknown, label: string): void {
  const data: SavedGame = {
    format: 1,
    campaign,
    label: label.slice(0, 60),
    savedAt: new Date().toISOString(),
    resume,
  };
  localStorage.setItem(prefix + slot, JSON.stringify(data));
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
