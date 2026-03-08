import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OrdersService } from '../../orders/services/orders.service';
import { LogisticsUtilService } from '../../logistics-proxy/utils/logistics-util.service';
import { OrderStatus } from '../../orders/entities/order.entity';
import { CronJob, CronTime } from 'cron';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { LogisticsQueryService } from '../../logistics-proxy/services/logistics-query.service';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { OperationType, TargetType } from '../../operation-logs/entities/operation-log.entity';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private taskName: string = 'logistics-daily-refresh';

  constructor(
    @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
    private readonly httpService: HttpService,
    private readonly logisticsUtilService: LogisticsUtilService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly distributedLockService: DistributedLockService,
    @Inject(forwardRef(() => LogisticsQueryService)) private readonly logisticsQueryService: LogisticsQueryService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  onModuleInit() {
    this.logger.log('任务模块初始化完成');
    
    // 检查定时任务是否正确注册
    try {
      const job = this.schedulerRegistry.getCronJob('logistics-daily-refresh');
      if (job) {
        this.logger.log(`定时任务已注册，下次执行时间: ${job.nextDate().toISO()}`);
      } else {
        this.logger.warn('定时任务未找到');
      }
    } catch (error) {
      this.logger.error('检查定时任务状态时出错:', error.message);
    }
  }

  @Cron('0 6 * * *', {
    name: 'logistics-daily-refresh',
    timeZone: 'Asia/Shanghai',
  })
  async handleDailyLogisticsRefresh() {
    this.logger.log('开始执行每日物流信息刷新任务...');
    
    const lockKey = 'logistics-daily-refresh';
    const acquired = await this.distributedLockService.acquireLock(lockKey, 600000); // 10分钟
    
    if (!acquired) {
      this.logger.warn('无法获取分布式锁，跳过本次任务执行');
      return;
    }

    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;
    const allErrors: string[] = [];

    try {
      await this.executeLogisticsRefresh(allErrors, successCount, failedCount);
    } catch (error) {
      this.logger.error('每日物流信息刷新任务执行失败:', error);
      allErrors.push(error.message);
      failedCount = 0;
    } finally {
      await this.distributedLockService.releaseLock(lockKey);
      
      const duration = Math.floor((Date.now() - startTime) / 1000);
      this.logger.log(`物流信息更新完成，耗时: ${duration}秒，成功: ${successCount}，失败: ${failedCount}`);
      if (allErrors.length > 0) {
        this.logger.log(`错误信息:`, allErrors);
      }

      await this.operationLogsService.createLog({
        user_id: null,
        username: 'system',
        operation_type: OperationType.UPDATE,
        target_type: TargetType.LOGISTICS,
        target_id: 'daily_refresh',
        details: {
          description: `每日物流信息自动刷新，成功 ${successCount} 个，失败 ${failedCount} 个`,
          success_count: successCount,
          failed_count: failedCount,
          errors: allErrors,
          duration_seconds: duration,
        },
        ip_address: '127.0.0.1',
      });
    }
  }

  async triggerManualRefresh(triggeredBy: string, ipAddress?: string) {
    this.logger.log(`手动触发物流信息刷新任务，操作者: ${triggeredBy}`);
    
    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;
    const allErrors: string[] = [];

    try {
      await this.executeLogisticsRefresh(allErrors, successCount, failedCount);
    } catch (error) {
      this.logger.error('手动物流信息刷新任务执行失败:', error);
      allErrors.push(error.message);
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);
    this.logger.log(`物流信息更新完成，耗时: ${duration}秒，成功: ${successCount}，失败: ${failedCount}`);
    if (allErrors.length > 0) {
      this.logger.log(`错误信息:`, allErrors);
    }

    await this.operationLogsService.createLog({
      user_id: null,
      username: triggeredBy,
      operation_type: OperationType.UPDATE,
      target_type: TargetType.LOGISTICS,
      target_id: 'manual_refresh',
      details: {
        description: `手动物流信息刷新，成功 ${successCount} 个，失败 ${failedCount} 个`,
        success_count: successCount,
        failed_count: failedCount,
        errors: allErrors,
        duration_seconds: duration,
      },
      ip_address: ipAddress || '127.0.0.1',
    });

    return { success: true, successCount, failedCount, errors: allErrors };
  }

  private async executeLogisticsRefresh(allErrors: string[], successCount: number, failedCount: number) {
    const startTime = Date.now();
    
    try {
      this.logger.log('开始更新所有订单的物流信息...');

      const { orders } = await this.ordersService.getOrders({
        is_archived: false,
      });

      const activeOrders = orders.filter(
        (order) => order.status !== 'delivered' && order.status !== 'cancelled',
      );

      if (activeOrders.length === 0) {
        this.logger.log('没有需要更新物流信息的订单');
        return;
      }

      this.logger.log(`找到 ${activeOrders.length} 个活跃订单需要更新物流信息`);

      const ordersByCarrier = activeOrders.reduce((acc, order) => {
        if (!order.carrier) {
          this.logger.warn(`订单 ${order.id} 缺少快递公司信息，跳过处理`);
          allErrors.push(`订单 ${order.id} 缺少快递公司信息，跳过处理`);
          return acc;
        }
        if (!acc[order.carrier]) {
          acc[order.carrier] = [];
        }
        acc[order.carrier].push(order);
        return acc;
      }, {} as Record<string, any[]>);

      this.logger.log(`按快递公司分组: ${Object.keys(ordersByCarrier).length} 个`);
      this.logger.log(`分组详情:`, Object.entries(ordersByCarrier).map(([k, v]: [string, any[]]) => `${k}: ${v.length}个订单`));

      for (const [carrier, orders] of Object.entries(ordersByCarrier)) {
        try {
          this.logger.log(`=== 开始处理快递公司 ${carrier} 的订单 ===`);
          this.logger.log(`订单数: ${(orders as any[]).length}`);

          const kddhList = (orders as any[]).map((o: any) => {
            const tail = o.details?.phone && o.details.phone.length >= 4 ? o.details.phone.slice(-4) : '';
            return tail ? `${o.order_number}||${tail}` : o.order_number;
          });
          
          const kddhsString = kddhList.join(',');

          const carrierCode = this.logisticsUtilService.getCarrierCode(carrier);
          if (!carrierCode) {
            const errorMsg = `承运商 ${carrier} 无法映射编码`;
            this.logger.error(errorMsg);
            allErrors.push(errorMsg);
            failedCount += (orders as any[]).length;
            continue;
          }

          const createParams = {
            ...this.logisticsUtilService.getLogisticsConfig(),
            zffs: 'jinbi',
            kdgs: carrierCode,
            kddhs: kddhsString,
            isBackTaskName: 'yes',
          };

          const createResponse = await this.httpPostForm(
            `${this.logisticsUtilService.getLogisticsApiBaseUrl()}create/`,
            createParams,
          );

          if (createResponse.code !== 1) {
            const errorMsg = `为快递公司 ${carrier} 创建任务失败: ${createResponse.msg}`;
            this.logger.error(errorMsg);
            allErrors.push(errorMsg);
            failedCount += (orders as any[]).length;
            continue;
          }

          const taskName = createResponse.msg;
          this.logger.log(`创建任务成功，任务名称: ${taskName}`);

          let logisticsResults: any[] = [];
          let retries = 0;
          const maxRetries = 240;
          const retryInterval = 10000;
          let taskCompleted = false;
          let lastRequestTime = 0;
          const minRequestInterval = 10000;

          while (retries < maxRetries) {
            try {
              const now = Date.now();
              const timeSinceLastRequest = now - lastRequestTime;
              
              if (timeSinceLastRequest < minRequestInterval) {
                const waitTime = minRequestInterval - timeSinceLastRequest;
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
              
              lastRequestTime = Date.now();
              
              let currentPage = 1;
              let totalPages = 1;
              let requestRejected = false;
              
              do {
                const selectParams = {
                  ...this.logisticsUtilService.getLogisticsConfig(),
                  pageno: currentPage,
                  taskname: taskName,
                };

                const selectResponse = await this.httpPostForm(
                  `${this.logisticsUtilService.getLogisticsApiBaseUrl()}select/`,
                  selectParams,
                );

                if (selectResponse.code !== 1) {
                  const errorMsg = `查询物流信息结果失败: ${selectResponse.msg}`;
                  this.logger.error(errorMsg);
                  allErrors.push(errorMsg);
                  requestRejected = true;
                  break;
                }

                const { jindu, totalpage, list } = selectResponse.msg;
                this.logger.log(`轮询第 ${retries} 次，页码 ${currentPage}，进度 ${jindu}%，数据条数 ${list?.length || 0}`);

                if (list && list.length > 0) {
                  const newResults = list.filter((item: any) => 
                    !logisticsResults.some((existing: any) => existing.kddh === item.kddh)
                  );
                  logisticsResults = [...logisticsResults, ...newResults];
                }

                totalPages = totalpage || 1;
                currentPage++;

                if (jindu === 100 && currentPage > totalPages) {
                  this.logger.log(`任务完成，进度 100%，已查询所有 ${totalPages} 页`);
                  taskCompleted = true;
                  break;
                }
              } while (currentPage <= totalPages && !requestRejected);
              
              if (requestRejected) {
                retries++;
                continue;
              }
              
              if (taskCompleted) {
                this.logger.log(`轮询结束，获取到 ${logisticsResults.length} 条物流信息`);
                break;
              }
            } catch (error) {
              const errorMsg = `轮询查询进度失败: ${(error as Error).message}`;
              this.logger.error(errorMsg);
              allErrors.push(errorMsg);
            }
            retries++;
          }

          if (logisticsResults.length > 0) {
            this.logger.log(`为快递公司 ${carrier} 获取到 ${logisticsResults.length} 条物流信息`);
            
            for (const logisticsInfo of logisticsResults) {
              const order = (orders as any[]).find((o: any) => o.order_number === logisticsInfo.kddh);
              if (order) {
                try {
                  await this.updateSingleOrderWithLogisticsData(order, logisticsInfo);
                  successCount++;
                } catch (error) {
                  const errorMsg = `更新订单 ${order.id} 物流信息失败: ${(error as Error).message}`;
                  this.logger.error(errorMsg);
                  allErrors.push(errorMsg);
                  failedCount++;
                }
              }
            }
          } else {
            const errorMsg = `为快递公司 ${carrier} 未获取到物流信息`;
            this.logger.error(errorMsg);
            allErrors.push(errorMsg);
            failedCount += (orders as any[]).length;
          }
        } catch (error) {
          const errorMsg = `处理快递公司 ${carrier} 的订单失败: ${(error as Error).message}`;
          this.logger.error(errorMsg);
          allErrors.push(errorMsg);
          failedCount += (orders as any[]).length;
        }
      }

      const duration = Math.floor((Date.now() - startTime) / 1000);
      this.logger.log(`物流信息更新完成，耗时: ${duration}秒，成功: ${successCount}，失败: ${failedCount}`);
      if (allErrors.length > 0) {
        this.logger.log(`错误信息:`, allErrors);
      }
    } catch (error) {
      this.logger.error('执行物流信息刷新失败:', error);
      throw error;
    }
  }

  private async updateSingleOrderWithLogisticsData(order: any, logisticsInfo: any): Promise<void> {
    const orderStatusStr = this.logisticsUtilService.mapLogisticsStatus(
      logisticsInfo.wuliuzhuangtai,
    );
    let orderStatus: OrderStatus;

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
          `订单 ${order.id} 状态转换失败: orderStatusStr="${orderStatusStr}"，使用默认状态 PENDING`,
        );
        orderStatus = OrderStatus.PENDING;
        break;
    }

    let warningStatus = 'none';

    const trackingNodes = this.logisticsUtilService.parseTrackingDetails(
      logisticsInfo.xiangxiwuliu || '',
    );

    if (orderStatus === OrderStatus.EXCEPTION) {
      warningStatus = 'transit_abnormal';
    } else {
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

    if (!this.logisticsUtilService.shouldUpdateOrderStatus(order.status, orderStatus)) {
      this.logger.log(`订单 ${order.id} 状态不需要更新: ${order.status} -> ${orderStatus}`);
      return;
    }

    await this.ordersService.updateOrderStatus(order.id, {
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

    this.logger.log(`订单 ${order.id} 状态已更新: ${order.status} -> ${orderStatus}`);
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
}
