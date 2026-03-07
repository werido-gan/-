import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly LOCK_PREFIX = 'lock:';
  private readonly DEFAULT_TTL = 300000; // 5分钟
  private redisAvailable = false;

  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.checkRedisConnection();
  }

  private async checkRedisConnection() {
    try {
      await this.redis.ping();
      this.redisAvailable = true;
      this.logger.log('Redis 连接成功，分布式锁功能已启用');
    } catch (error) {
      this.redisAvailable = false;
      this.logger.warn('Redis 连接失败，分布式锁功能已禁用');
    }
  }

  async acquireLock(
    key: string,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<boolean> {
    if (!this.redisAvailable) {
      this.logger.warn('Redis 不可用，跳过分布式锁获取');
      return true;
    }

    const lockKey = this.LOCK_PREFIX + key;
    const lockValue = Date.now().toString();

    try {
      const result = await this.redis.set(lockKey, lockValue, 'PX', ttl, 'NX');
      
      if (result === 'OK') {
        this.logger.log(`获取分布式锁成功: ${lockKey}`);
        return true;
      } else {
        this.logger.warn(`获取分布式锁失败: ${lockKey}，锁已被占用`);
        return false;
      }
    } catch (error) {
      this.logger.error(`获取分布式锁异常: ${lockKey}`, error);
      return false;
    }
  }

  async releaseLock(key: string): Promise<boolean> {
    if (!this.redisAvailable) {
      return true;
    }

    const lockKey = this.LOCK_PREFIX + key;

    try {
      const result = await this.redis.del(lockKey);
      
      if (result > 0) {
        this.logger.log(`释放分布式锁成功: ${lockKey}`);
        return true;
      } else {
        this.logger.warn(`释放分布式锁失败: ${lockKey}，锁不存在或已过期`);
        return false;
      }
    } catch (error) {
      this.logger.error(`释放分布式锁异常: ${lockKey}`, error);
      return false;
    }
  }

  async extendLock(
    key: string,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<boolean> {
    if (!this.redisAvailable) {
      return true;
    }

    const lockKey = this.LOCK_PREFIX + key;

    try {
      const result = await this.redis.pexpire(lockKey, ttl);
      
      if (result === 1) {
        this.logger.log(`延长分布式锁成功: ${lockKey}, 新TTL: ${ttl}ms`);
        return true;
      } else {
        this.logger.warn(`延长分布式锁失败: ${lockKey}，锁不存在或已过期`);
        return false;
      }
    } catch (error) {
      this.logger.error(`延长分布式锁异常: ${lockKey}`, error);
      return false;
    }
  }

  async isLocked(key: string): Promise<boolean> {
    if (!this.redisAvailable) {
      return false;
    }

    const lockKey = this.LOCK_PREFIX + key;

    try {
      const result = await this.redis.exists(lockKey);
      return result === 1;
    } catch (error) {
      this.logger.error(`检查分布式锁状态异常: ${lockKey}`, error);
      return false;
    }
  }

  async getLockTTL(key: string): Promise<number> {
    if (!this.redisAvailable) {
      return -1;
    }

    const lockKey = this.LOCK_PREFIX + key;

    try {
      const ttl = await this.redis.pttl(lockKey);
      return ttl;
    } catch (error) {
      this.logger.error(`获取分布式锁TTL异常: ${lockKey}`, error);
      return -1;
    }
  }

  async executeWithLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<T | null> {
    const acquired = await this.acquireLock(key, ttl);
    
    if (!acquired) {
      this.logger.warn(`无法获取锁，跳过执行: ${key}`);
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(key);
    }
  }
}
