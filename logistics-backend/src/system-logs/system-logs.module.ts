import { Module } from '@nestjs/common';
import { SystemLogsController } from './controllers/system-logs.controller';

@Module({
  controllers: [SystemLogsController],
})
export class SystemLogsModule {}
