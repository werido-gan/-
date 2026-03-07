import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * 健康检查端点
   */
  @Get('health')
  async getHealthCheck() {
    return this.appService.getHealthCheck();
  }

  /**
   * 监控指标端点
   */
  @Get('metrics')
  async getMetrics() {
    return this.appService.getMetrics();
  }
}
