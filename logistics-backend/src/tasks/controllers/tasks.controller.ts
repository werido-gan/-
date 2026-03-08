import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { TasksService } from '../services/tasks.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

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
}
