import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { AppConfig } from './config/app-config';
import { SignalingIoAdapter } from './signaling/signaling-io.adapter';

export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.use(helmet());
  app.set('trust proxy', config.trustProxy);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.allowedOrigins });
  app.useWebSocketAdapter(new SignalingIoAdapter(app, config));
}
