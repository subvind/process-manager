import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class ScalingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  processName: string;

  @Column()
  minInstances: number;

  @Column()
  maxInstances: number;

  @Column({ type: 'float' })
  cpuThreshold: number;

  @Column({ type: 'float' })
  memoryThreshold: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}