import { NotFoundException, Injectable, OnModuleInit } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import * as pidusage from 'pidusage';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process } from '../entities/process.entity';
import { ScalingRule } from '../entities/scaling-rule.entity';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Process as ProcessInterface } from '../interfaces/process.interface';
import { ScalingRule as ScalingRuleInterface } from '../interfaces/scaling-rule.interface';

@Injectable()
export class ProcessManagerService implements OnModuleInit {
  private readonly logger = new Logger(ProcessManagerService.name);

  constructor(
    @InjectRepository(Process)
    private processRepository: Repository<Process>,
    @InjectRepository(ScalingRule)
    private scalingRuleRepository: Repository<ScalingRule>,
    private configService: ConfigService
  ) {}

  async onModuleInit() {
    const interval = this.configService.get<number>('MONITORING_INTERVAL', 10000);
    setInterval(() => this.monitorAndScale(), interval);
    await this.loadPersistedProcesses();
  }

  private async loadPersistedProcesses() {
    const processes = await this.processRepository.find();
    for (const process of processes) {
      if (process.status === 'running') {
        try {
          const childProcess = spawn(process.command.split(' ')[0], process.command.split(' ').slice(1), {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
          });
          process.process = childProcess;
          process.pid = childProcess.pid;
          this.setupProcessEventListeners(process);
        } catch (error) {
          this.logger.error(`Failed to restart persisted process ${process.name}: ${error.message}`);
          process.status = 'crashed';
        }
      }
    }
  }

  private async monitorAndScale() {
    const processes = await this.processRepository.find({ where: { status: 'running' } });
    for (const process of processes) {
      await this.updateProcessMetrics(process);
    }

    await this.applyScalingRules();
    await this.balanceLoad();
  }

  private async updateProcessMetrics(process: ProcessInterface) {
    if (process.pid) {
      try {
        const usage = await pidusage(process.pid);
        process.cpu = usage.cpu;
        process.memory = usage.memory / 1024 / 1024; // Convert to MB
        await this.processRepository.save(process);
      } catch (error) {
        this.logger.error(`Failed to update metrics for process ${process.name}: ${error.message}`);
      }
    }
  }

  private async applyScalingRules() {
    const rules = await this.scalingRuleRepository.find();
    for (const rule of rules) {
      const processes = await this.processRepository.find({ where: { name: rule.processName, status: 'running' } });
      const avgCpu = processes.reduce((sum, p) => sum + p.cpu, 0) / processes.length;
      const avgMemory = processes.reduce((sum, p) => sum + p.memory, 0) / processes.length;

      if (avgCpu > rule.cpuThreshold || avgMemory > rule.memoryThreshold) {
        if (processes.length < rule.maxInstances) {
          await this.startProcess({ name: rule.processName, command: processes[0].command });
          this.logger.log(`Scaled up process ${rule.processName} due to high resource usage`);
        }
      } else if (processes.length > rule.minInstances) {
        await this.stopProcess(processes[processes.length - 1].id);
        this.logger.log(`Scaled down process ${rule.processName} due to low resource usage`);
      }
    }
  }

  private async balanceLoad() {
    const processes = await this.processRepository.find({ where: { status: 'running' } });
    processes.sort((a, b) => (a.cpu / 100 + a.memory / a.maxMemory) - (b.cpu / 100 + b.memory / b.maxMemory));
    // The sorted list can now be used by a load balancer to distribute incoming requests
  }

  async getProcesses() {
    return this.processRepository.find();
  }

  async startProcess(data: { name: string; command: string }): Promise<Process> {
    const newProcess = this.processRepository.create(data);
    newProcess.startProcess(spawn);
    return this.processRepository.save(newProcess);
  }

  async stopProcess(id: string): Promise<Process> {
    const process = await this.processRepository.findOne({
      where: {
        id
      }
    });
    if (process) {
      process.stopProcess();
      process.status = 'stopped';
      process.pid = undefined;
      await this.processRepository.save(process);
      return process;
    }
    throw new NotFoundException(`Process with id ${id} not found`);
  }

  async getProcessInfo(id: string) {
    const process = await this.processRepository.findOne({ 
      where: { 
        id
      } 
    });
    if (!process) {
      throw new NotFoundException(`Process with id ${id} not found`);
    }
    return process;
  }

  async addScalingRule(rule: ScalingRuleInterface) {
    const newRule = this.scalingRuleRepository.create(rule);
    return this.scalingRuleRepository.save(newRule);
  }

  async getScalingRules() {
    return this.scalingRuleRepository.find();
  }

  private setupProcessEventListeners(process: ProcessInterface) {
    process.process?.on('exit', async (code) => {
      this.logger.log(`Process ${process.name} (${process.id}) exited with code ${code}`);
      process.status = 'stopped';
      process.pid = undefined;
      await this.processRepository.save(process);

      if (process.status !== 'stopped') {
        await this.restartProcess(process);
      }
    });
  }

  private async restartProcess(process: ProcessInterface) {
    const maxRestartAttempts = this.configService.get<number>('MAX_RESTART_ATTEMPTS', 5);
    const restartDelay = this.configService.get<number>('RESTART_DELAY', 5000);

    if (process.restartAttempts >= maxRestartAttempts) {
      this.logger.warn(`Maximum restart attempts reached for process ${process.name} (${process.id}). Marking as crashed.`);
      process.status = 'crashed';
      await this.processRepository.save(process);
      return;
    }

    setTimeout(async () => {
      try {
        const childProcess = spawn(process.command.split(' ')[0], process.command.split(' ').slice(1), {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
        });

        process.process = childProcess;
        process.pid = childProcess.pid;
        process.status = 'running';
        process.restartAttempts++;
        process.lastRestart = new Date();

        this.setupProcessEventListeners(process);
        await this.processRepository.save(process);

        this.logger.log(`Process ${process.name} (${process.id}) restarted successfully.`);
      } catch (error) {
        this.logger.error(`Failed to restart process ${process.name} (${process.id}):`, error);
        process.status = 'crashed';
        await this.processRepository.save(process);
      }
    }, restartDelay);
  }
}
