import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  getHello(): string {
    return 'Hello World!';
  }

  /**
   * 健康检查端点
   */
  async getHealthCheck(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
    database: string;
    version: string;
  }> {
    try {
      // 检查数据库连接
      await this.dataSource.query('SELECT 1');

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        version: process.env.npm_package_version || 'unknown',
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'disconnected',
        version: process.env.npm_package_version || 'unknown',
      };
    }
  }

  /**
   * 监控指标端点
   */
  async getMetrics(): Promise<{
    timestamp: string;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    cpu: {
      usage: number;
    };
    database: {
      connected: boolean;
    };
  }> {
    // 检查数据库连接状态
    const dbConnected = this.dataSource.isInitialized;

    // 获取内存使用情况
    const memoryUsage = process.memoryUsage();

    // 获取CPU使用情况（简化版）
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: new Date().toISOString(),
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000, // 转换为毫秒
      },
      database: {
        connected: dbConnected,
      },
    };
  }
}
