import { createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { IceServer } from '@app/shared';
import { APP_CONFIG, type AppConfig, CLOCK, type Clock } from '../config/app-config';

type IceConfig = Pick<
  AppConfig,
  'stunUrls' | 'turnUrls' | 'turnSecret' | 'turnCredentialTtlSeconds'
>;

export function turnCredential(secret: string, username: string): string {
  return createHmac('sha1', secret).update(username).digest('base64');
}

export function buildIceServers(config: IceConfig, now: number): IceServer[] {
  const servers: IceServer[] = [{ urls: config.stunUrls }];
  if (config.turnUrls.length > 0 && config.turnSecret) {
    const expiresAt = Math.floor(now / 1000) + config.turnCredentialTtlSeconds;
    const username = `${expiresAt}:${randomBytes(6).toString('base64url')}`;
    servers.push({
      urls: config.turnUrls,
      username,
      credential: turnCredential(config.turnSecret, username),
    });
  }
  return servers;
}

@Injectable()
export class IceService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  iceServers(): IceServer[] {
    return buildIceServers(this.config, this.now());
  }
}
