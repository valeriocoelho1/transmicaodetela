import { Controller, Get } from '@nestjs/common';
import { healthResponse, type HealthResponse } from '@app/shared';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return healthResponse.parse({ status: 'ok' });
  }
}
