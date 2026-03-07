import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Worker } from 'bullmq';
import { OrdersService } from '../../orders/services/orders.service';
import { LogisticsUtilService } from '../../logistics-proxy/utils/logistics-util.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OrderStatus } from '../../orders/entities/order.entity';

export interface LogisticsRefreshJob {
  orderId: number;
  orderNumber: string;
  carrier: string;
  receiverPhone?: string;
  retryCount?: number;
}

@Injectable()
export class LogisticsQueueService implements OnModuleInit {
  private readonly logger = new Logger(LogisticsQueueService.name);
  private worker: Worker;

  constructor(
    @InjectQueue('logistics-refresh')
    private readonly logisticsRefreshQueue: Queue<LogisticsRefreshJob>,
    private readonly ordersService: OrdersService,
    private readonly logisticsUtilService: LogisticsUtilService,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    this.logger.log('初始化物流队列处理器...');

    this.worker = new Worker(
      'logistics-refresh',
      async (job) => {
        this.logger.log(`处理物流刷新任务: ${job.id}, 订单ID: ${job.data.orderId}`);
        return await this.processLogisticsRefresh(job.data);
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        concurrency: 3,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`物流刷新任务完成: ${job.id}, 订单ID: ${job.data.orderId}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `物流刷新任务失败: ${job?.id}, 订单ID: ${job?.data.orderId}`,
        err,
      );
    });

    this.worker.on('error', (err) => {
      this.logger.error('物流队列处理器错误:', err);
    });
  }

  async addLogisticsRefreshJob(jobData: LogisticsRefreshJob, options?: any) {
    return await this.logisticsRefreshQueue.add(
      'refresh-logistics',
      jobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 1000,
          age: 3600,
        },
        removeOnFail: {
          count: 5000,
        },
        ...options,
      },
    );
  }

  async addBulkLogisticsRefreshJobs(jobs: LogisticsRefreshJob[]) {
    const results: any[] = [];
    
    for (const job of jobs) {
      const result = await this.addLogisticsRefreshJob(job);
      results.push(result);
    }

    return results;
  }

  private async processLogisticsRefresh(jobData: LogisticsRefreshJob) {
    const { orderId, orderNumber, carrier, receiverPhone, retryCount = 0 } = jobData;

    try {
      const carrierCode = this.logisticsUtilService.getCarrierCode(carrier);
      if (!carrierCode) {
        throw new Error(`承运商 ${carrier} 无法映射编码`);
      }

      const kddh = receiverPhone && carrierCode === 'shunfeng'
        ? `${orderNumber}||${receiverPhone.slice(-4)}`
        : orderNumber;

      const createParams = {
        ...this.logisticsUtilService.getLogisticsConfig(),
        zffs: 'jinbi',
        kdgs: carrierCode,
        kddhs: kddh,
        isBackTaskName: 'yes',
      };

      const createResponse = await this.httpPostForm(
        `${this.logisticsUtilService.getLogisticsApiBaseUrl()}create/`,
        createParams,
      );

      if (createResponse.code !== 1) {
        throw new Error(`创建物流查询任务失败: ${createResponse.msg}`);
      }

      const taskName = createResponse.msg;
      if (!taskName) {
        throw new Error('创建物流查询任务失败，未返回任务名');
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const selectParams = {
        ...this.logisticsUtilService.getLogisticsConfig(),
        pageno: 1,
        taskname: taskName,
      };

      const maxRetries = 5;
      const retryInterval = 1000;
      let retryCountLocal = 0;
      let selectResponse: any;
      let taskCompleted = false;

      while (retryCountLocal < maxRetries) {
        selectResponse = await this.httpPostForm(
          `${this.logisticsUtilService.getLogisticsApiBaseUrl()}select/`,
          selectParams,
        );

        if (selectResponse.code !== 1) {
          throw new Error(`查询物流信息结果失败: ${selectResponse.msg}`);
        }

        if (selectResponse.msg.jindu === 100) {
          taskCompleted = true;
          break;
        }

        retryCountLocal++;
        if (retryCountLocal < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryInterval));
        }
      }

      if (!taskCompleted) {
        throw new Error(`物流查询任务超时或失败，已重试 ${maxRetries} 次`);
      }

      const logisticsInfo = selectResponse.msg.list?.[0];
      if (!logisticsInfo) {
        throw new Error('未获取到物流信息');
      }

      const orderStatusStr = this.logisticsUtilService.mapLogisticsStatus(
        logisticsInfo.wuliuzhuangtai,
      );
      let orderStatus: OrderStatus;

      // 安全的枚举转换：根据字符串值查找对应的枚举成员
      switch (orderStatusStr) {
        case 'pending':
          orderStatus = OrderStatus.PENDING;
          break;
        case 'in_transit':
          orderStatus = OrderStatus.IN_TRANSIT;
          break;
        case 'delivered':
          orderStatus = OrderStatus.DELIVERED;
          break;
        case 'returned':
          orderStatus = OrderStatus.RETURNED;
          break;
        case 'exception':
          orderStatus = OrderStatus.EXCEPTION;
          break;
        default:
          this.logger.warn(
            `订单 ${orderId} 状态转换失败: orderStatusStr="${orderStatusStr}"，使用默认状态 PENDING`,
          );
          orderStatus = OrderStatus.PENDING;
          break;
      }
      let warningStatus = 'none';

      // 分析物流轨迹中的最新状态
      const trackingNodes = this.logisticsUtilService.parseTrackingDetails(
        logisticsInfo.xiangxiwuliu || '',
      );

      // 如果第三方物流状态已经是异常，直接使用该状态
      if (orderStatus === OrderStatus.EXCEPTION) {
        warningStatus = 'transit_abnormal';
      } else {
        // 只有当第三方物流状态不是异常时，才分析物流轨迹和检测关键字
        if (trackingNodes.length > 0) {
          const latestTracking = trackingNodes[0];
          if (
            latestTracking.description.includes('送货上门') ||
            latestTracking.description.includes('已签收') ||
            latestTracking.description.includes('签收') ||
            latestTracking.description.includes('取出') ||
            latestTracking.description.includes('已从代收点取出') ||
            latestTracking.description.includes('包裹已从代收点取出') ||
            latestTracking.description.includes('包裹已送至')
          ) {
            orderStatus = OrderStatus.DELIVERED;
            warningStatus = 'none';
          } else if (
            latestTracking.description.includes('退回') ||
            latestTracking.description.includes('被退回')
          ) {
            orderStatus = OrderStatus.RETURNED;
            warningStatus = 'none';
          }
        }

        // 检测物流信息中的异常状态
        const hasAbnormal =
          logisticsInfo.wuliuzhuangtai.includes('异常') ||
          logisticsInfo.xiangxiwuliu.includes('异常') ||
          logisticsInfo.wuliuzhuangtai.includes('问题') ||
          logisticsInfo.xiangxiwuliu.includes('问题') ||
          logisticsInfo.wuliuzhuangtai.includes('失败') ||
          logisticsInfo.xiangxiwuliu.includes('失败') ||
          logisticsInfo.wuliuzhuangtai.includes('派送不成功') ||
          logisticsInfo.xiangxiwuliu.includes('派送不成功') ||
          logisticsInfo.wuliuzhuangtai.includes('未妥投') ||
          logisticsInfo.xiangxiwuliu.includes('未妥投') ||
          logisticsInfo.wuliuzhuangtai.includes('反签收') ||
          logisticsInfo.xiangxiwuliu.includes('反签收') ||
          logisticsInfo.wuliuzhuangtai.includes('拒签') ||
          logisticsInfo.xiangxiwuliu.includes('拒签') ||
          logisticsInfo.wuliuzhuangtai.includes('退件') ||
          logisticsInfo.xiangxiwuliu.includes('退件') ||
          logisticsInfo.wuliuzhuangtai.includes('无法') ||
          logisticsInfo.xiangxiwuliu.includes('无法') ||
          logisticsInfo.wuliuzhuangtai.includes('未通过') ||
          logisticsInfo.xiangxiwuliu.includes('未通过') ||
          logisticsInfo.wuliuzhuangtai.includes('异常件') ||
          logisticsInfo.xiangxiwuliu.includes('异常件') ||
          logisticsInfo.wuliuzhuangtai.includes('客户已取消寄件') ||
          logisticsInfo.xiangxiwuliu.includes('客户已取消寄件') ||
          logisticsInfo.wuliuzhuangtai.includes('您的快件取消成功') ||
          logisticsInfo.xiangxiwuliu.includes('您的快件取消成功') ||
          logisticsInfo.wuliuzhuangtai.includes('拒收') ||
          logisticsInfo.xiangxiwuliu.includes('拒收') ||
          logisticsInfo.wuliuzhuangtai.includes('待进一步处理') ||
          logisticsInfo.xiangxiwuliu.includes('待进一步处理') ||
          logisticsInfo.wuliuzhuangtai.includes('问题件') ||
          logisticsInfo.xiangxiwuliu.includes('问题件') ||
          logisticsInfo.wuliuzhuangtai.includes('转寄更改单') ||
          logisticsInfo.xiangxiwuliu.includes('转寄更改单') ||
          logisticsInfo.wuliuzhuangtai.includes('退货') ||
          logisticsInfo.xiangxiwuliu.includes('退货') ||
          logisticsInfo.wuliuzhuangtai.includes('无法正常派送') ||
          logisticsInfo.xiangxiwuliu.includes('无法正常派送') ||
          logisticsInfo.wuliuzhuangtai.includes('地址不详') ||
          logisticsInfo.xiangxiwuliu.includes('地址不详') ||
          logisticsInfo.wuliuzhuangtai.includes('无法找到') ||
          logisticsInfo.xiangxiwuliu.includes('无法找到') ||
          logisticsInfo.wuliuzhuangtai.includes('暂未联系上客户') ||
          logisticsInfo.xiangxiwuliu.includes('暂未联系上客户') ||
          logisticsInfo.wuliuzhuangtai.includes('电话无人接听') ||
          logisticsInfo.xiangxiwuliu.includes('电话无人接听') ||
          logisticsInfo.wuliuzhuangtai.includes('无法接通') ||
          logisticsInfo.xiangxiwuliu.includes('无法接通') ||
          logisticsInfo.wuliuzhuangtai.includes('关机') ||
          logisticsInfo.xiangxiwuliu.includes('关机');
        if (hasAbnormal) {
          orderStatus = OrderStatus.EXCEPTION;
          warningStatus = 'transit_abnormal';
        }
      }

      const order = await this.ordersService.getOrderById(orderId);
      
      const STATUS_PRIORITY = {
        [OrderStatus.PENDING]: 0,
        [OrderStatus.IN_TRANSIT]: 1,
        [OrderStatus.EXCEPTION]: 50,
        [OrderStatus.DELIVERED]: 99,
        [OrderStatus.RETURNED]: 99,
      };

      const currentStatusPriority = STATUS_PRIORITY[order.status] || 0;
      const newStatusPriority = STATUS_PRIORITY[orderStatus] || 0;

      if (currentStatusPriority <= newStatusPriority) {
        await this.ordersService.updateOrderStatus(orderId, {
          status: orderStatus,
          warning_status: warningStatus,
          details: {
            ...order.details,
            trackingInfo: logisticsInfo,
            tracking: trackingNodes,
            lastTrackingUpdate: new Date().toISOString(),
            logisticsQueryFailed: false,
            logisticsQueryErrorMessage: '',
          },
        });
      }

      this.logger.log(`订单 ${orderId} 物流信息更新成功`);
      return { success: true, orderId };
    } catch (error) {
      this.logger.error(`处理订单 ${orderId} 物流刷新失败:`, error);
      throw error;
    }
  }

  private async httpPostForm(url: string, data: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(url, new URLSearchParams(data as any), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`HTTP POST 请求失败: ${url}`, error);
      throw error;
    }
  }

  async getQueueStats() {
    const waiting = await this.logisticsRefreshQueue.getWaiting();
    const active = await this.logisticsRefreshQueue.getActive();
    const completed = await this.logisticsRefreshQueue.getCompleted();
    const failed = await this.logisticsRefreshQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  async pauseQueue() {
    await this.logisticsRefreshQueue.pause();
    this.logger.log('物流队列已暂停');
  }

  async resumeQueue() {
    await this.logisticsRefreshQueue.resume();
    this.logger.log('物流队列已恢复');
  }

  async clearQueue() {
    await this.logisticsRefreshQueue.drain();
    this.logger.log('物流队列已清空');
  }
}
