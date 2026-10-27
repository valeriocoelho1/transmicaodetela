import type { AnswerSdp, IceCandidate, IceServer, OfferSdp } from '@app/shared';
import { VIEWER_FAILURE_TIMEOUT_MS } from '../../config';
import { IceCandidateQueue, toIceCandidate } from './ice-candidate-queue';

export interface ViewerReceiverCallbacks {
  answer(sdp: AnswerSdp): void;
  ice(candidate: IceCandidate): void;
  stream(stream: MediaStream | null): void;
  connected(): void;
  failed(): void;
}

// The o= line keeps its session id for the whole life of an RTCPeerConnection, so an offer with
// the same id is a renegotiation (an ICE restart) of the connection we already have.
function sessionId(sdp: string | undefined): string | null {
  return sdp?.match(/^o=\S+ (\S+) /m)?.[1] ?? null;
}

export class ViewerReceiver {
  private pc: RTCPeerConnection | null = null;
  private queue: IceCandidateQueue | null = null;
  private failureTimer: ReturnType<typeof setTimeout> | undefined;
  private iceServers: IceServer[] = [];

  constructor(private readonly callbacks: ViewerReceiverCallbacks) {}

  setIceServers(list: IceServer[]): void {
    this.iceServers = list;
  }

  get connected(): boolean {
    return this.pc?.connectionState === 'connected';
  }

  async handleOffer(sdp: OfferSdp): Promise<void> {
    const current = this.pc;
    const session = sessionId(sdp.sdp);
    if (
      current &&
      session !== null &&
      current.signalingState === 'stable' &&
      sessionId(current.remoteDescription?.sdp) === session
    ) {
      await this.answer(current, sdp);
      return;
    }
    this.closePeer();
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const queue = new IceCandidateQueue((candidate) => pc.addIceCandidate(candidate));
    this.pc = pc;
    this.queue = queue;
    const isCurrent = () => this.pc === pc;

    pc.ontrack = (event) => {
      if (isCurrent()) this.callbacks.stream(event.streams[0] ?? new MediaStream([event.track]));
    };
    pc.onicecandidate = (event) => {
      if (event.candidate && isCurrent()) this.callbacks.ice(toIceCandidate(event.candidate));
    };
    pc.onconnectionstatechange = () => {
      if (!isCurrent()) return;
      const state = pc.connectionState;
      if (state === 'connected') {
        this.clearFailureTimer();
        this.callbacks.connected();
      } else if ((state === 'disconnected' || state === 'failed') && !this.failureTimer) {
        this.failureTimer = setTimeout(() => {
          this.failureTimer = undefined;
          if (isCurrent() && pc.connectionState !== 'connected') this.callbacks.failed();
        }, VIEWER_FAILURE_TIMEOUT_MS);
      }
    };

    try {
      await pc.setRemoteDescription(sdp);
      if (!isCurrent()) return;
      await queue.markReady();
    } catch {
      if (isCurrent()) this.callbacks.failed();
      return;
    }
    await this.answer(pc, sdp, true);
  }

  private async answer(pc: RTCPeerConnection, sdp: OfferSdp, remoteSet = false): Promise<void> {
    try {
      if (!remoteSet) await pc.setRemoteDescription(sdp);
      if (this.pc !== pc) return;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
    } catch {
      if (this.pc === pc) this.callbacks.failed();
      return;
    }
    const answerSdp = pc.localDescription?.sdp;
    if (answerSdp && this.pc === pc) this.callbacks.answer({ type: 'answer', sdp: answerSdp });
  }

  async handleIce(candidate: IceCandidate): Promise<void> {
    await this.queue?.push(candidate);
  }

  close(): void {
    this.closePeer();
    this.callbacks.stream(null);
  }

  private closePeer(): void {
    this.clearFailureTimer();
    const pc = this.pc;
    this.pc = null;
    this.queue = null;
    if (!pc) return;
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.close();
  }

  private clearFailureTimer(): void {
    clearTimeout(this.failureTimer);
    this.failureTimer = undefined;
  }
}
