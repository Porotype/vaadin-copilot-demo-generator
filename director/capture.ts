// Turning a scene into a video.
//
// stepped (default): one screenshot per output frame, taken over CDP after the director has moved the
//   mouse and drawn the overlay for that frame. Frames are written as numbered images and joined at a
//   fixed frame rate with ffmpeg, so the output timing is exact however long each screenshot took.
//   The camera (zoom) is applied here by cropping each screenshot; Chromium re-rasterizes the cropped
//   area at the output resolution, so zoomed text stays sharp.
//   The page itself still runs on wall-clock time: its own animations and server round trips appear
//   faster or slower in the output than they were. See "Timing" in the skill (.claude/skills/copilot-walkthroughs).
//
// video (fallback): Playwright's recordVideo in real time, with frames paced by the wall clock.
//   Simpler and closer to what a viewer would see live, but lower quality and no zoom.

import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContextOptions, CDPSession, Page } from 'playwright';
import type { Rect } from './callouts.ts';

export type CaptureMode = 'stepped' | 'video';

export interface CaptureOptions {
  /** Directory for this scene's output (frames/, scene.mp4, ...). */
  outDir: string;
  fps: number;
  viewport: { width: number; height: number };
  /** Output video size; keep the viewport's aspect ratio. */
  size: { width: number; height: number };
}

export interface FrameSink {
  readonly mode: CaptureMode;
  readonly zoomSupported: boolean;
  contextOptions(): Partial<BrowserContextOptions>;
  /** Recording starts here; anything the page did before (login, setup) is not in the video. */
  start(page: Page): Promise<void>;
  /** Emit one output frame showing `view` (CSS px rectangle of the viewport). */
  frame(view: Rect): Promise<void>;
  /** Repeats the last frame `count` more times (cheap; used to show waits at their real length). */
  repeat(count: number): Promise<void>;
  finish(): Promise<string>;
}

export function createCapture(mode: CaptureMode, options: CaptureOptions): FrameSink {
  return mode === 'video' ? new VideoCapture(options) : new SteppedCapture(options);
}

class SteppedCapture implements FrameSink {
  readonly mode = 'stepped';
  readonly zoomSupported = true;
  private cdp!: CDPSession;
  protected index = 0;
  private last: Buffer | null = null;
  private writes: Promise<void>[] = [];
  protected readonly framesDir: string;

  constructor(protected readonly options: CaptureOptions) {
    this.framesDir = path.join(options.outDir, 'frames');
  }

  contextOptions() {
    return {};
  }

  async start(page: Page) {
    await rm(this.framesDir, { recursive: true, force: true });
    await mkdir(this.framesDir, { recursive: true });
    this.cdp = await page.context().newCDPSession(page);
  }

  async frame(view: Rect) {
    // A screenshot can stall while the page navigates (e.g. Copilot reloading it after switching
    // user). Give it a few tries, then repeat the previous frame rather than hang the take.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const shot = this.cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 92,
        optimizeForSpeed: true,
        clip: { x: view.x, y: view.y, width: view.w, height: view.h, scale: this.options.size.width / view.w },
      });
      const result = await Promise.race([shot, new Promise<null>(r => setTimeout(() => r(null), 4000))]).catch(() => null);
      if (result) {
        this.last = Buffer.from(result.data, 'base64');
        return this.write(this.last);
      }
    }
    if (!this.last) throw new Error('could not capture a frame');
    console.warn('frame capture stalled; repeating the previous frame');
    await this.write(this.last);
  }

  async repeat(count: number) {
    for (let i = 0; i < count && this.last; i++) await this.write(this.last);
  }

  private async write(data: Buffer) {
    await this.writeFrame(path.join(this.framesDir, `${String(++this.index).padStart(6, '0')}.jpg`), data);
  }

  protected async writeFrame(file: string, data: Buffer) {
    this.writes.push(writeFile(file, data));
    if (this.writes.length > 64) await Promise.all(this.writes.splice(0));
  }

  async finish() {
    await Promise.all(this.writes);
    return this.encode();
  }

  protected async encode() {
    const { fps, size, outDir } = this.options;
    const mp4 = path.join(outDir, 'scene.mp4');
    await ffmpeg([
      '-y', '-framerate', String(fps), '-i', path.join(this.framesDir, '%06d.jpg'),
      '-vf', `scale=${size.width}:${size.height}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-movflags', '+faststart', mp4,
    ]);
    return mp4;
  }
}

/** Something drawn next to the browser on a split stage, e.g. the agent's terminal. */
export interface SidePanel {
  /** The panel at output frame `index`, as a JPEG. */
  frame(index: number, fps: number): Promise<Buffer>;
}

/**
 * Stepped capture of the browser plus a side panel, composited onto a backdrop (see stage.ts). The
 * browser's frames stay at its viewport size; zoom still crops them.
 */
export class SplitCapture extends SteppedCapture {
  private readonly sideDir: string;

  constructor(
    options: CaptureOptions,
    private readonly side: SidePanel,
    private readonly stage: { backdrop: string; size: { width: number; height: number }; browser: Rect; terminal: Rect },
  ) {
    super(options);
    this.sideDir = path.join(options.outDir, 'frames-side');
  }

  async start(page: Page) {
    await super.start(page);
    await rm(this.sideDir, { recursive: true, force: true });
    await mkdir(this.sideDir, { recursive: true });
  }

  async frame(view: Rect) {
    await super.frame(view);
    await this.sideFrame();
  }

  async repeat(count: number) {
    // Repeat the browser's frame, but keep drawing the side panel: its spinner keeps turning.
    for (let i = 0; i < count; i++) {
      await super.repeat(1);
      await this.sideFrame();
    }
  }

  private async sideFrame() {
    const data = await this.side.frame(this.index, this.options.fps);
    await this.writeFrame(path.join(this.sideDir, `${String(this.index).padStart(6, '0')}.jpg`), data);
  }

  protected async encode() {
    const { fps, outDir } = this.options;
    const { backdrop, size, browser: b, terminal: t } = this.stage;
    const mp4 = path.join(outDir, 'scene.mp4');
    await ffmpeg([
      '-y', '-loop', '1', '-framerate', String(fps), '-i', backdrop,
      '-framerate', String(fps), '-i', path.join(this.framesDir, '%06d.jpg'),
      '-framerate', String(fps), '-i', path.join(this.sideDir, '%06d.jpg'),
      '-filter_complex',
      `[1]scale=${b.w}:${b.h}:flags=lanczos[b];[2]scale=${t.w}:${t.h}[t];` +
        `[0][b]overlay=${b.x}:${b.y}:shortest=1[s];[s][t]overlay=${t.x}:${t.y}:shortest=1,scale=${size.width}:${size.height},format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-movflags', '+faststart', mp4,
    ]);
    return mp4;
  }
}

