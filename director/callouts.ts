// Node side of callouts, spotlight and zoom.
//
// Callouts and the spotlight are drawn in the page by page/overlay.page.js. Zoom is a camera: it
// never touches the page (a CSS transform would move Copilot's hit targets mid-drag); the stepped
// capture crops each screenshot to the camera rectangle instead.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Placement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

export interface CalloutSpec {
  text: string;
  kicker?: string;
  placement?: Placement;
}

/** Frame-level fade state of something that appears and disappears (callout, spotlight). */
export interface Fade {
  /** Frame on which it started appearing. */
  inFrame: number;
  /** Frame on which it starts disappearing, if scheduled. */
  outFrame?: number;
  frames: number;
}

export function fadeLevel(fade: Fade, frame: number): number {
  const fadeIn = Math.min(1, (frame - fade.inFrame) / fade.frames);
  const fadeOut = fade.outFrame == null ? 1 : 1 - Math.min(1, Math.max(0, (frame - fade.outFrame) / fade.frames));
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

export interface Camera {
  /** Center of the view, CSS px. */
  cx: number;
  cy: number;
  /** 1 = the whole viewport. */
  zoom: number;
}

/** The viewport rectangle the camera sees, kept inside the page so zooming near an edge doesn't show void. */
export function cameraRect(camera: Camera, viewport: { width: number; height: number }): Rect {
  const w = viewport.width / camera.zoom;
  const h = viewport.height / camera.zoom;
  const x = Math.max(0, Math.min(viewport.width - w, camera.cx - w / 2));
  const y = Math.max(0, Math.min(viewport.height - h, camera.cy - h / 2));
  return { x, y, w, h };
}

export function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  // Interpolate zoom geometrically so the zoom feels uniform in speed.
  const zoom = a.zoom * Math.pow(b.zoom / a.zoom, t);
  return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, zoom };
}

export function center(r: Rect) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
