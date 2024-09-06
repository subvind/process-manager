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
          await this.startProcess({ name: process.name, command: process.command });
        } catch (error) {
          this.logger.error(`Failed to restart persisted process ${process.name}: ${error.message}`);
          process.status = 'crashed';
          await this.processRepository.save(process);
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
        if (error.message.includes('No matching pid found')) {
          process.status = 'crashed';
          process.pid = undefined;
          await this.processRepository.save(process);
        }
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
    const existingProcess = await this.processRepository.findOne({ where: { name: data.name } });
    if (existingProcess) {
      this.logger.warn(`Process ${data.name} already exists. Stopping existing process before starting a new one.`);
      await this.stopProcess(existingProcess.id);
    }

    const newProcess = this.processRepository.create(data);
    try {
      const [command, ...args] = data.command.split(' ');
      const childProcess = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });
      newProcess.process = childProcess;
      newProcess.pid = childProcess.pid;
      newProcess.status = 'running';
      this.setupProcessEventListeners(newProcess);
      return this.processRepository.save(newProcess);
    } catch (error) {
      this.logger.error(`Failed to start process ${data.name}: ${error.message}`);
      newProcess.status = 'crashed';
      return this.processRepository.save(newProcess);
    }
  }
  public async stopProcess(id: string): Promise<Process> {
    const process = await this.processRepository.findOne({ where: { id } });
    if (!process) {
      throw new NotFoundException(`Process with id ${id} not found`);
    }
    
    this.logger.log(`Attempting to stop process ${process.name} (${process.id})`);
    
    if (process.status === 'running') {
      this.logger.log(`Killing process ${process.name} (PID: ${process.pid})`);
      
      // Send SIGTERM first
      process.process.kill('SIGTERM');
      
      // Wait for the process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.logger.warn(`Process ${process.name} did not exit within 5 seconds, forcing kill with SIGKILL`);
          process.process?.kill('SIGKILL');
          resolve();
        }, 5000);

        process.process?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Double-check if the process is still running
      try {
        process.process.kill(0);
        this.logger.warn(`Process ${process.name} (PID: ${process.pid}) is still running after kill attempt`);
        // Force kill if still running
        process.process.kill('SIGKILL');
      } catch (e) {
        this.logger.log(`Process ${process.name} (PID: ${process.pid}) has been successfully terminated`);
      }
    }
    
    process.status = 'stopped';
    process.pid = undefined;
    process.process = undefined;
    
    // Remove any event listeners to allow garbage collection
    if (process.process) {
      process.process.removeAllListeners();
    }
    
    this.logger.log(`Process ${process.name} (${process.id}) stopped successfully`);
    
    return this.processRepository.save(process);
  }

  async getProcessInfo(id: string) {
    const process = await this.processRepository.findOne({ where: { id } });
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

  async restartProcess(id: string): Promise<Process> {
    const process = await this.processRepository.findOne({ where: { id } });
    if (!process) {
      throw new NotFoundException(`Process with id ${id} not found`);
    }

    this.logger.log(`Attempting to restart process ${process.name} (${process.id})`);

    // Stop the existing process
    await this.stopProcess(id);
    
    // Wait for the process to fully stop
    await new Promise(resolve => setTimeout(resolve, 2000));

    const maxRetries = 3;
    let retryCount = 0;
    let success = false;

    while (retryCount < maxRetries && !success) {
      try {
        const [command, ...args] = process.command.split(' ');
        const childProcess = spawn(command, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
        });

        process.process = childProcess;
        process.pid = childProcess.pid;
        process.status = 'running';
        process.restartAttempts++;
        process.lastRestart = new Date();

        this.setupProcessEventListeners(process);
        await this.processRepository.save(process);

        this.logger.log(`Process ${process.name} (${process.id}) restarted successfully on attempt ${retryCount + 1}.`);
        success = true;
      } catch (error) {
        this.logger.error(`Failed to restart process ${process.name} (${process.id}) on attempt ${retryCount + 1}: ${error.message}`);
        retryCount++;
        if (retryCount < maxRetries) {
          this.logger.log(`Retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    if (!success) {
      process.status = 'crashed';
      await this.processRepository.save(process);
      throw new Error(`Failed to restart process ${process.name} (${process.id}) after ${maxRetries} attempts`);
    }

    return process;
  }

  private setupProcessEventListeners(process: ProcessInterface) {
    process.process?.on('exit', async (code) => {
      this.logger.log(`Process ${process.name} (${process.id}) exited with code ${code}`);
      if (code !== 0 && process.status !== 'stopped') {
        this.logger.error(`Process ${process.name} (${process.id}) crashed with code ${code}`);
        process.status = 'crashed';
      } else {
        process.status = 'stopped';
      }
      process.pid = undefined;
      process.process = undefined;
      await this.processRepository.save(process);

      if (process.status === 'crashed') {
        if (process.restartAttempts < 3) {
          this.logger.log(`Attempting to restart crashed process ${process.name} (${process.id})`);
          try {
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.restartProcess(process.id);
          } catch (error) {
            this.logger.error(`Failed to restart crashed process ${process.name} (${process.id}): ${error.message}`);
          }
        } else {
          this.logger.warn(`Process ${process.name} (${process.id}) has crashed ${process.restartAttempts} times. Stopping automatic restarts.`);
        }
      }
    });

    process.process?.stdout?.on('data', (data) => {
      this.logger.log(`[${process.name}] ${data.toString().trim()}`);
    });

    process.process?.stderr?.on('data', (data) => {
      this.logger.error(`[${process.name}] ${data.toString().trim()}`);
    });
  }
}