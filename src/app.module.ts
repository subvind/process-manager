import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessController } from './controllers/process.controller';
import { ProcessManagerService } from './services/process-manager.service';
import { Process } from './entities/process.entity';
import { ScalingRule } from './entities/scaling-rule.entity';
import { CustomLogger } from './logger/custom-logger';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'sqlite',
        database: configService.get('DB_NAME', 'process_manager.sqlite'),
        entities: [Process, ScalingRule],
        synchronize: true, // Be cautious with this in production
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Process, ScalingRule]),
  ],
  controllers: [ProcessController],
  providers: [
    ProcessManagerService,
    CustomLogger
  ]
})
export class AppModule {}