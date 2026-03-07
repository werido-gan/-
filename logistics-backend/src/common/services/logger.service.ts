import { createLogger, format, transports } from 'winston';
import 'winston-daily-rotate-file';
import * as fs from 'fs';
import * as path from 'path';

// 确保日志目录存在
const logDir = path.resolve(__dirname, '../../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 配置日志格式
const logFormat = format.combine(
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  format.printf(
    (info) => `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`,
  ),
);

// 创建日志服务
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // 控制台输出
    new transports.Console({
      format: format.combine(format.colorize(), logFormat),
    }),
    // 错误日志文件（每天轮换）
    new transports.DailyRotateFile({
      filename: path.resolve(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '7d', // 保留7天
      maxSize: '10m', // 每个文件最大10MB
    }),
    // 所有日志文件（每天轮换）
    new transports.DailyRotateFile({
      filename: path.resolve(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      maxSize: '10m',
    }),
  ],
  exceptionHandlers: [
    // 未捕获异常日志文件
    new transports.DailyRotateFile({
      filename: path.resolve(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      maxSize: '10m',
    }),
  ],
  rejectionHandlers: [
    // Promise拒绝日志文件
    new transports.DailyRotateFile({
      filename: path.resolve(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      maxSize: '10m',
    }),
  ],
});

export default logger;