class VideoCapture implements FrameSink {
  readonly mode = 'video';
  readonly zoomSupported = false;
  private page!: Page;
  private startedAt = 0;
  private createdAt = performance.now();
  private index = 0;

  constructor(private readonly options: CaptureOptions) {}

  contextOptions(): Partial<BrowserContextOptions> {
    this.createdAt = performance.now();
    return { recordVideo: { dir: path.join(this.options.outDir, 'raw'), size: this.options.size } };
  }

  async start(page: Page) {
    this.page = page;
    this.startedAt = performance.now();
  }

  async frame() {
    // Pace to the wall clock: frame n is due at start + n / fps.
    const due = this.startedAt + (++this.index * 1000) / this.options.fps;
    const wait = due - performance.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }

  async repeat(count: number) {
    // The video is the wall clock; just keep the frame count in step with it.
    this.index += count;
  }

  async finish() {
    const video = this.page.video();
    if (!video) throw new Error('recordVideo was not enabled for this context');
    await this.page.context().close();
    const raw = await video.path();
    const mp4 = path.join(this.options.outDir, 'scene.mp4');
    const skip = ((this.startedAt - this.createdAt) / 1000).toFixed(3);
    await ffmpeg([
      '-y', '-ss', skip, '-i', raw, '-r', String(this.options.fps),
      '-vf', `scale=${this.options.size.width}:${this.options.size.height},format=yuv420p`,
      '-c:v', 'libx264', '-crf', '18', '-movflags', '+faststart', mp4,
    ]);
    return mp4;
  }
}

/**
 * GIFs, for places that take images rather than videos, with a palette computed from the clip itself: `<name>.gif` plays once
 * and stops on its last frame (an end screen), `<name>-loop.gif` loops forever. They are encoded once; the
 * play-once copy is the looping one without its loop block.
 */
export async function toGif(mp4: string, options: { fps?: number; width?: number; out?: string } = {}) {
  const once = options.out ?? mp4.replace(/\.mp4$/, '.gif');
  const loop = once.replace(/\.gif$/, '-loop.gif');
  const tmp = `${loop}.tmp.gif`;
  const fps = options.fps ?? 15;
  const width = options.width ?? 960;
  await ffmpeg([
    '-y', '-i', mp4, '-filter_complex',
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`,
    '-loop', '0',
    tmp,
  ]);
  await rename(tmp, loop);
  await writeFile(once, withoutLoop(await readFile(loop)));
  return { once, loop };
}

/**
 * A GIF loops when it has a NETSCAPE2.0 application extension (19 bytes after the header and global
 * palette); without one, it plays once. This is what ffmpeg's `-loop -1` leaves out.
 */
function withoutLoop(gif: Buffer) {
  const at = gif.indexOf(Buffer.concat([Buffer.from([0x21, 0xff, 0x0b]), Buffer.from('NETSCAPE2.0')]));
  if (at < 0) throw new Error('no loop block in the GIF ffmpeg wrote');
  return Buffer.concat([gif.subarray(0, at), gif.subarray(at + 19)]);
}

export function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
}
