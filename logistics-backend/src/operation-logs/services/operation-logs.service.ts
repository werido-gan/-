import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLog } from '../entities/operation-log.entity';

@Injectable()
export class OperationLogsService {
  constructor(
    @InjectRepository(OperationLog)
    private operationLogsRepository: Repository<OperationLog>,
  ) {}

  async createLog(logData: any): Promise<OperationLog> {
    const log = this.operationLogsRepository.create(logData);
    const savedLogs = await this.operationLogsRepository.save(log);
    // 如果返回的是数组，取第一个元素
    return Array.isArray(savedLogs) ? savedLogs[0] : savedLogs;
  }

  async getLogs(query: any): Promise<any> {
    const {
      page = 1,
      limit = 20,
      operation_type,
      target_type,
      date_range,
    } = query;
    const offset = (page - 1) * limit;

    const queryBuilder = this.operationLogsRepository
      .createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC');

    if (operation_type) {
      queryBuilder.andWhere('log.operation_type = :operationType', {
        operationType: operation_type,
      });
    }

    if (target_type) {
      queryBuilder.andWhere('log.target_type = :targetType', {
        targetType: target_type,
      });
    }

    if (date_range) {
      queryBuilder.andWhere('log.created_at BETWEEN :start AND :end', {
        start: date_range.start,
        end: date_range.end,
      });
    }

    const [logs, total] = await queryBuilder
      .skip(offset)
      .take(Number(limit))
      .getManyAndCount();

    return {
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }
}
