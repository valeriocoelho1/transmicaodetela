import { expect, type Page, test, type WebSocketRoute } from '@playwright/test';
import {
  closeContexts,
  newContext,
  expectVideoPlaying,
  openHostRoom,
  openViewer,
  url,
  WAITING,
} from '../support/helpers';

test.afterEach(closeContexts);

test('7. reloading the host page keeps the room and the video comes back', async ({ browser }) => {
  const { host, link } = await openHostRoom(browser);
  const viewer = await openViewer(browser, link);
  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expectVideoPlaying(viewer);

  await host.reload();
  await expect(viewer.getByText(WAITING)).toBeVisible();
  await expect(host.getByLabel('1 espectador', { exact: true })).toBeVisible();
  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expect(host.getByText('Ao vivo')).toBeVisible();
  await expectVideoPlaying(viewer);
});

test('8. host closes the tab and does not return: the room ends after the grace period', async ({
  browser,
}) => {
  const { host, link } = await openHostRoom(browser);
  const viewer = await openViewer(browser, link);
  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expectVideoPlaying(viewer);

  // Closing the page here does not run its unload handlers, so to the server the host simply
  // vanished: viewers keep the last frame until the grace period ends the room.
  await host.close();
  await expect(viewer.getByText('O anfitrião saiu e a sala foi encerrada.')).toBeVisible({
    timeout: 15_000,
  });
});

test('9. opening the room in a second host tab replaces the first one', async ({ browser }) => {
  const { host } = await openHostRoom(browser);
  const second = await host.context().newPage();
  await second.goto(host.url());
  await expect(second.getByLabel('0 espectadores', { exact: true })).toBeVisible();
  await expect(host.getByText('Esta sala foi aberta em outra aba.')).toBeVisible();
  await expect(second.getByRole('button', { name: 'Compartilhar tela' })).toBeEnabled();
});

test('10. a host page without a stored token is refused', async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await page.goto(url('/host/aZ09_-aZ09_-'));
  await expect(page.getByText('Você não tem acesso de anfitrião a esta sala.')).toBeVisible();
});

test('11. a viewer keeps watching while its network loses the server', async ({ browser }) => {
  // setOffline does not close an open WebSocket, so the drop is only noticed by the
  // Socket.IO ping timeout (about 45 s with the defaults). It does not stop the WebRTC video.
  test.setTimeout(120_000);
  const { host, link } = await openHostRoom(browser);
  const viewer = await openViewer(browser, link);
  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expectVideoPlaying(viewer);
  await markVideo(viewer);

  await viewer.context().setOffline(true);
  await expect(viewer.getByText('Reconectando…', { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(markedVideo(viewer)).toHaveCount(1);
  await viewer.context().setOffline(false);
  await expect(viewer.getByText('Ao vivo')).toBeVisible({ timeout: 20_000 });
  await expect(markedVideo(viewer)).toHaveCount(1);
  await expectVideoPlaying(viewer);
  await expect(host.getByLabel('1 espectador', { exact: true })).toBeVisible();
});

test('12. a dropped server connection resumes without stopping the video', async ({ browser }) => {
  const { host, link } = await openHostRoom(browser);
  const context = await newContext(browser);
  const sockets: { page: WebSocketRoute; server: WebSocketRoute }[] = [];
  await context.routeWebSocket(/\/socket\.io\//, (ws) => {
    sockets.push({ page: ws, server: ws.connectToServer() });
  });
  const viewer = await context.newPage();
  await viewer.goto(link);
  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expectVideoPlaying(viewer);
  await markVideo(viewer);

  const opened = sockets.length;
  const current = sockets.at(-1)!;
  await current.server.close();
  await current.page.close();
  await expect.poll(() => sockets.length, { timeout: 15_000 }).toBeGreaterThan(opened);
  await expect(viewer.getByText('Ao vivo')).toBeVisible({ timeout: 15_000 });
  await expect(markedVideo(viewer)).toHaveCount(1);
  await expectVideoPlaying(viewer);
  await expect(host.getByLabel('1 espectador', { exact: true })).toBeVisible();
});

test('13. viewers keep watching while the host connection to the server drops', async ({
  browser,
}) => {
  const sockets: { page: WebSocketRoute; server: WebSocketRoute }[] = [];
  const { host, link } = await openHostRoom(browser, (context) =>
    context.routeWebSocket(/\/socket\.io\//, (ws) => {
      sockets.push({ page: ws, server: ws.connectToServer() });
    }),
  );
  const viewer = await openViewer(browser, link);
  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expectVideoPlaying(viewer);
  await markVideo(viewer);

  const opened = sockets.length;
  const current = sockets.at(-1)!;
  await current.server.close();
  await current.page.close();
  await expect.poll(() => sockets.length, { timeout: 15_000 }).toBeGreaterThan(opened);
  await expect(host.getByText('Ao vivo')).toBeVisible({ timeout: 15_000 });
  await expect(viewer.getByText('Ao vivo')).toBeVisible();
  await expect(markedVideo(viewer)).toHaveCount(1);
  await expectVideoPlaying(viewer);
});

// A new video connection would unmount the player, so a mark that survives proves it was kept.
async function markVideo(page: Page) {
  await page.getByTestId('remote-video').evaluate((video) => (video.dataset.mark = 'kept'));
}

function markedVideo(page: Page) {
  return page.locator('[data-testid="remote-video"][data-mark="kept"]');
}
