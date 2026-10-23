import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, CLOCK, type Clock, loadConfig } from './app-config';

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig(process.env) },
    { provide: CLOCK, useValue: (() => Date.now()) satisfies Clock },
  ],
  exports: [APP_CONFIG, CLOCK],
})
export class ConfigModule {}
