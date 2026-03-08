import { Module, forwardRef, Inject } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LogisticsProxyController } from './logistics-proxy.controller';
import { TrackingNumberRecognitionService } from './services/tracking-number-recognition.service';
import { LogisticsQueryService } from './services/logistics-query.service';
import { OrdersProgressController } from './controllers/orders-progress.controller';
import { OrdersModule } from '../orders/orders.module';
import { LogisticsUtilModule } from './utils/logistics-util.module';
import { LogisticsQueueModule } from './queues/logistics-queue.module';
import { OrdersService } from '../orders/services/orders.service';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    HttpModule.register({
      timeout: 2400000, // 40分钟超时时间（2400秒）
    }),
    LogisticsUtilModule,
    LogisticsQueueModule,
  ],
  controllers: [LogisticsProxyController, OrdersProgressController],
  providers: [TrackingNumberRecognitionService, LogisticsQueryService],
  exports: [LogisticsQueryService],
})
export class LogisticsProxyModule {}
