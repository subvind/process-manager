
export interface ScalingRule {
  id?: string;  // Optional for creation
  processName: string;
  minInstances: number;
  maxInstances: number;
  cpuThreshold: number;
  memoryThreshold: number;
  createdAt?: Date;  // Optional for creation
  updatedAt?: Date;  // Optional for creation
}