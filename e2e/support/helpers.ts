import { type Browser, type BrowserContext, expect, type Page } from '@playwright/test';
import { installFakeDisplayMedia } from './fake-display-media';
import { BASE_URL, EXTERNAL_BASE_URL } from './target';

const openContexts: BrowserContext[] = [];

export async function newContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ ignoreHTTPSErrors: Boolean(EXTERNAL_BASE_URL) });
  openContexts.push(context);
  return context;
}

export async function closeContexts(): Promise<void> {
  const contexts = openContexts.splice(0);
  await Promise.all(contexts.map((context) => context.close()));
}

export function url(path: string): string {
  return `${BASE_URL}${path}`;
}

export async function openHostRoom(browser: Browser): Promise<{ host: Page; link: string }> {
  const context = await newContext(browser);
  await installFakeDisplayMedia(context);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(BASE_URL).origin,
  });
  const host = await context.newPage();
  await host.goto(url('/'));
  await host.getByRole('button', { name: 'Criar sala' }).click();
  await expect(host.getByRole('heading', { name: 'Sua sala' })).toBeAttached();
  await expect(host.getByLabel('0 espectadores', { exact: true })).toBeVisible();

  await host.getByRole('button', { name: 'Copiar link' }).click();
  await expect(host.getByRole('button', { name: 'Link copiado' })).toBeVisible();
  const link = await host.evaluate(() => navigator.clipboard.readText());
  expect(link.startsWith(url('/r/'))).toBe(true);
  expect(link).toMatch(/\/r\/[A-Za-z0-9_-]{12}$/);
  await expect(host.getByRole('textbox', { name: 'Link' })).toHaveValue(link);
  expect(host.url()).not.toContain('token');
  return { host, link };
}

export async function openViewer(browser: Browser, link: string): Promise<Page> {
  const context = await newContext(browser);
  const viewer = await context.newPage();
  await viewer.goto(link);
  return viewer;
}

export async function expectVideoPlaying(page: Page): Promise<void> {
  const video = page.getByTestId('remote-video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 20_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 })
    .toBeGreaterThan(0.3);
}

export const WAITING = 'Aguardando o anfitrião iniciar a transmissão.';
