import type Phaser from "phaser";
import type { Battle, CombatRules, Room, SessionView, ShieldArc } from "../game/types";
import { canAttack } from "../game/combat";
import { laterSequences } from "../content/story-content";

const C = {
  void: 0x070c1b,
  shadow: 0x0c1327,
  wall: 0x17243b,
  panel: 0x20324c,
  steel: 0x354965,
  edge: 0x536784,
  mist: 0x91adc3,
  white: 0xd8f3ed,
  teal: 0x55dcc5,
  cyan: 0x74cbea,
  blue: 0x3975bb,
  navy: 0x23477c,
  purple: 0x8872d7,
  plum: 0x443d72,
  gold: 0xd9b773,
  ochre: 0x967748,
  red: 0xed7285,
  darkRed: 0x653447,
  skin: 0xe4b596,
  skinShade: 0xab7774,
  hair: 0xe3c477,
  beige: 0xc2b39b,
  taupe: 0x998d7e,
  taupeShade: 0x70675e,
  cream: 0xe0d2b8,
  bronze: 0x967251,
  wood: 0xaf835a,
  woodShade: 0x694e3d,
  carpet: 0x613e48,
  carpetLight: 0x79505a,
  lcarsOrange: 0xe7a36d,
  lcarsPeach: 0xecc6a0,
  lcarsLilac: 0xb3a5cf,
  hull: 0xa6b7c0,
  hullLight: 0xd0dadd,
  hullShade: 0x71848f,
  bussard: 0xf16a53,
  warp: 0x66b6fa,
} satisfies Record<string, number>;

type PaintMethod = "clear" | "fillStyle" | "lineStyle" | "fillRect" | "lineBetween"
  | "fillTriangle" | "fillEllipse" | "fillCircle" | "fillPoints";
export type SceneGraphics = {
  [K in PaintMethod]: (...args: Parameters<Phaser.GameObjects.Graphics[K]>) => unknown;
};
type Graphics = SceneGraphics;
type Cutscene = Extract<SessionView<unknown>["scene"], { kind: "cutscene" }>;
type Heading = "up" | "right";
type PixelPainter = (x: number, y: number, w: number, h: number, color: number) => void;

function rect(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha = 1,
): void {
  const left = Math.round(x);
  const top = Math.round(y);
  g.fillStyle(color, alpha);
  g.fillRect(left, top, Math.round(x + width) - left, Math.round(y + height) - top);
}

function line(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
  alpha = 1,
  width = 1,
): void {
  g.lineStyle(width, color, alpha);
  g.lineBetween(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2));
}

function triangle(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  color: number,
  alpha = 1,
): void {
  g.fillStyle(color, alpha);
  g.fillTriangle(
    Math.round(x1), Math.round(y1),
    Math.round(x2), Math.round(y2),
    Math.round(x3), Math.round(y3),
  );
}

function ellipse(
  g: Graphics,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: number,
  alpha = 1,
): void {
  for (let row = -Math.ceil(ry); row < ry; row += 1) {
    const fraction = (row + 0.5) / ry;
    const span = Math.round(rx * Math.sqrt(Math.max(0, 1 - fraction * fraction)));
    rect(g, x - span, y + row, span * 2, 1, color, alpha);
  }
}

function glow(
  g: Graphics,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: number,
  strength: number,
): void {
  for (let layer = 6; layer > 0; layer -= 1) {
    g.fillStyle(color, strength * (1 - layer / 7) / 3);
    g.fillEllipse(Math.round(x), Math.round(y), Math.round(rx * layer / 3), Math.round(ry * layer / 3));
  }
}

function lcars(g: Graphics, x: number, y: number, w: number, h: number, seed = 0): void {
  rect(g, x, y, w, h, C.void);
  rect(g, x + 2, y + 4, 8, h - 8, C.lcarsOrange);
  rect(g, x + 5, y + 1, w - 8, 5, C.lcarsOrange);
  rect(g, x + 10, y + 6, 5, 3, C.lcarsOrange);
  rect(g, x + 2, y + h - 10, 8, 2, C.void);
  rect(g, x + 6, y + h - 5, 14, 4, C.lcarsLilac);
  rect(g, x + 10, y + 9, 4, h - 15, C.void);
  for (let row = 0; row < Math.floor((h - 14) / 6); row += 1) {
    const yy = y + 11 + row * 6;
    rect(g, x + 19, yy, 9, 3, (row + seed) % 3 === 0 ? C.lcarsLilac : C.lcarsPeach);
    rect(g, x + 32, yy, Math.max(3, (w - 39) * (0.45 + hash(row, seed) * 0.5)), 2,
      row % 2 === 0 ? C.lcarsOrange : C.lcarsLilac, 0.85);
  }
  rect(g, x + w - 14, y + 1, 2, 5, C.void);
}

function light(g: Graphics, x: number, y: number, color: number, strength = 1): void {
  rect(g, x - 6, y - 4, 15, 11, color, 0.045 * strength);
  rect(g, x - 2, y - 1, 7, 5, color, 0.18 * strength);
  rect(g, x, y, 3, 2, color, 0.85 * strength);
}

function sparkle(g: Graphics, x: number, y: number, color: number, alpha = 1): void {
  rect(g, x - 3, y, 7, 1, color, alpha * 0.7);
  rect(g, x, y - 3, 1, 7, color, alpha * 0.7);
  rect(g, x - 1, y - 1, 3, 3, color, alpha);
}

function hash(index: number, seed: number): number {
  const value = Math.imul(index + 1, 374761393) ^ Math.imul(seed + 1, 668265263);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
}

function stars(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  time: number,
  seed: number,
  count: number,
): void {
  rect(g, x, y, width, height, C.void);
  for (let band = 0; band < 8; band += 1) {
    rect(g, x, y + height * band / 8, width, height / 8, C.blue, (1 - band / 8) * 0.045);
  }
  for (let i = 0; i < 15; i += 1) {
    const cloudX = x + 8 + hash(i, seed + 2) * Math.max(0, width - 65);
    const cloudY = y + 6 + hash(i, seed + 3) * Math.max(0, height - 40);
    glow(g, cloudX + 18, cloudY + 8, 24, 14, C.purple, 0.075);
    glow(g, cloudX + 24, cloudY + 12, 18, 9, C.blue, 0.065);
  }
  for (let i = 0; i < count; i += 1) {
    const sx = x + 4 + hash(i, seed) * (width - 9);
    const sy = y + 4 + hash(i, seed + 1) * (height - 9);
    const twinkle = 0.45 + 0.2 * Math.sin(time * 0.65 + i * 2.7);
    const color = i % 9 === 0 ? C.gold : i % 3 === 0 ? C.cyan : C.mist;
    if (i % 23 === 0) sparkle(g, sx, sy, color, twinkle + 0.15);
    else rect(g, sx, sy, i % 11 === 0 ? 2 : 1, 1, color, twinkle);
  }
}

function planet(g: Graphics, x: number, y: number, radius: number): void {
  g.fillStyle(C.blue, 0.08);
  g.fillCircle(Math.round(x), Math.round(y), radius + 9);
  g.fillStyle(C.cyan, 0.16);
  g.fillCircle(Math.round(x), Math.round(y), radius + 3);
  g.fillStyle(C.panel, 1);
  g.fillCircle(Math.round(x), Math.round(y), radius);
  for (let row = -radius + 4; row < radius - 3; row += 5) {
    const span = Math.floor(Math.sqrt(radius * radius - row * row));
    const left = x - span;
    rect(g, left, y + row, Math.max(1, span * 0.37), 4, C.blue, 0.5);
    rect(g, left + 2, y + row, Math.max(1, span * 0.1), 2, C.teal, 0.55);
    if (row % 3 === 0) {
      rect(g, left + span * 0.18, y + row, span * 0.5, 3, C.mist, 0.17);
    }
  }
}

function panel(g: Graphics, x: number, y: number, w: number, h: number): void {
  rect(g, x + 3, y + 4, w, h, C.void, 0.65);
  rect(g, x, y, w, h, C.taupeShade);
  rect(g, x + 2, y + 2, w - 4, h - 4, C.beige);
  rect(g, x + 3, y + 4, w - 6, h - 7, C.taupe);
  rect(g, x + 3, y + 2, w - 6, 1, C.cream);
  rect(g, x + 4, y + h - 4, w - 8, 2, C.shadow);
  for (const dx of [5, w - 7]) {
    rect(g, x + dx, y + 5, 2, 2, C.mist, 0.45);
    rect(g, x + dx, y + h - 8, 2, 2, C.mist, 0.3);
  }
}

function vents(g: Graphics, x: number, y: number, count: number, w: number): void {
  for (let i = 0; i < count; i += 1) {
    rect(g, x, y + i * 5, w, 2, C.void, 0.85);
    rect(g, x + 1, y + i * 5 + 2, w - 2, 1, C.edge, 0.4);
  }
}

function caution(g: Graphics, x: number, y: number, width: number): void {
  rect(g, x, y, width, 5, C.shadow);
  for (let i = 0; i < width - 4; i += 10) {
    rect(g, x + i + 2, y, 4, 2, C.gold, 0.75);
    rect(g, x + i, y + 2, 4, 3, C.ochre, 0.8);
  }
}

function door(g: Graphics, side: "left" | "right", alarm: boolean): void {
  const x = side === "left" ? 0 : 610;
  const y = side === "left" ? 175 : 170;
  const h = side === "left" ? 120 : 125;
  rect(g, x, y - 5, 30, h + 5, C.void);
  rect(g, x + (side === "left" ? 0 : 6), y, 24, h, C.beige);
  rect(g, x + (side === "left" ? 0 : 13), y + 7, 17, h - 9, C.shadow);
  rect(g, x + (side === "left" ? 24 : 4), y + 5, 2, h - 12, alarm ? C.red : C.cream, 0.7);
  for (let i = 0; i < 6; i += 1) {
    rect(g, x + (side === "left" ? 3 : 22), y + 13 + i * 15, 6, 8, C.taupeShade);
  }
  rect(g, x + 1, y + h - 9, 28, 8, C.edge);
  rect(g, x + 2, y + h - 7, 26, 2, C.gold, 0.65);
  light(g, x + (side === "left" ? 20 : 7), y - 7, alarm ? C.red : C.lcarsOrange);
}

function floor(g: Graphics, tint: number): void {
  rect(g, 30, 238, 580, 95, C.taupeShade);
  rect(g, 30, 240, 580, 88, C.carpet, 0.65);
  for (let band = 0; band < 10; band += 1) {
    rect(g, 30, 240 + band * 9, 580, 9, C.void, band * 0.012);
  }
  for (let i = 0; i < 170; i += 1) {
    rect(g, 34 + hash(i, 45) * 570, 244 + hash(i, 46) * 77, 2, 1, C.beige, 0.055);
  }
  for (let i = -3; i <= 9; i += 1) {
    line(g, 320 + (i - 3) * 57, 239, 320 + (i - 3) * 102, 332, C.taupe, 0.14);
  }
  for (const y of [251, 270, 296, 332]) {
    rect(g, 30, y, 580, 1, C.void, 0.15);
    rect(g, 30, y + 1, 580, 1, C.taupe, 0.08);
  }
  rect(g, 31, 238, 578, 3, C.void);
  for (let band = 0; band < 5; band += 1) {
    rect(g, 31, 241 + band * 2, 578, 2, C.void, 0.2 - band * 0.04);
  }
  rect(g, 36, 242, 568, 1, tint, 0.22);
  rect(g, 37, 322, 566, 2, C.void);
  for (let x = 45; x < 610; x += 47) {
    rect(g, x, 326, 18, 2, tint, 0.42);
    rect(g, x + 3, 329, 12, 1, tint, 0.1);
  }
  rect(g, 0, 333, 640, 27, C.void);
  rect(g, 0, 334, 640, 2, C.bronze);
  rect(g, 49, 343, 542, 1, C.panel);
  for (let x = 75; x < 600; x += 82) {
    rect(g, x, 344, 28, 3, C.shadow);
  }
}

