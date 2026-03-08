import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OrderStatus } from '../../orders/entities/order.entity';
import { LogisticsUtilService } from '../../logistics-proxy/utils/logistics-util.service';
import { OrdersService } from '../../orders/services/orders.service';

export interface LogisticsQueryOptions {
  orderNumber: string;
  carrier: string;
  receiverPhone?: string;
  maxRetries?: number;
  retryInterval?: number;
}

export interface LogisticsQueryResult {
  success: boolean;
  orderNumber: string;
  logisticsInfo?: any;
  error?: string;
}

export interface LogisticsQueryTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  result?: LogisticsQueryResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class LogisticsQueryService {
  private readonly logger = new Logger(LogisticsQueryService.name);
  private readonly tasks = new Map<string, LogisticsQueryTask>();

  constructor(
    private readonly httpService: HttpService,
    private readonly logisticsUtilService: LogisticsUtilService,
    @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
  ) {}

  async queryAndSync(options: LogisticsQueryOptions): Promise<{ status: string; taskId?: string; result?: LogisticsQueryResult }> {
    const taskId = this.generateTaskId();
    const task: LogisticsQueryTask = {
      id: taskId,
      status: 'pending',
      progress: 0,
      message: '任务已创建，等待处理...',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(taskId, task);

    this.processQuery(taskId, options).catch((error) => {
      this.logger.error(`任务 ${taskId} 处理失败:`, error);
      const currentTask = this.tasks.get(taskId);
      if (currentTask) {
        currentTask.status = 'failed';
        currentTask.error = error.message;
        currentTask.message = `查询失败: ${error.message}`;
        currentTask.updatedAt = new Date();
      }
    });

    return { status: 'processing', taskId };
  }

  async getTaskProgress(taskId: string): Promise<LogisticsQueryTask | null> {
    return this.tasks.get(taskId) || null;
  }

  private async processQuery(taskId: string, options: LogisticsQueryOptions): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    task.status = 'processing';
    task.progress = 10;
    task.message = '准备物流数据...';
    task.updatedAt = new Date();

    try {
      const result = await this.queryLogistics(options, (progress, message) => {
        task.progress = progress;
        task.message = message;
        task.updatedAt = new Date();
      });

      if (result.success && result.logisticsInfo) {
        task.progress = 90;
        task.message = '同步订单状态...';
        task.updatedAt = new Date();

        await this.syncOrderStatus(options, result.logisticsInfo);
      }

      task.status = 'completed';
      task.progress = 100;
      task.message = '查询完成';
      task.result = result;
      task.updatedAt = new Date();

      this.logger.log(`任务 ${taskId} 完成: ${result.success ? '成功' : '失败'}`);
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.message = `查询失败: ${error.message}`;
      task.updatedAt = new Date();
      throw error;
    }
  }

  async queryLogistics(
    options: LogisticsQueryOptions,
    onProgress?: (progress: number, message: string) => void,
  ): Promise<LogisticsQueryResult> {
    const {
      orderNumber,
      carrier,
      receiverPhone,
      maxRetries = 15,
      retryInterval = 3000,
    } = options;

    onProgress?.(20, '构建物流请求...');

    const carrierCode = this.logisticsUtilService.getCarrierCode(carrier);
    if (!carrierCode) {
      throw new Error(`承运商 ${carrier} 无法映射编码`);
    }

    const kddh = this.buildTrackingNumber(orderNumber, carrierCode, receiverPhone);
    onProgress?.(30, '创建物流任务...');

    const taskName = await this.createLogisticsTask(carrierCode, kddh);
    onProgress?.(40, '查询物流信息...');

    const logisticsInfo = await this.pollLogisticsResult(taskName, maxRetries, retryInterval, onProgress);
    onProgress?.(90, '解析物流信息...');

    return {
      success: true,
      orderNumber,
      logisticsInfo,
    };
  }

  private buildTrackingNumber(orderNumber: string, carrierCode: string, receiverPhone?: string): string {
    if (this.logisticsUtilService.requiresPhoneVerification(carrierCode) && receiverPhone) {
      const tail = receiverPhone.length >= 4 ? receiverPhone.slice(-4) : '';
      return tail ? `${orderNumber}||${tail}` : orderNumber;
    }
    return orderNumber;
  }

  private async createLogisticsTask(carrierCode: string, kddh: string): Promise<string> {
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

    return taskName;
  }

  private async pollLogisticsResult(
    taskName: string,
    maxRetries: number,
    retryInterval: number,
    onProgress?: (progress: number, message: string) => void,
  ): Promise<any> {
    const selectParams = {
      ...this.logisticsUtilService.getLogisticsConfig(),
      pageno: 1,
      taskname: taskName,
    };

    let retryCount = 0;
    let selectResponse: any;
    let taskCompleted = false;
    let logisticsList: any[] = [];

    while (retryCount < maxRetries) {
      selectResponse = await this.httpPostForm(
        `${this.logisticsUtilService.getLogisticsApiBaseUrl()}select/`,
        selectParams,
      );

      if (selectResponse.code !== 1) {
        throw new Error(`查询物流信息结果失败: ${selectResponse.msg}`);
      }

      const { jindu, list } = selectResponse.msg;
      const progress = 40 + (jindu * 50 / 100);
      onProgress?.(Math.floor(progress), `查询物流信息... ${jindu}%`);

      if (jindu === 100) {
        taskCompleted = true;
        logisticsList = list || [];
        break;
      }

      retryCount++;
      if (retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    }

    if (!taskCompleted) {
      throw new Error(`物流查询任务超时，已重试 ${maxRetries} 次`);
    }

    const logisticsInfo = logisticsList?.[0];
    if (!logisticsInfo) {
      throw new Error('未获取到物流信息');
    }

    return logisticsInfo;
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

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  cleanupOldTasks(maxAge: number = 3600000): void {
    const now = Date.now();
    for (const [taskId, task] of this.tasks.entries()) {
      const age = now - task.createdAt.getTime();
      if (age > maxAge) {
        this.tasks.delete(taskId);
        this.logger.log(`清理过期任务: ${taskId}`);
      }
    }
  }

  private async syncOrderStatus(options: LogisticsQueryOptions, logisticsInfo: any): Promise<void> {
    const order = await this.ordersService.getOrderByOrderNumber(options.orderNumber);
    
    if (!order) {
      this.logger.warn(`订单 ${options.orderNumber} 不存在，跳过同步`);
      return;
    }

    const orderStatusStr = this.logisticsUtilService.mapLogisticsStatus(logisticsInfo.wuliuzhuangtai);
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
}
