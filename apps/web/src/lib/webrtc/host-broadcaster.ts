import type { AnswerSdp, IceCandidate, IceServer, OfferSdp } from '@app/shared';
import {
  HOST_PEER_MAX_RECOVERIES,
  HOST_PEER_RECOVERY_DELAY_MS,
  VIDEO_MAX_BITRATE_BPS,
  VIDEO_MAX_FRAMERATE,
} from '../../config';
import { IceCandidateQueue, toIceCandidate } from './ice-candidate-queue';

export interface HostBroadcasterCallbacks {
  offer(viewerId: string, sdp: OfferSdp): void;
  ice(viewerId: string, candidate: IceCandidate): void;
  peerFailed(viewerId: string): void;
}

interface Peer {
  pc: RTCPeerConnection;
  queue: IceCandidateQueue;
  recoveryTimer?: ReturnType<typeof setTimeout>;
}

// VP9 compresses text and flat screen content better than the VP8 default. Receivers that
// cannot decode it still negotiate the next codec in the list.
const PREFERRED_VIDEO_CODEC = 'video/vp9';

function preferVideoCodec(pc: RTCPeerConnection): void {
  if (typeof RTCRtpSender === 'undefined' || typeof RTCRtpReceiver === 'undefined') return;
  const canSend = RTCRtpSender.getCapabilities?.('video')?.codecs.some(
    (codec) => codec.mimeType.toLowerCase() === PREFERRED_VIDEO_CODEC,
  );
  const codecs = RTCRtpReceiver.getCapabilities?.('video')?.codecs;
  if (!canSend || !codecs) return;
  const rank = (codec: RTCRtpCodec) =>
    codec.mimeType.toLowerCase() === PREFERRED_VIDEO_CODEC ? 0 : 1;
  const ordered = [...codecs].sort((a, b) => rank(a) - rank(b));
  for (const transceiver of pc.getTransceivers()) {
    if (transceiver.sender.track?.kind !== 'video' || !transceiver.setCodecPreferences) continue;
    try {
      transceiver.setCodecPreferences(ordered);
    } catch {
      // The browser keeps its default codec order.
    }
  }
}

export class HostBroadcaster {
  private readonly peers = new Map<string, Peer>();
  private readonly knownViewers = new Set<string>();
  private readonly recoveries = new Map<string, number>();
  private stream: MediaStream | null = null;
  private iceServers: IceServer[] = [];

  constructor(private readonly callbacks: HostBroadcasterCallbacks) {}

  get viewerCount(): number {
    return this.knownViewers.size;
  }

  setIceServers(list: IceServer[]): void {
    this.iceServers = list;
  }

  setViewers(viewerIds: string[]): void {
    const next = new Set(viewerIds);
    for (const viewerId of this.knownViewers) {
      if (!next.has(viewerId)) this.removeViewer(viewerId);
    }
    for (const viewerId of next) this.knownViewers.add(viewerId);
  }

  addViewer(viewerId: string): void {
    this.knownViewers.add(viewerId);
    if (this.stream) void this.createPeer(viewerId, this.stream);
  }

  removeViewer(viewerId: string): void {
    this.knownViewers.delete(viewerId);
    this.recoveries.delete(viewerId);
    this.closePeer(viewerId);
  }

  start(stream: MediaStream): void {
    this.stream = stream;
    this.recoveries.clear();
    this.rebuildAll();
  }

  stop(): void {
    this.stream = null;
    for (const viewerId of [...this.peers.keys()]) this.closePeer(viewerId);
  }

  rebuildAll(): void {
    for (const viewerId of [...this.peers.keys()]) this.closePeer(viewerId);
    const stream = this.stream;
    if (!stream) return;
    for (const viewerId of this.knownViewers) void this.createPeer(viewerId, stream);
  }

  async handleAnswer(viewerId: string, sdp: AnswerSdp): Promise<void> {
    const peer = this.peers.get(viewerId);
    if (!peer || peer.pc.signalingState !== 'have-local-offer') return;
    try {
      await peer.pc.setRemoteDescription(sdp);
    } catch {
      return;
    }
    await peer.queue.markReady();
  }

  async handleIce(viewerId: string, candidate: IceCandidate): Promise<void> {
    await this.peers.get(viewerId)?.queue.push(candidate);
  }

  dispose(): void {
    this.stop();
    this.knownViewers.clear();
  }

  private closePeer(viewerId: string): void {
    const peer = this.peers.get(viewerId);
    if (!peer) return;
    this.peers.delete(viewerId);
    clearTimeout(peer.recoveryTimer);
    peer.pc.onicecandidate = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
  }

  private isCurrent(viewerId: string, pc: RTCPeerConnection): boolean {
    return this.peers.get(viewerId)?.pc === pc;
  }

  private recover(viewerId: string, pc: RTCPeerConnection): void {
    if (!this.isCurrent(viewerId, pc)) return;
    const stream = this.stream;
    const attempts = (this.recoveries.get(viewerId) ?? 0) + 1;
    if (!stream || !this.knownViewers.has(viewerId) || attempts > HOST_PEER_MAX_RECOVERIES) {
      this.recoveries.delete(viewerId);
      this.closePeer(viewerId);
      this.callbacks.peerFailed(viewerId);
      return;
    }
    this.recoveries.set(viewerId, attempts);
    void this.createPeer(viewerId, stream);
  }

  private async createPeer(viewerId: string, stream: MediaStream): Promise<void> {
    this.closePeer(viewerId);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const queue = new IceCandidateQueue((candidate) => pc.addIceCandidate(candidate));
    this.peers.set(viewerId, { pc, queue });

    for (const track of stream.getTracks()) pc.addTrack(track, stream);
    preferVideoCodec(pc);

    const videoSender = pc.getSenders().find((sender) => sender.track?.kind === 'video');
    if (videoSender) {
      const params = videoSender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      params.encodings[0]!.maxBitrate = VIDEO_MAX_BITRATE_BPS;
      params.encodings[0]!.maxFramerate = VIDEO_MAX_FRAMERATE;
      try {
        await videoSender.setParameters(params);
      } catch {
        // The browser keeps its default encoding when it rejects the limits.
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.isCurrent(viewerId, pc)) {
        this.callbacks.ice(viewerId, toIceCandidate(event.candidate));
      }
    };
    pc.onconnectionstatechange = () => {
      const peer = this.peers.get(viewerId);
      if (!peer || peer.pc !== pc) return;
      const state = pc.connectionState;
      if (state === 'connected') {
        clearTimeout(peer.recoveryTimer);
        peer.recoveryTimer = undefined;
        this.recoveries.delete(viewerId);
      } else if (state === 'failed') {
        this.recover(viewerId, pc);
      } else if (state === 'disconnected' && !peer.recoveryTimer) {
        peer.recoveryTimer = setTimeout(() => {
          peer.recoveryTimer = undefined;
          if (pc.connectionState !== 'connected') this.recover(viewerId, pc);
        }, HOST_PEER_RECOVERY_DELAY_MS);
      }
    };

    if (!this.isCurrent(viewerId, pc)) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
    } catch {
      if (this.isCurrent(viewerId, pc)) this.closePeer(viewerId);
      return;
    }
    const sdp = pc.localDescription?.sdp;
    if (sdp && this.isCurrent(viewerId, pc)) this.callbacks.offer(viewerId, { type: 'offer', sdp });
  }
}
