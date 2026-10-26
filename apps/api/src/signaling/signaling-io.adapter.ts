import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
import type { AppConfig } from '../config/app-config';
import type { ConnectionLimiter } from './connection-limiter';

export const MAX_SOCKET_MESSAGE_BYTES = 65_536;

export class SignalingIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly config: AppConfig,
    private readonly limiter: ConnectionLimiter,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const { allowedOrigins } = this.config;
    const ioOptions: Partial<ServerOptions> = {
      ...options,
      maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
      cors: { origin: allowedOrigins },
      allowRequest: (req, callback) => {
        const origin = req.headers.origin;
        const originAllowed = origin === undefined || allowedOrigins.includes(origin);
        callback(null, originAllowed && this.limiter.hasRoom(this.limiter.ipOf(req)));
      },
    };
    return super.createIOServer(port, ioOptions as ServerOptions);
  }
}
