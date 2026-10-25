import type { IncomingMessage } from 'node:http';
import type { AppConfig } from '../config/app-config';
import { clientIp, ConnectionLimiter } from './connection-limiter';

function req(remoteAddress: string, forwarded?: string): IncomingMessage {
  return {
    headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded },
    socket: { remoteAddress },
  } as unknown as IncomingMessage;
}

describe('clientIp', () => {
  it('uses the socket address when no proxy is trusted', () => {
    expect(clientIp(req('10.0.0.5', '203.0.113.10'), 0)).toBe('10.0.0.5');
  });

  it('takes the address the trusted proxy appended, ignoring forged entries before it', () => {
    expect(clientIp(req('172.18.0.3', '198.51.100.1, 203.0.113.10'), 1)).toBe('203.0.113.10');
  });

  it('falls back to the first entry when the chain is shorter than the hop count', () => {
    expect(clientIp(req('172.18.0.3'), 1)).toBe('172.18.0.3');
  });
});

describe('ConnectionLimiter', () => {
  const limiter = () => new ConnectionLimiter({ maxSocketsPerIp: 2 } as AppConfig);

  it('allows up to the limit per address and frees slots on release', () => {
    const l = limiter();
    expect(l.acquire('s1', 'a')).toBe(true);
    expect(l.acquire('s2', 'a')).toBe(true);
    expect(l.acquire('s3', 'a')).toBe(false);
    expect(l.acquire('s4', 'b')).toBe(true);
    l.release('s1');
    expect(l.hasRoom('a')).toBe(true);
  });

  it('ignores the release of a socket that never got a slot', () => {
    const l = limiter();
    l.acquire('s1', 'a');
    l.acquire('s2', 'a');
    l.acquire('s3', 'a');
    l.release('s3');
    expect(l.hasRoom('a')).toBe(false);
  });
});