function shell(g: Graphics, time: number, alarm: boolean, tint: number): void {
  rect(g, 0, 0, 640, 360, C.void);
  rect(g, 24, 28, 592, 211, C.taupe);
  for (let i = 0; i < 8; i += 1) {
    const x = 30 + i * 74;
    rect(g, x, 40, 70, 173, i % 2 === 0 ? C.beige : C.taupe, 0.65);
    rect(g, x + 1, 41, 67, 1, C.cream, 0.4);
    rect(g, x + 68, 43, 2, 166, C.taupeShade, 0.7);
    rect(g, x + 10, 219, 49, 5, C.void, 0.65);
    rect(g, x + 12, 219, 18, 1, C.edge, 0.5);
  }
  for (let band = 0; band < 19; band += 1) {
    rect(g, 24, 40 + band * 10, 592, 10, C.void, band * 0.01);
  }
  rect(g, 24, 32, 592, 5, C.void, 0.25);
  rect(g, 0, 0, 640, 25, C.taupeShade);
  rect(g, 0, 25, 640, 5, C.bronze);
  rect(g, 18, 30, 604, 2, C.cream, 0.6);
  rect(g, 44, 10, 552, 2, C.beige, 0.35);
  for (const x of [62, 179, 449, 563]) {
    glow(g, x + 9, 73, 46, 42, C.cream, 0.17);
    rect(g, x, 15, 18, 8, C.void);
    rect(g, x + 2, 18, 14, 2, C.cream, 0.85);
  }
  for (const x of [13, 616]) {
    rect(g, x, 35, 11, 132, C.bronze);
    rect(g, x + 2, 35, 2, 132, C.beige);
    vents(g, x + 4, 48, 7, 4);
  }
  rect(g, 29, 229, 582, 8, C.bronze);
  rect(g, 33, 231, 574, 3, C.taupeShade);
  floor(g, tint);
  const signal = alarm ? C.red : tint;
  const intensity = alarm ? 0.7 + Math.sin(time * 4) * 0.3 : 0.55;
  for (const x of [36, 591]) {
    panel(g, x - 3, 46, 20, 12);
    rect(g, x, 50, 14, 4, signal, intensity);
    rect(g, x - 12, 37, 39, 28, signal, 0.045 * intensity);
  }
}

function engineering(g: Graphics, time: number, alarm: boolean): void {
  shell(g, time, alarm, C.lcarsOrange);
  rect(g, 199, 32, 242, 200, C.taupeShade);
  rect(g, 230, 33, 180, 190, C.shadow);
  rect(g, 244, 34, 152, 184, C.taupeShade, 0.65);
  glow(g, 320, 132, 77, 100, C.warp, 0.32);
  glow(g, 320, 251, 82, 22, C.warp, 0.22);
  ellipse(g, 320, 236, 48, 7, C.void, 0.4);
  for (let i = 0; i < 7; i += 1) {
    rect(g, 303 + i, 243 + i * 5, 34 - i * 2, 2, C.warp, 0.12 - i * 0.014);
  }
  for (const x of [203, 426]) {
    rect(g, x, 33, 12, 192, C.bronze);
    rect(g, x + 2, 34, 4, 190, C.beige);
    rect(g, x + 7, 35, 2, 188, C.cream, 0.65);
  }
  for (const x of [69, 454]) {
    panel(g, x, 42, 116, 32);
    lcars(g, x + 5, 46, 106, 22, x);
  }
  rect(g, 70, 110, 222, 12, C.taupeShade);
  rect(g, 348, 110, 228, 12, C.taupeShade);
  rect(g, 73, 110, 218, 4, C.beige);
  rect(g, 349, 110, 224, 4, C.beige);
  rect(g, 231, 114, 60, 2, C.warp, 0.35);
  rect(g, 349, 114, 60, 2, C.warp, 0.35);
  for (const x of [82, 132, 184, 235, 391, 442, 494, 548]) {
    rect(g, x, 83, 4, 27, C.bronze);
    rect(g, x, 84, 1, 24, C.cream);
  }
  for (const x of [72, 349]) {
    rect(g, x, 80, 222, 4, C.bronze);
    rect(g, x, 80, 222, 1, C.cream);
    rect(g, x, 96, 222, 2, C.bronze);
  }
  rect(g, 236, 145, 168, 16, C.bronze);
  rect(g, 237, 147, 166, 9, C.taupe);
  rect(g, 238, 148, 164, 2, C.cream, 0.7);
  for (const x of [244, 259, 374, 389]) rect(g, x, 143, 4, 20, C.taupeShade);

  const pulse = 0.65 + Math.sin(time * 3.5) * 0.15;
  rect(g, 297, 33, 46, 197, C.steel);
  rect(g, 302, 33, 36, 197, C.navy);
  rect(g, 307, 33, 26, 197, C.blue, pulse);
  rect(g, 313, 33, 14, 197, C.warp, pulse);
  rect(g, 318, 33, 4, 197, C.white, pulse * 0.75);
  for (let i = 0; i < 11; i += 1) {
    const y = 36 + ((i * 18 + time * 24) % 189);
    rect(g, 305, y, 30, 3, C.warp, 0.8);
    rect(g, 312, y, 16, 2, C.white, 0.85);
  }
  for (let y = 37; y < 226; y += 18) {
    line(g, 304, y, 316, y + 16, C.hullLight, 0.7, 2);
    line(g, 316, y + 16, 329, y, C.hullLight, 0.65, 2);
    line(g, 312, y, 336, y + 16, C.hullShade, 0.65);
    ellipse(g, 320, y + 16, 25, 4, C.hullShade);
    rect(g, 296, y + 14, 48, 3, C.hullLight);
    rect(g, 299, y + 14, 12, 1, C.white, 0.8);
    rect(g, 336, y + 14, 8, 3, C.navy, 0.45);
    rect(g, 299, y + 17, 42, 1, C.steel);
  }
  rect(g, 297, 34, 3, 192, C.hullShade);
  rect(g, 340, 34, 3, 192, C.hullShade);
  ellipse(g, 320, 151, 30, 8, C.hullLight);
  rect(g, 290, 151, 60, 23, C.hullShade);
  rect(g, 293, 154, 54, 16, C.panel);
  rect(g, 300, 156, 40, 12, C.warp, pulse);
  rect(g, 312, 155, 16, 14, C.white, pulse * 0.75);
  for (const x of [298, 307, 331, 340]) rect(g, x, 153, 3, 18, C.steel);
  ellipse(g, 320, 174, 30, 6, C.hullShade);
  rect(g, 291, 172, 58, 3, C.hullLight);
  ellipse(g, 320, 231, 41, 6, C.taupeShade);
  ellipse(g, 320, 228, 35, 5, C.beige);
  rect(g, 300, 246, 39, 3, C.warp, 0.065);

  // The diagnostics hotspot spans the two catwalk displays, leaving the core visible.
  for (const x of [248, 349]) {
    panel(g, x, 75, 43, 38);
    lcars(g, x + 4, 80, 35, 27, x);
    light(g, x + 33, 108, alarm ? C.red : C.lcarsOrange, 0.7);
  }
  rect(g, 248, 112, 144, 2, C.bronze);

  ellipse(g, 121, 233, 88, 9, C.void, 0.35);
  rect(g, 44, 223, 156, 9, C.shadow, 0.5);
  rect(g, 79, 182, 73, 44, C.bronze);
  rect(g, 86, 184, 57, 42, C.beige);
  rect(g, 94, 197, 40, 29, C.taupeShade);
  rect(g, 100, 206, 28, 20, C.shadow);
  rect(g, 73, 226, 84, 6, C.bronze);
  rect(g, 78, 227, 74, 2, C.cream);
  triangle(g, 49, 155, 188, 155, 207, 179, C.wood);
  triangle(g, 49, 155, 207, 179, 36, 179, C.wood);
  rect(g, 36, 179, 171, 8, C.woodShade);
  rect(g, 39, 179, 165, 2, C.lcarsPeach);
  triangle(g, 53, 159, 184, 159, 196, 175, C.void);
  triangle(g, 53, 159, 196, 175, 45, 175, C.void);
  rect(g, 53, 161, 12, 11, C.lcarsOrange);
  rect(g, 67, 161, 71, 3, C.lcarsOrange);
  rect(g, 67, 168, 9, 4, C.lcarsPeach);
  for (let i = 0; i < 8; i += 1) {
    rect(g, 79 + i * 12, 169, 8, 3, i % 3 === 0 ? C.lcarsLilac : C.lcarsOrange);
  }
  rect(g, 143, 161, 33, 4, C.lcarsLilac);
  rect(g, 46, 187, 101, 13, C.void);
  rect(g, 49, 190, 20, 5, C.lcarsOrange);
  rect(g, 74, 190, 44, 2, C.lcarsPeach);
  light(g, 135, 192, alarm ? C.red : C.lcarsLilac);
  rect(g, 151, 188, 45, 4, C.bronze);

  ellipse(g, 465, 236, 75, 6, C.void, 0.32);
  panel(g, 398, 160, 66, 75);
  lcars(g, 404, 165, 53, 18, 3);
  rect(g, 411, 188, 40, 29, C.void);
  rect(g, 421, 191, 8, 22, C.hullShade);
  rect(g, 425, 195, 19, 5, C.lcarsOrange);
  rect(g, 439, 192, 6, 12, C.bronze);
  rect(g, 410, 222, 42, 3, alarm ? C.red : C.lcarsLilac);
  light(g, 450, 166, alarm ? C.red : C.lcarsOrange);

  panel(g, 467, 167, 65, 64);
  ellipse(g, 499, 193, 18, 18, C.taupeShade);
  ellipse(g, 499, 192, 14, 15, C.hullLight);
  ellipse(g, 499, 192, 10, 11, C.panel);
  rect(g, 488, 180, 9, 2, C.white, 0.7);
  rect(g, 496, 182, 6, 21, C.blue);
  rect(g, 489, 189, 20, 6, C.hullShade);
  rect(g, 497, 190, 4, 4, C.warp);
  rect(g, 475, 214, 45, 10, C.void);
  for (let i = 0; i < 6; i += 1) rect(g, 478 + i * 7, 217, 4, 3, C.lcarsOrange);
  rect(g, 529, 177, 16, 6, C.taupeShade);
  rect(g, 535, 180, 7, 47, C.bronze);
  rect(g, 536, 184, 2, 39, C.beige);

  panel(g, 548, 140, 63, 85);
  lcars(g, 554, 147, 51, 60, 8);
  rect(g, 561, 212, 39, 5, C.void);
  rect(g, 563, 213, 11, 3, C.lcarsLilac);
  light(g, 591, 214, alarm ? C.red : C.lcarsOrange);
  door(g, "left", alarm);
  door(g, "right", alarm);
}

