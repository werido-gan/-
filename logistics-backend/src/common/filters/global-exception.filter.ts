import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ValidationError } from 'class-validator';

export interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus;
    let errorResponse: ErrorResponse;

    // 处理CSRF错误（ForbiddenError）
    if (
      exception.name === 'ForbiddenError' &&
      exception.message === 'invalid csrf token'
    ) {
      status = HttpStatus.FORBIDDEN;
      errorResponse = {
        success: false,
        error: {
          code: 'INVALID_CSRF_TOKEN',
          message: '无效的CSRF令牌',
          timestamp: new Date().toISOString(),
          path: request.path,
        },
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus() as HttpStatus;
      const exceptionResponse = exception.getResponse();

      // 处理验证错误
      if (status === HttpStatus.BAD_REQUEST) {
        errorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据验证失败',
            details: exceptionResponse,
            timestamp: new Date().toISOString(),
            path: request.path,
          },
        };
      } else {
        // 其他HTTP错误
        errorResponse = {
          success: false,
          error: {
            code: exceptionResponse['code'] || 'HTTP_ERROR',
            message: exceptionResponse['message'] || exception.message,
            details: exceptionResponse['details'] || exceptionResponse,
            timestamp: new Date().toISOString(),
            path: request.path,
          },
        };
      }
    } else {
      // 系统异常
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '服务器内部错误',
          timestamp: new Date().toISOString(),
          path: request.path,
        },
      };

      // 记录系统异常的完整堆栈信息
      this.logger.error('系统内部错误', {
        path: request.path,
        method: request.method,
        error: exception.message,
        stack: exception.stack,
        clientIp: request.ip,
        timestamp: new Date().toISOString(),
      });
    }

    // 记录异常日志
    if (status !== HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.warn('请求处理失败', {
        path: request.path,
        method: request.method,
        error: errorResponse.error,
        clientIp: request.ip,
        timestamp: new Date().toISOString(),
      });
    }

    // 返回统一格式的错误响应
    response.status(status).json(errorResponse);
  }
}
