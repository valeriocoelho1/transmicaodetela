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

export class ViewerReceiver {
  private pc: RTCPeerConnection | null = null;
  private queue: IceCandidateQueue | null = null;
  private failureTimer: ReturnType<typeof setTimeout> | undefined;
  private iceServers: IceServer[] = [];

  constructor(private readonly callbacks: ViewerReceiverCallbacks) {}

  setIceServers(list: IceServer[]): void {
    this.iceServers = list;
  }

  async handleOffer(sdp: OfferSdp): Promise<void> {
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
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
    } catch {
      if (isCurrent()) this.callbacks.failed();
      return;
    }
    const answerSdp = pc.localDescription?.sdp;
    if (answerSdp && isCurrent()) this.callbacks.answer({ type: 'answer', sdp: answerSdp });
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