function alcove(g: Graphics, time: number, alarm: boolean): void {
  shell(g, time, alarm, C.gold);
  for (const x of [51, 208, 406, 575]) {
    rect(g, x, 64, 7, 162, C.steel);
    rect(g, x + 1, 64, 2, 162, C.edge, 0.7);
    for (const y of [87, 121, 189]) rect(g, x - 2, y, 11, 5, C.panel);
  }
  rect(g, 57, 66, 351, 6, C.steel);
  rect(g, 58, 67, 347, 1, C.mist, 0.35);
  panel(g, 70, 130, 125, 95);
  rect(g, 78, 138, 109, 71, C.shadow);
  for (let y = 143; y < 209; y += 9) {
    for (let x = 82; x < 184; x += 10) rect(g, x, y, 2, 2, C.edge, 0.4);
  }
  for (const x of [90, 119, 148, 176]) rect(g, x, 146, 2, 7, C.gold);
  rect(g, 87, 153, 7, 37, C.blue);
  rect(g, 85, 185, 11, 10, C.navy);
  rect(g, 87, 149, 7, 8, C.mist);
  rect(g, 89, 146, 3, 9, C.shadow);
  rect(g, 114, 157, 10, 24, C.gold);
  rect(g, 117, 179, 4, 19, C.steel);
  rect(g, 146, 154, 5, 36, C.edge);
  rect(g, 140, 152, 17, 8, C.mist);
  rect(g, 173, 158, 6, 33, C.ochre);
  rect(g, 169, 155, 14, 10, C.gold);
  caution(g, 76, 216, 111);
  rect(g, 88, 110, 88, 13, C.shadow);
  for (let i = 0; i < 6; i += 1) rect(g, 94 + i * 13, 115, 8, 2, C.gold, 0.4);

  panel(g, 248, 95, 120, 76);
  rect(g, 256, 102, 104, 60, C.gold, 0.9);
  rect(g, 260, 106, 96, 52, C.shadow);
  triangle(g, 277, 113, 263, 140, 291, 140, C.gold);
  rect(g, 275, 120, 4, 10, C.shadow);
  rect(g, 275, 134, 4, 3, C.shadow);
  for (let i = 0; i < 4; i += 1) {
    rect(g, 301, 113 + i * 7, 45 - (i % 3) * 8, 2, C.gold, 0.85);
  }
  rect(g, 270, 149, 75, 2, C.mist, 0.65);
  rect(g, 265, 180, 86, 3, C.void);
  rect(g, 278, 185, 60, 2, C.edge, 0.4);

  panel(g, 420, 140, 140, 75);
  rect(g, 429, 148, 122, 54, C.shadow);
  rect(g, 434, 174, 112, 5, C.edge);
  rect(g, 434, 195, 112, 5, C.steel);
  for (const x of [440, 462, 514]) {
    rect(g, x, 157, 15, 14, C.plum);
    rect(g, x + 2, 153, 11, 4, C.gold);
    rect(g, x + 3, 159, 9, 2, C.purple);
    rect(g, x + 5, 164, 5, 4, C.teal);
  }
  rect(g, 487, 151, 13, 22, C.teal);
  rect(g, 483, 155, 21, 5, C.edge);
  rect(g, 483, 166, 21, 5, C.edge);
  rect(g, 490, 156, 4, 13, C.white, 0.7);
  for (let i = 0; i < 4; i += 1) {
    rect(g, 440 + i * 26, 183, 19, 10, C.steel);
    rect(g, 444 + i * 26, 186, 10, 2, C.gold, 0.65);
  }
  rect(g, 441, 217, 6, 14, C.steel);
  rect(g, 533, 217, 6, 14, C.steel);
  panel(g, 86, 245, 51, 29);
  rect(g, 90, 249, 43, 4, C.plum);
  rect(g, 107, 257, 10, 4, C.gold);
  door(g, "right", alarm);
}

function liftDoors(g: Graphics, x: number, y: number, h: number, tint: number): void {
  rect(g, x - 9, y - 7, 118, h + 9, C.void);
  rect(g, x - 5, y - 4, 110, h + 5, C.beige);
  rect(g, x, y, 100, h, C.shadow);
  rect(g, x + 5, y + 5, 44, h - 10, C.taupeShade);
  rect(g, x + 51, y + 5, 44, h - 10, C.taupeShade);
  rect(g, x + 8, y + 6, 2, h - 13, C.beige, 0.5);
  rect(g, x + 89, y + 6, 2, h - 13, C.beige, 0.5);
  rect(g, x + 46, y + 8, 2, h - 19, C.bronze);
  rect(g, x + 52, y + 8, 2, h - 19, C.bronze);
  rect(g, x + 15, y + 22, 25, 4, tint, 0.35);
  rect(g, x + 60, y + 22, 25, 4, tint, 0.35);
  for (const dx of [18, 64]) {
    triangle(g, x + dx, y + 55, x + dx + 18, y + 55, x + dx + 9, y + 64, C.edge, 0.4);
  }
  rect(g, x + 1, y + h - 5, 98, 5, C.edge);
  rect(g, x + 5, y + h - 4, 90, 1, tint, 0.6);
  rect(g, x + 17, y - 16, 66, 7, C.void);
  for (let i = 0; i < 5; i += 1) rect(g, x + 22 + i * 12, y - 14, 7, 3, tint, 0.8);
}

function corridor(g: Graphics, time: number, alarm: boolean): void {
  shell(g, time, alarm, C.lcarsPeach);
  triangle(g, 30, 34, 183, 34, 183, 231, C.taupeShade);
  triangle(g, 610, 34, 427, 34, 427, 231, C.taupeShade);
  for (const x of [87, 159, 411, 571]) {
    rect(g, x, 41, 9, 184, C.beige);
    rect(g, x + 2, 44, 2, 176, C.cream);
  }
  panel(g, 106, 91, 124, 64);
  stars(g, 113, 98, 110, 49, time, 71, 22);
  rect(g, 165, 99, 4, 48, C.steel);
  rect(g, 114, 147, 109, 4, C.edge);
  rect(g, 121, 165, 103, 2, C.cream, 0.75);
  for (let i = 0; i < 6; i += 1) rect(g, 123 + i * 16, 174, 9, 3, C.edge, 0.5);
  liftDoors(g, 280, 110, 145, alarm ? C.red : C.lcarsOrange);
  rect(g, 239, 273, 182, 3, C.beige, 0.18);
  for (let i = 0; i < 3; i += 1) {
    line(g, 316, 265 + i * 13, 327, 260 + i * 13, C.gold, 0.55);
    line(g, 327, 260 + i * 13, 338, 265 + i * 13, C.gold, 0.55);
  }
  panel(g, 460, 145, 60, 80);
  vents(g, 470, 155, 5, 39);
  rect(g, 470, 186, 39, 13, C.void);
  for (let i = 0; i < 9; i += 1) {
    const h = 2 + Math.round(Math.abs(Math.sin(time * 2 + i * 1.4)) * 7);
    rect(g, 473 + i * 4, 195 - h / 2, 2, h, alarm ? C.red : C.lcarsLilac, 0.75);
  }
  rect(g, 474, 206, 11, 8, C.gold);
  light(g, 501, 209, C.teal);
  rect(g, 544, 94, 15, 52, C.shadow);
  for (let i = 0; i < 6; i += 1) rect(g, 548, 100 + i * 7, 7, 3, C.gold, 0.7);
  door(g, "left", alarm);
}

function turbolift(g: Graphics, time: number, alarm: boolean): void {
  shell(g, time, alarm, C.lcarsOrange);
  rect(g, 151, 47, 352, 181, C.woodShade);
  for (const x of [167, 226, 414, 473]) {
    rect(g, x, 51, 10, 171, C.bronze);
    rect(g, x + 2, 53, 2, 166, C.beige);
    rect(g, x + 5, 70, 2, 95, C.cream, 0.6);
    rect(g, x - 5, 70, 20, 95, C.lcarsOrange, 0.025);
  }
  rect(g, 181, 64, 287, 5, C.steel);
  rect(g, 200, 68, 249, 2, C.gold, 0.55);
  liftDoors(g, 280, 100, 150, C.gold);
  panel(g, 435, 119, 27, 81);
  for (let i = 0; i < 5; i += 1) {
    rect(g, 441, 128 + i * 12, 14, 8, i === 0 ? C.lcarsOrange : C.void);
    rect(g, 445, 130 + i * 12, 6, 2, i === 0 ? C.cream : C.lcarsLilac, 0.85);
  }
  rect(g, 75, 202, 181, 8, C.void);
  rect(g, 77, 201, 177, 4, C.edge);
  rect(g, 80, 201, 171, 1, C.mist, 0.7);
  rect(g, 402, 202, 173, 8, C.void);
  rect(g, 404, 201, 169, 4, C.edge);
  for (const x of [85, 234, 414, 560]) rect(g, x, 206, 5, 15, C.steel);
  rect(g, 225, 258, 201, 53, C.plum, 0.16);
  line(g, 226, 258, 195, 312, C.gold, 0.25);
  line(g, 425, 258, 458, 312, C.gold, 0.25);
  rect(g, 196, 310, 262, 2, C.gold, 0.3);
  for (let i = 0; i < 3; i += 1) {
    const y = 86 + ((i * 33 + time * 12) % 98);
    rect(g, 198, y, 4, 12, C.lcarsOrange, 0.6);
    rect(g, 448, y - 7, 4, 7, C.lcarsOrange, 0.3);
  }
  door(g, "left", alarm);
}

function chair(g: Graphics, x = 280, y = 155, scale = 1): void {
  const tile = (dx: number, dy: number, w: number, h: number, color: number): void => {
    rect(g, x + dx * scale, y + dy * scale, w * scale, h * scale, color);
  };
  ellipse(g, x + 38 * scale, y + 75 * scale, 37 * scale, 5 * scale, C.void, 0.4);
  ellipse(g, x + 41 * scale, y + 78 * scale, 44 * scale, 7 * scale, C.void, 0.16);
  tile(30, 59, 15, 19, C.taupeShade);
  tile(19, 77, 37, 3, C.bronze);
  tile(8, 4, 59, 52, C.taupeShade);
  tile(12, 0, 51, 8, C.beige);
  tile(11, 7, 53, 43, C.beige);
  tile(17, 7, 41, 32, C.taupe);
  tile(19, 8, 37, 3, C.cream);
  tile(20, 13, 2, 24, C.beige);
  tile(54, 13, 3, 24, C.taupeShade);
  tile(24, 34, 29, 2, C.taupeShade);
  tile(24, 11, 29, 1, C.beige);
  tile(17, 40, 41, 5, C.taupeShade);
  tile(15, 45, 45, 16, C.beige);
  tile(18, 46, 39, 10, C.taupe);
  tile(20, 46, 35, 2, C.cream);
  tile(21, 53, 33, 2, C.taupeShade);
  tile(0, 35, 15, 25, C.taupeShade);
  tile(60, 35, 15, 25, C.taupeShade);
  tile(1, 35, 13, 5, C.beige);
  tile(61, 35, 13, 5, C.beige);
  tile(2, 40, 11, 10, C.void);
  tile(62, 40, 11, 10, C.void);
  tile(4, 42, 7, 3, C.lcarsOrange);
  tile(64, 42, 7, 3, C.lcarsLilac);
  tile(4, 47, 5, 1, C.lcarsPeach);
  tile(65, 47, 5, 1, C.lcarsOrange);
}

