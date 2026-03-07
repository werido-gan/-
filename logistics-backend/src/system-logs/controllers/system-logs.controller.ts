import { Controller, Get, Query, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/system-logs')
@UseGuards(JwtAuthGuard)
export class SystemLogsController {
  private readonly logDir = path.resolve(__dirname, '../../logs');

  @Get()
  async getLogs(
    @Query('date') date?: string,
    @Query('level') level?: string,
    @Query('lines') lines?: string,
  ) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const targetLevel = level || 'combined';
      const maxLines = lines ? parseInt(lines) : 100;

      const logFileName = `${targetLevel}-${targetDate}.log`;
      const logPath = path.join(this.logDir, logFileName);

      if (!fs.existsSync(logPath)) {
        return {
          success: true,
          data: {
            date: targetDate,
            level: targetLevel,
            logs: [],
            message: '当日暂无日志记录',
          },
        };
      }

      const content = fs.readFileSync(logPath, 'utf-8');
      const logLines = content.split('\n').filter(line => line.trim());

      const logs = logLines
        .slice(-maxLines)
        .map(line => {
          const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)$/);
          if (match) {
            return {
              timestamp: match[1],
              level: match[2].toLowerCase(),
              message: match[3],
            };
          }
          return {
            timestamp: '',
            level: 'info',
            message: line,
          };
        });

      return {
        success: true,
        data: {
          date: targetDate,
          level: targetLevel,
          logs,
          total: logs.length,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'LOG_READ_ERROR',
            message: '读取日志文件失败',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('dates')
  async getAvailableDates() {
    try {
      if (!fs.existsSync(this.logDir)) {
        return {
          success: true,
          data: { dates: [] },
        };
      }

      const files = fs.readdirSync(this.logDir);
      const dates = new Set<string>();

      files.forEach(file => {
        const match = file.match(/combined-(\d{4}-\d{2}-\d{2})\.log/);
        if (match) {
          dates.add(match[1]);
        }
      });

      const sortedDates = Array.from(dates).sort().reverse();

      return {
        success: true,
        data: { dates: sortedDates },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'DATES_READ_ERROR',
            message: '获取可用日期失败',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('levels')
  async getAvailableLevels() {
    return {
      success: true,
      data: {
        levels: [
          { value: 'combined', label: '综合日志', color: '#3b82f6' },
          { value: 'error', label: '错误日志', color: '#ef4444' },
          { value: 'exceptions', label: '异常日志', color: '#ec4899' },
          { value: 'rejections', label: '拒绝日志', color: '#f59e0b' },
        ],
      },
    };
  }
}
