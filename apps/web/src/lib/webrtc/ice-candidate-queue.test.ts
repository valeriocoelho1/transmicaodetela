import { describe, expect, it } from 'vitest';
import type { IceCandidate } from '@app/shared';
import { IceCandidateQueue } from './ice-candidate-queue';

const candidate = (n: number): IceCandidate => ({ candidate: `candidate:${n}`, sdpMid: '0' });

describe('IceCandidateQueue', () => {
  it('holds candidates until the remote description is ready', async () => {
    const applied: string[] = [];
    const queue = new IceCandidateQueue(async (c) => {
      applied.push(c.candidate);
    });
    void queue.push(candidate(1));
    void queue.push(candidate(2));
    await Promise.resolve();
    expect(applied).toEqual([]);
    await queue.markReady();
    expect(applied).toEqual(['candidate:1', 'candidate:2']);
  });

  it('applies later candidates immediately and in order', async () => {
    const applied: string[] = [];
    const queue = new IceCandidateQueue(async (c) => {
      await new Promise((resolve) => setTimeout(resolve, c.candidate.endsWith('1') ? 10 : 0));
      applied.push(c.candidate);
    });
    void queue.push(candidate(1));
    await queue.markReady();
    void queue.push(candidate(2));
    await queue.push(candidate(3));
    expect(applied).toEqual(['candidate:1', 'candidate:2', 'candidate:3']);
  });

  it('keeps going when applying a candidate fails', async () => {
    const applied: string[] = [];
    const queue = new IceCandidateQueue(async (c) => {
      if (c.candidate === 'candidate:1') throw new Error('bad candidate');
      applied.push(c.candidate);
    });
    void queue.push(candidate(1));
    void queue.push(candidate(2));
    await queue.markReady();
    expect(applied).toEqual(['candidate:2']);
  });
});