function bridge(g: Graphics, time: number, alarm: boolean): void {
  shell(g, time, alarm, C.lcarsPeach);
  ellipse(g, 320, 156, 307, 133, C.taupeShade);
  ellipse(g, 320, 156, 296, 124, C.beige);
  ellipse(g, 320, 161, 277, 114, C.taupe);
  ellipse(g, 320, 168, 257, 100, C.beige);
  glow(g, 320, 86, 248, 60, C.cream, 0.28);
  rect(g, 156, 39, 330, 96, C.taupeShade);
  rect(g, 161, 43, 320, 88, C.cream);
  rect(g, 166, 47, 310, 79, C.shadow);
  lcars(g, 171, 51, 86, 71, 11);
  lcars(g, 263, 51, 128, 71, 17);
  lcars(g, 397, 51, 74, 71, 23);
  ellipse(g, 329, 77, 30, 10, C.lcarsLilac);
  rect(g, 325, 86, 8, 19, C.lcarsLilac);
  rect(g, 307, 86, 4, 22, C.lcarsPeach);
  rect(g, 347, 86, 4, 22, C.lcarsPeach);
  rect(g, 311, 94, 36, 3, C.lcarsOrange);
  rect(g, 168, 126, 307, 3, C.bronze);
  for (let i = 0; i < 28; i += 1) {
    const active = (i + Math.floor(time * 4)) % 7 !== 0;
    rect(g, 181 + i * 10, 129, 4, 2, C.cream, active ? 0.9 : 0.25);
  }
  for (const x of [57, 494]) {
    rect(g, x - 7, 75, 96, 101, C.taupeShade);
    rect(g, x - 3, 79, 88, 92, C.bronze);
    rect(g, x, 81, 81, 82, C.void);
    lcars(g, x + 4, 87, 73, 55, x);
    rect(g, x + 6, 149, 67, 8, C.shadow);
    for (let i = 0; i < 7; i += 1) {
      rect(g, x + 9 + i * 9, 151, 6, 3, i % 3 === 0 ? C.lcarsLilac : C.lcarsOrange);
    }
    rect(g, x - 3, 69, 88, 4, C.cream);
  }
  rect(g, 42, 175, 556, 63, C.carpet);
  rect(g, 65, 224, 511, 5, C.bronze);
  rect(g, 70, 223, 501, 2, C.beige);
  rect(g, 182, 230, 278, 7, C.carpetLight);
  rect(g, 30, 238, 580, 95, C.carpet);
  for (let y = 243; y < 333; y += 6) {
    for (let x = 37; x < 607; x += 13) {
      rect(g, x + (y % 4), y, 3, 1, C.carpetLight, 0.25);
    }
  }
  triangle(g, 230, 238, 403, 238, 451, 332, C.taupeShade);
  triangle(g, 230, 238, 451, 332, 184, 332, C.taupeShade);
  triangle(g, 245, 239, 388, 239, 427, 332, C.carpetLight);
  triangle(g, 245, 239, 427, 332, 208, 332, C.carpetLight);
  glow(g, 319, 262, 118, 44, C.lcarsPeach, 0.09);
  rect(g, 31, 331, 578, 2, C.bronze);

  ellipse(g, 320, 209, 161, 27, C.void, 0.2);
  ellipse(g, 320, 180, 154, 50, C.woodShade);
  ellipse(g, 320, 171, 153, 48, C.wood);
  ellipse(g, 320, 169, 146, 41, C.void);
  ellipse(g, 320, 177, 128, 31, C.carpet);
  rect(g, 209, 174, 222, 58, C.carpet);
  for (let i = 0; i < 15; i += 1) {
    const x = 219 + i * 14;
    const y = 136 + Math.round(Math.pow((x - 320) / 105, 2) * 15);
    rect(g, x, y, 10, 4, i % 3 === 0 ? C.lcarsLilac : C.lcarsOrange);
    rect(g, x, y + 6, 7, 2, C.lcarsPeach);
  }
  for (const x of [175, 451]) {
    rect(g, x, 164, 12, 35, C.wood);
    rect(g, x + 2, 164, 8, 19, C.void);
    rect(g, x + 4, 167, 4, 8, C.lcarsOrange);
    rect(g, x, 199, 11, 19, C.beige);
  }
  chair(g, 233, 178, 0.58);
  chair(g, 362, 178, 0.58);
  chair(g);

  for (const x of [84, 400]) {
    const right = x === 400;
    const y = right ? 180 : 188;
    const w = right ? 150 : 140;
    ellipse(g, x + w / 2 + 5, y + 62, w / 2 + 10, 9, C.void, 0.35);
    glow(g, x + w / 2, y + 73, w / 2, 15, C.lcarsOrange, 0.1);
    rect(g, x + 9, y + 42, w - 18, 19, C.taupeShade);
    rect(g, x + 17, y + 43, w - 34, 16, C.beige);
    rect(g, x, y, w, 42, C.taupeShade);
    rect(g, x + 2, y, w - 4, 3, C.cream);
    rect(g, x + 3, y + 4, w - 6, 31, C.beige);
    rect(g, x + w - 6, y + 4, 3, 31, C.bronze);
    lcars(g, x + 8, y + 7, w - 16, 25, x);
    rect(g, x + 4, y + 36, w - 8, 6, C.wood);
    rect(g, x + 9, y + 37, w - 18, 3, C.void);
    for (let i = 0; i < 11; i += 1) {
      rect(g, x + 14 + i * 10, y + 37, 6, 2, i % 3 === 0 ? C.lcarsLilac : C.lcarsOrange);
    }
  }
  rect(g, 418, 228, 46, 8, C.void);
  rect(g, 422, 230, 33, 3, C.lcarsLilac);
  rect(g, 498, 229, 37, 8, C.void);
  rect(g, 501, 231, 31, 4, C.lcarsOrange);
  panel(g, 573, 182, 25, 27);
  rect(g, 578, 188, 15, 3, C.lcarsOrange);
  rect(g, 578, 195, 15, 6, C.lcarsLilac);
  door(g, "left", alarm);
}

function readyRoom(g: Graphics, time: number, alarm: boolean): void {
  shell(g, time, alarm, C.lcarsPeach);
  panel(g, 220, 48, 230, 100);
  stars(g, 226, 54, 218, 88, time, 351, 65);
  for (const x of [267, 395]) rect(g, x, 54, 4, 88, C.bronze);
  rect(g, 215, 147, 240, 7, C.wood);
  panel(g, 76, 88, 117, 79);
  lcars(g, 82, 94, 105, 65, 22);
  chair(g, 302, 132, 0.75);
  ellipse(g, 338, 239, 105, 9, C.void, 0.32);
  rect(g, 252, 179, 179, 58, C.woodShade);
  rect(g, 258, 182, 168, 52, C.wood);
  for (const x of [265, 319, 373]) {
    rect(g, x, 190, 46, 29, C.bronze);
    rect(g, x + 5, 194, 36, 1, C.lcarsPeach);
    rect(g, x + 18, 202, 13, 3, C.void);
  }
  ellipse(g, 337, 178, 102, 18, C.woodShade);
  ellipse(g, 335, 173, 102, 16, C.wood);
  ellipse(g, 333, 170, 91, 11, C.lcarsPeach, 0.2);
  rect(g, 298, 164, 48, 13, C.void);
  lcars(g, 301, 164, 43, 17, 5);
  rect(g, 384, 159, 9, 11, C.cream);
  panel(g, 478, 110, 95, 110);
  rect(g, 485, 118, 81, 77, C.navy);
  glow(g, 526, 156, 39, 35, C.teal, 0.17);
  rect(g, 485, 191, 81, 5, C.ochre);
  for (const x of [494, 539, 558]) {
    line(g, x, 191, x + 3, 159, C.teal, 0.5, 2);
    line(g, x, 176, x - 6, 169, C.teal, 0.5, 2);
  }
  const fishX = 524 + Math.sin(time * 0.5) * 19;
  ellipse(g, fishX, 151, 8, 4, C.gold);
  triangle(g, fishX - 7, 151, fishX - 14, 146, fishX - 14, 156, C.lcarsOrange);
  rect(g, fishX + 4, 150, 1, 1, C.void);
  door(g, "left", alarm);
}

function shuttlebay(g: Graphics, time: number, alarm: boolean): void {
  shell(g, time, alarm, C.blue);
  rect(g, 158, 38, 316, 155, C.void);
  stars(g, 170, 48, 292, 130, time, 612, 60);
  for (const x of [159, 461]) {
    rect(g, x, 39, 14, 156, C.steel);
    rect(g, x + 3, 42, 3, 147, C.mist);
    rect(g, x + 8, 44, 2, 141, C.warp, 0.7);
  }
  for (const y of [47, 61, 177, 189]) rect(g, 160, y, 315, 3, C.edge);
  rect(g, 169, 51, 292, 127, C.warp, 0.04);
  triangle(g, 228, 121, 389, 121, 426, 160, C.hullShade);
  triangle(g, 228, 121, 426, 160, 207, 160, C.hullShade);
  rect(g, 232, 130, 146, 28, C.hullLight);
  triangle(g, 376, 130, 376, 158, 416, 158, C.hull);
  rect(g, 243, 129, 93, 15, C.shadow);
  rect(g, 248, 132, 83, 7, C.blue);
  rect(g, 216, 159, 207, 6, C.steel);
  rect(g, 235, 165, 23, 7, C.void);
  rect(g, 379, 165, 23, 7, C.void);
  panel(g, 74, 135, 113, 97);
  for (const x of [91, 123, 154]) {
    rect(g, x, 149, 14, 63, C.hullShade);
    rect(g, x + 3, 148, 8, 59, C.hullLight);
    triangle(g, x + 3, 148, x + 11, 148, x + 7, 139, C.white);
    rect(g, x + 4, 182, 6, 8, C.blue);
    rect(g, x + 2, 211, 10, 4, C.lcarsOrange);
  }
  panel(g, 262, 169, 146, 66);
  lcars(g, 270, 177, 130, 40, 43);
  rect(g, 277, 224, 117, 4, C.woodShade);
  panel(g, 487, 112, 94, 122);
  ellipse(g, 534, 165, 33, 38, C.steel);
  ellipse(g, 534, 165, 26, 31, C.void);
  ellipse(g, 534, 165, 20, 25, C.navy);
  ellipse(g, 534, 165, 9, 15, C.warp, 0.55);
  caution(g, 496, 217, 74);
  for (const x of [191, 429]) line(g, x, 240, x + (x < 320 ? -26 : 26), 326, C.gold, 0.45, 2);
  door(g, "left", alarm);
}

function depot(g: Graphics, time: number, alarm: boolean): void {
  shell(g, time, alarm, C.lcarsLilac);
  rect(g, 205, 46, 266, 83, C.woodShade);
  stars(g, 211, 52, 254, 70, time, 651, 43);
  ship(g, 335, 85, 0.43, "right", false, 0, time);
  for (const x of [266, 413]) rect(g, x, 52, 4, 70, C.bronze);
  panel(g, 66, 84, 118, 78);
  lcars(g, 73, 91, 104, 64, 4);
  panel(g, 212, 160, 79, 74);
  rect(g, 222, 172, 58, 21, C.void);
  rect(g, 228, 187, 45, 32, C.cream);
  for (let row = 0; row < 4; row++) rect(g, 234, 195 + row * 5, 31 - row * 4, 2, C.woodShade);
  crew(g, 373, 204, time * 0.15, 0);
  rect(g, 368, 166, 8, 3, C.mist);
  ellipse(g, 375, 237, 76, 8, C.void, 0.3);
  rect(g, 312, 196, 132, 39, C.woodShade);
  rect(g, 315, 199, 126, 32, C.wood);
  rect(g, 306, 190, 144, 11, C.bronze);
  rect(g, 307, 190, 140, 3, C.lcarsPeach);
  rect(g, 332, 185, 42, 10, C.void);
  rect(g, 338, 186, 31, 4, C.lcarsLilac);
  panel(g, 485, 147, 88, 86);
  lcars(g, 492, 154, 74, 65, 17);
  light(g, 553, 220, C.teal);
  door(g, "right", alarm);
}

function workshop(g: Graphics, time: number, alarm: boolean): void {
  shell(g, time, alarm, C.lcarsOrange);
  for (const x of [49, 230, 416, 600]) {
    rect(g, x, 54, 7, 178, C.steel);
    rect(g, x + 1, 56, 2, 173, C.edge);
  }
  panel(g, 67, 119, 135, 111);
  rect(g, 75, 127, 119, 87, C.void);
  for (const y of [154, 182, 210]) {
    rect(g, 76, y, 118, 4, C.edge);
    for (const x of [86, 120, 157]) {
      rect(g, x, y - 20, 22, 18, C.hullShade);
      rect(g, x + 3, y - 17, 16, 6, C.blue);
      rect(g, x + 4, y - 8, 6, 3, C.lcarsOrange);
    }
  }
  rect(g, 250, 207, 143, 27, C.bronze);
  rect(g, 246, 199, 151, 8, C.beige);
  panel(g, 265, 160, 109, 39);
  rect(g, 275, 168, 88, 22, C.shadow);
  rect(g, 281, 172, 41, 13, C.teal);
  for (let i = 0; i < 5; i++) rect(g, 330 + i * 5, 173, 2, 12, C.gold);
  rect(g, 290, 192, 32, 4, C.steel);
  panel(g, 451, 139, 135, 94);
  lcars(g, 459, 147, 119, 48, 39);
  rect(g, 469, 204, 36, 18, C.hullShade);
  rect(g, 473, 207, 27, 8, C.warp);
  rect(g, 527, 207, 43, 5, C.void);
  for (const x of [290, 315, 340]) {
    rect(g, x, 79, 4, 43, C.hullShade);
    rect(g, x - 4, 77, 12, 6, C.gold);
  }
  door(g, "left", alarm);
}

