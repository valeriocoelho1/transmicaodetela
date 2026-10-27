import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import {
  HOST_ICE_RESTART_TIMEOUT_MS,
  HOST_PEER_MAX_RECOVERIES,
  HOST_PEER_RECOVERY_DELAY_MS,
} from '../../config';
import { HostBroadcaster, type HostBroadcasterCallbacks } from './host-broadcaster';

const videoCodecs = [
  { mimeType: 'video/VP8', clockRate: 90000 },
  { mimeType: 'video/rtx', clockRate: 90000 },
  { mimeType: 'video/VP9', clockRate: 90000, sdpFmtpLine: 'profile-id=0' },
  { mimeType: 'video/H264', clockRate: 90000 },
];

class FakePeerConnection {
  static created: FakePeerConnection[] = [];
  connectionState: RTCPeerConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  localDescription: { sdp: string } | null = null;
  onicecandidate: ((event: { candidate: null }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  closed = false;
  offerOptions: (RTCOfferOptions | undefined)[] = [];
  codecPreferences: { mimeType: string }[] | null = null;
  private readonly track = { kind: 'video' };
  private readonly sender = {
    track: this.track,
    getParameters: () => ({ encodings: [{}] }),
    setParameters: () => Promise.resolve(),
  };

  constructor() {
    FakePeerConnection.created.push(this);
  }

  addTrack() {
    return this.sender;
  }
  getSenders() {
    return [this.sender];
  }
  getTransceivers() {
    return [
      {
        sender: this.sender,
        setCodecPreferences: (codecs: { mimeType: string }[]) => {
          this.codecPreferences = codecs;
        },
      },
    ];
  }
  createOffer(options?: RTCOfferOptions) {
    this.offerOptions.push(options);
    return Promise.resolve({ type: 'offer', sdp: 'v=0' });
  }
  setLocalDescription(description: { sdp: string }) {
    this.signalingState = 'have-local-offer';
    this.localDescription = description;
    return Promise.resolve();
  }
  close() {
    this.closed = true;
  }
  changeState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

const stream = { getTracks: () => [{ kind: 'video' }] } as unknown as MediaStream;
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('HostBroadcaster', () => {
  let offer: Mock<HostBroadcasterCallbacks['offer']>;
  let peerFailed: Mock<HostBroadcasterCallbacks['peerFailed']>;
  let broadcaster: HostBroadcaster;

  beforeEach(() => {
    vi.useFakeTimers();
    FakePeerConnection.created = [];
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    vi.stubGlobal('RTCRtpSender', { getCapabilities: () => ({ codecs: videoCodecs }) });
    vi.stubGlobal('RTCRtpReceiver', { getCapabilities: () => ({ codecs: videoCodecs }) });
    offer = vi.fn<HostBroadcasterCallbacks['offer']>();
    peerFailed = vi.fn<HostBroadcasterCallbacks['peerFailed']>();
    broadcaster = new HostBroadcaster({ offer, ice: vi.fn(), peerFailed });
    broadcaster.start(stream);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function addViewer(): Promise<FakePeerConnection> {
    broadcaster.addViewer('viewer-1');
    await flush();
    const pc = FakePeerConnection.created.at(-1);
    if (!pc) throw new Error('No peer created');
    return pc;
  }

  it('puts VP9 first and keeps every other codec', async () => {
    const pc = await addViewer();
    expect(pc.codecPreferences?.map((codec) => codec.mimeType)).toEqual([
      'video/VP9',
      'video/VP8',
      'video/rtx',
      'video/H264',
    ]);
  });

  it('keeps the default codec order when the browser cannot send VP9', async () => {
    vi.stubGlobal('RTCRtpSender', {
      getCapabilities: () => ({ codecs: videoCodecs.filter((c) => c.mimeType !== 'video/VP9') }),
    });
    const pc = await addViewer();
    expect(pc.codecPreferences).toBeNull();
  });

  // A failed peer first gets an ICE restart; a second failure replaces it.
  async function failTwice(pc: FakePeerConnection) {
    pc.changeState('failed');
    await flush();
    pc.changeState('failed');
    await flush();
  }

  it('tries an ICE restart on the same peer when it fails', async () => {
    const pc = await addViewer();
    expect(offer).toHaveBeenCalledTimes(1);
    pc.changeState('failed');
    await flush();
    expect(pc.closed).toBe(false);
    expect(FakePeerConnection.created).toHaveLength(1);
    expect(pc.offerOptions.at(-1)).toEqual({ iceRestart: true });
    expect(offer).toHaveBeenCalledTimes(2);
  });

  it('replaces the peer when it fails again after the ICE restart', async () => {
    const pc = await addViewer();
    await failTwice(pc);
    expect(pc.closed).toBe(true);
    expect(FakePeerConnection.created).toHaveLength(2);
    expect(offer).toHaveBeenCalledTimes(3);
    expect(peerFailed).not.toHaveBeenCalled();
  });

  it('replaces the peer when the ICE restart does not connect in time', async () => {
    const pc = await addViewer();
    pc.changeState('failed');
    await vi.advanceTimersByTimeAsync(HOST_ICE_RESTART_TIMEOUT_MS);
    expect(pc.closed).toBe(true);
    expect(FakePeerConnection.created).toHaveLength(2);
  });

  it('keeps the peer when the ICE restart works', async () => {
    const pc = await addViewer();
    pc.changeState('failed');
    await flush();
    pc.changeState('connected');
    await vi.advanceTimersByTimeAsync(HOST_ICE_RESTART_TIMEOUT_MS);
    expect(FakePeerConnection.created).toHaveLength(1);
    pc.changeState('failed');
    await flush();
    expect(pc.offerOptions.at(-1)).toEqual({ iceRestart: true });
    expect(pc.closed).toBe(false);
  });

  it('waits before restarting a disconnected peer and does nothing if it comes back', async () => {
    const pc = await addViewer();
    pc.changeState('disconnected');
    await vi.advanceTimersByTimeAsync(HOST_PEER_RECOVERY_DELAY_MS - 1);
    pc.changeState('connected');
    await vi.advanceTimersByTimeAsync(HOST_PEER_RECOVERY_DELAY_MS);
    expect(offer).toHaveBeenCalledTimes(1);
    expect(FakePeerConnection.created).toHaveLength(1);
  });

  it('restarts ICE on a peer that stays disconnected', async () => {
    const pc = await addViewer();
    pc.changeState('disconnected');
    await vi.advanceTimersByTimeAsync(HOST_PEER_RECOVERY_DELAY_MS);
    expect(pc.closed).toBe(false);
    expect(pc.offerOptions.at(-1)).toEqual({ iceRestart: true });
  });

  it('gives up after the maximum number of replacements in a row', async () => {
    await addViewer();
    for (let i = 0; i <= HOST_PEER_MAX_RECOVERIES; i++) {
      await failTwice(FakePeerConnection.created.at(-1)!);
    }
    expect(FakePeerConnection.created).toHaveLength(HOST_PEER_MAX_RECOVERIES + 1);
    expect(peerFailed).toHaveBeenCalledWith('viewer-1');
  });

  it('resets the replacement count once the peer connects', async () => {
    await addViewer();
    for (let i = 0; i < HOST_PEER_MAX_RECOVERIES; i++) {
      await failTwice(FakePeerConnection.created.at(-1)!);
    }
    FakePeerConnection.created.at(-1)?.changeState('connected');
    await failTwice(FakePeerConnection.created.at(-1)!);
    expect(peerFailed).not.toHaveBeenCalled();
  });

  it('resume keeps connected peers and offers again to the others', async () => {
    broadcaster.addViewer('viewer-1');
    broadcaster.addViewer('viewer-2');
    await flush();
    const [first, second] = FakePeerConnection.created;
    first?.changeState('connected');
    broadcaster.resume();
    await flush();
    expect(first?.closed).toBe(false);
    expect(second?.closed).toBe(true);
    expect(FakePeerConnection.created).toHaveLength(3);
  });

  it('does not recover a viewer that already left', async () => {
    const pc = await addViewer();
    pc.changeState('disconnected');
    broadcaster.removeViewer('viewer-1');
    await vi.advanceTimersByTimeAsync(HOST_PEER_RECOVERY_DELAY_MS);
    expect(FakePeerConnection.created).toHaveLength(1);
  });
});
