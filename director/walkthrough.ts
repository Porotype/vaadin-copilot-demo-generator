// Cuts a walkthrough take into one clip per step, at the scene's step marks (demo.step(), written by run.ts
// to out/<scene>/steps.json). Each step loops on its own in the docs page that embeds it, so a clip runs
// from its mark to the next one; a still step is its last frame only.
//
//   npm run walkthrough -- <scene>… [--gif]  → out/<scene>/steps/NN-<name>.mp4, .jpg (last frame), with --gif a
//                                            -loop.gif, and steps.json there, listing them
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ffmpeg, toGif } from './capture.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

interface Mark { name: string; t: number; still: boolean; crop?: { x: number; y: number; w: number; h: number }; skip?: boolean }

/** Clips are sized for a docs column: sharp at 2× in about 720 CSS px. */
const WIDTH = 1440;

async function cut(scene: string, gifs: boolean) {
  const dir = path.join(ROOT, 'out', scene);
  const src = path.join(dir, 'scene.mp4');
  const { duration, steps } = JSON.parse(await readFile(path.join(dir, 'steps.json'), 'utf8')) as { duration: number; steps: Mark[] };
  const out = path.join(dir, 'steps');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const fps = Number(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src]).toString().split('/')[0]);
  const listed = [];
  for (const [i, s] of steps.entries()) {
    // A demo.between() mark ends the step before it, and starts nothing.
    if (s.skip) continue;
    const from = s.t, to = steps[i + 1]?.t ?? duration;
    const base = `${String(listed.length + 1).padStart(2, '0')}-${s.name}`;
    const crop = s.crop ? `crop=${s.crop.w}:${s.crop.h}:${s.crop.x}:${s.crop.y},` : '';
    const still = path.join(out, `${base}.jpg`);
    // The step's last frame: its poster, and the whole of a still step.
    await ffmpeg(['-y', '-ss', Math.max(from, to - 1.5 / fps).toFixed(3), '-i', src, '-frames:v', '1', '-vf', `${crop}scale=${WIDTH}:-2:flags=lanczos`, '-q:v', '3', still]);
    const entry: Record<string, unknown> = { name: s.name, still: path.basename(still), seconds: +(to - from).toFixed(2) };
    if (!s.still) {
      const mp4 = path.join(out, `${base}.mp4`);
      await ffmpeg(['-y', '-ss', from.toFixed(3), '-to', to.toFixed(3), '-i', src, '-an',
        '-vf', `${crop}scale=${WIDTH}:-2:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-movflags', '+faststart', mp4]);
      entry.video = path.basename(mp4);
      if (gifs) {
        const { loop } = await toGif(mp4);
        await rm(mp4.replace(/\.mp4$/, '.gif'));
        entry.gif = path.basename(loop);
      }
    }
    listed.push(entry);
    console.log(`${scene} ${base}: ${(to - from).toFixed(1)} s${s.still ? ' (still)' : ''}`);
  }
  await writeFile(path.join(out, 'steps.json'), JSON.stringify(listed, null, 2));
}

const scenes = process.argv.slice(2).filter(a => a !== '--gif');
if (!scenes.length) {
  console.error('usage: npm run walkthrough -- <scene>… [--gif]');
  process.exit(2);
}
for (const scene of scenes) await cut(scene, process.argv.includes('--gif'));
