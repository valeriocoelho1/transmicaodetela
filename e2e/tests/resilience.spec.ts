import { expect, test } from '@playwright/test';
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
  await expect(host.getByText('1 espectador', { exact: true })).toBeVisible();
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

  await host.close();
  await expect(viewer.getByText(WAITING)).toBeVisible();
  await expect(viewer.getByText('O anfitrião saiu e a sala foi encerrada.')).toBeVisible({
    timeout: 15_000,
  });
});

test('9. opening the room in a second host tab replaces the first one', async ({ browser }) => {
  const { host } = await openHostRoom(browser);
  const second = await host.context().newPage();
  await second.goto(host.url());
  await expect(second.getByText('0 espectadores')).toBeVisible();
  await expect(host.getByText('Esta sala foi aberta em outra aba.')).toBeVisible();
  await expect(second.getByRole('button', { name: 'Compartilhar tela' })).toBeEnabled();
});

test('10. a host page without a stored token is refused', async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await page.goto(url('/host/aZ09_-aZ09_-'));
  await expect(page.getByText('Você não tem acesso de anfitrião a esta sala.')).toBeVisible();
});

test('11. a viewer recovers after losing the network', async ({ browser }) => {
  // setOffline does not close an open WebSocket, so the drop is only noticed by the
  // Socket.IO ping timeout (about 45 s with the defaults).
  test.setTimeout(120_000);
  const { host, link } = await openHostRoom(browser);
  const viewer = await openViewer(browser, link);
  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expectVideoPlaying(viewer);

  await viewer.context().setOffline(true);
  await expect(viewer.getByText('Conexão perdida. Reconectando…')).toBeVisible({
    timeout: 60_000,
  });
  await viewer.context().setOffline(false);
  await expectVideoPlaying(viewer);
  await expect(host.getByText('1 espectador', { exact: true })).toBeVisible();
});
