import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum OrderStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  RETURNED = 'returned',
  EXCEPTION = 'exception',
}

export enum WarningStatus {
  NONE = 'none',
  DELAY_SHIPMENT = 'delay_shipment',
  TRANSIT_ABNORMAL = 'transit_abnormal',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  @Index() // 订单号索引，但不唯一
  order_number: string;

  // ★★★ 新增：添加 carrier_code 字段定义 ★★★
  @Column({ name: 'carrier_code', length: 50, comment: '快递公司编码' })
  @Index()
  carrier_code: string;

  @Column({ length: 100 })
  @Index() // 客户名称索引
  customer_name: string;

  @Column({ length: 50 })
  @Index() // 部门键索引
  department_key: string;

  @Column({ length: 50 })
  @Index() // 承运商名称索引
  carrier: string;

  @Column({ comment: '收货人电话，用于物流查询鉴权', nullable: true })
  receiverPhone: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  @Index() // 状态索引
  status: OrderStatus;

  @Column({ type: 'enum', enum: WarningStatus, default: WarningStatus.NONE })
  @Index() // 警告状态索引
  warning_status: WarningStatus;

  @Column({ default: false })
  @Index() // 归档状态索引
  is_archived: boolean;

  @Column({ type: 'json', nullable: true })
  details: any;

  @Column({ default: 1 }) // 默认用户ID为1
  user_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
