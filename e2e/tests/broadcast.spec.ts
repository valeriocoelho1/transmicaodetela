import { expect, test } from '@playwright/test';
import { expectVideoPlaying, openHostRoom, openViewer, WAITING } from '../support/helpers';

test('1. viewer who joins before the broadcast receives the video', async ({ browser }) => {
  const { host, link } = await openHostRoom(browser);
  const viewer = await openViewer(browser, link);
  await expect(viewer.getByText(WAITING)).toBeVisible();
  await expect(host.getByText('1 espectador', { exact: true })).toBeVisible();

  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expect(host.getByText('Ao vivo')).toBeVisible();
  await expectVideoPlaying(viewer);
  await expect(host.getByText('1 espectador', { exact: true })).toBeVisible();
  await expect(viewer.getByText('Esta transmissão está sem áudio.')).toBeVisible();
});

test('2. viewer who joins during the broadcast receives the video', async ({ browser }) => {
  const { host, link } = await openHostRoom(browser);
  const first = await openViewer(browser, link);
  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expectVideoPlaying(first);

  const second = await openViewer(browser, link);
  await expectVideoPlaying(second);
  await expect(host.getByText('2 espectadores', { exact: true })).toBeVisible();
});

test('3. a third viewer sees that the room is full', async ({ browser }) => {
  const { host, link } = await openHostRoom(browser);
  await openViewer(browser, link);
  await openViewer(browser, link);
  await expect(host.getByText('2 espectadores', { exact: true })).toBeVisible();
  const third = await openViewer(browser, link);
  await expect(third.getByText('A sala está cheia. Tente novamente mais tarde.')).toBeVisible();
});

test('4. missing or malformed rooms show the not found message', async ({ browser }) => {
  const missing = await openViewer(browser, 'http://localhost:5273/r/aaaaaaaaaaaa');
  await expect(missing.getByText('Sala não encontrada ou já encerrada.')).toBeVisible();
  const malformed = await openViewer(browser, 'http://localhost:5273/r/nao-existe');
  await expect(malformed.getByText('Sala não encontrada ou já encerrada.')).toBeVisible();
});

test('5. stopping and sharing again brings the video back', async ({ browser }) => {
  const { host, link } = await openHostRoom(browser);
  const viewer = await openViewer(browser, link);
  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expectVideoPlaying(viewer);

  await host.getByRole('button', { name: 'Parar transmissão' }).click();
  await expect(viewer.getByText(WAITING)).toBeVisible();
  await expect(viewer.getByTestId('remote-video')).toHaveCount(0);

  await host.getByRole('button', { name: 'Compartilhar novamente' }).click();
  await expect(host.getByText('Ao vivo')).toBeVisible();
  await expectVideoPlaying(viewer);
});

test('6. ending the room tells viewers the host ended it', async ({ browser }) => {
  const { host, link } = await openHostRoom(browser);
  const viewer = await openViewer(browser, link);
  await host.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expectVideoPlaying(viewer);

  await host.getByRole('button', { name: 'Encerrar sala' }).click();
  await expect(viewer.getByText('A transmissão foi encerrada pelo anfitrião.')).toBeVisible();
  await expect(viewer.getByTestId('remote-video')).toHaveCount(0);
});
