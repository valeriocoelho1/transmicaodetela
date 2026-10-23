import type { IceCandidate } from '@app/shared';

export class IceCandidateQueue {
  private pending: IceCandidate[] = [];
  private ready = false;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly apply: (candidate: IceCandidate) => Promise<void>) {}

  push(candidate: IceCandidate): Promise<void> {
    if (!this.ready) {
      this.pending.push(candidate);
      return this.chain;
    }
    return this.enqueue(candidate);
  }

  markReady(): Promise<void> {
    this.ready = true;
    const pending = this.pending;
    this.pending = [];
    for (const candidate of pending) void this.enqueue(candidate);
    return this.chain;
  }

  private enqueue(candidate: IceCandidate): Promise<void> {
    this.chain = this.chain.then(() => this.apply(candidate)).catch(() => undefined);
    return this.chain;
  }
}

export function toIceCandidate(candidate: RTCIceCandidate): IceCandidate {
  const json = candidate.toJSON();
  return {
    candidate: json.candidate ?? '',
    sdpMid: json.sdpMid,
    sdpMLineIndex: json.sdpMLineIndex,
    usernameFragment: json.usernameFragment,
  };
}
