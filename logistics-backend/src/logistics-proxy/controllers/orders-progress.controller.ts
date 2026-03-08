import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LogisticsQueryService } from '../services/logistics-query.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersProgressController {
  constructor(private readonly logisticsQueryService: LogisticsQueryService) {}

  @Get('progress/:taskId')
  async getOrderProgress(@Param('taskId') taskId: string) {
    const task = await this.logisticsQueryService.getTaskProgress(taskId);
    
    if (!task) {
      return {
        success: false,
        message: '任务不存在',
      };
    }

    return {
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        progress: task.progress,
        message: task.message,
        result: task.result,
        error: task.error,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    };
  }

  @Get(':id/refresh')
  async refreshOrder(@Param('id') id: string) {
    return {
      success: true,
      message: '请使用 POST /orders/:id/query-and-sync 接口进行异步查询',
    };
  }
}
