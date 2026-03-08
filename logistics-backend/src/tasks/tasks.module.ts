import { Module } from '@nestjs/common';
import { TasksService } from './services/tasks.service';
import { TasksController } from './controllers/tasks.controller';
import { OrdersModule } from '../orders/orders.module';
import { HttpModule } from '@nestjs/axios';
import { LogisticsUtilModule } from '../logistics-proxy/utils/logistics-util.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { DistributedLockService } from '../common/services/distributed-lock.service';
import { LogisticsProxyModule } from '../logistics-proxy/logistics-proxy.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';

@Module({
  imports: [
    OrdersModule,
    HttpModule.register({
      timeout: 2400000, // 40分钟超时时间（2400秒）
    }),
    LogisticsUtilModule,
    LogisticsProxyModule,
    OperationLogsModule,
    RedisModule.forRootAsync({
      useFactory: () => ({
        type: 'single',
        url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
        retryStrategy: (times) => Math.min(times + 1, 3),
        reconnectOnError: true,
      }),
      inject: [],
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService, DistributedLockService],
  exports: [TasksService, DistributedLockService],
})
export class TasksModule {}
