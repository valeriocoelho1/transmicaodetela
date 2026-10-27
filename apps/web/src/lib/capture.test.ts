import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureErrorMessage, isDisplayCaptureSupported, startDisplayCapture } from './capture';

const domError = (name: string) => new DOMException('message', name);

describe('captureErrorMessage', () => {
  it.each([
    ['NotAllowedError', 'Você cancelou ou não permitiu o compartilhamento.'],
    ['NotFoundError', 'Nenhuma tela disponível para compartilhar.'],
    ['NotReadableError', 'O sistema impediu a captura da tela.'],
    ['AbortError', 'Não foi possível iniciar o compartilhamento.'],
  ])('maps %s', (name, message) => {
    expect(captureErrorMessage(domError(name))).toBe(message);
  });

  it('maps unknown values to the generic message', () => {
    expect(captureErrorMessage('boom')).toBe('Não foi possível iniciar o compartilhamento.');
  });
});

describe('isDisplayCaptureSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false without getDisplayMedia', () => {
    vi.stubGlobal('navigator', { mediaDevices: {} });
    expect(isDisplayCaptureSupported()).toBe(false);
  });

  it('is true when getDisplayMedia exists', () => {
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: () => undefined } });
    expect(isDisplayCaptureSupported()).toBe(true);
  });
});

describe('startDisplayCapture', () => {
  const fakeStream = () =>
    ({ getVideoTracks: () => [{ contentHint: '' }] }) as unknown as MediaStream;
  const windowsAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0';
  const macAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0.0.0';

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for screen, tab audio and system audio', async () => {
    vi.stubGlobal('navigator', { userAgent: windowsAgent });
    const getDisplayMedia = vi.fn<(options: DisplayMediaStreamOptions) => Promise<MediaStream>>(
      async () => fakeStream(),
    );
    await startDisplayCapture({}, getDisplayMedia);
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(getDisplayMedia.mock.calls[0]?.[0]).toMatchObject({
      audio: true,
      systemAudio: 'include',
    });
  });

  it('asks the Mac for tab audio only', async () => {
    vi.stubGlobal('navigator', { userAgent: macAgent });
    const getDisplayMedia = vi.fn<(options: DisplayMediaStreamOptions) => Promise<MediaStream>>(
      async () => fakeStream(),
    );
    await startDisplayCapture({}, getDisplayMedia);
    expect(getDisplayMedia.mock.calls[0]?.[0]).toMatchObject({
      audio: true,
      systemAudio: 'exclude',
    });
  });

  it('asks for screen only, without system audio, when sound is turned off', async () => {
    const getDisplayMedia = vi.fn<(options: DisplayMediaStreamOptions) => Promise<MediaStream>>(
      async () => fakeStream(),
    );
    await startDisplayCapture({ audio: false }, getDisplayMedia);
    expect(getDisplayMedia.mock.calls[0]?.[0]).toMatchObject({
      audio: false,
      systemAudio: 'exclude',
    });
  });

  it('retries with video only when the browser rejects the options', async () => {
    const getDisplayMedia = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('audio not supported'))
      .mockResolvedValueOnce(fakeStream());
    await startDisplayCapture({}, getDisplayMedia);
    expect(getDisplayMedia).toHaveBeenCalledTimes(2);
    expect(getDisplayMedia.mock.calls[1]?.[0]).toMatchObject({ audio: false });
  });

  it('does not ask again when the user cancels', async () => {
    const getDisplayMedia = vi.fn().mockRejectedValue(domError('NotAllowedError'));
    await expect(startDisplayCapture({}, getDisplayMedia)).rejects.toThrow();
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });
});
