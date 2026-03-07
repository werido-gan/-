import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { OrdersService } from '../../orders/services/orders.service';
import { LogisticsUtilService } from '../utils/logistics-util.service';
import { WarningStatus, OrderStatus } from '../../orders/entities/order.entity';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LogisticsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(LogisticsSchedulerService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly httpService: HttpService,
    private readonly logisticsUtilService: LogisticsUtilService,
  ) {}

  // 模块初始化时启动定时任务
  onModuleInit() {
    this.scheduleDailyUpdate();
  }

  // 调度每天凌晨12点执行的任务
  private scheduleDailyUpdate() {
    this.logger.log('初始化物流信息每日更新任务...');

    // 立即执行一次更新
    this.updateAllLogisticsInfo();

    // 计算当前时间到明天凌晨12点的时间差
    const now = new Date();
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
    );
    const delay = tomorrow.getTime() - now.getTime();

    // 设置定时器，明天凌晨12点执行任务
    setTimeout(() => {
      // 执行更新任务
      this.updateAllLogisticsInfo();

      // 设置每天重复执行的定时器
      setInterval(
        () => {
          this.updateAllLogisticsInfo();
        },
        24 * 60 * 60 * 1000,
      ); // 24小时
    }, delay);
  }

  // 更新所有订单的物流信息
  private async updateAllLogisticsInfo() {
    try {
      this.logger.log('开始更新所有订单的物流信息...');

      // 获取所有未归档的订单
      const { orders } = await this.ordersService.getOrders({
        is_archived: false,
      });

      // 过滤掉已签收(delivered)和取消(cancelled)的，只查需要更新的
      const activeOrders = orders.filter(
        (order) => order.status !== 'delivered' && order.status !== 'cancelled',
      );

      if (activeOrders.length === 0) {
        this.logger.log('没有需要更新物流信息的订单');
        return;
      }

      this.logger.log(`找到 ${activeOrders.length} 个活跃订单需要更新物流信息`);

      // 批量获取物流信息
      const logisticsData = await this.fetchBulkLogisticsInfo(activeOrders);

      // 更新订单的物流状态
      await this.updateOrdersWithLogisticsData(activeOrders, logisticsData);

      this.logger.log('物流信息更新完成');
    } catch (error) {
      this.logger.error('更新物流信息失败:', error);
    }
  }

  // 批量获取物流信息
  private async fetchBulkLogisticsInfo(orders: any[]): Promise<any[]> {
    const allLogisticsData: any[] = [];

    // 根据订单的承运商分组，同一承运商的订单一起处理
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
          // 如果编码为空，跳过
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

    // 为每个承运商的订单创建批量查询任务
    for (const [carrier, carrierOrders] of Object.entries(ordersByCarrier) as Array<[string, any[]]>)
    {
      try {
        // 分批处理订单，每次处理1个订单，避免余额不足导致全部失败
        const batchSize = 1;
        for (let i = 0; i < carrierOrders.length; i += batchSize) {
          const batch = carrierOrders.slice(i, i + batchSize);

          // 构建批量查询参数，对于需要手机号的承运商（如顺丰），格式为：单号||手机尾号
          const kddhs = batch
            .map((order) => {
              if (carrier === 'shunfeng' && order.receiverPhone) {
                // 顺丰需要手机尾号后四位
                const phoneSuffix = order.receiverPhone.slice(-4);
                return `${order.order_number}||${phoneSuffix}`;
              }
              return order.order_number;
            })
            .join(',');

          // 构建创建任务参数
          const createParams = {
            ...this.logisticsUtilService.getLogisticsConfig(),
            zffs: 'jinbi', // 支付方式固定为金币
            kdgs: carrier,
            kddhs: kddhs,
            isBackTaskName: 'yes', // 返回任务名
          };

          // 创建查询任务
          const createResponse = await this.httpPostForm(
            `${this.logisticsUtilService.getLogisticsApiBaseUrl()}create/`,
            createParams,
          );

          // 检查创建任务响应
          if (createResponse.code !== 1) {
            this.logger.error(`创建物流查询任务失败: ${createResponse.msg}`);
            continue;
          }

          const taskName = createResponse.msg;
          if (!taskName) {
            this.logger.error('创建物流查询任务失败，未返回任务名');
            continue;
          }

          // 等待一段时间，让系统处理任务
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // 构建查询结果参数
          const selectParams = {
            ...this.logisticsUtilService.getLogisticsConfig(),
            pageno: 1,
            taskname: taskName,
          };

          // 轮询查询物流信息结果
          // 轮询配置
          const maxRetries = 5;
          const retryInterval = 1000; // 1秒
          let retryCount = 0;
          let selectResponse: any;
          let taskCompleted = false;

          while (retryCount < maxRetries) {
            // 查询物流信息结果
            selectResponse = await this.httpPostForm(
              `${this.logisticsUtilService.getLogisticsApiBaseUrl()}select/`,
              selectParams,
            );

            // 检查查询结果响应
            if (selectResponse.code !== 1) {
              this.logger.error(`查询物流信息结果失败: ${selectResponse.msg}`);
              break;
            }

            // 检查任务是否完成
            if (selectResponse.msg.jindu === 100) {
              taskCompleted = true;
              break;
            }

            // 任务未完成，等待后重试
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

          // 检查是否超时或查询失败
          if (!taskCompleted) {
            this.logger.error(
              `物流查询任务超时或失败，已重试 ${maxRetries} 次`,
            );
            continue;
          }

          // 处理物流信息
          const logisticsList = selectResponse.msg.list || [];
          allLogisticsData.push(...logisticsList);

          // 添加查询间隔，防止IP封禁（每查询一个订单后暂停200ms）
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (error) {
        this.logger.error(`处理承运商 ${carrier} 的订单时出错:`, error);
      }
    }

    return allLogisticsData;
  }

  /**
   * 更新订单的物流状态
   */
  private async updateOrdersWithLogisticsData(
    orders: any[],
    logisticsData: any[],
  ) {
    // 定义状态优先级常量
    const STATUS_PRIORITY = {
      [OrderStatus.PENDING]: 0,        // 待发货：等级 0
      [OrderStatus.IN_TRANSIT]: 1,     // 运输中：等级 1
      [OrderStatus.EXCEPTION]: 50,     // 运输异常：等级 50（高于运输中，低于终态）
      [OrderStatus.DELIVERED]: 99,     // 已签收：等级 99（最高，不可撼动）
      [OrderStatus.RETURNED]: 99,      // 已退回：等级 99（终态）
    };

    for (const order of orders) {
      try {
        // 查找对应的物流信息
        const logisticsInfo = logisticsData.find(
          (item) => item.wuliudanhao === order.order_number,
        );
        if (!logisticsInfo) {
          this.logger.warn(`未找到订单 ${order.id} 的物流信息`);
          continue;
        }

        // 计算订单状态和预警状态
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
        let warningStatus = WarningStatus.NONE;

        // 分析物流轨迹中的最新状态
        const trackingNodes = this.logisticsUtilService.parseTrackingDetails(
          logisticsInfo.xiangxiwuliu || '',
        );

        // 如果第三方物流状态已经是异常，直接使用该状态
        if (orderStatus === OrderStatus.EXCEPTION) {
          warningStatus = WarningStatus.TRANSIT_ABNORMAL;
        } else {
          // 只有当第三方物流状态不是异常时，才分析物流轨迹和检测关键字
          if (trackingNodes.length > 0) {
            const latestTracking = trackingNodes[0]; // 最新的物流记录在第一位
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
              warningStatus = WarningStatus.NONE; // 已签收的订单不应该有异常预警
            } else if (
              latestTracking.description.includes('退回') ||
              latestTracking.description.includes('被退回')
            ) {
              orderStatus = OrderStatus.RETURNED;
              warningStatus = WarningStatus.NONE; // 已退回的订单不应该有异常预警
            } else if (
              latestTracking.description.includes('发往') ||
              latestTracking.description.includes('运往') ||
              latestTracking.description.includes('运输') ||
              latestTracking.description.includes('派送') ||
              latestTracking.description.includes('揽收') ||
              latestTracking.description.includes('已发货') ||
              latestTracking.description.includes('已揽收') ||
              latestTracking.description.includes('正在派送') ||
              latestTracking.description.includes('已到达') ||
              latestTracking.description.includes('已发出') ||
              latestTracking.description.includes('已离开') ||
              latestTracking.description.includes('中转')
            ) {
              orderStatus = OrderStatus.IN_TRANSIT;
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
            warningStatus = WarningStatus.TRANSIT_ABNORMAL;
          }
        }

        // 状态优先级检查：确保高优先级状态不会被低优先级状态覆盖
        const currentStatusPriority = STATUS_PRIORITY[order.status] || 0;
        const newStatusPriority = STATUS_PRIORITY[orderStatus] || 0;

        // 如果当前状态优先级高于新状态优先级，保持当前状态
        if (currentStatusPriority > newStatusPriority) {
          this.logger.log(`订单 ${order.id} 当前状态 ${order.status} 优先级高于新状态 ${orderStatus}，保持当前状态`);
          // 只更新物流信息，不更新状态
          await this.ordersService.updateOrderStatus(order.id, {
            // 保持原有状态
            status: order.status,
            warning_status: warningStatus,
            details: {
              ...order.details, // 保留原有详情
              trackingInfo: logisticsInfo,
              tracking: trackingNodes,
              lastTrackingUpdate: new Date().toISOString(),
              logisticsQueryFailed: false,
              logisticsQueryErrorMessage: '',
            },
          });
        } else {
          // 更新订单的物流信息
          await this.ordersService.updateOrderStatus(order.id, {
            status: orderStatus,
            warning_status: warningStatus,
            details: {
              ...order.details, // 保留原有详情
              trackingInfo: logisticsInfo,
              tracking: trackingNodes,
              lastTrackingUpdate: new Date().toISOString(),
              logisticsQueryFailed: false,
              logisticsQueryErrorMessage: '',
            },
          });

          this.logger.log(`更新订单 ${order.id} 的物流信息成功`);
        }
      } catch (error) {
        this.logger.error(`更新订单 ${order.id} 的物流信息失败:`, error);
      }
    }
  }

  /**
   * 模拟HttpUtilService的httpPostForm方法
   */
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
