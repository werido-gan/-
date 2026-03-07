import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLog } from './entities/operation-log.entity';
import { OperationLogsService } from './services/operation-logs.service';
import { OperationLogInterceptor } from './interceptors/operation-log.interceptor';
import { OperationLogsController } from './controllers/operation-logs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OperationLog])],
  controllers: [OperationLogsController],
  providers: [OperationLogsService, OperationLogInterceptor],
  exports: [OperationLogsService, OperationLogInterceptor],
})
export class OperationLogsModule {}