function relay(g: Graphics, time: number, alarm: boolean): void {
  shell(g, time, alarm, C.teal);
  panel(g, 168, 43, 290, 104);
  stars(g, 175, 50, 276, 87, time, 199, 65);
  rect(g, 307, 82, 9, 48, C.hullShade);
  line(g, 311, 97, 345, 75, C.hullLight, 1, 3);
  ellipse(g, 344, 72, 30, 9, C.hullShade);
  ellipse(g, 344, 68, 30, 7, C.hullLight);
  rect(g, 343, 55, 2, 12, C.lcarsPeach);
  light(g, 343, 53, C.teal, 0.7 + Math.sin(time * 2) * 0.2);
  panel(g, 66, 143, 94, 91);
  for (const y of [155, 178, 201]) {
    rect(g, 76, y, 74, 17, C.void);
    rect(g, 83, y + 3, 47, 10, C.lcarsLilac);
    rect(g, 137, y + 5, 5, 5, C.gold);
  }
  panel(g, 206, 158, 116, 76);
  lcars(g, 213, 165, 102, 57, 54);
  panel(g, 357, 164, 90, 69);
  ellipse(g, 402, 192, 26, 21, C.void);
  ellipse(g, 402, 192, 19, 15, C.navy);
  line(g, 381, 192, 423, 192, C.teal, 0.7);
  line(g, 402, 178, 402, 207, C.teal, 0.7);
  sparkle(g, 410, 187, C.gold, 0.8);
  panel(g, 496, 138, 85, 96);
  lcars(g, 503, 145, 71, 66, 63);
  rect(g, 514, 218, 52, 5, C.teal);
  glow(g, 535, 239, 36, 9, C.teal, 0.1);
  door(g, "left", alarm);
}

const roomPainters: Readonly<Record<string, (g: Graphics, time: number, alarm: boolean) => void>> = {
  engineering, alcove, corridor, turbolift, bridge, "ready-room": readyRoom, shuttlebay, depot, workshop, relay,
};
export const roomArtIds = Object.keys(roomPainters);

function roomArt(g: Graphics, art: string, time: number, alarm: boolean): void {
  const paint = roomPainters[art];
  if (!paint) throw new Error(`Missing room artwork: ${art}`);
  paint(g, time, alarm);
}

function rogerUniform(tile: PixelPainter): void {
  tile(-9, 15, 18, 13, C.shadow);
  tile(-7, 14, 14, 15, C.gold);
  tile(-7, 15, 4, 13, C.ochre);
  tile(-7, 14, 14, 4, C.shadow);
  tile(-4, 18, 10, 1, C.lcarsPeach);
  tile(-1, 19, 1, 9, C.ochre);
  tile(4, 19, 2, 3, C.white);
  tile(3, 21, 1, 1, C.white);
  tile(-5, 25, 9, 1, C.ochre);
  tile(-7, 27, 14, 3, C.shadow);
  tile(1, 28, 3, 2, C.gold);
}

function rogerHead(tile: PixelPainter): void {
  tile(-3, 11, 7, 5, C.skinShade);
  tile(-6, 2, 13, 11, C.shadow);
  tile(-5, 3, 12, 10, C.skinShade);
  tile(-2, 4, 9, 8, C.skin);
  tile(-4, 7, 2, 3, C.skin);
  tile(1, 4, 5, 1, C.lcarsPeach);
  tile(7, 7, 2, 3, C.skin);
  tile(3, 6, 3, 2, C.white);
  tile(5, 6, 1, 2, C.void);
  tile(3, 5, 3, 1, C.ochre);
  tile(4, 10, 3, 1, C.skinShade);
  tile(0, 12, 5, 1, C.skinShade);
  tile(-6, 1, 12, 4, C.hair);
  tile(-4, 0, 8, 2, C.hair);
  tile(-6, 4, 4, 4, C.ochre);
  tile(-4, 2, 8, 1, C.gold);
  tile(-3, 1, 6, 1, C.cream);
}

function roger(
  g: Graphics,
  x: number,
  y: number,
  time: number,
  walking: boolean,
  facing: -1 | 1,
  reducedMotion: boolean,
): void {
  const stride = walking && !reducedMotion ? Math.round(Math.sin(time * 11) * 3) : 0;
  const bob = reducedMotion ? 0 : walking ? Math.abs(stride) > 1 ? -1 : 0 : Math.sin(time * 1.8) > 0.8 ? -1 : 0;
  const top = Math.round(y) - 40 + bob;
  const tile: PixelPainter = (dx, dy, w, h, color) => {
    rect(g, x + (facing === 1 ? dx : -dx - w), top + dy, w, h, color);
  };
  ellipse(g, x + 3, y, 16, 4, C.void, 0.16);
  ellipse(g, x, y, 11, 2, C.void, 0.48);
  tile(-7, 27, 6, 8, C.shadow);
  tile(2, 27, 6, 8, C.shadow);
  tile(-7 - stride, 32, 6, 6 - bob, C.shadow);
  tile(2 + stride, 32, 6, 6 - bob, C.shadow);
  tile(-6 - stride, 32, 2, 4, C.steel);
  tile(3 + stride, 32, 2, 4, C.steel);
  tile(-8 - stride, 37 - bob, 8, 3, C.void);
  tile(1 + stride, 37 - bob, 9, 3, C.void);
  tile(-7 - stride, 37 - bob, 5, 1, C.edge);
  tile(3 + stride, 37 - bob, 5, 1, C.edge);
  rogerUniform(tile);
  tile(-10, 17 + stride, 4, 11, C.ochre);
  tile(-10, 17 + stride, 4, 3, C.shadow);
  tile(-10, 26 + stride, 4, 4, C.skinShade);
  tile(7, 17 - stride, 4, 10, C.gold);
  tile(7, 17 - stride, 4, 3, C.shadow);
  tile(9, 20 - stride, 1, 4, C.lcarsPeach);
  tile(7, 24 - stride, 4, 2, C.shadow);
  tile(7, 26 - stride, 4, 4, C.skin);
  tile(7, 29 - stride, 3, 1, C.skinShade);
  rogerHead(tile);
}

function seatedRoger(g: Graphics, elapsedMs: number): void {
  const turn = elapsedMs < 450 ? 1 : elapsedMs < 1050 ? -1 : 1;
  const shift = elapsedMs < 1800 ? turn * 2 : 0;
  const tile: PixelPainter = (dx, dy, w, h, color) => {
    rect(g, 318 + shift + (turn === 1 ? dx : -dx - w), 173 + dy, w, h, color);
  };
  tile(-10, 28, 22, 7, C.shadow);
  tile(-10, 30, 9, 6, C.steel);
  tile(2, 30, 13, 6, C.steel);
  tile(-9, 35, 6, 12, C.shadow);
  tile(9, 35, 6, 12, C.shadow);
  tile(-8, 36, 2, 8, C.steel);
  tile(10, 36, 2, 8, C.steel);
  tile(-10, 46, 10, 4, C.void);
  tile(8, 46, 11, 4, C.void);
  tile(-9, 46, 6, 1, C.edge);
  tile(10, 46, 6, 1, C.edge);
  rogerUniform(tile);
  tile(-12, 17, 5, 10, C.ochre);
  tile(-17, 24, 8, 4, C.ochre);
  tile(-21, 24, 5, 3, C.skinShade);
  tile(7, 17, 5, 10, C.gold);
  tile(10, 24, 9, 4, C.gold);
  tile(19, 24, 5, 3, C.skin);
  tile(7, 17, 5, 3, C.shadow);
  rogerHead(tile);
}

function carriedObject(tile: PixelPainter, target: string, x: number, y: number): void {
  if (target === "tool-rack") {
    tile(x + 2, y, 3, 12, C.gold);
    tile(x + 2, y - 4, 3, 5, C.hullLight);
    tile(x, y - 5, 2, 4, C.hullLight);
    tile(x + 5, y - 5, 2, 4, C.hullLight);
  } else if (target === "coupling-bin") {
    tile(x, y, 8, 11, C.teal);
    tile(x - 2, y + 1, 12, 2, C.hullShade);
    tile(x - 2, y + 8, 12, 2, C.hullShade);
    tile(x + 3, y + 3, 2, 5, C.white);
  } else if (["form-printer", "clerk", "recorder", "fleet-channel"].includes(target)) {
    tile(x, y, 8, 10, C.cream);
    tile(x + 2, y + 2, 4, 1, C.woodShade);
    tile(x + 2, y + 5, 3, 1, C.woodShade);
  } else {
    tile(x, y, 9, 8, C.hullShade);
    tile(x + 1, y + 1, 7, 4, C.teal);
    for (let pin = 0; pin < 3; pin++) tile(x + 1 + pin * 3, y + 7, 1, 3, C.gold);
  }
}

function interactionRoger(
  g: Graphics, view: SessionView<unknown>, room: Room, reducedMotion: boolean,
): boolean {
  const dialogue = view.dialogue;
  const animation = dialogue?.animation;
  const target = room.hotspots.find((hotspot) => hotspot.id === animation?.target);
  if (!dialogue || !animation || !target) return false;
  const ms = reducedMotion ? 850 : dialogue.elapsedMs;
  const beat = ms < 1800 ? Math.floor(ms / 180) % 2 : 0;
  const { kind } = animation;
  if (kind === "sit") {
    if (room.art !== "bridge" || target.id !== "captain-chair") return false;
    seatedRoger(g, ms);
    return true;
  }

  const bounds = target.bounds;
  const targetX = bounds.x + bounds.width / 2;
  const targetY = bounds.y + bounds.height / 2;
  const working = kind === "repair" || kind === "operate" || kind === "pickup";
  // Work at the cabinet lip, not the navigation approach. High wall displays stay out of reach.
  const x = working ? targetX - 20 : view.actor.x;
  const y = working ? Math.max(238, Math.min(view.actor.y, bounds.y + bounds.height + 10)) : view.actor.y;
  const facing = working || targetX >= view.actor.x ? 1 : -1;
  const bend = kind === "pickup" ? ms < 500 ? 9 : ms < 1050 ? 5 : 0 : 0;
  const lean = kind === "recoil" ? -5 : kind === "pickup" ? 5 : kind === "inspect" ? 3 : 0;
  const tile: PixelPainter = (dx, dy, w, h, color) => {
    rect(g, x + (facing === 1 ? dx : -dx - w), y - 40 + dy, w, h, color);
  };
  const torso: PixelPainter = (dx, dy, w, h, color) => tile(dx + lean, dy + bend, w, h, color);
  ellipse(g, x, y, 13, 3, C.void, 0.4);
  tile(-7, 27, 6, 11, C.shadow);
  tile(2, 27 + (bend ? 3 : 0), bend ? 12 : 6, bend ? 6 : 11, C.shadow);
  tile(bend ? 9 : 3, 33, 4, 5, C.steel);
  tile(-6, 32, 2, 5, C.steel);
  tile(-8, 37, 8, 3, C.void);
  tile(bend ? 8 : 1, 37, 10, 3, C.void);
  rogerUniform(torso);
  torso(-10, 17, 4, 11, C.ochre);
  torso(-10, 17, 4, 3, C.shadow);
  torso(-10, 27, 4, 4, C.skinShade);

  switch (kind) {
    case "repair":
      torso(7, 17, 5, 9, C.gold);
      torso(10, 21 + beat, 9, 4, C.gold);
      torso(18, 20 + beat, 4, 4, C.skin);
      torso(21, 13 + beat, 3, 10, C.gold);
      torso(21, 9 + beat, 3, 5, C.hullLight);
      torso(19, 8 + beat, 2, 4, C.hullLight);
      torso(24, 8 + beat, 2, 4, C.hullLight);
      sparkle(g, targetX, Math.max(bounds.y + 8, bounds.y + bounds.height - 25), C.cyan, beat ? 0.9 : 0.3);
      break;
    case "operate":
      torso(7, 17, 5, 9, C.gold);
      torso(10, 22 - beat * 2, 9, 4, C.gold);
      torso(18, 22 - beat * 2, 5, 3, C.skin);
      torso(21, 24 - beat * 2, 3, 2, C.skin);
      for (let i = 0; i < 3; i++) rect(g, targetX - 8 + i * 6, bounds.y + bounds.height - 12, 4, 2,
        i === beat ? C.white : C.teal, 0.9);
      break;
    case "pickup":
      torso(7, 17, 5, bend ? 12 : 8, C.gold);
      torso(bend ? 10 : 9, bend ? 26 : 22, bend ? 4 : 10, 4, C.gold);
      if (ms >= 500) carriedObject(torso, target.id, bend ? 12 : 16, bend ? 22 : 18);
      torso(bend ? 10 : 14, bend ? 29 : 24, 5, 4, C.skin);
      if (ms < 1050) sparkle(g, targetX, targetY, C.gold, 0.7);
      break;
    case "talk":
      torso(7, 17, 5, 9, C.gold);
      torso(10, 21, 7, 4, C.gold);
      torso(14, 15 - beat * 3, 4, 9 + beat * 3, C.gold);
      torso(14, 11 - beat * 3, 5, 5, C.skin);
      torso(19, 13 - beat * 3, 2, 2, C.skin);
      break;
    case "inspect":
      torso(7, 18, 5, 8, C.gold);
      torso(10, 17, 4, 8, C.gold);
      torso(7, 13, 7, 4, C.skin);
      brackets(g, targetX - 7, targetY - 6, 14, 12, C.gold);
      break;
    case "sniff":
      torso(7, 17, 5, 10, C.gold);
      torso(11, 16, 4, 10, C.gold);
      torso(9, 10, 6, 6, C.skin);
      for (let i = 0; i < 3; i++) {
        torso(18 + i * 4 + beat, 10 - i * 2, 2, 1, C.mist);
      }
      break;
    case "recoil":
      torso(7, 17, 5, 9, C.gold);
      torso(10, 20, 7, 4, C.gold);
      torso(14, 13, 4, 10, C.gold);
      torso(13, 8, 6, 6, C.skin);
      torso(19, 10, 2, 3, C.skin);
      torso(-13, 17, 4, 9, C.ochre);
      torso(-17, 21, 5, 4, C.skinShade);
      torso(-14 - beat, 1, 1, 5, C.gold);
      torso(-11 - beat, -2, 1, 4, C.gold);
      break;
  }
  rogerHead(kind === "pickup" && bend
    ? (dx, dy, w, h, color) => torso(dx + 4, dy + 3, w, h, color)
    : torso);
  if (kind === "talk") torso(5, 10, 3, beat ? 2 : 1, C.shadow);
  if (kind === "sniff") torso(3, 7, 3, 1, C.shadow);
  if (kind === "recoil") {
    torso(4, 4, 3, 1, C.ochre);
    torso(5, 10, 2, 3, C.shadow);
  }
  return true;
}

