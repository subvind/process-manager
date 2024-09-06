import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessController } from './controllers/process.controller';
import { ProcessManagerService } from './services/process-manager.service';
import { Process } from './entities/process.entity';
import { ScalingRule } from './entities/scaling-rule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Process, ScalingRule]),
    ConfigModule.forRoot(),
  ],
  controllers: [ProcessController],
  providers: [ProcessManagerService]
})
export class AppModule {}
