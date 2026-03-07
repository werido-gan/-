import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, WarningStatus } from '../entities/order.entity';
import { OrderDetailsDto } from './order-details.dto';

export class UpdateOrderDto {
  @IsString()
  @IsOptional()
  customer_name?: string;

  @IsString()
  @IsOptional()
  carrier_code?: string;

  @IsString()
  @IsOptional()
  carrier?: string;

  @IsString()
  @IsOptional()
  department_key?: string;

  @IsOptional()
  @IsString()
  order_number?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(WarningStatus)
  warning_status?: WarningStatus;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OrderDetailsDto)
  details?: OrderDetailsDto;

  @IsOptional()
  @IsNumber()
  user_id?: number;

  @IsOptional()
  @IsString()
  receiverPhone?: string;
}
