import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import compression from 'compression'; // 启用响应压缩
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import { createServer } from 'http';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  // 创建应用实例
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 增加请求体大小限制，支持更大的批量导入数据
  app.use(express.json({ limit: '1000mb' }));
  app.use(express.urlencoded({ limit: '1000mb', extended: true }));

  // 启用CORS，允许前端跨域请求
  const isProduction = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: isProduction
      ? [
          process.env.CORS_ORIGIN || 'https://your-production-domain.com', // 生产环境域名
          /^https:\/\/.*$/, // 允许所有HTTPS来源
        ]
      : [
          'http://localhost:3000', // 前端应用的URL
          'http://localhost:3001', // 前端实际运行端口
          'http://192.168.128.1:3000', // 网络IP地址(端口3000)
          'http://192.168.128.1:3001', // 网络IP地址(端口3001)
          'http://192.168.23.1:3000', // 网络IP地址(端口3000)
          'http://192.168.19.1:3000', // 网络IP地址(端口3000)
          'http://192.168.110.105:3000', // 网络IP地址(端口3000)
        ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders:
      'Content-Type, Authorization, X-Requested-With, X-CSRF-Token',
  });

  // 启用响应压缩
  app.use(compression()); // 启用响应压缩

  // 添加cookie解析中间件
  app.use(cookieParser());

  // 启用CSRF保护，但为物流代理接口除外
  app.use((req, res, next) => {
    // 物流代理接口不需要CSRF保护
    if (req.path.startsWith('/api/logistics-proxy/')) {
      return next();
    }

    // 其他接口启用CSRF保护
    csurf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // 生产环境使用HTTPS
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 3600 * 24, // 24小时
      },
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS'], // 忽略安全方法
      // 从请求头中获取CSRF令牌
      value: (req) => {
        return req.headers['x-csrf-token'] as string;
      },
    })(req, res, next);
  });

  // 将CSRF token添加到响应头中，以便前端可以获取使用
  app.use((req, res, next) => {
    // 物流代理接口不需要CSRF token
    if (req.path.startsWith('/api/logistics-proxy/')) {
      return next();
    }
    
    try {
      const token = req.csrfToken();
      res.setHeader('X-CSRF-Token', token);
    } catch (error) {
      // 如果获取token失败，不影响请求继续处理
      console.warn('Failed to generate CSRF token:', error.message);
    }
    next();
  });

  // 配置安全头
  app.use((req, res, next) => {
    // 防止点击劫持攻击
    res.setHeader('X-Frame-Options', 'DENY');
    // 防止XSS攻击
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // 防止MIME类型嗅探
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // 内容安全策略
    const isProduction = process.env.NODE_ENV === 'production';
    const cspPolicy = isProduction
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data:; connect-src 'self'"
      : "default-src 'self' http://localhost:3000 http://localhost:3001 http://192.168.128.1:3000 http://192.168.128.1:3001; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data:; connect-src 'self' http://localhost:3000 http://localhost:3001 http://192.168.128.1:3000 http://192.168.128.1:3001;";

    res.setHeader('Content-Security-Policy', cspPolicy);
    // 拒绝不安全的连接
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
    next();
  });

  // 配置全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动移除未知属性
      forbidNonWhitelisted: true, // 禁止未知属性
      transform: true, // 自动转换类型
      disableErrorMessages: false, // 显示错误信息
    }),
  );

  // 设置API前缀
  app.setGlobalPrefix('api');

  // 应用全局异常过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 配置Swagger文档
  const config = new DocumentBuilder()
    .setTitle('物流看板API')
    .setDescription('物流看板系统的API文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3002;

  if (isProduction) {
    // 生产环境：配置HTTPS
    try {
      // 读取SSL证书和密钥文件
      const httpsOptions = {
        cert: fs.readFileSync(path.join(__dirname, '..', 'ssl', 'cert.pem')),
        key: fs.readFileSync(path.join(__dirname, '..', 'ssl', 'key.pem')),
      };

      // 启动HTTPS服务器
      await app.listen(443, '0.0.0.0', () => {
        console.log('HTTPS Server running on https://0.0.0.0:443');
      });

      // 创建HTTP服务器用于重定向到HTTPS
      const httpApp = express();
      httpApp.get('*', (req, res) => {
        res.redirect('https://' + req.headers.host + req.url);
      });

      // 启动HTTP服务器
      createServer(httpApp).listen(80, '0.0.0.0', () => {
        console.log(
          'HTTP Server running on http://0.0.0.0:80 (redirecting to HTTPS)',
        );
      });
    } catch (error) {
      console.error('Error configuring HTTPS:', error.message);
      console.log('Falling back to HTTP server');
      await app.listen(80, '0.0.0.0');
    }
  } else {
    // 开发环境：使用HTTP
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
    console.log(
      `API documentation is available at: http://localhost:${port}/api/docs`,
    );
  }
}
bootstrap();
