import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LogisticsProxyController } from './logistics-proxy.controller';
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
  providers: [TrackingNumberRecognitionService],
})
export class LogisticsProxyModule {}
