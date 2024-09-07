import { Module, Controller, Get, Post, Delete, Body, Param, NotFoundException, InternalServerErrorException, Injectable, OnModuleInit, HttpCode } from '@nestjs/common';
import { ProcessManagerService } from '../services/process-manager.service';
import { ScalingRule } from '../interfaces/scaling-rule.interface';

@Controller('processes')
export class ProcessController {
  constructor(private processManagerService: ProcessManagerService) {}

  @Get()
  listProcesses() {
    return this.processManagerService.getProcesses();
  }

  @Post()
  startProcess(@Body() data: { name: string; command: string }) {
    return this.processManagerService.startProcess(data);
  }

  @Post(':id/stop')
  @HttpCode(200)
  async stopProcess(@Param('id') id: string) {
    const stoppedProcess = await this.processManagerService.stopProcess(id);
    if (stoppedProcess.status !== 'stopped') {
      throw new InternalServerErrorException('Failed to stop the process');
    }
    return stoppedProcess;
  }

  @Get(':id')
  getProcessInfo(@Param('id') id: string) {
    return this.processManagerService.getProcessInfo(id);
  }

  @Post('scaling-rule')
  addScalingRule(@Body() rule: ScalingRule) {
    return this.processManagerService.addScalingRule(rule);
  }

  @Get('scaling-rules')
  getScalingRules() {
    return this.processManagerService.getScalingRules();
  }

  @Post(':id/restart')
  @HttpCode(200)
  async restartProcess(@Param('id') id: string) {
    const restartedProcess = await this.processManagerService.restartProcess(id);
    if (restartedProcess.status !== 'running') {
      throw new InternalServerErrorException('Failed to restart the process');
    }
    return restartedProcess;
  }

  @Delete(':id')
  @HttpCode(200)
  async deleteProcess(@Param('id') id: string) {
    const deletedProcess = await this.processManagerService.deleteProcess(id);
    if (!deletedProcess) {
      throw new NotFoundException(`Process with id ${id} not found`);
    }
    return { message: `Process ${deletedProcess.name} (${id}) has been deleted` };
  }
}