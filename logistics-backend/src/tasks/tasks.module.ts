import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskExecution } from './entities/task-execution.entity';
import { TasksService } from './services/tasks.service';
import { TasksController } from './controllers/tasks.controller';
import { OrdersModule } from '../orders/orders.module';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { LogisticsUtilModule } from '../logistics-proxy/utils/logistics-util.module';
import { BullModule } from '@nestjs/bullmq';
import { LogisticsQueueService } from './services/logistics-queue.service';
import { RedisModule } from '@nestjs-modules/ioredis';
import { DistributedLockService } from '../common/services/distributed-lock.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskExecution]),
    OrdersModule,
    HttpModule,
    ScheduleModule.forRoot(),
    LogisticsUtilModule,
    BullModule.forRootAsync({
      imports: [RedisModule],
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      }),
      inject: [],
    }),
    BullModule.registerQueue({
      name: 'logistics-refresh',
    }),
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
  providers: [TasksService, LogisticsQueueService, DistributedLockService],
  exports: [TasksService, LogisticsQueueService, DistributedLockService],
})
export class TasksModule {}
