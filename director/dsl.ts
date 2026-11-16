// The scene DSL. A Demo owns the timeline: every method advances it by whole frames, moving the real
// mouse (so hover, drag-and-drop and drops reach the app and Copilot for real) and drawing the overlay
// for each frame before the capture takes it.
//
//   await demo.moveTo('vaadin-button', { duration: 600 });
//   await demo.dragStart(copilot.paletteItem('Grid ⋅ Basic'));
//   await demo.dragTo(target, { stopAt: 0.6 });               // mouse stays down
//   await demo.pause({ callout: 'Drop zones light up', ms: 2500 });
//   await demo.zoom(copilot.activeDropZone, 1.8);
//   await demo.drop();

import type { Locator, Page } from 'playwright';
import {
  type Camera,
  type CalloutSpec,
  type Fade,
  type Placement,
  type Rect,
  cameraRect,
  center,
  fadeLevel,
  lerpCamera,
} from './callouts.ts';
import type { FrameSink } from './capture.ts';
import {
  type CursorState,
  type Easing,
  type Ghost,
  type Point,
  type Ripple,
  MotionPath,
  easings,
  framesAlong,
  naturalDuration,
} from './cursor-overlay.ts';

/** Anything the cursor can go to or a callout can point at. */
export type Target = string | Locator | Point | Rect | (() => Promise<Rect | null>);

/** A rectangle of the output video, in its pixels. */
export interface Crop { x: number; y: number; w: number; h: number }

export interface MoveOptions {
  /** ms; defaults to a duration that grows with distance. */
  duration?: number;
  /** Where in the target to aim, as fractions of its box (default: the center). */
  anchor?: { x: number; y: number };
  /** Pixel offset added after anchoring. */
  offset?: Point;
  /** Bend of the path; 0 is a straight line. */
  curve?: number;
  easing?: Easing;
}

export interface PauseOptions {
  ms: number;
  callout?: string | CalloutSpec;
  /** What the callout points at: a target, or 'cursor' (the default while dragging). */
  at?: Target | 'cursor';
  /** Dim everything except this target while paused. */
  spotlight?: Target;
}

interface ActiveCallout {
  id: string;
  spec: CalloutSpec;
  at: Target | 'cursor';
  fade: Fade;
  lastRect?: Rect;
}

/** A card in screen space: a code card (diff lines) or a chapter title. */
export interface CardSpec {
  kind?: 'code' | 'title';
  kicker?: string;
  title?: string;
  text?: string;
  lines?: CodeLine[];
  /** 'right' (default), 'left', 'center', 'bottom', 'bottom-left', 'bottom-right', or a point. */
  position?: string | Point;
  width?: number;
}

export interface CodeLine {
  text: string;
  /** '+' added, '-' removed, '~' elided, ' ' context. */
  type: '+' | '-' | '~' | ' ';
}

interface ActiveCard {
  id: string;
  spec: CardSpec;
  fade: Fade;
}

interface ActiveSpotlight {
  target: Target;
  padding: number;
  /** Dims everything else; false draws only the outline. */
  dim: boolean;
  fade: Fade;
  lastRect?: Rect;
}

interface CameraTween {
  from: Camera;
  to: Camera;
  startFrame: number;
  frames: number;
  easing: Easing;
}

export class Demo {
  readonly fps: number;
  private frameNo = 0;
  private cursor: CursorState;
  private ripples: Ripple[] = [];
  private rippleIds = 0;
  private ghost: Ghost | null = null;
  private callouts = new Map<string, ActiveCallout>();
  private calloutIds = 0;
  private cards = new Map<string, ActiveCard>();
  private spot: ActiveSpotlight | null = null;
  private camera: Camera;
  private cameraTween: CameraTween | null = null;
  private pendingDrag: { path: MotionPath; t: number } | null = null;
  private warnedZoom = false;
  private dragging = false;
  private movedThisFrame = false;

  constructor(
    readonly page: Page,
    private readonly capture: FrameSink,
    readonly viewport: { width: number; height: number },
    fps: number,
  ) {
    this.fps = fps;
    this.cursor = { x: viewport.width * 0.62, y: viewport.height * 0.58, visible: true, pressed: false, halo: false };
    this.camera = { cx: viewport.width / 2, cy: viewport.height / 2, zoom: 1 };
  }

  /** Number of frames that `ms` takes at the scene's frame rate. */
  frames(ms: number): number {
    return Math.max(1, Math.round((ms * this.fps) / 1000));
  }

