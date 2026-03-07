import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';
import { OrderStatus, WarningStatus } from '../entities/order.entity';

export class UpdateStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsEnum(WarningStatus)
  warning_status?: WarningStatus;

  @IsOptional()
  @IsString()
  warning_reason?: string;

  @IsOptional()
  @IsObject()
  details?: any;
}
