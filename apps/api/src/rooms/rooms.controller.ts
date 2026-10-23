import {
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  type CreateRoomResponse,
  createRoomResponse,
  type RoomSummaryResponse,
  roomSummaryResponse,
} from '@app/shared';
import { RoomLimitReachedError, RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  private readonly logger = new Logger(RoomsController.name);

  constructor(private readonly rooms: RoomsService) {}

  @Post()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  create(): CreateRoomResponse {
    try {
      const created = this.rooms.create();
      this.logger.log(`Room ${created.roomId.slice(0, 4)}… created (${this.rooms.count} active)`);
      return createRoomResponse.parse(created);
    } catch (error) {
      if (error instanceof RoomLimitReachedError) {
        this.logger.warn('Room limit reached');
        throw new ServiceUnavailableException({ error: 'SERVER_BUSY' });
      }
      throw error;
    }
  }

  @Get(':roomId')
  get(@Param('roomId') roomId: string): RoomSummaryResponse {
    const summary = this.rooms.summary(roomId);
    if (!summary) throw new NotFoundException({ error: 'ROOM_NOT_FOUND' });
    return roomSummaryResponse.parse({ roomId, ...summary });
  }
}
