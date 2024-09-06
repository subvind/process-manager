import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

import { CustomLogger } from './logger/custom-logger';

export async function bootstrap(): Promise<any> {
  const logger = new CustomLogger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });
  
  await app.listen(9393);
}
bootstrap();
