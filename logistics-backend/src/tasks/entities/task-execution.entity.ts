import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskType {
  LOGISTICS_REFRESH = 'logistics_refresh',
  MANUAL_REFRESH = 'manual_refresh',
}

@Entity('task_executions')
@Index(['task_type', 'status'])
@Index(['created_at'])
export class TaskExecution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  task_name: string;

  @Column({ type: 'enum', enum: TaskType })
  task_type: TaskType;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.PENDING })
  status: TaskStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'int', default: 0 })
  total_orders: number;

  @Column({ type: 'int', default: 0 })
  success_orders: number;

  @Column({ type: 'int', default: 0 })
  failed_orders: number;

  @Column({ type: 'int', default: 0 })
  skipped_orders: number;

  @Column({ type: 'int', default: 0 })
  duration_seconds: number;

  @Column({ type: 'json', nullable: true })
  details: any;

  @Column({ length: 50, nullable: true })
  triggered_by: string;

  @Column({ length: 45, nullable: true })
  ip_address: string;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
