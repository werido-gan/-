import { Module, Global } from '@nestjs/common';
import logger from './services/logger.service';

@Global() // 全局模块，不需要在每个模块中导入
@Module({
  providers: [
    {
      provide: 'LoggerService',
      useValue: logger,
    },
  ],
  exports: ['LoggerService'],
})
export class CommonModule {}
