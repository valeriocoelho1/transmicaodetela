import { CAPTURE_FRAME_RATE, CAPTURE_MAX_HEIGHT, CAPTURE_MAX_WIDTH } from '../config';

export const UNSUPPORTED_BROWSER_MESSAGE =
  'Este navegador não permite compartilhar a tela. Use um navegador de computador atualizado.';
export const NO_AUDIO_SHARED_MESSAGE =
  'O som não foi compartilhado. No Chrome ou no Edge, escolha uma guia do navegador e ative a opção de compartilhar o áudio da guia. Em janela ou tela inteira, o som só aparece em alguns sistemas, e Safari e Firefox não compartilham som.';

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

const video: MediaTrackConstraints = {
  frameRate: { ideal: CAPTURE_FRAME_RATE, max: CAPTURE_FRAME_RATE },
  width: { max: CAPTURE_MAX_WIDTH },
  height: { max: CAPTURE_MAX_HEIGHT },
};

// Errors thrown while the browser validates the options, before it shows its picker.
const OPTION_ERRORS = ['TypeError', 'NotSupportedError', 'OverconstrainedError'];

export async function startDisplayCapture(
  getDisplayMedia = (options: DisplayMediaStreamOptions) =>
    navigator.mediaDevices.getDisplayMedia(options),
): Promise<MediaStream> {
  const options: DisplayMediaStreamOptions & DisplayCaptureHints = {
    video,
    audio: true,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    systemAudio: 'include',
  };
  let stream: MediaStream;
  try {
    stream = await getDisplayMedia(options);
  } catch (error) {
    // Some browsers reject the audio request or the capture hints outright instead of ignoring
    // them. Ask again with video only so the host can still share the screen.
    const name = error instanceof Error || error instanceof DOMException ? error.name : '';
    if (!OPTION_ERRORS.includes(name)) throw error;
    stream = await getDisplayMedia({ video, audio: false });
  }
  const [videoTrack] = stream.getVideoTracks();
  if (videoTrack) videoTrack.contentHint = 'detail';
  return stream;
}
