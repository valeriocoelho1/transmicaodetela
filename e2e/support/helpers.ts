import { type Browser, expect, type Page } from '@playwright/test';
import { installFakeDisplayMedia } from './fake-display-media';

export const WEB_ORIGIN = 'http://localhost:5273';

export async function openHostRoom(browser: Browser): Promise<{ host: Page; link: string }> {
  const context = await browser.newContext();
  await installFakeDisplayMedia(context);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: WEB_ORIGIN });
  const host = await context.newPage();
  await host.goto(`${WEB_ORIGIN}/`);
  await host.getByRole('button', { name: 'Criar sala' }).click();
  await expect(host.getByRole('heading', { name: 'Sua sala' })).toBeVisible();
  await expect(host.getByText('0 espectadores')).toBeVisible();

  await host.getByRole('button', { name: 'Copiar link' }).click();
  await expect(host.getByRole('button', { name: 'Link copiado' })).toBeVisible();
  const link = await host.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/^http:\/\/localhost:5273\/r\/[A-Za-z0-9_-]{12}$/);
  await expect(host.getByRole('textbox', { name: 'Link' })).toHaveValue(link);
  expect(host.url()).not.toContain('token');
  return { host, link };
}

export async function openViewer(browser: Browser, link: string): Promise<Page> {
  const context = await browser.newContext();
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
