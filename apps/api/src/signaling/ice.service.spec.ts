import { buildIceServers, turnCredential } from './ice.service';

const base = {
  stunUrls: ['stun:stun.test:3478'],
  turnUrls: [] as string[],
  turnSecret: undefined as string | undefined,
  turnCredentialTtlSeconds: 43_200,
};

describe('IceService', () => {
  it('matches the fixed TURN credential vector', () => {
    expect(turnCredential('test-secret', '1893456000:abcdef')).toBe('cLAZH1uPPVeiaiZEbOJx5kd0ySk=');
  });

  it('returns only STUN when TURN is not configured', () => {
    expect(buildIceServers(base, 0)).toEqual([{ urls: ['stun:stun.test:3478'] }]);
  });

  it('adds a TURN entry with a temporary credential', () => {
    const now = 1_800_000_000_500;
    const servers = buildIceServers(
      { ...base, turnUrls: ['turn:turn.test:3478'], turnSecret: 'test-secret' },
      now,
    );
    expect(servers).toHaveLength(2);
    const turn = servers[1]!;
    expect(turn.urls).toEqual(['turn:turn.test:3478']);
    const [expiresAt, id] = turn.username!.split(':');
    expect(Number(expiresAt)).toBe(Math.floor(now / 1000) + 43_200);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(turn.credential).toBe(turnCredential('test-secret', turn.username!));
  });
});
