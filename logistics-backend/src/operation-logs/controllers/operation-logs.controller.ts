import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { OperationLogsService } from '../services/operation-logs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('operation-logs')
@UseGuards(JwtAuthGuard)
// 所有操作日志接口都需要JWT认证
export class OperationLogsController {
  constructor(private readonly operationLogsService: OperationLogsService) {}

  // 查询操作日志
  @Get()
  async getLogs(@Query() query) {
    const result = await this.operationLogsService.getLogs(query);
    return { success: true, data: result };
  }

  // 创建操作日志
  @Post()
  async createLog(@Body() logData) {
    const result = await this.operationLogsService.createLog(logData);
    return { success: true, data: result };
  }
}
