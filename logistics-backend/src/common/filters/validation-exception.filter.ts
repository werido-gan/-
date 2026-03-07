import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { Request, Response } from 'express';
import { Logger } from '@nestjs/common';

@Catch(HttpException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ValidationExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // 检查是否是验证错误
    if (status === HttpStatus.BAD_REQUEST) {
      const errorResponse = exception.getResponse();

      // 记录验证错误日志
      this.logger.warn('数据验证失败', {
        path: request.path,
        method: request.method,
        error: errorResponse,
        clientIp: request.ip,
        timestamp: new Date().toISOString(),
      });

      // 统一错误响应格式
      response.status(status).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求数据验证失败',
          details: errorResponse,
          timestamp: new Date().toISOString(),
          path: request.path,
        },
      });
    } else {
      // 其他HTTP错误保持默认处理
      response.status(status).json(exception.getResponse());
    }
  }
}
