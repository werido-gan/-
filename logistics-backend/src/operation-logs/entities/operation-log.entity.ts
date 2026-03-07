import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export enum OperationType {
  IMPORT = 'import',
  EXPORT = 'export',
  DELETE = 'delete',
  ARCHIVE = 'archive',
  RESTORE = 'restore',
  UPDATE = 'update',
  CREATE = 'create',
  LOGIN = 'login',
  LOGOUT = 'logout',
}

export enum TargetType {
  ORDER = 'order',
  USER = 'user',
  DEPARTMENT = 'department',
  SYSTEM = 'system',
  LOGISTICS = 'logistics',
}

@Entity('operation_logs')
export class OperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  user_id: number;

  @Column({ length: 50, nullable: true })
  username: string;

  @Column({ length: 20 })
  operation_type: string;

  @Column({ length: 20, nullable: true })
  target_type: string;

  @Column({ length: 50, nullable: true })
  target_id: string;

  @Column({ type: 'json', nullable: true })
  details: any;

  @Column({ length: 45, nullable: true })
  ip_address: string;

  @CreateDateColumn()
  created_at: Date;
}
