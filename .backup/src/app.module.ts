import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessController } from './controllers/process.controller';
import { ProcessManagerService } from './services/process-manager.service';
import { Process } from './entities/process.entity';
import { ScalingRule } from './entities/scaling-rule.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +configService.get<number>('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [Process, ScalingRule],
        synchronize: true, // Be cautious with this in production
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Process, ScalingRule]),
  ],
  controllers: [ProcessController],
  providers: [ProcessManagerService]
})
export class AppModule {}