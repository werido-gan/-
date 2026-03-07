import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm'; // 引入 EntityManager
import { Order, OrderStatus, WarningStatus } from '../entities/order.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}

  async getOrders(query: any): Promise<any> {
    const {
       page = 1,
      limit = 100000, // 增加默认限制，支持更多订单
      department_key,
      status,
      is_archived = false,
      search,
    } = query;
    const offset = (page - 1) * limit;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.is_archived = :isArchived', {
        isArchived: is_archived === 'true' || false,
      });

    // 部门筛选
    if (department_key) {
      queryBuilder.andWhere('order.department_key = :departmentKey', {
        departmentKey: department_key,
      });
    }

    // 状态筛选
    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    // 搜索功能
    if (search) {
      queryBuilder.andWhere(
        'order.order_number LIKE :search OR order.customer_name LIKE :search',
        { search: `%${search}%` },
      );
    }

    // 分页
    const [orders, total] = await queryBuilder
      .skip(offset)
      .take(Number(limit))
      .orderBy('order.created_at', 'DESC')
      .getManyAndCount();

    return {
      orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getOrderById(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`ID为${id}的订单不存在`);
    }
    return order;
  }

  async getOrderByOrderNumber(orderNumber: string): Promise<Order | null> {
    const normalizedNumber = orderNumber ? orderNumber.trim() : '';
    return await this.ordersRepository.findOne({
      where: { order_number: normalizedNumber },
    });
  }

  async updateOrder(id: number, orderData: any): Promise<Order> {
    const order = await this.getOrderById(id);

    // 更新订单信息
    Object.assign(order, orderData);

    const savedOrders = await this.ordersRepository.save(order);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单更新失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async createOrder(orderData: any): Promise<Order> {
    const newOrder = this.ordersRepository.create(orderData);
    const savedOrders = await this.ordersRepository.save(newOrder);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单创建失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async updateOrderStatus(id: number, statusData: any): Promise<Order> {
    const order = await this.getOrderById(id);

    // 更新订单状态
    if (statusData.status) {
      order.status = statusData.status;
    }

    if (statusData.warning_status) {
      order.warning_status = statusData.warning_status;
    }

    // 更新订单详情
    if (statusData.details) {
      order.details = statusData.details;
    }

    const savedOrders = await this.ordersRepository.save(order);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单状态更新失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async archiveOrder(id: number): Promise<Order> {
    const order = await this.getOrderById(id);
    order.is_archived = true;

    const savedOrders = await this.ordersRepository.save(order);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单归档失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async restoreOrder(id: number): Promise<Order> {
    const order = await this.getOrderById(id);
    order.is_archived = false;

    const savedOrders = await this.ordersRepository.save(order);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单恢复失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async deleteOrder(id: number): Promise<void> {
    const result = await this.ordersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
  }

  async exportOrders(filters?: any): Promise<Order[]> {
    const queryBuilder = this.ordersRepository.createQueryBuilder('order');

    // 应用筛选条件
    if (filters?.department_key) {
      queryBuilder.where('order.department_key = :departmentKey', {
        departmentKey: filters.department_key,
      });
    }

    if (filters?.status) {
      if (queryBuilder.getParameters().departmentKey) {
        queryBuilder.andWhere('order.status = :status', {
          status: filters.status,
        });
      } else {
        queryBuilder.where('order.status = :status', {
          status: filters.status,
        });
      }
    }

    if (filters?.date_range) {
      if (
        queryBuilder.getParameters().departmentKey ||
        queryBuilder.getParameters().status
      ) {
        queryBuilder.andWhere('order.created_at BETWEEN :start AND :end', {
          start: filters.date_range.start,
          end: filters.date_range.end,
        });
      } else {
        queryBuilder.where('order.created_at BETWEEN :start AND :end', {
          start: filters.date_range.start,
          end: filters.date_range.end,
        });
      }
    }

    return queryBuilder.orderBy('order.created_at', 'DESC').getMany();
  }

  async exportSingleOrder(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
    });
    
    if (!order) {
      throw new Error('订单不存在');
    }
    
    return order;
  }

  // ================= 优化后的导入逻辑 =================

  /**
   * 统一的导入入口，支持纯订单导入和带物流信息的导入
   */
  async importOrders(ordersData: any[]): Promise<any> {
    // 使用统一的事务处理逻辑
    const executeImport = async (manager: EntityManager) => {
      const createdOrders: Order[] = [];
      const errors: Array<{ index: number; error: string; data: any }> = [];

      for (let i = 0; i < ordersData.length; i++) {
        try {
          // 兼容两种数据结构：
          // 1. 纯订单对象 (ordersData[i] 直接是 order)
          // 2. 带物流信息的对象 (ordersData[i] 是 { order: ..., logisticsData: ... })
          let orderInfo = ordersData[i];
          let logisticsInfo = {};
          
          if (ordersData[i].order && ordersData[i].logisticsData) {
             orderInfo = ordersData[i].order;
             logisticsInfo = ordersData[i].logisticsData;
          }

          // --- 数据映射与补全 ---
          // 将 CSV 中的"收货人"、"电话"、"地址"等存入 details
          // 优先使用orderInfo.details中的字段，只有当orderInfo.details中没有对应字段时，才尝试从orderInfo根目录下查找
          const details = {
            ...(orderInfo.details || {}),
            recipient: (orderInfo.details?.recipient || orderInfo.recipient || orderInfo.recipient_name || orderInfo.shouhuoren), // 映射收货人
            phone: (orderInfo.details?.phone || orderInfo.phone || orderInfo.recipient_phone || orderInfo.shouhuorendianhua), // 映射电话
            destination: (orderInfo.details?.destination || orderInfo.destination || orderInfo.address || orderInfo.shouhuodizhi), // 映射地址
            carrier: (orderInfo.details?.carrier || orderInfo.carrier || orderInfo.courier_company || orderInfo.kuaidigongsi), // 快递公司
            application_number: (orderInfo.details?.application_number || orderInfo.application_number || orderInfo.shenqingdanhao || orderInfo.waibudingdanhao), // 映射申请单号/外部订单号
            internal_order_number: (orderInfo.details?.internal_order_number || orderInfo.internal_order_number || orderInfo.dingdanhao), // 映射内部订单号
            product_info: (orderInfo.details?.product_info || orderInfo.product_info || orderInfo.wuliaomingcheng), // 映射物料名称
            logisticsData: logisticsInfo // 保存物流信息
          };

          // 校验必填项 (根据你的业务需求)
          if (!orderInfo.customer_name) throw new Error('客户名称不能为空');
          if (!orderInfo.department_key) throw new Error('部门键不能为空');

          // 确定订单号：优先使用传入的 order_number (CSV中的快递单号或申请单号)，否则自动生成
          const trackingNumber = `TRK${Date.now()}${i}${Math.floor(Math.random() * 100)}`;
          const finalOrderNumber = orderInfo.order_number || orderInfo.tracking_number || trackingNumber;

          // 检查订单是否已存在，如果存在则使用原状态
          let existingOrder: Order | null = null;
          try {
            existingOrder = await this.getOrderByOrderNumber(finalOrderNumber);
          } catch (error) {
            // 订单不存在，继续创建新订单
          }

          // 确定状态：优先使用已存在订单的状态，其次根据物流信息判断，最后使用传入的状态
          let status = existingOrder?.status || orderInfo.status || OrderStatus.PENDING;
          const statusText = logisticsInfo['wuliuzhuangtai'] || '';
          const latestInfo = logisticsInfo['zuihouwuliu'] || '';
          const detailedLogistics = logisticsInfo['xiangxiwuliu'] || '';
          
          // 检查物流信息中是否包含已签收状态
          const isDelivered = 
            statusText.includes('签收') || 
            statusText.includes('已完成') ||
            statusText.includes('已送达') ||
            latestInfo.includes('签收') || 
            latestInfo.includes('已签收') ||
            latestInfo.includes('已送达') ||
            latestInfo.includes('已签收人') ||
            latestInfo.includes('已签收，感谢') ||
            detailedLogistics.includes('签收') ||
            detailedLogistics.includes('已签收');
          
          // 只有当物流信息明确显示状态变化时，才更新订单状态
          if (isDelivered) {
            status = OrderStatus.DELIVERED;
          }
          else if (statusText.includes('退回') || statusText.includes('拒收') || latestInfo.includes('退回') || latestInfo.includes('拒收')) {
            status = OrderStatus.RETURNED;
          }
          else if (statusText.includes('运输') || statusText.includes('派送') || statusText.includes('发往') || 
                   latestInfo.includes('运输') || latestInfo.includes('派送') || latestInfo.includes('发往')) {
            // 只有当当前状态不是已签收时，才更新为运输中
            if (status !== OrderStatus.DELIVERED) {
              status = OrderStatus.IN_TRANSIT;
            }
          }
          
          // 如果订单已存在且当前状态是已签收，不要因为物流信息为空而重置为待发货
          if (existingOrder && existingOrder.status === OrderStatus.DELIVERED) {
            status = OrderStatus.DELIVERED;
          }

          let savedOrder;
          if (existingOrder) {
            // 如果订单已存在，更新现有订单
            existingOrder.customer_name = orderInfo.customer_name;
            existingOrder.department_key = orderInfo.department_key;
            existingOrder.status = status;
            existingOrder.warning_status = orderInfo.warning_status || WarningStatus.NONE;
            existingOrder.details = details;
            savedOrder = await manager.save(existingOrder);
          } else {
            // 如果订单不存在，创建新订单
            const newOrder = manager.create(Order, {
              customer_name: orderInfo.customer_name,
              department_key: orderInfo.department_key,
              order_number: finalOrderNumber,
              status: status,
              warning_status: orderInfo.warning_status || WarningStatus.NONE,
              details: details,
            });
            savedOrder = await manager.save(newOrder);
          }

          createdOrders.push(savedOrder);

        } catch (error) {
          console.error(`Row ${i} failed:`, error);
          errors.push({ index: i, error: error.message, data: ordersData[i] });
        }
      }

      return { successCount: createdOrders.length, errorCount: errors.length, errors, createdOrders };
    };

    // 自动判断是否使用事务 (生产环境/测试环境兼容)
    if (this.ordersRepository.manager && typeof this.ordersRepository.manager.transaction === 'function') {
      return await this.ordersRepository.manager.transaction(executeImport);
    } else {
      return executeImport(this.ordersRepository.manager);
    }
  }
}
