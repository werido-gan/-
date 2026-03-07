import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpException,
  Get,
  Res,
  Req,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../services/auth.service';
import { Role } from '../../users/entities/user.entity';
import { validatePassword } from '../../common/utils/password-validator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ login: { ttl: 60000, limit: 5 } }) // 每分钟最多5次尝试
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const { username, password } = body;

    if (!username || !password) {
      throw new HttpException('用户名和密码不能为空', HttpStatus.BAD_REQUEST);
    }

    const user = await this.authService.validateUser(username, password);
    if (!user) {
      throw new HttpException('用户名或密码错误', HttpStatus.UNAUTHORIZED);
    }
    return { success: true, data: await this.authService.login(user) };
  }

  @Post('register')
  async register(
    @Body()
    body: {
      username: string;
      password: string;
      email?: string;
      role?: Role;
    },
  ) {
    const { username, password, email, role } = body;

    // 检查用户名是否已存在
    const existingUser = await this.authService.findUserByUsername(username);
    if (existingUser) {
      throw new HttpException(
        'Username already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 验证密码复杂度
    validatePassword(password);

    const newUser = await this.authService.register(
      username,
      password,
      email,
      role,
    );
    return { success: true, data: newUser };
  }

  @Get('csrf-token')
  getCsrfToken(@Req() request, @Res() response) {
    // CSRF令牌由csurf中间件自动生成
    try {
      // 检查CSRF中间件是否已启用
      if (typeof request.csrfToken === 'function') {
        const csrfToken = request.csrfToken();
        // 同时在响应头和响应数据中返回令牌，确保前端能够获取
        response.setHeader('X-CSRF-Token', csrfToken);
        return response.status(HttpStatus.OK).json({
          success: true,
          message: 'CSRF token retrieved',
          csrfToken: csrfToken,
        });
      } else {
        // CSRF中间件未启用，返回空响应或适当的提示
        return response.status(HttpStatus.OK).json({
          success: true,
          message: 'CSRF protection is disabled',
          csrfToken: null,
        });
      }
    } catch (error) {
      console.error('Error generating CSRF token:', error.message);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to generate CSRF token',
      });
    }
  }
}