  /** Where the cursor is now, as a target. */
  get cursorPosition(): Point {
    return { x: this.cursor.x, y: this.cursor.y };
  }

  /** Current time in the output video, ms. */
  get time(): number {
    return (this.frameNo * 1000) / this.fps;
  }

  // ---------------------------------------------------------------- cursor

  /** Puts the cursor somewhere without animating, e.g. before recording starts. */
  async placeCursor(target: Target, options: Pick<MoveOptions, 'anchor' | 'offset'> = {}) {
    const p = await this.pointOf(target, options);
    this.cursor.x = p.x;
    this.cursor.y = p.y;
    await this.page.mouse.move(p.x, p.y);
  }

  showCursor(visible = true) {
    this.cursor.visible = visible;
  }

  /** A soft highlight behind the cursor. */
  halo(on = true) {
    this.cursor.halo = on;
  }

  async moveTo(target: Target, options: MoveOptions = {}) {
    const to = await this.pointOf(target, options);
    const path = new MotionPath({ x: this.cursor.x, y: this.cursor.y }, to, options.curve);
    const duration = options.duration ?? naturalDuration(path.length);
    for (const p of framesAlong(path, 0, 1, this.frames(duration), options.easing)) {
      await this.mouseTo(p);
      await this.frame();
    }
  }

  async click(target?: Target, options: MoveOptions & { button?: 'left' | 'right'; modifiers?: Array<'Shift' | 'ControlOrMeta' | 'Alt'> } = {}) {
    if (target) await this.moveTo(target, options);
    for (const m of options.modifiers ?? []) await this.page.keyboard.down(m);
    this.cursor.pressed = true;
    this.ripple();
    await this.page.mouse.down({ button: options.button });
    await this.hold(90);
    await this.page.mouse.up({ button: options.button });
    this.cursor.pressed = false;
    for (const m of options.modifiers ?? []) await this.page.keyboard.up(m);
    await this.hold(220);
  }

