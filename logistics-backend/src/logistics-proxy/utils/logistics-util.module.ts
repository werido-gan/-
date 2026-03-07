import { Module } from '@nestjs/common';
import { LogisticsUtilService } from './logistics-util.service';

@Module({
  providers: [LogisticsUtilService],
  exports: [LogisticsUtilService],
})
export class LogisticsUtilModule {}
