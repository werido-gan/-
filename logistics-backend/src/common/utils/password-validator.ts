import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 验证密码复杂度
 * @param password 要验证的密码
 * @throws HttpException 如果密码不符合复杂度要求
 */
export const validatePassword = (password: string): void => {
  // 密码长度至少8位
  if (password.length < 8) {
    throw new HttpException('密码长度不能少于8位', HttpStatus.BAD_REQUEST);
  }

  // 密码必须包含至少一个大写字母
  if (!/[A-Z]/.test(password)) {
    throw new HttpException(
      '密码必须包含至少一个大写字母',
      HttpStatus.BAD_REQUEST,
    );
  }

  // 密码必须包含至少一个小写字母
  if (!/[a-z]/.test(password)) {
    throw new HttpException(
      '密码必须包含至少一个小写字母',
      HttpStatus.BAD_REQUEST,
    );
  }

  // 密码必须包含至少一个数字
  if (!/\d/.test(password)) {
    throw new HttpException('密码必须包含至少一个数字', HttpStatus.BAD_REQUEST);
  }

  // 密码必须包含至少一个特殊字符
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    throw new HttpException(
      '密码必须包含至少一个特殊字符',
      HttpStatus.BAD_REQUEST,
    );
  }
};
