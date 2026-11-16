// Helpers for the real Copilot UI, which any Vaadin app in dev mode brings along.
// Selectors come from the Copilot source (copilot-internal) at 25.3; Copilot renders under one open
// shadow root (copilot-main) and Playwright's CSS engine pierces it.

import { copyFile, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright';

export type CopilotMode = 'play' | 'inspect' | 'edit' | 'test';

export class Copilot {
  constructor(readonly page: Page) {}

  /** Waits until Copilot has booted in the page. */
  async ready(timeout = 30_000) {
    await this.page.waitForFunction(() => (document.querySelector('copilot-main') as any)?.initialized === true, null, { timeout });
  }

  async mode(): Promise<CopilotMode> {
    return this.page.evaluate(() => (window as any).Vaadin.copilot._uiState.activeMode);
  }

  modeButton(mode: CopilotMode) {
    return this.page.locator(`#${mode}-mode-radio-btn`);
  }

  /** Switches mode by clicking the toolbar (without the scripted cursor; use for setup). */
  async setMode(mode: CopilotMode) {
    if ((await this.mode()) === mode) return;
    // The toolbar collapses to the active mode until the pointer comes near, so force the click. Right
    // after Copilot reports itself initialized the toolbar can still ignore clicks: retry.
    for (let attempt = 1; ; attempt++) {
      await this.modeButton(mode).click({ force: true });
      try {
        await this.page.waitForFunction(m => (window as any).Vaadin.copilot._uiState.activeMode === m, mode, { timeout: 1500 });
        break;
      } catch (e) {
        if (attempt === 10) throw e;
      }
    }
    if (mode !== 'play') {
      // Edit-mode features (palette, drag and drop) are private plugins loaded on first use.
      await this.page.waitForFunction(() => (window as any).Vaadin.copilot._uiState.privatePluginsState === 'INITIALIZED', null, { timeout: 30_000 });
    }
  }

  /** The toolbar button that opens or closes a panel. (An open panel carries the same data-panel-tag.) */
  panelButton(panelTag: string) {
    return this.page.locator(`#mode-panel-icon-container [data-panel-tag="${panelTag}"]`);
  }

  get paletteButton() {
    return this.panelButton('copilot-palette');
  }

  get palette() {
    return this.page.locator('copilot-palette');
  }

  get paletteSearch() {
    return this.page.locator('copilot-palette-actions vaadin-text-field[placeholder="Search"]');
  }

  /** A palette entry by its title, e.g. 'Grid ⋅ Basic' (the dot is U+22C5). */
  paletteItem(title: string) {
    return this.page.locator('copilot-palette li vaadin-button[draggable]', { hasText: title });
  }

  async openPalette() {
    if ((await this.paletteButton.getAttribute('aria-expanded')) !== 'true') {
      await this.paletteButton.click();
    }
    await this.palette.waitFor({ state: 'visible' });
  }

  /** The drop zone the cursor is over during a drag. */
  get activeDropZone() {
    return this.page.locator('.copilot-drop-zone.hover');
  }

  /** The toolbar's "⋮" button, which opens the dev tools menu (App Info, Features, Impersonate, Feedback, ...). */
  get devtoolsButton() {
    return this.page.locator('#devtools-button');
  }

  /** An entry of the dev tools menu by its visible text, e.g. 'Features'. */
  devtoolsItem(text: string) {
    return this.page.locator('#devtools-popover vaadin-button', { hasText: text }).first();
  }

  /** An open panel (a vaadin-dialog[panel-container]) by its element tag, e.g. 'copilot-features-panel'. */
  panel(tag: string) {
    return this.page.locator(tag).first();
  }

  /** The badge of the selected component (name, AI prompt, docs, layout tools, ⋮). */
  get badge() {
    // Copilot keeps badges for hovered and earlier selections around, hidden.
    return this.page.locator('copilot-component-info-badge:visible').first();
  }

  /** True while Copilot waits for the server (a drop being written and hot-reloaded). */
  async busy(): Promise<boolean> {
    return this.page.evaluate(() => {
      const s = (window as any).Vaadin?.copilot?._uiState;
      return !!(s?.operationInProgress || s?.operationWaitsHmrUpdate);
    });
  }
}

/**
 * Serves Copilot's private plugins (palette, drag and drop, ...; fetched by the browser from
 * cdn.vaadin.com/copilot/<version>/) from a local cache, filling it on first use. Recordings then
 * don't depend on the network, and the plugins can't change under a scene between runs.
 */
export async function cacheCopilotPlugins(context: BrowserContext, cacheDir: string) {
  await context.route('https://cdn.vaadin.com/copilot/**', async route => {
    const url = new URL(route.request().url());
    const file = path.join(cacheDir, url.pathname.replace(/^\/copilot\//, ''));
    if (existsSync(file)) {
      return route.fulfill({ path: file, headers: { 'content-type': contentType(file), 'access-control-allow-origin': '*' } });
    }
    const response = await route.fetch();
    if (response.ok()) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, await response.body());
    }
    return route.fulfill({ response });
  });
}

function contentType(file: string) {
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript';
  if (file.endsWith('.css')) return 'text/css';
  if (file.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

export interface MachineConfigOverrides {
  /** Notification dismissIds to treat as dismissed, e.g. 'java-modification-no-hotswap'. */
  dismissNotifications?: string[];
  /** Start the palette unfiltered (Copilot remembers the last search). */
  clearPaletteFilter?: boolean;
  /** Anything else to set on the configuration object. */
  set?: Record<string, unknown>;
}

/**
 * Copilot keeps machine-wide UI state in ~/.vaadin/copilot-configuration.json, read by the server on
 * each request and written back on every change. A recording swaps in a copy with `overrides` and
 * restores the user's own file afterwards (call the returned function).
 */
export async function useDemoMachineConfig(overrides: MachineConfigOverrides, backupDir: string): Promise<() => Promise<void>> {
  const file = path.join(os.homedir(), '.vaadin', 'copilot-configuration.json');
  const backup = path.join(backupDir, 'copilot-configuration.backup.json');
  const existed = existsSync(file);
  await mkdir(backupDir, { recursive: true });
  if (existsSync(backup)) {
    throw new Error(`${backup} exists: a previous run did not restore it. Copy it back to ${file} (or delete it) first.`);
  }
  let conf: Record<string, any> = {};
  if (existed) {
    await copyFile(file, backup);
    conf = JSON.parse(await readFile(file, 'utf8'));
  }
  if (overrides.dismissNotifications) {
    conf.dismissedNotifications = [...new Set([...(conf.dismissedNotifications ?? []), ...overrides.dismissNotifications])];
  }
  if (overrides.clearPaletteFilter && conf.paletteState) conf.paletteState = { ...conf.paletteState, filterText: '' };
  Object.assign(conf, overrides.set);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(conf));

  return async () => {
    if (existed) {
      await copyFile(backup, file);
      await rm(backup);
    } else {
      await rm(file, { force: true });
    }
  };
}
