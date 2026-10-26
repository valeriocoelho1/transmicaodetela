import type { IncomingMessage } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

// Same rule as Express "trust proxy" with a hop count: skip that many addresses from the end.
export function clientIp(req: IncomingMessage, trustProxy: number): string {
  const forwarded = req.headers['x-forwarded-for'];
  const chain =
    typeof forwarded === 'string'
      ? forwarded
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
      : [];
  const addresses = [...chain, req.socket.remoteAddress ?? ''];
  return addresses[Math.max(0, addresses.length - 1 - trustProxy)] ?? '';
}

@Injectable()
export class ConnectionLimiter {
  private readonly perIp = new Map<string, number>();
  private readonly ipBySocket = new Map<string, string>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  ipOf(req: IncomingMessage): string {
    return clientIp(req, this.config.trustProxy);
  }

  hasRoom(ip: string): boolean {
    return (this.perIp.get(ip) ?? 0) < this.config.maxSocketsPerIp;
  }

  acquire(socketId: string, ip: string): boolean {
    if (!this.hasRoom(ip)) return false;
    this.perIp.set(ip, (this.perIp.get(ip) ?? 0) + 1);
    this.ipBySocket.set(socketId, ip);
    return true;
  }

  release(socketId: string): void {
    const ip = this.ipBySocket.get(socketId);
    if (ip === undefined) return;
    this.ipBySocket.delete(socketId);
    const count = (this.perIp.get(ip) ?? 1) - 1;
    if (count <= 0) this.perIp.delete(ip);
    else this.perIp.set(ip, count);
  }
}