function crew(g: Graphics, x: number, y: number, time: number, variant: number): void {
  const step = Math.round(Math.sin(time * 10 + variant) * 3);
  const uniform = variant % 2 === 0 ? C.plum : C.steel;
  rect(g, x - 10, y - 1, 21, 3, C.void, 0.4);
  rect(g, x - 5, y - 13, 4, 13 + step, C.shadow);
  rect(g, x + 2, y - 13, 4, 13 - step, C.shadow);
  rect(g, x - 7, y - 27, 15, 15, uniform);
  rect(g, x - 10, y - 24 + step, 4, 11, uniform);
  rect(g, x + 7, y - 24 - step, 4, 11, uniform);
  rect(g, x - 5, y - 38, 11, 10, C.shadow);
  rect(g, x + 2, y - 34, 5, 6, C.skinShade);
  rect(g, x - 4, y - 27, 10, 2, C.gold, 0.65);
  rect(g, x + 12, y - 13 - step, 8, 9, C.ochre);
}

function alarmWash(g: Graphics, time: number): void {
  const pulse = 0.035 + (Math.sin(time * 4) + 1) * 0.018;
  rect(g, 0, 0, 640, 333, C.red, pulse);
  rect(g, 0, 28, 40, 277, C.red, pulse);
  rect(g, 600, 28, 40, 277, C.red, pulse);
  rect(g, 36, 240, 59, 2, C.red, 0.5);
  rect(g, 546, 240, 59, 2, C.red, 0.5);
}

function ship(
  g: Graphics,
  cx: number,
  cy: number,
  scale: number,
  heading: Heading,
  pursuer: boolean,
  thrust: number,
  time: number,
): void {
  const point = (x: number, y: number): readonly [number, number] =>
    heading === "up"
      ? [cx + x * scale, cy + y * scale]
      : [cx + (x * 0.72 - y) * scale, cy + (x * 0.36 + y * 0.38) * scale];
  const tri = (
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, color: number, alpha = 1,
  ): void => {
    const a = point(x1, y1);
    const b = point(x2, y2);
    const c = point(x3, y3);
    triangle(g, a[0], a[1], b[0], b[1], c[0], c[1], color, alpha);
  };
  const tile = (x: number, y: number, w: number, h: number, color: number, alpha = 1): void => {
    if (heading === "up") {
      rect(g, cx + x * scale, cy + y * scale, w * scale, h * scale, color, alpha);
    } else {
      const corners = [point(x, y), point(x + w, y), point(x + w, y + h), point(x, y + h)];
      g.fillStyle(color, alpha);
      g.fillPoints(corners.map(([px, py]) => ({ x: Math.round(px), y: Math.round(py) })), true);
    }
  };
  const oval = (x: number, y: number, rx: number, ry: number, color: number, alpha = 1): void => {
    const points = Array.from({ length: 64 }, (_, segment) => {
      const angle = segment / 64 * Math.PI * 2;
      const [px, py] = point(x + Math.cos(angle) * rx, y + Math.sin(angle) * ry);
      return { x: Math.round(px), y: Math.round(py) };
    });
    g.fillStyle(color, alpha);
    g.fillPoints(points, true);
  };
  const glow = thrust > 0 ? 0.5 + Math.min(1, thrust) * 0.35 + Math.sin(time * 3) * 0.08 : 0.15;
  if (pursuer) {
    oval(0, 2, 35, 30, C.hullShade);
    oval(0, -1, 33, 28, C.hull);
    oval(0, -2, 27, 25, C.hullLight);
    tile(-24, 23, 48, 7, C.hullShade);
    tile(-18, 23, 36, 4, C.hull);
    for (const side of [-1, 1]) {
      const x = side * 29;
      oval(x, 3, 12, 29, C.warp, glow * 0.08);
      tri(x - side * 9, -23, x + side * 5, -20, x + side * 12, 21, C.hullShade);
      tile(x - 7, -17, 14, 44, C.hullShade);
      tile(x - 6, -17, 12, 40, C.hull);
      tile(x - 6, -16, 2, 36, C.hullLight);
      tile(x - 4, -18, 8, 4, C.bussard);
      tile(x - 5, -11, 10, 20, C.steel);
      tile(x - 3, -9, 6, 18, C.warp, glow);
      for (let i = 0; i < 5; i += 1) tile(x - 3, -7 + i * 3, 6, 1, C.hullShade, 0.65);
      tile(x - 4, 14, 8, 9, C.panel);
      tile(x - 3, 24, 6, 3, C.warp, glow);
      tile(side * 18 - 2, -22, 4, 7, C.woodShade);
      tile(side * 18 - 1, -24, 2, 4, C.lcarsOrange);
      tri(side * 7, -14, side * 21, -6, side * 17, 12, C.hull, 0.85);
      tile(side * 17 - 4, 10, 8, 8, C.hullShade);
      tile(side * 17 - 2, 11, 4, 5, C.hull);
      tile(side * 12 - 2, -10, 4, 2, C.hullShade, 0.4);
      tile(side * 12 - 2, 2, 4, 5, C.white, 0.25);
    }
    tile(-8, -34, 16, 20, C.hullShade);
    tile(-6, -35, 12, 19, C.hull);
    tile(-7, -35, 14, 5, C.bronze);
    tile(-5, -35, 10, 3, C.warp);
    tile(-3, -35, 6, 1, C.white);
    tile(-6, -17, 12, 26, C.hullShade);
    tile(-4, -17, 8, 25, C.hullLight);
    oval(0, -6, 6, 5, C.hull);
    tile(-3, -8, 6, 3, C.hullLight);
    tile(-2, -7, 4, 1, C.shadow);
    tile(-8, 12, 16, 7, C.hull);
    tile(-5, 13, 10, 2, C.hullShade);
    tile(-5, 21, 10, 4, C.void);
    tile(-3, 22, 6, 1, C.lcarsPeach);
    return;
  }
  for (const side of [-1, 1]) {
    tri(side * 9, 15, side * 40, 36, side * 38, 53, C.hullShade);
    tri(side * 9, 15, side * 38, 53, side * 14, 35, C.hullShade);
    tri(side * 12, 18, side * 36, 36, side * 35, 44, C.hullLight);
    tri(side * 12, 18, side * 35, 44, side * 15, 32, C.hull);
  }
  oval(0, 26, 19, 40, C.hullShade);
  oval(-2, 22, 16, 39, C.hull);
  oval(-3, 20, 11, 34, C.hullLight);
  tile(-7, -17, 14, 46, C.hull);
  tile(-4, -17, 8, 41, C.hullLight);
  oval(0, 12, 11, 7, C.bronze);
  oval(0, 11, 8, 5, C.blue);
  oval(0, 10, 5, 3, C.warp);
  tile(-2, 9, 4, 1, C.white);
  for (let i = 0; i < 5; i += 1) {
    tile(-10, 26 + i * 5, 4, 1, C.hullShade);
    tile(6, 26 + i * 5, 4, 1, C.hullShade);
  }
  tile(-5, 52, 10, 5, C.steel);
  tile(-3, 53, 6, 2, C.hullLight);
  for (const side of [-1, 1]) {
    const x = side * 39;
    for (let layer = 3; layer > 0; layer -= 1) {
      oval(x, 39, 8 + layer * 3, 36 + layer * 3, C.warp, glow * 0.045);
    }
    oval(x, 38, 8, 38, C.hullShade);
    oval(x - 1, 37, 6, 36, C.hull);
    tile(x - 6, 13, 12, 49, C.hullShade);
    tile(x - 4, 13, 8, 50, C.hullLight);
    tile(x, 13, 3, 49, C.hull);
    tile(x - 5, 18, 3, 44, C.warp, glow);
    tile(x + 3, 18, 3, 44, C.warp, glow);
    tile(x - 1, 17, 2, 43, C.hullShade);
    for (let i = 0; i < 10; i += 1) {
      tile(x - 5, 21 + i * 4, 3, 1, C.navy, 0.75);
      tile(x + 3, 21 + i * 4, 3, 1, C.navy, 0.75);
    }
    oval(x, 7, 6, 9, C.bussard);
    oval(x - 1, 5, 4, 5, C.lcarsOrange);
    tile(x - 2, 2, 3, 3, C.lcarsPeach);
    tile(x - 4, 64, 8, 4, C.hull);
    tile(x - 2, 68, 4, 4, C.warp, glow);
  }

  oval(0, -32, 58, 42, C.steel);
  oval(0, -34, 59, 42, C.hullShade);
  oval(0, -37, 58, 39, C.hull);
  oval(-1, -38, 54, 36, C.hullLight);
  oval(0, -37, 43, 28, C.hull);
  oval(-1, -38, 41, 26, C.hullLight);
  oval(-12, -48, 29, 13, C.white, 0.19);
  for (let i = 0; i < 78; i += 1) {
    const angle = i / 78 * Math.PI * 2;
    const x = Math.cos(angle) * 52;
    const y = -37 + Math.sin(angle) * 34;
    tile(x - 1, y, 2, 1, C.hullShade, 0.85);
    if (i % 2 === 0) {
      tile(Math.cos(angle) * 56 - 1, -36 + Math.sin(angle) * 37, 2, 1,
        i % 6 === 0 ? C.lcarsPeach : C.white, 0.8);
    }
  }
  for (let i = 0; i < 20; i += 1) {
    const angle = i / 20 * Math.PI * 2;
    const a = point(Math.cos(angle) * 44, -37 + Math.sin(angle) * 28);
    const b = point(Math.cos(angle) * 50, -37 + Math.sin(angle) * 33);
    line(g, a[0], a[1], b[0], b[1], C.hullShade, 0.5);
  }
  for (let ring = 0; ring < 3; ring += 1) {
    for (let sector = 0; sector < 24; sector += 1) {
      const angle = (sector + ring * 0.5) / 24 * Math.PI * 2;
      tile(Math.cos(angle) * (20 + ring * 8), -37 + Math.sin(angle) * (12 + ring * 5),
        3 + sector % 3, 1, sector % 2 === 0 ? C.hullShade : C.white, 0.24);
    }
  }
  oval(0, -13, 17, 13, C.hull);
  oval(-1, -16, 13, 10, C.hullLight);
  tile(-9, -6, 18, 4, C.hullShade);
  tile(-7, -5, 14, 1, C.shadow);
  oval(0, -35, 9, 6, C.hullShade);
  oval(-1, -36, 7, 4, C.hullLight);
  tile(-3, -37, 5, 2, C.hull);
  tile(-2, -37, 3, 1, C.white);
  for (const x of [-22, 15]) {
    tile(x, -1, 7, 3, C.bussard);
    tile(x + 1, -1, 5, 1, C.lcarsPeach);
  }
  tile(-56, -37, 2, 2, C.red);
  tile(54, -37, 2, 2, C.teal);
}

