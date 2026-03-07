import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { TasksService } from '../services/tasks.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TaskExecution, TaskType, TaskStatus } from '../entities/task-execution.entity';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('refresh')
  async triggerManualRefresh(
    @Body('triggered_by') triggeredBy: string,
    @Body('ip_address') ipAddress?: string,
  ) {
    return await this.tasksService.triggerManualRefresh(triggeredBy, ipAddress);
  }

  @Get()
  async getTaskExecutions(
    @Query('task_type') taskType?: TaskType,
    @Query('status') status?: TaskStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const filters: any = {};
    if (taskType) filters.task_type = taskType;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit.toString());
    if (offset) filters.offset = parseInt(offset.toString());

    return await this.tasksService.getTaskExecutions(filters);
  }

  @Get(':id')
  async getTaskExecutionById(@Param('id') id: number) {
    return await this.tasksService.getTaskExecutionById(id);
  }

  @Get('health/scheduler')
  async getSchedulerHealth() {
    return await this.tasksService.getSchedulerHealth();
  }

  @Post('schedule/update')
  async updateSchedule(@Body('cron_expression') cronExpression: string) {
    return await this.tasksService.updateSchedule(cronExpression);
  }
}
