import { Module, Controller, Get, Post, Body, Param, NotFoundException, InternalServerErrorException, Injectable, OnModuleInit, HttpCode } from '@nestjs/common';
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
  @HttpCode(200) // This decorator sets the status code to 200
  stopProcess(@Param('id') id: string) {
    return this.processManagerService.stopProcess(id);
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
}