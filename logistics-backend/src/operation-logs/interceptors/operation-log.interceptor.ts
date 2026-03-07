import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { OperationLogsService } from '../services/operation-logs.service';
import { OperationType, TargetType } from '../entities/operation-log.entity';

@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(
    private operationLogsService: OperationLogsService,
    @Inject('LoggerService') private readonly logger: any,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // 提取请求信息
    const { method, url, body, user, ip } = request;

    // 计算操作类型和目标
    const { operationType, targetType, targetId } = this.getOperationDetails(
      method,
      url,
      body,
    );

    return next.handle().pipe(
      tap(() => {
        // 只有成功的请求才记录日志
        if (response.statusCode >= 200 && response.statusCode < 300) {
          const logData = {
            user_id: user?.id,
            username: user?.username,
            operation_type: operationType,
            target_type: targetType,
            target_id: targetId,
            details: {
              url,
              method,
              body: this.sanitizeBody(body, operationType),
              statusCode: response.statusCode,
            },
            ip_address: ip,
          };

          // 异步保存日志，不影响响应
          this.operationLogsService.createLog(logData).catch((error) => {
            this.logger.error(`Failed to save operation log: ${error.message}`);
          });
        }
      }),
    );
  }

  private getOperationDetails(
    method: string,
    url: string,
    body: any,
  ): {
    operationType: string;
    targetType: string;
    targetId: string | undefined;
  } {
    // 解析URL路径
    const pathSegments = url.split('/').filter((segment) => segment);
    const apiIndex = pathSegments.findIndex((segment) => segment === 'api');

    if (apiIndex === -1) {
      return {
        operationType: OperationType.UPDATE,
        targetType: TargetType.SYSTEM,
        targetId: undefined,
      };
    }

    // 获取资源类型
    const resource = pathSegments[apiIndex + 1];
    const nextSegment = pathSegments[apiIndex + 2];

    // 确定操作类型
    let operationType: string;
    switch (method) {
      case 'POST':
        operationType = OperationType.CREATE;
        break;
      case 'PUT':
      case 'PATCH':
        operationType = OperationType.UPDATE;
        break;
      case 'DELETE':
        operationType = OperationType.DELETE;
        break;
      case 'GET':
      default:
        // 对于GET请求，如果有资源ID则记录为UPDATE，否则不记录（或记录为QUERY）
        return { operationType: '', targetType: '', targetId: undefined };
    }

    // 确定目标类型和ID
    let targetType: string;
    let targetId: string | undefined;

    // 特殊处理物流代理相关接口
    if (resource === 'logistics-proxy') {
      targetType = TargetType.LOGISTICS;
      // 如果是query-and-sync接口，从body中获取order_id
      if (nextSegment === 'query-and-sync' && body?.order_id) {
        targetId = body.order_id.toString();
      } else if (nextSegment === 'refresh-tracking' && body?.order_ids) {
        // 对于批量操作，可以记录多个ID或第一个ID
        targetId = Array.isArray(body.order_ids)
          ? body.order_ids[0].toString()
          : body.order_ids?.toString();
      }
    }
    // 标准资源接口处理
    else {
      switch (resource) {
        case 'orders':
          targetType = TargetType.ORDER;
          targetId = nextSegment; // 假设下一个段是订单ID
          break;
        case 'users':
          targetType = TargetType.USER;
          targetId = nextSegment; // 假设下一个段是用户ID
          break;
        case 'departments':
          targetType = TargetType.DEPARTMENT;
          targetId = nextSegment; // 假设下一个段是部门ID
          break;
        default:
          targetType = TargetType.SYSTEM;
          targetId = nextSegment;
      }
    }

    return { operationType, targetType, targetId };
  }

  private sanitizeBody(body: any, operationType: string): any {
    // 对于某些操作类型，需要过滤敏感信息
    if (!body) return body;

    const sanitizedBody = { ...body };

    // 移除密码等敏感信息
    if (sanitizedBody.password) {
      delete sanitizedBody.password;
    }

    // 对于导入操作，只记录导入数量
    if (operationType === OperationType.IMPORT && sanitizedBody.orders) {
      sanitizedBody.orders = `[${sanitizedBody.orders.length} orders]`;
    }

    return sanitizedBody;
  }
}
