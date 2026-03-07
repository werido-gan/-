import {
  IsOptional,
  IsString,
  IsDateString,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TrackingNodeDto {
  @IsString()
  location: string;

  @IsString()
  description: string;

  @IsDateString()
  timestamp: string;
}

export class OrderDetailsDto {
  @IsOptional()
  @IsDateString()
  order_date?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsDateString()
  planned_ship_date?: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsString()
  product_info?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackingNodeDto)
  timeline?: TrackingNodeDto[];

  @IsOptional()
  @IsString()
  tracking_number?: string;

  @IsOptional()
  @IsString()
  recipient?: string;
}
