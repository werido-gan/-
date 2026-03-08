import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrdersService } from './services/orders.service';
import { OrdersController } from './controllers/orders.controller';
import { LogisticsProxyModule } from '../logistics-proxy/logistics-proxy.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), forwardRef(() => LogisticsProxyModule)],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
