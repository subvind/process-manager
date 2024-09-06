import { ChildProcess, spawn } from 'child_process';

export interface Process {
  id?: string;
  name: string;
  command: string;
  status: 'running' | 'stopped' | 'crashed';
  pid?: number;
  process?: ChildProcess;
  restartAttempts: number;
  lastRestart?: Date;
  cpu: number;
  memory: number;
}
