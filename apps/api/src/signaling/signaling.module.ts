import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { IceService } from './ice.service';
import { SignalingGateway } from './signaling.gateway';

@Module({
  imports: [RoomsModule],
  providers: [IceService, SignalingGateway],
})
export class SignalingModule {}
