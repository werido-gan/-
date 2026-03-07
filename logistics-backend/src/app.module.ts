import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { DepartmentsModule } from './departments/departments.module';
import { AuthModule } from './auth/auth.module';
import { OperationLogsModule } from './operation-logs/operation-logs.module';
import { CommonModule } from './common/common.module';
import { LogisticsProxyModule } from './logistics-proxy/logistics-proxy.module';
import { TasksModule } from './tasks/tasks.module';
import { SystemLogsModule } from './system-logs/system-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // 配置请求速率限制
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 时间窗口（毫秒）
        limit: 200, // 每个IP在时间窗口内的最大请求数，增加到200
      },
    ]),
    // 配置静态文件服务，提供前端构建后的静态文件
    ServeStaticModule.forRoot({
      rootPath: 'd:\\智能看板\\dist',
      serveRoot: '/',
      serveStaticOptions: {
        // 配置静态资源缓存策略
        setHeaders: (res, path) => {
          // 配置不同文件类型的缓存策略
          const ext = path.split('.').pop()?.toLowerCase();
          const isProduction = process.env.NODE_ENV === 'production';

          if (isProduction) {
            // 生产环境：设置较长的缓存时间
            if (
              [
                'js',
                'css',
                'json',
                'ico',
                'svg',
                'woff',
                'woff2',
                'ttf',
                'eot',
              ].includes(ext || '')
            ) {
              // 静态资源文件：设置1年缓存
              res.setHeader(
                'Cache-Control',
                'public, max-age=31536000, immutable',
              );
            } else if (['html', 'htm'].includes(ext || '')) {
              // HTML文件：设置短缓存和验证
              res.setHeader(
                'Cache-Control',
                'public, max-age=0, must-revalidate',
              );
              res.setHeader('ETag', Date.now().toString());
            } else if (
              ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')
            ) {
              // 图片文件：设置1个月缓存
              res.setHeader('Cache-Control', 'public, max-age=2592000');
            }
          } else {
            // 开发环境：禁用缓存
            res.setHeader(
              'Cache-Control',
              'no-store, no-cache, must-revalidate, proxy-revalidate',
            );
            res.setHeader('Expires', '0');
          }

          // 设置内容类型
          if (ext === 'json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
        },
      },
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true, // 临时启用自动同步，解决字段不匹配问题
      // 连接池配置
      extra: {
        connectionLimit: process.env.DB_CONNECTION_LIMIT
          ? parseInt(process.env.DB_CONNECTION_LIMIT)
          : 10, // 最大连接数
        queueLimit: process.env.DB_QUEUE_LIMIT
          ? parseInt(process.env.DB_QUEUE_LIMIT)
          : 0, // 连接池队列长度，0表示无限
        connectTimeout: process.env.DB_CONNECT_TIMEOUT
          ? parseInt(process.env.DB_CONNECT_TIMEOUT)
          : 10000, // 建立连接的超时时间（毫秒）
        acquireTimeout: process.env.DB_ACQUIRE_TIMEOUT
          ? parseInt(process.env.DB_ACQUIRE_TIMEOUT)
          : 10000, // 从连接池获取连接的超时时间（毫秒）
        waitForConnections:
          process.env.DB_WAIT_FOR_CONNECTIONS === 'false' ? false : true, // 当连接池满时是否等待可用连接
        charset: 'utf8mb4', // 支持emoji的字符集
        timezone: '+08:00', // 设置时区为北京时间
        timeout: process.env.DB_QUERY_TIMEOUT
          ? parseInt(process.env.DB_QUERY_TIMEOUT)
          : 30000, // 查询超时时间（毫秒）
      },
    }),
    CommonModule,
    UsersModule,
    OrdersModule,
    DepartmentsModule,
    AuthModule,
    OperationLogsModule,
    LogisticsProxyModule,
    TasksModule,
    SystemLogsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
