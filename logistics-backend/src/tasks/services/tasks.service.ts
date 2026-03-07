import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TaskExecution, TaskStatus, TaskType } from '../entities/task-execution.entity';
import { OrdersService } from '../../orders/services/orders.service';
import { LogisticsUtilService } from '../../logistics-proxy/utils/logistics-util.service';
import { OrderStatus } from '../../orders/entities/order.entity';
import { CronJob, CronTime } from 'cron';
import { DistributedLockService } from '../../common/services/distributed-lock.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private taskName: string = 'logistics-daily-refresh';

  constructor(
    @InjectRepository(TaskExecution)
    private readonly taskExecutionRepository: Repository<TaskExecution>,
    private readonly ordersService: OrdersService,
    private readonly httpService: HttpService,
    private readonly logisticsUtilService: LogisticsUtilService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  onModuleInit() {
    this.logger.log('任务模块初始化完成');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
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
    
    const taskExecution = await this.createTaskExecution(
      '每日物流信息自动刷新',
      TaskType.LOGISTICS_REFRESH,
      'system',
    );

    try {
      await this.executeLogisticsRefresh(taskExecution);
    } catch (error) {
      this.logger.error('每日物流信息刷新任务执行失败:', error);
      await this.updateTaskExecutionStatus(
        taskExecution.id,
        TaskStatus.FAILED,
        error.message,
      );
    } finally {
      await this.distributedLockService.releaseLock(lockKey);
    }
  }

  async triggerManualRefresh(triggeredBy: string, ipAddress?: string) {
    this.logger.log(`手动触发物流信息刷新任务，操作者: ${triggeredBy}`);
    
    const taskExecution = await this.createTaskExecution(
      '手动物流信息刷新',
      TaskType.MANUAL_REFRESH,
      triggeredBy,
      ipAddress,
    );

    try {
      await this.executeLogisticsRefresh(taskExecution);
      return { success: true, taskId: taskExecution.id };
    } catch (error) {
      this.logger.error('手动物流信息刷新任务执行失败:', error);
      await this.updateTaskExecutionStatus(
        taskExecution.id,
        TaskStatus.FAILED,
        error.message,
      );
      return { success: false, error: error.message };
    }
  }

  private async createTaskExecution(
    taskName: string,
    taskType: TaskType,
    triggeredBy: string,
    ipAddress?: string,
  ): Promise<TaskExecution> {
    const taskExecution = this.taskExecutionRepository.create({
      task_name: taskName,
      task_type: taskType,
      status: TaskStatus.RUNNING,
      triggered_by: triggeredBy,
      ip_address: ipAddress,
      started_at: new Date(),
      details: {
        started_at: new Date().toISOString(),
      },
    });

    return await this.taskExecutionRepository.save(taskExecution);
  }

  private async updateTaskExecutionStatus(
    id: number,
    status: TaskStatus,
    errorMessage?: string,
  ) {
    const taskExecution = await this.taskExecutionRepository.findOne({ where: { id } });
    if (!taskExecution) {
      throw new Error(`任务执行记录不存在: ${id}`);
    }

    taskExecution.status = status;
    if (errorMessage) {
      taskExecution.error_message = errorMessage;
    }

    if (status === TaskStatus.SUCCESS || status === TaskStatus.FAILED) {
      taskExecution.completed_at = new Date();
      if (taskExecution.started_at) {
        taskExecution.duration_seconds = Math.floor(
          (new Date().getTime() - taskExecution.started_at.getTime()) / 1000,
        );
      }
    }

    return await this.taskExecutionRepository.save(taskExecution);
  }

  private async executeLogisticsRefresh(taskExecution: TaskExecution) {
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
        taskExecution.total_orders = 0;
        taskExecution.success_orders = 0;
        taskExecution.failed_orders = 0;
        taskExecution.skipped_orders = 0;
        await this.updateTaskExecutionStatus(taskExecution.id, TaskStatus.SUCCESS);
        return;
      }

      this.logger.log(`找到 ${activeOrders.length} 个活跃订单需要更新物流信息`);
      taskExecution.total_orders = activeOrders.length;

      const logisticsData = await this.fetchBulkLogisticsInfo(activeOrders);

      await this.updateOrdersWithLogisticsData(activeOrders, logisticsData, taskExecution);

      const duration = Math.floor((Date.now() - startTime) / 1000);
      this.logger.log(`物流信息更新完成，耗时: ${duration}秒`);

      taskExecution.duration_seconds = duration;
      taskExecution.details = {
        ...taskExecution.details,
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
      };

      await this.updateTaskExecutionStatus(taskExecution.id, TaskStatus.SUCCESS);
    } catch (error) {
      this.logger.error('执行物流信息刷新失败:', error);
      throw error;
    }
  }

  private async fetchBulkLogisticsInfo(orders: any[]): Promise<any[]> {
    const allLogisticsData: any[] = [];

    const ordersByCarrier = orders.reduce(
      (groups, order) => {
        if (!order.carrier || !order.order_number) {
          this.logger.warn(
            `订单 ${order.id} 缺少物流单号或承运商信息，跳过查询`,
          );
          return groups;
        }

        const carrier = this.logisticsUtilService.getCarrierCode(order.carrier);
        if (!carrier) {
          this.logger.warn(
            `订单 ${order.id} 的承运商 ${order.carrier} 无法映射编码，跳过查询`,
          );
          return groups;
        }

        if (!groups[carrier]) {
          groups[carrier] = [];
        }
        groups[carrier].push(order);
        return groups;
      },
      {} as Record<string, any[]>,
    );

    for (const [carrier, carrierOrders] of Object.entries(ordersByCarrier) as Array<[string, any[]]>)
    {
      try {
        const batchSize = 1;
        for (let i = 0; i < carrierOrders.length; i += batchSize) {
          const batch = carrierOrders.slice(i, i + batchSize);

          const kddhs = batch
            .map((order) => {
              if (carrier === 'shunfeng' && order.receiverPhone) {
                const phoneSuffix = order.receiverPhone.slice(-4);
                return `${order.order_number}||${phoneSuffix}`;
              }
              return order.order_number;
            })
            .join(',');

          const createParams = {
            ...this.logisticsUtilService.getLogisticsConfig(),
            zffs: 'jinbi',
            kdgs: carrier,
            kddhs: kddhs,
            isBackTaskName: 'yes',
          };

          const createResponse = await this.httpPostForm(
            `${this.logisticsUtilService.getLogisticsApiBaseUrl()}create/`,
            createParams,
          );

          if (createResponse.code !== 1) {
            this.logger.error(`创建物流查询任务失败: ${createResponse.msg}`);
            continue;
          }

          const taskName = createResponse.msg;
          if (!taskName) {
            this.logger.error('创建物流查询任务失败，未返回任务名');
            continue;
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));

          const selectParams = {
            ...this.logisticsUtilService.getLogisticsConfig(),
            pageno: 1,
            taskname: taskName,
          };

          const maxRetries = 5;
          const retryInterval = 1000;
          let retryCount = 0;
          let selectResponse: any;
          let taskCompleted = false;

          while (retryCount < maxRetries) {
            selectResponse = await this.httpPostForm(
              `${this.logisticsUtilService.getLogisticsApiBaseUrl()}select/`,
              selectParams,
            );

            if (selectResponse.code !== 1) {
              this.logger.error(`查询物流信息结果失败: ${selectResponse.msg}`);
              break;
            }

            if (selectResponse.msg.jindu === 100) {
              taskCompleted = true;
              break;
            }

            this.logger.warn(
              `物流查询任务尚未完成 (进度: ${selectResponse.msg.jindu}%), ${retryInterval}ms后重试...`,
            );
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise((resolve) =>
                setTimeout(resolve, retryInterval),
              );
            }
          }

          if (!taskCompleted) {
            this.logger.error(
              `物流查询任务超时或失败，已重试 ${maxRetries} 次`,
            );
            continue;
          }

          const logisticsList = selectResponse.msg.list || [];
          allLogisticsData.push(...logisticsList);

          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (error) {
        this.logger.error(`处理承运商 ${carrier} 的订单时出错:`, error);
      }
    }

    return allLogisticsData;
  }

  private async updateOrdersWithLogisticsData(
    orders: any[],
    logisticsData: any[],
    taskExecution: TaskExecution,
  ) {
    const STATUS_PRIORITY = {
      [OrderStatus.PENDING]: 0,
      [OrderStatus.IN_TRANSIT]: 1,
      [OrderStatus.EXCEPTION]: 50,
      [OrderStatus.DELIVERED]: 99,
      [OrderStatus.RETURNED]: 99,
    };

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const order of orders) {
      try {
        const logisticsInfo = logisticsData.find(
          (item) => item.wuliudanhao === order.order_number,
        );
        if (!logisticsInfo) {
          this.logger.warn(`未找到订单 ${order.id} 的物流信息`);
          skippedCount++;
          continue;
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
              `订单 ${order.id} 状态转换失败: orderStatusStr="${orderStatusStr}"，使用默认状态 PENDING`,
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

        const currentStatusPriority = STATUS_PRIORITY[order.status] || 0;
        const newStatusPriority = STATUS_PRIORITY[orderStatus] || 0;

        if (currentStatusPriority > newStatusPriority) {
          this.logger.log(`订单 ${order.id} 当前状态 ${order.status} 优先级高于新状态 ${orderStatus}，保持当前状态`);
          await this.ordersService.updateOrderStatus(order.id, {
            status: order.status,
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
          skippedCount++;
        } else {
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

          this.logger.log(`更新订单 ${order.id} 的物流信息成功`);
          successCount++;
        }
      } catch (error) {
        this.logger.error(`更新订单 ${order.id} 的物流信息失败:`, error);
        failedCount++;
      }
    }

    taskExecution.success_orders = successCount;
    taskExecution.failed_orders = failedCount;
    taskExecution.skipped_orders = skippedCount;
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

  async getTaskExecutions(filters?: {
    task_type?: TaskType;
    status?: TaskStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ tasks: TaskExecution[]; total: number }> {
    const queryBuilder = this.taskExecutionRepository.createQueryBuilder('task');

    if (filters?.task_type) {
      queryBuilder.andWhere('task.task_type = :task_type', {
        task_type: filters.task_type,
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere('task.status = :status', {
        status: filters.status,
      });
    }

    const total = await queryBuilder.getCount();

    queryBuilder.orderBy('task.created_at', 'DESC');

    if (filters?.limit) {
      queryBuilder.limit(filters.limit);
    }

    if (filters?.offset) {
      queryBuilder.offset(filters.offset);
    }

    const tasks = await queryBuilder.getMany();

    return { tasks, total };
  }

  async getTaskExecutionById(id: number): Promise<TaskExecution> {
    const taskExecution = await this.taskExecutionRepository.findOne({
      where: { id },
    });
    if (!taskExecution) {
      throw new Error(`任务执行记录不存在: ${id}`);
    }
    return taskExecution;
  }

  async getSchedulerHealth() {
    const job = this.schedulerRegistry.getCronJob(this.taskName || 'logistics-daily-refresh');
    const isScheduled = !!job;
    const lastExecution = await this.taskExecutionRepository.findOne({
      where: { task_type: TaskType.LOGISTICS_REFRESH },
      order: { created_at: 'DESC' },
    });

    return {
      task_name: this.taskName || 'logistics-daily-refresh',
      is_scheduled: isScheduled,
      last_execution: lastExecution
        ? {
            id: lastExecution.id,
            status: lastExecution.status,
            created_at: lastExecution.created_at,
            completed_at: lastExecution.completed_at,
            duration_seconds: lastExecution.duration_seconds,
            total_orders: lastExecution.total_orders,
            success_orders: lastExecution.success_orders,
            failed_orders: lastExecution.failed_orders,
          }
        : null,
    };
  }

  async updateSchedule(cronExpression: string) {
    try {
      const job = this.schedulerRegistry.getCronJob(this.taskName);
      if (!job) {
        throw new Error('定时任务不存在');
      }

      const newCronTime = new CronTime(cronExpression);
      job.setTime(newCronTime);
      job.start();

      this.logger.log(`定时任务调度时间已更新为: ${cronExpression}`);
      return { success: true, message: '定时任务调度时间已更新' };
    } catch (error) {
      this.logger.error('更新定时任务调度时间失败:', error);
      return { success: false, message: error.message };
    }
  }
}
