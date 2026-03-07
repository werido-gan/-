import {
  IsOptional,
  IsString,
  IsEmail,
  IsEnum,
  Length,
  Matches,
} from 'class-validator';
import { Role } from '../entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: '用户名只能包含字母、数字和下划线',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @Length(6, 100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,100}$/, {
    message:
      '密码必须包含至少一个大写字母、一个小写字母和一个数字，长度至少为6个字符',
  })
  password?: string;

  @IsOptional()
  @IsEmail(
    {},
    {
      message: '请提供有效的邮箱地址',
    },
  )
  email?: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  department?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