function brackets(g: Graphics, x: number, y: number, w: number, h: number, color: number): void {
  for (const dx of [0, w]) {
    for (const dy of [0, h]) {
      rect(g, x + dx - (dx === 0 ? 0 : 9), y + dy, 10, 1, color, 0.8);
      rect(g, x + dx, y + dy - (dy === 0 ? 0 : 9), 1, 10, color, 0.8);
    }
  }
}

function shield(
  g: Graphics,
  x: number,
  y: number,
  arc: ShieldArc,
  strength: number,
  exposed: boolean,
  time: number,
): void {
  const starts: Record<ShieldArc, number> = {
    forward: -135,
    starboard: -45,
    aft: 45,
    port: 135,
  };
  const color = exposed ? C.gold : strength > 25 ? C.teal : C.red;
  const opacity = 0.18 + Math.min(1, strength / 100) * 0.62;
  for (let segment = 0; segment < 13; segment += 1) {
    const angle1 = (starts[arc] + 3 + segment * 6.5) * Math.PI / 180;
    const angle2 = angle1 + 4.5 * Math.PI / 180;
    line(g, x + Math.cos(angle1) * 83, y + Math.sin(angle1) * 101,
      x + Math.cos(angle2) * 83, y + Math.sin(angle2) * 101,
      color, opacity, 2);
    if (exposed) {
      line(g, x + Math.cos(angle1) * 88, y + Math.sin(angle1) * 107,
        x + Math.cos(angle2) * 88, y + Math.sin(angle2) * 107,
        color, 0.22 + 0.1 * Math.sin(time * 3));
    }
  }
}

function anomaly(g: Graphics, x: number, y: number, time: number, stable = false): void {
  const color = stable ? C.teal : C.purple;
  glow(g, x, y, 53, 45, color, 0.4);
  for (let arm = 0; arm < 12; arm++) {
    const angle = arm / 12 * Math.PI * 2 + time * 0.08;
    const radius = 20 + Math.sin(time * 1.5 + arm) * 8;
    line(g, x, y, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, color, 0.7, 2);
  }
  ellipse(g, x, y, 13, 10, C.warp, 0.85);
  ellipse(g, x - 2, y - 2, 6, 5, C.white, 0.9);
}

function station(g: Graphics, x: number, y: number, scale: number): void {
  ellipse(g, x, y + 3 * scale, 63 * scale, 24 * scale, C.steel);
  ellipse(g, x, y, 62 * scale, 22 * scale, C.hullShade);
  ellipse(g, x, y - 2 * scale, 48 * scale, 15 * scale, C.void);
  for (const side of [-1, 1]) line(g, x, y, x + side * 55 * scale, y, C.hull, 1, 5 * scale);
  rect(g, x - 6 * scale, y - 36 * scale, 12 * scale, 76 * scale, C.hullShade);
  rect(g, x - 3 * scale, y - 34 * scale, 4 * scale, 71 * scale, C.hullLight);
  ellipse(g, x, y - 12 * scale, 20 * scale, 11 * scale, C.hullLight);
  for (let i = 0; i < 16; i++) {
    const angle = i / 16 * Math.PI * 2;
    rect(g, x + Math.cos(angle) * 56 * scale, y + Math.sin(angle) * 19 * scale, 3 * scale, 2 * scale, C.lcarsOrange);
  }
}

function tactical(g: Graphics, battle: Battle, time: number, reducedMotion: boolean, rules: CombatRules): void {
  stars(g, 0, 0, 640, 360, time, 206, 100);
  for (let x = 24; x < 640; x += 32) rect(g, x, 20, 1, 320, C.blue, 0.09);
  for (let y = 20; y < 350; y += 32) rect(g, 24, y, 592, 1, C.blue, 0.09);
  brackets(g, 15, 15, 610, 329, C.edge);
  rect(g, 31, 31, 4, 42, C.teal, 0.4);
  rect(g, 35, 31, 37, 1, C.teal, 0.4);
  for (let i = 0; i < 9; i += 1) rect(g, 589, 250 + i * 8, i % 3 === 0 ? 18 : 9, 1, C.edge, 0.7);
  const x = 231 + (battle.maneuver === "evade" ? Math.sin(time * 1.9) * 6 : 0);
  const y = 195;
  if (battle.engaged && rules.chargeSystem === "engines" && rules.source !== "hazard") {
    const charge = Math.min(1, Math.max(0, battle.charge / 100));
    for (let i = 0; i < 25; i += 1) {
      const px = x - 72 + hash(i, 301) * 145;
      const py = 255 + ((hash(i, 302) * 85 + time * 45) % 85);
      rect(g, px, py, 1, 3 + charge * 11, i % 3 === 0 ? C.purple : C.teal, 0.3 + charge * 0.4);
    }
    rect(g, x - 48, 240, 96, 35, C.purple, charge * 0.055);
  }
  if (rules.chargeSystem === "shields") {
    station(g, 477, 269, 0.65);
    if (battle.engaged) {
      line(g, x + 25, y + 12, 477, 257, C.teal, 0.22, 5);
      line(g, x + 25, y + 12, 477, 257, C.white, 0.55);
    }
  }
  if (rules.requiredTarget === "weapons" && battle.enemyWeapons > 0) {
    line(g, 481, 103, x, y, C.warp, 0.09, 16);
    line(g, 481, 103, x, y, C.warp, 0.4, 2);
  }
  ship(g, x, y, 1.25, "up", false, battle.engaged ? 1.8 : battle.power.engines / 4, time);
  for (const arc of ["forward", "starboard", "aft", "port"] satisfies readonly ShieldArc[]) {
    shield(g, x, y, arc, battle.shields[arc], arc === battle.exposedArc, time);
  }
  if (battle.hull < 45) {
    rect(g, x - 19, y + 19, 8, 13, C.void);
    sparkle(g, x - 17, y + 17, C.gold, 0.55 + 0.2 * Math.sin(time * 7));
  }
  const ex = 481;
  const ey = 103;
  const targetX = ex + (battle.target === "engines" ? 26 : 17);
  const targetY = ey + (battle.target === "engines" ? 15 : -20);
  if (rules.source === "hazard") {
    anomaly(g, ex, ey, time, battle.engaged);
    ship(g, 493, 257, 0.75, "up", true, 0.2, time);
    line(g, 480, 223, ex, ey + 19, C.teal, 0.25, 2);
  } else ship(g, ex, ey, 0.9, "up", true, battle.enemyEngines > 0 ? 0.7 : 0, time);
  if (rules.requiredTarget === null && rules.requiredManeuver === "evade") {
    escapePod(g, 568, 151 + Math.sin(time) * 4, time);
    for (const radius of [12, 20, 28]) {
      ellipse(g, 575, 157, radius, 1, C.red, 0.18);
    }
  }
  brackets(g, ex - 44, ey - 39, 88, 75, battle.scanned ? C.gold : C.purple);
  if (battle.scanned) {
    brackets(g, targetX - 10, targetY - 9, 20, 18, C.red);
    rect(g, ex + 50, targetY, 32, 1, C.gold, 0.55);
    rect(g, ex + 81, targetY - 2, 3, 5, C.gold, 0.7);
  }
  if (battle.enemyEngines <= 0 && rules.source === "ship") {
    for (const side of [-1, 1]) {
      rect(g, ex + side * 26 - 3, ey + 13, 6, 7, C.shadow);
      for (let i = 0; i < 3; i += 1) {
        rect(g, ex + side * 26 - 4 + i * 3, ey + 27 + i * 6, 4, 4, C.hullShade, 0.35);
      }
    }
  }
  if (battle.cooldownMs > 0) {
    const pulse = reducedMotion ? 0.65 : 0.35 + 0.65 * Math.max(0, Math.sin(battle.cooldownMs / 85));
    line(g, x + 3, y - 62, targetX, targetY, C.lcarsOrange, pulse * 0.08, 9);
    line(g, x + 3, y - 62, targetX, targetY, C.lcarsOrange, pulse * 0.7, 3);
    line(g, x + 3, y - 62, targetX, targetY, C.white, pulse * 0.85);
    sparkle(g, x + 3, y - 62, C.white, pulse);
    sparkle(g, targetX, targetY, C.lcarsOrange, pulse);
  }
  if (battle.enemyAttackMs < 1600 && canAttack(battle, rules)) {
    const warning = 1 - Math.max(0, battle.enemyAttackMs) / 1600;
    const arcOffset: Record<ShieldArc, readonly [number, number]> = {
      forward: [0, -101],
      starboard: [83, 0],
      aft: [0, 101],
      port: [-83, 0],
    };
    const [dx, dy] = arcOffset[battle.exposedArc];
    const targetX = x + dx;
    const targetY = y + dy;
    for (let i = 1; i < 16; i += 1) {
      const fraction = i / 16;
      rect(g, ex + 17 + (targetX - ex - 17) * fraction, ey - 20 + (targetY - ey + 20) * fraction,
        3, 2, C.red, 0.25 + warning * 0.6);
    }
    brackets(g, targetX - 8, targetY - 8, 16, 16, C.red);
    triangle(g, ex + 50, ey - 32, ex + 43, ey - 19, ex + 57, ey - 19, C.red, 0.65 + warning * 0.3);
    rect(g, ex + 49, ey - 28, 2, 5, C.shadow);
    if (battle.enemyAttackMs < 180) {
      line(g, ex + 17, ey - 20, targetX, targetY, C.lcarsOrange, 0.7, 2);
      sparkle(g, targetX, targetY, C.gold);
    }
  }
}

function form(g: Graphics, x: number, y: number): void {
  panel(g, x, y, 78, 92);
  rect(g, x + 7, y + 7, 64, 77, C.gold);
  rect(g, x + 10, y + 10, 58, 70, C.shadow);
  rect(g, x + 15, y + 15, 37, 3, C.gold);
  for (let i = 0; i < 5; i += 1) {
    rect(g, x + 16, y + 25 + i * 7, 4, 4, i === 4 ? C.red : C.teal);
    rect(g, x + 25, y + 26 + i * 7, 33 - (i % 3) * 5, 2, C.mist, 0.65);
  }
  rect(g, x + 28, y + 66, 26, 7, C.gold);
  rect(g, x + 37, y + 68, 9, 2, C.shadow);
}

function escapePod(g: Graphics, x: number, y: number, time: number): void {
  rect(g, x - 8, y + 2, 9, 4, C.gold, 0.15);
  rect(g, x - 4, y + 3, 6, 2, C.teal, 0.8);
  rect(g, x, y, 15, 9, C.steel);
  rect(g, x + 2, y - 2, 10, 12, C.gold);
  rect(g, x + 3, y, 9, 7, C.panel);
  rect(g, x + 7, y + 1, 4, 3, C.cyan);
  rect(g, x + 13, y + 2, 4, 5, C.mist);
  light(g, x + 1, y + 6, C.gold, 0.6 + Math.sin(time * 3) * 0.2);
}