  /** Types into whatever has focus, at a human pace. */
  async type(text: string, options: { perChar?: number } = {}) {
    const perChar = options.perChar ?? 95;
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await this.hold(perChar);
    }
  }

  async press(key: string) {
    await this.page.keyboard.press(key);
    await this.frame();
  }

  // ---------------------------------------------------------------- drag and drop

  /**
   * Presses on `target` and starts a native HTML5 drag. A picture of the element follows the cursor,
   * since headless Chromium draws no drag image.
   */
  async dragStart(target: Target, options: MoveOptions & { ghost?: boolean; ghostFrom?: Target } = {}) {
    await this.moveTo(target, options);
    // The picture can come from something else than the handle, e.g. a component dragged by its badge.
    const rect = await this.rectOf(options.ghostFrom ?? target);
    if (options.ghost !== false && rect) {
      const image = await this.page.screenshot({
        clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h },
        type: 'png',
        scale: 'device',
        animations: 'disabled',
      });
      this.ghost = {
        id: `ghost-${this.frameNo}`,
        image: `data:image/png;base64,${image.toString('base64')}`,
        w: rect.w,
        h: rect.h,
        grabX: this.cursor.x - rect.x,
        grabY: this.cursor.y - rect.y,
        opacity: 0,
      };
    }
    this.cursor.pressed = true;
    this.ripple();
    await this.page.mouse.down();
    this.dragging = true;
    await this.hold(120);
    // A few small moves cross the drag threshold and start the drag, like a hand would.
    const start = { x: this.cursor.x, y: this.cursor.y };
    for (let i = 1; i <= 6; i++) {
      await this.mouseTo({ x: start.x + i * 1.5, y: start.y + i });
      if (this.ghost) this.ghost.opacity = Math.min(0.88, (i / 6) * 0.88);
      await this.frame();
    }
  }

  /**
   * Drags toward `target`. With `stopAt` < 1 the cursor halts part-way with the mouse still down, so
   * the scene can pause, call out or zoom mid-drag; drop() then finishes the same path.
   */
  async dragTo(target: Target, options: MoveOptions & { stopAt?: number } = {}) {
    const to = await this.pointOf(target, options);
    const path = new MotionPath({ x: this.cursor.x, y: this.cursor.y }, to, options.curve ?? 0.08);
    const stopAt = options.stopAt ?? 1;
    const duration = options.duration ?? naturalDuration(path.length * stopAt) + 250;
    for (const p of framesAlong(path, 0, stopAt, this.frames(duration), options.easing)) {
      await this.mouseTo(p);
      await this.frame();
    }
    this.pendingDrag = stopAt < 1 ? { path, t: stopAt } : null;
  }

  /** Finishes a halted drag (or drags to `target` first) and releases the mouse. */
  async drop(target?: Target, options: MoveOptions = {}) {
    if (target) {
      await this.dragTo(target, options);
    } else if (this.pendingDrag) {
      const { path, t } = this.pendingDrag;
      const duration = options.duration ?? naturalDuration(path.length * (1 - t)) + 150;
      for (const p of framesAlong(path, t, 1, this.frames(duration), options.easing)) {
        await this.mouseTo(p);
        await this.frame();
      }
    }
    this.pendingDrag = null;
    // Settle for a moment so the drop target registers the final position.
    await this.hold(120);
    await this.page.mouse.up();
    this.dragging = false;
    this.cursor.pressed = false;
    this.ghost = null;
    this.ripple();
    await this.hold(150);
  }

  // ---------------------------------------------------------------- callouts, spotlight, zoom

  /** Shows a callout until hideCallout(id). Returns its id. */
  callout(spec: string | CalloutSpec, at: Target | 'cursor' = 'cursor', fadeMs = 220): string {
    const id = `c${++this.calloutIds}`;
    const s = typeof spec === 'string' ? { text: spec } : spec;
    this.callouts.set(id, { id, spec: s, at, fade: { inFrame: this.frameNo, frames: this.frames(fadeMs) } });
    return id;
  }

  hideCallout(id?: string) {
    for (const c of this.callouts.values()) {
      if ((id == null || c.id === id) && c.fade.outFrame == null) c.fade.outFrame = this.frameNo;
    }
  }

  /** Shows a card until hideCard(id). Returns its id. */
  card(spec: CardSpec, fadeMs = 320): string {
    const id = `k${++this.calloutIds}`;
    this.cards.set(id, { id, spec, fade: { inFrame: this.frameNo, frames: this.frames(fadeMs) } });
    return id;
  }

  hideCard(id?: string) {
    for (const c of this.cards.values()) {
      if ((id == null || c.id === id) && c.fade.outFrame == null) c.fade.outFrame = this.frameNo;
    }
  }

  /** Shows a card for `ms`, fading in and out. */
  async showCard(spec: CardSpec, ms: number) {
    const id = this.card(spec);
    await this.hold(Math.max(0, ms - 320));
    this.hideCard(id);
    await this.hold(320);
  }

  spotlight(target: Target, options: { padding?: number; fadeMs?: number; dim?: boolean } = {}) {
    this.spot = { target, padding: options.padding ?? 10, dim: options.dim ?? true, fade: { inFrame: this.frameNo, frames: this.frames(options.fadeMs ?? 300) } };
  }

  /** An outline around `target`, without dimming the rest: where to look, for clips that carry no text. */
  outline(target: Target, options: { padding?: number; fadeMs?: number } = {}) {
    this.spotlight(target, { ...options, dim: false });
  }

  /** Clears the spotlight or outline. */
  clearOutline() {
    this.clearSpotlight();
  }

  // ---------------------------------------------------------------- steps

  /** Step marks, in the order given (see step()). */
  readonly steps: Array<{ name: string; t: number; still: boolean; crop?: Crop; skip?: boolean }> = [];

  /**
   * Starts a step here: a walkthrough is cut into one clip per step at these marks (director/walkthrough.ts).
   * A `still` step is exported as its last frame only. `crop` keeps part of the output frame (its pixels), for
   * what the camera can't zoom: the side panel of a split stage.
   */
  step(name: string, options: { still?: boolean; crop?: Crop } = {}) {
    this.steps.push({ name, t: this.time / 1000, still: options.still ?? false, crop: options.crop });
  }

  /** Ends the step before here without starting one: what follows, up to the next step, is left out of the clips. */
  between() {
    this.steps.push({ name: '', t: this.time / 1000, still: false, skip: true });
  }

  clearSpotlight() {
    if (this.spot && this.spot.fade.outFrame == null) this.spot.fade.outFrame = this.frameNo;
  }

  /** Holds still for `ms`, optionally with a callout and a spotlight that fade in and out with it. */
  async pause(options: PauseOptions) {
    const at = options.at ?? 'cursor';
    const id = options.callout ? this.callout(options.callout, at) : null;
    if (options.spotlight) this.spotlight(options.spotlight);
    const fadeOut = 220;
    await this.hold(Math.max(0, options.ms - (id || options.spotlight ? fadeOut : 0)));
    if (id) this.hideCallout(id);
    if (options.spotlight) this.clearSpotlight();
    if (id || options.spotlight) await this.hold(fadeOut);
  }

  /**
   * Moves the camera to frame `target` at `factor`× (1 = whole viewport). Only the stepped capture
   * can zoom; the video fallback ignores it.
   */
  async zoom(target: Target | null, factor = 1.6, options: { duration?: number; wait?: boolean; easing?: Easing } = {}) {
    if (!this.capture.zoomSupported && !this.warnedZoom) {
      console.warn(`zoom is not supported by the ${this.capture.mode} capture; ignoring`);
      this.warnedZoom = true;
    }
    let cx = this.viewport.width / 2;
    let cy = this.viewport.height / 2;
    if (target) {
      const c = center((await this.rectOf(target)) ?? this.pointRect(await this.pointOf(target)));
      cx = c.x;
      cy = c.y;
    }
    const frames = this.frames(options.duration ?? 700);
    this.cameraTween = { from: { ...this.camera }, to: { cx, cy, zoom: target ? factor : 1 }, startFrame: this.frameNo, frames, easing: options.easing ?? easings.easeInOutSine };
    if (options.wait !== false) await this.frame(frames);
  }

  async unzoom(options: { duration?: number; wait?: boolean } = {}) {
    await this.zoom(null, 1, options);
  }

  // ---------------------------------------------------------------- time

  /** Holds the picture (and the mouse) for `ms`; overlay fades and ripples keep animating. */
  async hold(ms: number) {
    await this.frame(this.frames(ms));
  }

  /**
   * Keeps recording until `condition` holds: a locator that becomes visible, or a function. In the
   * stepped capture each frame takes longer than its share of output time, so a wait is shortened
   * in the video by roughly that ratio; `realtime` keeps it at its real length instead (for waits the
   * audience should feel, like an AI request), and `speed` plays it at that many times real time
   * (e.g. 10 for an agent's work the audience should still be able to follow).
   */
  async waitFor(condition: Locator | (() => Promise<boolean>), options: { timeout?: number; minMs?: number; realtime?: boolean; speed?: number } = {}) {
    const speed = options.speed ?? (options.realtime ? 1 : 0);
    const check = typeof condition === 'function' ? condition : () => condition.first().isVisible();
    const deadline = Date.now() + (options.timeout ?? 30_000);
    const minFrames = options.minMs ? this.frames(options.minMs) : 0;
    let n = 0;
    let owedMs = 0;
    while (!(await check().catch(() => false)) || n < minFrames) {
      if (Date.now() > deadline) throw new Error(`waitFor timed out after ${options.timeout ?? 30_000} ms`);
      const started = performance.now();
      await this.frame();
      n++;
      if (speed) {
        // Show the wait at 1/speed of its real length: repeat this frame for that share of the wall time,
        // carrying what doesn't make a whole frame over to the next one.
        owedMs = Math.max(0, owedMs + (performance.now() - started) / speed - 1000 / this.fps);
        const extra = Math.floor((owedMs * this.fps) / 1000);
        owedMs -= (extra * 1000) / this.fps;
        if (extra > 0) {
          await this.capture.repeat(extra);
          this.frameNo += extra;
          n += extra;
        }
      }
    }
  }

  // ---------------------------------------------------------------- frames

  /** Renders the overlay and captures `count` frames. */
  async frame(count = 1) {
    for (let i = 0; i < count; i++) {
      // A real browser keeps firing dragover while the mouse is held still mid-drag, and drop targets
      // (Copilot's drop zones) rely on it; Playwright's intercepted drag only fires it on movement.
      // Nudge the real mouse half a pixel; the drawn cursor stays put.
      if (this.dragging && !this.movedThisFrame) {
        await this.page.mouse.move(this.cursor.x + (this.frameNo % 2 ? 0.5 : -0.5), this.cursor.y);
      }
      this.movedThisFrame = false;
      const view = this.advanceCamera();
      await this.render();
      await this.capture.frame(view);
      this.frameNo++;
    }
  }

  private advanceCamera(): Rect {
    const t = this.cameraTween;
    if (t) {
      const p = Math.min(1, (this.frameNo - t.startFrame) / t.frames);
      this.camera = lerpCamera(t.from, t.to, t.easing(p));
      if (p >= 1) this.cameraTween = null;
    }
    return this.capture.zoomSupported ? cameraRect(this.camera, this.viewport) : { x: 0, y: 0, w: this.viewport.width, h: this.viewport.height };
  }

  private async render() {
    const f = this.frameNo;
    this.ripples = this.ripples.filter(r => f - r.startFrame <= r.frames);

    const callouts = [];
    for (const c of this.callouts.values()) {
      const t = fadeLevel(c.fade, f);
      if (c.fade.outFrame != null && t <= 0) {
        this.callouts.delete(c.id);
        continue;
      }
      const anchor = c.at === 'cursor' ? this.cursorRect() : ((await this.rectOf(c.at, 50).catch(() => null)) ?? c.lastRect);
      if (!anchor) continue;
      c.lastRect = anchor;
      callouts.push({ id: c.id, text: c.spec.text, kicker: c.spec.kicker ?? '', placement: c.spec.placement ?? ('auto' as Placement), anchor, t: easings.easeOutCubic(t) });
    }

    let spotlight = null;
    if (this.spot) {
      const t = fadeLevel(this.spot.fade, f);
      if (this.spot.fade.outFrame != null && t <= 0) {
        this.spot = null;
      } else {
        const rect = (await this.rectOf(this.spot.target, 50).catch(() => null)) ?? this.spot.lastRect;
        if (rect) {
          this.spot.lastRect = rect;
          spotlight = { rect, padding: this.spot.padding, dim: this.spot.dim, t };
        }
      }
    }

    const cards = [];
    for (const c of this.cards.values()) {
      const t = fadeLevel(c.fade, f);
      if (c.fade.outFrame != null && t <= 0) {
        this.cards.delete(c.id);
        continue;
      }
      cards.push({ id: c.id, ...c.spec, kind: c.spec.kind ?? 'code', sig: JSON.stringify(c.spec), t: easings.easeOutCubic(t) });
    }

    const state = {
      cursor: this.cursor,
      cards,
      ghost: this.ghost,
      ripples: this.ripples.map(r => ({ id: r.id, x: r.x, y: r.y, t: (f - r.startFrame) / r.frames })),
      callouts,
      spotlight,
    };
    try {
      // Bounded: during a navigation the evaluation can wait for the next document indefinitely.
      await Promise.race([
        this.page.evaluate(s => (window as any).__director?.render(s), state),
        new Promise(r => setTimeout(r, 3000)),
      ]);
    } catch (e) {
      // A navigation between frames destroys the context; the next document re-installs the overlay.
      if (!/context was destroyed|navigation/i.test(String(e))) throw e;
    }
  }

  // ---------------------------------------------------------------- targets

  private ripple() {
    this.ripples.push({ id: ++this.rippleIds, x: this.cursor.x, y: this.cursor.y, startFrame: this.frameNo, frames: this.frames(450) });
  }

  private async mouseTo(p: Point) {
    this.cursor.x = p.x;
    this.cursor.y = p.y;
    this.movedThisFrame = true;
    await this.page.mouse.move(p.x, p.y);
  }

  private cursorRect(): Rect {
    if (this.ghost?.w && this.ghost.h) {
      return { x: this.cursor.x - this.ghost.grabX, y: this.cursor.y - this.ghost.grabY, w: this.ghost.w, h: this.ghost.h };
    }
    return { x: this.cursor.x - 4, y: this.cursor.y - 4, w: 26, h: 30 };
  }

  private pointRect(p: Point): Rect {
    return { x: p.x, y: p.y, w: 0, h: 0 };
  }

  /** `timeout` is how long to wait for a locator to appear; per-frame lookups pass a short one. */
  async rectOf(target: Target, timeout = 2000): Promise<Rect | null> {
    if (typeof target === 'function') return target();
    if (typeof target === 'object' && 'x' in target && 'y' in target) {
      return 'w' in target ? target : this.pointRect(target);
    }
    const locator = typeof target === 'string' ? this.page.locator(target).first() : target.first();
    const box = await locator.boundingBox({ timeout });
    return box ? { x: box.x, y: box.y, w: box.width, h: box.height } : null;
  }

  private async pointOf(target: Target, options: Pick<MoveOptions, 'anchor' | 'offset'> = {}): Promise<Point> {
    const rect = await this.rectOf(target);
    if (!rect) throw new Error(`target has no box: ${String(target)}`);
    const a = options.anchor ?? { x: 0.5, y: 0.5 };
    return { x: rect.x + rect.w * a.x + (options.offset?.x ?? 0), y: rect.y + rect.h * a.y + (options.offset?.y ?? 0) };
  }
}
