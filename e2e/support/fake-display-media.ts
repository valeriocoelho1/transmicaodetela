import type { BrowserContext } from '@playwright/test';

export async function installFakeDisplayMedia(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new DOMException('Canvas unavailable', 'NotReadableError');
      let frame = 0;
      const draw = () => {
        frame += 1;
        ctx.fillStyle = `hsl(${frame % 360} 70% 45%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '64px sans-serif';
        ctx.fillText(`frame ${frame}`, 48, 120);
      };
      draw();
      setInterval(draw, 1000 / 30);
      return canvas.captureStream(30);
    };
  });
}