function laterSequence(g: Graphics, scene: Cutscene, time: number, reducedMotion: boolean): void {
  const definition = laterSequences[scene.id];
  const frame = definition?.frames[scene.frame];
  if (!frame) throw new Error(`Missing sequence artwork: ${scene.id}:${scene.frame}`);
  const id = scene.id;
  const part = scene.frame;
  const t = reducedMotion ? 0 : scene.elapsedMs / 1000;
  const space = id === "c2-departure" && part > 0 || id === "c2-outro"
    || id === "c3-intro" && part === 0 || id === "c3-departure" && part > 0 || id === "c3-outro"
    || id === "c4-intro" && part === 0 || id === "c4-departure" && part > 0
    || id === "c4-outro" && part === 1 || id === "c5-intro" && part === 0
    || id === "c5-departure" && part > 0 || id === "c5-outro" && part === 0;
  if (space) {
    stars(g, 0, 0, 640, 360, time, 781, 160);
    planet(g, 585, 354, 92);
    ship(g, 252 + Math.min(t, 4) * 4, 177, 1.65, "right", false, 0.6, time);
    if (id === "c2-outro") {
      station(g, 486, 106, part === 2 ? 1.1 : 0.7);
      for (let i = 0; i < 6; i++) {
        const travel = (time * 24 + i * 53) % 330;
        rect(g, 22 + travel, 231 + i * 13, 13, 1, C.cyan, 0.2);
      }
      light(g, 470, 101, C.teal, 0.65 + Math.sin(time * 2) * 0.2);
    } else if (id === "c2-departure") {
      escapePod(g, 436 + t * 12, 110 - t * 4, time);
      ship(g, 454, 239, 0.85, "right", true, 0.65, time);
      sparkle(g, 454 + t * 12, 115 - t * 4, C.red, 0.8);
    } else if (id === "c3-intro" || id === "c4-intro") {
      station(g, 480, 103, 1.2);
    } else {
      ship(g, 468, 104, 1, "right", true, 0.3, time);
      if (id === "c3-departure") {
        line(g, 438, 103, 286, 159, C.warp, 0.12, 19);
        line(g, 438, 103, 286, 159, C.warp, 0.6, 2);
      }
      if (id === "c4-departure") {
        station(g, 474, 259, 0.6);
        line(g, 294, 170, 470, 247, C.teal, 0.65, 2);
      }
      if (id.startsWith("c5")) {
        anomaly(g, 463, 244, time, id === "c5-outro");
        line(g, 302, 176, 452, 237, C.teal, 0.55, 2);
        line(g, 470, 136, 467, 230, C.teal, 0.55, 2);
      }
    }
    return;
  }
  const art = id === "c5-outro" && part === 3 ? "engineering"
    : id === "c4-intro" && part === 1 ? "engineering" : frame.art;
  roomArt(g, art, time, false);
  roger(g, 290, 310, time, false, 1, reducedMotion);
  if (id === "c3-intro") form(g, 233, 178);
  if (id === "c2-intro" && part > 0) brackets(g, 76, 88, 117, 79, C.gold);
  if (id === "c4-intro" && part === 1) brackets(g, 398, 160, 66, 75, C.red);
  if (id === "c5-outro" && part > 0 && part < 3) {
    for (let i = 0; i < 5; i++) crew(g, 90 + i * 101 + Math.sin(time * 0.5 + i) * 3, 277, time, i);
  }
  if (id === "c5-outro" && part === 3) {
    rect(g, 303, 268, 2, 45, C.wood);
    rect(g, 295, 309, 19, 5, C.mist);
    rect(g, 297, 314, 15, 2, C.teal);
    form(g, 405, 193);
  }
}

function sequence(g: Graphics, scene: Cutscene, time: number, reducedMotion: boolean): void {
  const t = reducedMotion ? 0 : scene.elapsedMs / 1000;
  const frame = scene.frame;
  switch (scene.id) {
    case "intro":
      if (frame === 0) {
        stars(g, 0, 0, 640, 360, time, 19, 160);
        planet(g, 493, 269, 106);
        ship(g, 271 + Math.sin(t * 0.2) * 6, 166, 1.8, "right", false, 0.45, time);
        for (let i = 0; i < 7; i += 1) rect(g, 67 + i * 13, 226, 5, 1, C.teal, 0.23);
      } else {
        engineering(g, time, false);
        roger(g, frame === 1 ? 180 : 164, 287, time, false, -1, reducedMotion);
        form(g, frame === 1 ? 423 : 72, frame === 1 ? 62 : 97);
        if (frame > 1) {
          brackets(g, 106, 208, 33, 18, C.gold);
          sparkle(g, 121, 212, C.gold, 0.7);
        }
      }
      break;
    case "evacuation":
      if (frame === 1) {
        stars(g, 0, 0, 640, 360, time, 42, 130);
        planet(g, 530, 329, 97);
        ship(g, 265, 168, 1.6, "right", false, 0.2, time);
        for (let i = 0; i < 5; i += 1) {
          const travel = (t * 22 + i * 37) % 192;
          escapePod(g, 319 + travel, 81 + i * 42 + travel * (i % 2 === 0 ? -0.12 : 0.12), time);
        }
        light(g, 287, 149, C.red, 0.7 + 0.3 * Math.sin(time * 4));
        light(g, 285, 189, C.red, 0.7 + 0.3 * Math.sin(time * 4));
      } else {
        if (frame === 0) corridor(g, time, true);
        else engineering(g, time, true);
        for (let i = 0; i < (frame === 0 ? 5 : 2); i += 1) {
          const x = 65 + ((475 + i * 91 - (t * 48) % 475) % 475);
          crew(g, x, 258 + (i % 3) * 18, time, i);
        }
        roger(g, frame === 0 ? 194 : 203, 310, time, false, 1, reducedMotion);
        if (frame > 1) form(g, 89, 104);
        alarmWash(g, time);
      }
      break;
    case "takeover":
      bridge(g, time, false);
      if (frame > 0) {
        roger(g, 374, 285, time, false, 1, reducedMotion);
        rect(g, 414, 220, 125, 11, C.teal, 0.12);
        brackets(g, 497, 227, 40, 13, frame === 1 ? C.gold : C.red);
        ship(g, 415, 83, 0.48, "right", true, 0.2, time);
      } else {
        rect(g, 289, 151, 62, 90, C.purple, 0.045);
        brackets(g, 275, 150, 84, 89, C.gold);
      }
      break;
    case "outro":
      stars(g, 0, 0, 640, 360, time, 58, 120);
      for (let i = 0; i < 53; i += 1) {
        const x = (hash(i, 63) * 640 + time * 75) % 640;
        const y = 12 + hash(i, 64) * 333;
        const length = frame === 0 ? 9 : 25 + hash(i, 65) * 73;
        rect(g, x, y, Math.min(length, 640 - x), 1, i % 4 === 0 ? C.purple : C.cyan, 0.1 + hash(i, 66) * 0.28);
      }
      if (frame < 2) {
        ship(g, 432, 86, 0.48, "right", true, 0, time);
        rect(g, 28, 161, 236, 32, C.teal, 0.035);
        rect(g, 80, 170, 183, 8, C.cyan, 0.06);
        ship(g, 302 + Math.min(t, 5) * 9, 195, 1.6, "right", false, 2.4, time);
      } else {
        ship(g, 400, 180, 1.6, "right", true, 0.25, time);
        brackets(g, 94, 104, 114, 117, C.gold);
        triangle(g, 151, 127, 118, 187, 184, 187, C.gold, 0.85);
        rect(g, 148, 146, 6, 23, C.shadow);
        rect(g, 148, 175, 6, 6, C.shadow);
        for (let i = 0; i < 8; i += 1) rect(g, 222 + i * 10, 161, 4, 1, C.gold, 0.6);
      }
      break;
    default:
      laterSequence(g, scene, time, reducedMotion);
  }
  rect(g, 0, 0, 640, 6, C.void);
  rect(g, 0, 354, 640, 6, C.void);
  rect(g, 25, 14, 21, 1, C.gold, 0.6);
  rect(g, 594, 345, 21, 1, C.gold, 0.6);
}

function failure(g: Graphics, view: SessionView<unknown>, room: Room, time: number): void {
  roomArt(g, room.art || room.id, 0, true);
  rect(g, 0, 0, 640, 360, C.void, 0.35);
  alarmWash(g, time);
  const x = view.actor.x;
  const y = view.actor.y;
  rect(g, x - 28, y - 2, 58, 5, C.void, 0.65);
  rect(g, x - 9, y - 11, 26, 11, C.ochre);
  rect(g, x - 7, y - 11, 22, 3, C.gold);
  rect(g, x + 13, y - 9, 15, 6, C.shadow);
  rect(g, x + 24, y - 17, 6, 14, C.shadow);
  rect(g, x + 23, y - 19, 9, 4, C.edge);
  rect(g, x + 12, y - 3, 21, 4, C.void);
  rect(g, x - 22, y - 12, 13, 11, C.skin);
  rect(g, x - 25, y - 11, 5, 9, C.hair);
  rect(g, x - 22, y - 14, 10, 4, C.hair);
  rect(g, x - 15, y - 9, 3, 1, C.shadow);
  rect(g, x - 5, y - 18, 5, 12, C.gold);
  rect(g, x - 6, y - 22, 6, 5, C.skin);
  rect(g, x - 12, y - 27, 17, 6, C.gold);
  rect(g, x - 10, y - 26, 12, 3, C.shadow);
  for (let i = 0; i < 3; i += 1) {
    sparkle(g, x - 25 + i * 14, y - 34 - (i % 2) * 6, C.gold, 0.5 + Math.sin(time * 1.8 + i) * 0.15);
  }
  rect(g, 0, 0, 640, 5, C.red, 0.65);
  rect(g, 0, 355, 640, 5, C.red, 0.35);
}

function complete(g: Graphics, time: number): void {
  stars(g, 0, 0, 640, 360, time, 501, 190);
  planet(g, 542, 373, 126);
  rect(g, 47, 86, 259, 18, C.purple, 0.035);
  rect(g, 80, 100, 241, 10, C.blue, 0.035);
  ship(g, 293 + Math.sin(time * 0.15) * 5, 175, 1.7, "right", false, 0.35, time);
  sparkle(g, 479, 73, C.gold, 0.75);
  rect(g, 441, 73, 77, 1, C.gold, 0.09);
  for (let i = 0; i < 9; i += 1) {
    rect(g, 69 + i * 13, 241 - i * 3, 3, 1, C.teal, 0.1 + i * 0.025);
  }
}

export function drawScene(
  g: SceneGraphics,
  view: SessionView<unknown>,
  room: Room,
  elapsedSeconds: number,
  reducedMotion: boolean,
  presentation: { readonly chapter: number; readonly combat: CombatRules },
): void {
  g.clear();
  const time = reducedMotion ? 0 : elapsedSeconds;
  const scene = view.scene;
  switch (scene.kind) {
    case "cutscene":
      sequence(g, scene, time, reducedMotion);
      break;
    case "combat":
      tactical(g, scene.battle, time, reducedMotion, presentation.combat);
      break;
    case "failure":
      failure(g, view, room, time);
      break;
    case "complete":
      if (presentation.chapter === 5) {
        bridge(g, time, false);
        for (let i = 0; i < 5; i++) crew(g, 95 + i * 104, 282, time, i);
        roger(g, 320, 318, time, false, 1, reducedMotion);
      } else complete(g, time);
      break;
    case "adventure": {
      const alarm = view.countdownMs !== null;
      roomArt(g, room.art || room.id, time, alarm);
      if (room.id === "final-engineering") {
        rect(g, 251, 79, 36, 30, C.woodShade);
        rect(g, 254, 83, 30, 23, C.hullShade);
        rect(g, 261, 76, 17, 5, C.gold);
        rect(g, 261, 89, 16, 10, C.blue);
        rect(g, 259, 92, 20, 3, C.warp);
      }
      if (view.destination !== null) {
        const { x, y } = view.destination;
        line(g, x - 5, y, x, y - 2, C.gold, 0.5);
        line(g, x, y - 2, x + 5, y, C.gold, 0.5);
        line(g, x + 5, y, x, y + 2, C.gold, 0.5);
        line(g, x, y + 2, x - 5, y, C.gold, 0.5);
      }
      if (!interactionRoger(g, view, room, reducedMotion)) roger(
        g, view.actor.x, view.actor.y, time,
        view.destination !== null,
        view.destination !== null && view.destination.x < view.actor.x ? -1 : 1,
        reducedMotion,
      );
      if (alarm) alarmWash(g, time);
      break;
    }
    default: {
      const exhaustive: never = scene;
      return exhaustive;
    }
  }
}
