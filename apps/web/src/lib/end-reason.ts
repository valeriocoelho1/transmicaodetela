import type { EndReason } from '@app/shared';

export const END_REASON_MESSAGES: Record<EndReason, string> = {
  HOST_ENDED: 'A transmissão foi encerrada pelo anfitrião.',
  HOST_TIMEOUT: 'O anfitrião saiu e a sala foi encerrada.',
  EXPIRED: 'A sala expirou.',
};

export const ROOM_NOT_FOUND_MESSAGE = 'Sala não encontrada ou já encerrada.';
export const RECONNECTING_MESSAGE = 'Conexão perdida. Reconectando…';
export const CONNECTING_MESSAGE = 'Conectando à sala…';
