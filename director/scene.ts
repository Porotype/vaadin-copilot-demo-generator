import type { Browser, BrowserContext, Page } from 'playwright';
import type { Demo } from './dsl.ts';
import type { StageOptions } from './stage.ts';
import type { Editor } from './editor.ts';
import type { Terminal } from './terminal.ts';

export interface SceneContext {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  /** This scene's output directory (out/<scene>/). */
  outDir: string;
  /** Registers cleanup that runs after the scene, also when it fails or is interrupted. */
  defer(cleanup: () => Promise<void> | void): void;
  /** The coding agent's terminal, on a split stage (see Scene.stage). */
  terminal?: Terminal;
  /** The developer's IDE, on a split stage with side: 'editor'. */
  editor?: Editor;
}

export interface Scene {
  name: string;
  /** CSS px. The output keeps this aspect ratio. */
  viewport?: { width: number; height: number };
  /** Output video size. */
  size?: { width: number; height: number };
  fps?: number;
  /** The browser's preferred color scheme (prefers-color-scheme); light unless given. */
  colorScheme?: 'light' | 'dark';
  /**
   * Records on the split stage: the browser next to a coding agent's terminal (ctx.terminal). The
   * viewport and size are then the stage's.
   */
  stage?: StageOptions;
  /** Runs before the browser starts: app checks, config swaps. */
  prepare?(ctx: Pick<SceneContext, 'outDir' | 'defer'>): Promise<void>;
  /** Runs in the browser before recording starts (sign in, open the view, set up Copilot). */
  setup?(ctx: SceneContext): Promise<void>;
  /** The recorded part. */
  run(demo: Demo, ctx: SceneContext): Promise<void>;
}

export function defineScene(scene: Scene): Scene {
  return scene;
}
