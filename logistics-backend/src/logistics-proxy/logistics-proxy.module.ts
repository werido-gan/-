import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LogisticsProxyController } from './logistics-proxy.controller';
import { LogisticsSchedulerService } from './services/logistics-scheduler.service';
import { TrackingNumberRecognitionService } from './services/tracking-number-recognition.service';
import { OrdersModule } from '../orders/orders.module';
import { LogisticsUtilModule } from './utils/logistics-util.module';
import { LogisticsQueueModule } from './queues/logistics-queue.module';

@Module({
  imports: [
    OrdersModule,
    HttpModule,
    LogisticsUtilModule,
    LogisticsQueueModule,
  ],
  controllers: [LogisticsProxyController],
  providers: [LogisticsSchedulerService, TrackingNumberRecognitionService],
})
export class LogisticsProxyModule {}
