// Node side of the cursor: motion paths, easing, and the cursor/ripple/ghost state that
// page/overlay.page.js draws. The page never animates on its own; every frame's state comes from here.

export interface Point {
  x: number;
  y: number;
}

export interface CursorState extends Point {
  visible: boolean;
  pressed: boolean;
  /** A soft highlight behind the cursor, for moments the viewer should follow it. */
  halo: boolean;
}

export interface Ripple extends Point {
  id: number;
  startFrame: number;
  frames: number;
}

/** A picture of the dragged element that follows the cursor; headless Chromium draws no native drag image. */
export interface Ghost {
  id: string;
  image?: string; // data: URL
  label?: string;
  w?: number;
  h?: number;
  grabX: number;
  grabY: number;
  opacity: number;
}

export type Easing = (t: number) => number;

export const easings = {
  linear: (t: number) => t,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
} satisfies Record<string, Easing>;

/**
 * A gently curved path from `from` to `to`, like a hand moving a mouse: a quadratic Bézier whose
 * control point sits off the straight line by `curve` × distance. Positive curves bend to the
 * left of the direction of travel.
 */
export class MotionPath {
  private readonly control: Point;

  constructor(
    readonly from: Point,
    readonly to: Point,
    curve = 0.12,
  ) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    this.control = { x: from.x + dx / 2 - dy * curve, y: from.y + dy / 2 + dx * curve };
  }

  get length(): number {
    return Math.hypot(this.to.x - this.from.x, this.to.y - this.from.y);
  }

  at(t: number): Point {
    const u = 1 - t;
    return {
      x: u * u * this.from.x + 2 * u * t * this.control.x + t * t * this.to.x,
      y: u * u * this.from.y + 2 * u * t * this.control.y + t * t * this.to.y,
    };
  }
}

/** A duration that grows with distance (Fitts-ish), unless the scene gives one. */
export function naturalDuration(distance: number): number {
  return Math.round(Math.min(1100, Math.max(350, 250 + distance * 0.55)));
}

/**
 * The positions along `path` between parameters `t0` and `t1`, one per frame, eased so the motion
 * starts and stops smoothly even when a drag halts part-way (dragTo({stopAt})) and resumes later.
 */
export function framesAlong(
  path: MotionPath,
  t0: number,
  t1: number,
  frameCount: number,
  easing: Easing = easings.easeInOutCubic,
): Point[] {
  const points: Point[] = [];
  const n = Math.max(1, frameCount);
  for (let i = 1; i <= n; i++) {
    points.push(path.at(t0 + (t1 - t0) * easing(i / n)));
  }
  return points;
}
