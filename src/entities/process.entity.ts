import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ChildProcess } from 'child_process';
import { Process as ProcessInterface } from '../interfaces/process.interface';

@Entity()
export class Process implements ProcessInterface {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  command: string;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'stopped'
  })
  status: 'running' | 'stopped' | 'crashed';

  @Column({ nullable: true })
  pid?: number;

  @Column({ default: 0 })
  restartAttempts: number;

  @Column({ type: 'datetime', nullable: true })
  lastRestart?: Date;

  @Column({ type: 'float', default: 0 })
  cpu: number;

  @Column({ type: 'float', default: 0 })
  memory: number;

  @Column({ type: 'float', default: 1024 })
  maxMemory: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  private _process?: ChildProcess;

  get process(): ChildProcess | undefined {
    return this._process;
  }

  set process(proc: ChildProcess | undefined) {
    this._process = proc;
    if (proc) {
      this.pid = proc.pid;
      this.status = 'running';
    } else {
      this.pid = undefined;
      this.status = 'stopped';
    }
  }

  kill(signal: NodeJS.Signals): void {
    if (this.pid) {
      console.log('kill', this.pid, signal)
      process.kill(this.pid, signal);
    }
  }

  on(event: string, listener: (...args: any[]) => void): void {
    if (this._process) {
      this._process.on(event, listener);
    }
  }

  // Method to start the process
  startProcess(spawn: Function): void {
    if (this.status !== 'running') {
      const childProcess = spawn(this.command.split(' ')[0], this.command.split(' ').slice(1), {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });
      this.process = childProcess;
    }
  }

  // Method to stop the process
  stopProcess(): void {
    if (this.status === 'running') {
      this.kill('SIGTERM');
      // this._process = undefined;
      this.status = 'stopped';
      // this.pid = undefined;
    }
  }
}
