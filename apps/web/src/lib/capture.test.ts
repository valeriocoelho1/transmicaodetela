import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureErrorMessage, isDisplayCaptureSupported } from './capture';

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
