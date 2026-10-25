import type { DialogueContent, InteractionAnimation, RuleResult, World } from "../game/types";

export interface DialogueOptions {
  readonly speaker?: string;
  readonly animation?: InteractionAnimation;
}

export function reply<P>(
  world: World<P>, lines: string | readonly string[], options: DialogueOptions = {},
): RuleResult<P> & { readonly dialogue: DialogueContent } {
  return {
    world,
    dialogue: {
      speaker: options.speaker ?? "Roger",
      lines: typeof lines === "string" ? [lines] : lines,
      ...(options.animation ? { animation: options.animation } : {}),
    },
  };
}
