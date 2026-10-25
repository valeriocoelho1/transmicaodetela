import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { ConnectionLimiter } from './connection-limiter';
import { IceService } from './ice.service';
import { SignalingGateway } from './signaling.gateway';

@Module({
  imports: [RoomsModule],
  providers: [ConnectionLimiter, IceService, SignalingGateway],
})
export class SignalingModule {}
