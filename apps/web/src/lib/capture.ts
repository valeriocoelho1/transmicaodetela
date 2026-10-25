import { CAPTURE_FRAME_RATE, CAPTURE_MAX_HEIGHT, CAPTURE_MAX_WIDTH } from '../config';

export const UNSUPPORTED_BROWSER_MESSAGE =
  'Este navegador não permite compartilhar a tela. Use um navegador de computador atualizado.';
export const NO_AUDIO_SHARED_MESSAGE =
  'O áudio não foi compartilhado. Para incluir áudio, compartilhe uma aba do navegador e marque a opção de áudio, quando o navegador oferecer.';

export function isDisplayCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  );
}

export function captureErrorMessage(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
      return 'Você cancelou ou não permitiu o compartilhamento.';
    case 'NotFoundError':
      return 'Nenhuma tela disponível para compartilhar.';
    case 'NotReadableError':
      return 'O sistema impediu a captura da tela.';
    default:
      return 'Não foi possível iniciar o compartilhamento.';
  }
}

interface DisplayCaptureHints {
  selfBrowserSurface: 'exclude';
  surfaceSwitching: 'include';
  systemAudio: 'include';
}

export async function startDisplayCapture(): Promise<MediaStream> {
  const options: DisplayMediaStreamOptions & DisplayCaptureHints = {
    video: {
      frameRate: { ideal: CAPTURE_FRAME_RATE, max: CAPTURE_FRAME_RATE },
      width: { max: CAPTURE_MAX_WIDTH },
      height: { max: CAPTURE_MAX_HEIGHT },
    },
    audio: true,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    systemAudio: 'include',
  };
  const stream = await navigator.mediaDevices.getDisplayMedia(options);
  const [videoTrack] = stream.getVideoTracks();
  if (videoTrack) videoTrack.contentHint = 'detail';
  return stream;
}
