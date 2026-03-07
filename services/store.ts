import { create } from 'zustand';
import { Order, OrderStatus, DEPARTMENT_DICT, DEPARTMENTS, OperationLog, WarningStatus, User, Role, AuthState, OperationType, TargetType, getCarrierCode } from '../types';
import { apiService } from './api';
import { exportToExcel } from '../utils/export';

// 定义API响应数据结构接口
interface OrderApiResponse {
  order: Order;
  logs?: OperationLog[];
}

interface OrdersApiResponse {
  orders: Order[];
  logs?: OperationLog[];
}

interface CreatedOrdersApiResponse {
  createdOrders: Order[];
  logs?: OperationLog[];
}

interface WarningStatusApiResponse {
  warningStatus: WarningStatus;
}

interface UpdatedWarningsApiResponse {
  updatedOrders: Order[];
  logs?: OperationLog[];
}

// 解析物流详情的辅助函数
function parseTrackingDetails(details: string): any[] {
  if (!details || details === '//太长省略//') {
    return [];
  }
  
  try {
    const parsed = JSON.parse(details);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    const nodes: any[] = [];
    
    const lines = details.split('\n');
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        nodes.push({
          time: parts[0].trim(),
          description: parts.slice(1).join('|').trim(),
        });
      }
    }
    
    return nodes;
  }
  
  return [];
}

// 从本地存储获取初始认证状态
const getInitialAuthState = (): AuthState => {
  const storedUser = localStorage.getItem('user');
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const storedToken = localStorage.getItem('token');
  const storedCsrfToken = localStorage.getItem('csrfToken');

  // 打印认证状态信息
  console.log('从本地存储获取认证状态:', {
    isAuthenticated,
    storedUser: storedUser ? '存在' : '不存在',
    storedToken: storedToken ? '存在' : '不存在',
    storedCsrfToken: storedCsrfToken ? '存在' : '不存在'
  });

  if (isAuthenticated && storedUser && storedToken) {
    return {
      isAuthenticated: true,
      user: JSON.parse(storedUser),
      token: storedToken || null,
      csrfToken: storedCsrfToken || null
    };
  }

  return {
    isAuthenticated: false,
    user: null,
    token: null,
    csrfToken: null
  };
};

// 从本地存储获取初始操作日志状态
const getInitialOperationLogsState = (): OperationLog[] => {
  const storedLogs = localStorage.getItem('operationLogs');
  if (storedLogs) {
    try {
      return JSON.parse(storedLogs);
    } catch (error) {
      console.error('解析操作日志失败:', error);
      return [];
    }
  }
  return [];
};

// 保存操作日志到本地存储
const saveOperationLogsToStorage = (logs: OperationLog[]): void => {
  try {
    localStorage.setItem('operationLogs', JSON.stringify(logs));
  } catch (error) {
    console.error('保存操作日志失败:', error);
  }
};

// 更新操作日志并保存到本地存储的包装函数
const updateOperationLogs = (currentLogs: OperationLog[], newLogs: OperationLog[]): OperationLog[] => {
  const updatedLogs = newLogs;
  saveOperationLogsToStorage(updatedLogs);
  return updatedLogs;
};

interface LogisticsStore {
  // 数据
  orders: Order[];
  operationLogs: OperationLog[];
  users: User[];
  
  // 认证状态
  auth: AuthState;
  
  // 加载状态
  loading: {
    [key: string]: boolean;
  };
  
  // 错误状态
  error: {
    [key: string]: string | null;
  };
  
  // ★★★ 新增进度状态 ★★★
  taskProgress: number;
  taskStatus: string; // 'idle' | 'creating' | 'polling' | 'saving' | 'completed' | 'error'
  
  // 手动刷新进度状态
  refreshProgress: number;
  refreshStatus: string | null;
  
  // 分页状态
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  
  // 订单相关Actions
  deleteOrder: (id: number) => Promise<{ success: boolean; message: string }>; // Soft delete
  batchDeleteOrders: (ids: number[]) => Promise<{ success: boolean; message: string; data?: any }>; // Batch delete
  restoreOrder: (id: number) => Promise<{ success: boolean; message: string }>;
  hardDeleteOrder: (id: number) => Promise<{ success: boolean; message: string }>;
  updateOrderStatus: (id: number, newStatus?: OrderStatus) => Promise<{ success: boolean; message: string }>; // Simulate API update
  importOrders: (newOrders: Order[], operator?: string) => Promise<{ success: boolean; message: string }>; // Return import result
  exportOrders: (filterCriteria?: any, operator?: string) => Promise<{ success: boolean; message: string; data: Order[] }>; // Return filtered orders for export
  refreshAllTracking: () => Promise<{ success: boolean; message: string; data?: any }>; // Simulate nightly batch update
  addOperationLog: (log: OperationLog) => void;
  calculateWarningStatus: (order: Order) => Promise<WarningStatus>;
  updateAllWarningStatuses: () => Promise<{ success: boolean; message: string; data?: any }>;
  fetchAllOrders: (page?: number, limit?: number) => Promise<{ success: boolean; message: string }>;
  loadMoreOrders: () => Promise<{ success: boolean; message: string }>;

  // 用户相关Actions
  fetchAllUsers: () => Promise<{ success: boolean; message: string }>;
  createUser: (userData: Partial<User>) => Promise<{ success: boolean; message: string }>;
  updateUser: (userId: number, userData: Partial<User>) => Promise<{ success: boolean; message: string }>;
  deleteUser: (userId: number) => Promise<{ success: boolean; message: string }>;

  // 认证相关Actions
  login: (user: User, token: string) => void;
  logout: () => void;
  setCsrfToken: (token: string) => void;
  updateUserProfile: (userData: Partial<User>) => Promise<{ success: boolean; message: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  isAdmin: () => boolean;
  isUser: () => boolean;

  // 辅助方法
  calculateOrderStatusFromLogistics: (logisticsStatus: string) => OrderStatus;

  // Selectors (Computed manually in components usually, but helpers here)
  getStats: (departmentKey?: string) => any;
  getFilteredOrders: (departmentKey?: string, status?: OrderStatus, warningStatus?: WarningStatus) => Order[];
}

export const useLogisticsStore = create<LogisticsStore>((set, get) => ({
  orders: [], // Empty initial data
  operationLogs: getInitialOperationLogsState(), // 从本地存储加载初始日志
  users: [], // Empty initial user data
  auth: getInitialAuthState(),
  loading: {},
  error: {},
  
  // ★★★ 新增初始进度状态 ★★★
  taskProgress: 0,
  taskStatus: 'idle',
  
  // 手动刷新进度初始状态
  refreshProgress: 0,
  refreshStatus: null,
  
  // 分页初始状态
  pagination: {
    total: 0,
    page: 1,
    limit: 1000,
    totalPages: 0,
  },
  deleteOrder: async (id) => {
    try {
      set({ loading: { deleteOrder: true }, error: { deleteOrder: null } });
      
      // 找到要删除的订单
      const state = get();
      const orderToDelete = state.orders.find(o => o.id === id);
      
      // 尝试调用API
      try {
        const response = await apiService.put<OrderApiResponse>(`/orders/${id}/archive`);
        if (response.success && response.data?.order) {
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.ARCHIVE,
            target_type: TargetType.ORDER,
            target_id: id.toString(),
            details: {
              description: `归档订单 ${orderToDelete?.order_number}`,
              order_id: id,
              order_number: orderToDelete?.order_number
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };
          
          set((state) => {
            const updatedLogs = [newLog, ...state.operationLogs];
            saveOperationLogsToStorage(updatedLogs);
            return {
              orders: state.orders.map(o => o.id === id ? response.data.order : o),
              operationLogs: updatedLogs,
              loading: { ...state.loading, deleteOrder: false }
            };
          });
        }
        return { success: response.success, message: response.message || '归档订单成功' };
      } catch (apiError) {
        // API调用失败，在本地处理
        if (orderToDelete) {
          // 更新订单状态为已归档
          const updatedOrder = {
            ...orderToDelete,
            is_archived: true,
            updated_at: new Date().toISOString()
          };
          
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.ARCHIVE,
            target_type: TargetType.ORDER,
            target_id: id.toString(),
            details: {
              description: `归档订单 ${orderToDelete.order_number}`,
              order_id: id,
              order_number: orderToDelete.order_number
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };
          
          // 更新状态
          set((state) => {
            const updatedLogs = [newLog, ...state.operationLogs];
            saveOperationLogsToStorage(updatedLogs);
            return {
              orders: state.orders.map(o => o.id === id ? updatedOrder : o),
              operationLogs: updatedLogs,
              loading: { ...state.loading, deleteOrder: false }
            };
          });
          
          return { success: true, message: '归档订单成功' };
        }
        
        throw apiError;
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('归档订单失败:', error);
      set({ loading: { deleteOrder: false }, error: { deleteOrder: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  batchDeleteOrders: async (ids) => {
    try {
      set({ loading: { batchDeleteOrders: true }, error: { batchDeleteOrders: null } });
      
      const state = get();
      const ordersToDelete = state.orders.filter(o => ids.includes(o.id));
      const successCount: number[] = [];
      const failedOrders: { id: number; orderNumber: string; error: string }[] = [];
      
      for (const id of ids) {
        try {
          const orderToDelete = state.orders.find(o => o.id === id);
          
          try {
            const response = await apiService.put<OrderApiResponse>(`/orders/${id}/archive`);
            if (response.success && response.data?.order) {
              set((state) => ({
                orders: state.orders.map(o => o.id === id ? response.data.order : o)
              }));
              successCount.push(id);
            }
          } catch (apiError) {
            if (orderToDelete) {
              const updatedOrder = {
                ...orderToDelete,
                is_archived: true,
                updated_at: new Date().toISOString()
              };
              
              set((state) => ({
                orders: state.orders.map(o => o.id === id ? updatedOrder : o)
              }));
              successCount.push(id);
            }
          }
        } catch (error) {
          const orderToDelete = ordersToDelete.find(o => o.id === id);
          failedOrders.push({
            id,
            orderNumber: orderToDelete?.order_number || '未知',
            error: (error as Error).message || '未知错误'
          });
        }
      }
      
      const newLog: OperationLog = {
        id: Math.floor(Math.random() * 1000000),
        user_id: state.auth.user?.id,
        username: state.auth.user?.username || 'system',
        operation_type: OperationType.ARCHIVE,
        target_type: TargetType.ORDER,
        target_id: ids.join(','),
        details: {
          description: `批量归档订单 ${successCount.length} 个，失败 ${failedOrders.length} 个`,
          order_ids: ids,
          success_count: successCount.length,
          failed_count: failedOrders.length,
          failed_orders: failedOrders
        },
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString()
      };
      
      set((state) => {
        const updatedLogs = [newLog, ...state.operationLogs];
        saveOperationLogsToStorage(updatedLogs);
        return {
          operationLogs: updatedLogs,
          loading: { ...state.loading, batchDeleteOrders: false }
        };
      });
      
      if (failedOrders.length > 0) {
        return { 
          success: false, 
          message: `批量归档完成：成功 ${successCount.length} 个，失败 ${failedOrders.length} 个`,
          data: { successCount, failedOrders }
        };
      }
      
      return { success: true, message: `成功归档 ${successCount.length} 个订单`, data: { successCount } };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('批量归档订单失败:', error);
      set({ loading: { batchDeleteOrders: false }, error: { batchDeleteOrders: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  restoreOrder: async (id) => {
    try {
      set({ loading: { restoreOrder: true }, error: { restoreOrder: null } });
      
      // 找到要恢复的订单
      const state = get();
      const orderToRestore = state.orders.find(o => o.id === id);
      
      // 尝试调用API
      try {
        const response = await apiService.put<OrderApiResponse>(`/orders/${id}/restore`);
        if (response.success && response.data?.order) {
          set((state) => {
            const updatedLogs = response.data.logs ? [...response.data.logs, ...state.operationLogs] : state.operationLogs;
            saveOperationLogsToStorage(updatedLogs);
            return {
              orders: state.orders.map(o => o.id === id ? response.data.order : o),
              operationLogs: updatedLogs,
              loading: { ...state.loading, restoreOrder: false }
            };
          });
        }
        return { success: response.success, message: response.message || '恢复订单成功' };
      } catch (apiError) {
        // API调用失败，在本地处理
        if (orderToRestore) {
          // 更新订单状态为已恢复
          const updatedOrder = {
            ...orderToRestore,
            is_archived: false,
            updated_at: new Date().toISOString()
          };
          
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.UPDATE,
            target_type: TargetType.ORDER,
            target_id: id.toString(),
            details: {
              description: `恢复订单 ${orderToRestore.order_number}`,
              order_id: id,
              order_number: orderToRestore.order_number
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };
          
          // 更新状态
          set((state) => {
            const updatedLogs = [newLog, ...state.operationLogs];
            saveOperationLogsToStorage(updatedLogs);
            return {
              orders: state.orders.map(o => o.id === id ? updatedOrder : o),
              operationLogs: updatedLogs,
              loading: { ...state.loading, restoreOrder: false }
            };
          });
          
          return { success: true, message: '恢复订单成功' };
        }
        
        throw apiError;
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('恢复订单失败:', error);
      set({ loading: { restoreOrder: false }, error: { restoreOrder: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  hardDeleteOrder: async (id) => {
    try {
      set({ loading: { hardDeleteOrder: true }, error: { hardDeleteOrder: null } });
      
      // 找到要删除的订单
      const state = get();
      const orderToDelete = state.orders.find(o => o.id === id);
      
      const response = await apiService.delete<{ logs?: OperationLog[] }>(`/orders/${id}`);
      if (response.success) {
        // 创建操作日志
        const newLog: OperationLog = {
          id: Math.floor(Math.random() * 1000000),
          user_id: state.auth.user?.id,
          username: state.auth.user?.username || 'system',
          operation_type: OperationType.DELETE,
          target_type: TargetType.ORDER,
          target_id: id.toString(),
          details: {
            description: `彻底删除订单 ${orderToDelete?.order_number}`,
            order_id: id,
            order_number: orderToDelete?.order_number
          },
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString()
        };
        
        set((state) => {
          const updatedLogs = [newLog, ...state.operationLogs];
          saveOperationLogsToStorage(updatedLogs);
          return {
            orders: state.orders.filter(o => o.id !== id),
            operationLogs: updatedLogs,
            loading: { ...state.loading, hardDeleteOrder: false }
          };
        });
      }
      return { success: response.success, message: response.message || '彻底删除订单成功' };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('彻底删除订单失败:', error);
      set({ loading: { hardDeleteOrder: false }, error: { hardDeleteOrder: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  importOrders: async (newOrders, operator = 'system') => {
    try {
      set({ loading: { importOrders: true }, error: { importOrders: null }, taskProgress: 0, taskStatus: 'creating' });
      
      // 1. 准备数据：提取单号、手机号和快递公司，按快递公司分组
      // 格式：单号1||手机尾号1,单号2||手机尾号2,...
      
      // 快递公司名称到代码的映射
      const carrierNameToCode: Record<string, string> = {
        '顺丰': 'shunfeng',
        '申通': 'shentong',
        '圆通': 'yuantong',
        '韵达': 'yunda',
        '韵达快运': 'ydky',
        '中通': 'zhongtong',
        '中通快运': 'zhongtongkuaiyun',
        '极兔': 'jito',
        'EMS': 'ems',
        'EMS经济': 'eyb',
        '邮政国内小包': 'youzhengguonei',
        '京东高速查': 'jdgao',
        '京东验手机': 'jdbyphone',
        '京东': 'jd',
        '百世': 'huitongkuaidi',
        '百世快运': 'baishiwuliu',
        '宅急送': 'zhaijisong',
        '全峰': 'quanfengkuaidi',
        '德邦': 'debangwuliu',
        '跨越': 'kuayue',
        '安能': 'annengwuliu',
        '安能快递': 'ane66',
        '优速': 'youshuwuliu',
        '如风达': 'rufengda',
        '国通': 'guotongkuaidi',
        '加运美': 'jiayunmeiwuliu',
        '速尔': 'suer',
        '远成': 'yuanchengwuliu',
        'UEQ': 'ueq',
        '菜鸟': 'zhimakaimen',
        '全一': 'quanyikuaidi',
        '龙邦': 'longbanwuliu',
        '信丰': 'xinfengwuliu',
        '苏宁': 'suning',
        '佳吉': 'jiajiwuliu',
        'D速': 'dsukuaidi',
        '亚风': 'yafengsudi',
        '中铁快运': 'zhongtiekuaiyun',
        '天地华宇': 'tiandihuayu',
        '丰程': 'sccod',
        '晟邦': 'nanjingshengbang',
        '递四方': 'disifang',
        '蓝天国际': 'blueskyexpress',
        '程光': 'flyway',
        '富腾达': 'ftd',
        '转运四方': 'zhuanyunsifang',
        '澳世': 'ausexpress',
        'AOL澳通': 'aolau',
        '澳邮中国快运': 'auexpress',
        'FedEx': 'fedex',
        'FedEx中文': 'fedexcn',
        'UPS': 'ups',
        '品骏': 'pjbest',
        '长江国际': 'changjiang',
        '邮政国际': 'youzhengguoji',
        '斑马物流': 'banma',
        '捷安达': 'jieanda',
        'C＆C': 'cncexp',
        '极地': 'polarexpress',
        '全速快运': 'quansu',
        '优优': 'youyou',
        '自动识别': 'auto',
        '黄马甲': 'huangmajia',
        '东骏': 'dongjun',
        '菜鸟农村': 'cnnc',
        '增益': 'zengyisudi',
        '快服务': 'kfwnet',
        '日日顺': 'rrs',
        '新邦': 'xinbangwuliu',
        '运通': 'yuntongkuaidi',
        'KJDE': 'kjde',
        'EWE': 'ewe',
        '大田': 'datianwuliu',
        '远成快运': 'ycgky',
        '易客满': 'ecmscn',
        '联昊通': 'lianhaowuliu',
        '南方传媒': 'ndwl',
        'DHL中国': 'dhl',
        'DHL国际': 'dhlen',
        'USPS': 'usps',
        '嘉里大通': 'jialidatong',
        '黑猫宅急便': 'yct',
        'EMS英文': 'emsen',
        '原飞航': 'yfh',
        '特急送': 'lntjs',
        '华企快运': 'huaqikuaiyun',
        '速通': 'sut56',
        '京广': 'jinguangsudikuaijian',
        '盛辉': 'shenghuiwuliu',
        '安迅': 'anxl',
        '香港环球快运': 'huanqiuabc',
        '远航国际': 'yuanhhk',
        '平安达腾飞': 'pingandatengfei',
        '顺心捷达': 'sxjdfreight',
        '上海同城快递': 'shpost',
        '九曳': 'jiuyescm',
        '优邦': 'ubonex',
        '澳洲飞跃': 'rlgaus',
        '山西建华': 'sxjh',
        '春风': 'spring56',
        '新配盟': 'zmkmkd',
        '迅达': 'xdexpress',
        '陆本': 'luben',
        '日昱': 'riyuwuliu',
        '欧亚专线': 'euasia',
        '澳德': 'auod',
        '商桥': 'shangqiao56',
        'TNT': 'tnt',
        '尚途国际': 'shangtu',
        '中环': 'zhonghuan',
        '壹米滴答': 'yimidida',
        'COE': 'coe',
        '风驰': 'fengchi',
        '威盛': 'wherexpess',
        '易达通': 'qexpress',
        '易达国际': 'eta100',
        '新元国际': 'xynyc',
        '一速递': 'oneexpress',
        '中翼国际': 'chnexp',
        '方舟国际': 'arkexpress',
        '卓志': 'chinaicip',
        '中通国际': 'ztog',
        '众邮': 'zhongyouex',
        '澳捷': 'ajl',
        '龙行速运': 'longcps',
        '中集冷云': 'cccc58',
        '宏递': 'hd',
        'EFS（平安快递）': 'efs',
        '三盛': 'sansheng',
        '贝海国际': 'xlobo',
        '盛丰': 'sfwl',
        '美快': 'meiquick',
        '速腾': 'suteng',
        '韵达全': 'ydquan',
        '行云': 'xyb2b',
        '海带宝': 'haidaibao',
        '汇森': 'huisenky',
        '丰网': 'fengwang',
        '三象': 'sxexpress',
        '新杰': 'sunjex',
        '科捷': 'kejie',
        '明达': 'tmwexpress',
        '海信': 'savor',
        '安得': 'annto',
        '京东全': 'jdquan',
        '哪吒': 'nezha',
        '上海同城快寄': 'shpost',
        '快捷快': 'gdkjk56',
        '宇鑫': 'yuxinwuliu',
        '联运通': 'szuem',
        '中健云康': 'concare',
        '中通冷链': 'ztocc',
        '速邮达': 'suyoda',
        '奔力': 'blex56',
        '泛球': 'fanqiu',
        '安敏': 'anmin56',
        '极速达': 'jsdky',
        '速必达': 'subida',
        '志方': 'zfex56',
        'Jingle': 'jingleexpressx',
        '德坤': 'dekuncn',
        '一站通': 'yztex',
        'OCS': 'ocs',
        '万家': 'wjwl',
        '申通非缓存': 'stonocache',
        'EMS非缓存': 'emsnocache',
        '邮速达': 'inpostysd',
        '中通非缓存': 'ztonocache',
        '无忧': 'aliexpress',
        'Aramex': 'aramex',
        '菜鸟大件': 'cndj',
        'Amazon': 'amazon',
        '华通': 'huatong',
        '云途': 'yunexpress',
        '小米': 'xiaomiwuliu',
        '京东前半程': 'jdqian',
        '融辉': 'ronghui',
        'Uniuni': 'uniuni',
        'Pig': 'piggyship',
        'RoyalMail': 'royal',
        '万邦': 'wanb',
        '快弟来了': 'kder',
        'YWE': 'ywe',
        '景光': 'jgwl',
        '安顺快运': 'anshun',
        '加拿大邮政': 'canpost',
        'UBI': 'ubi',
        'Sagawa': 'sagawa',
        '佳成': 'jiacheng',
        '日本邮政': 'japanpost',
        '华翰': 'huahanwuliu',
        '上海守务': 'shshouwu',
        '笨鸟': 'benniao',
        '奇普文': 'quipuwin',
        '意大利邮政': 'posteit',
        'EVRi': 'evri',
        'KoreaPost': 'koreapost',
        'GOFO': 'gofo',
        'SwiftX': 'swiftx',
        '顺衍': 'shunyanwl'
      };
      
      const ordersByCarrier: Record<string, Array<{ order_number: string; phone: string }>> = {};
      
      // 初始化错误数组
      let allErrors: string[] = [];
      
      // 按快递公司分组订单
      newOrders.forEach(o => {
        const phone = o.details?.phone ? String(o.details.phone).trim() : '';
        // 从订单数据中提取快递公司信息
        let carrier = o.details?.carrier || o.carrier || (o as any).express_company || 'auto';
        
        // 转换快递公司名称为代码
        if (carrier !== 'auto') {
          const normalizedCarrier = carrier.trim();
          carrier = carrierNameToCode[normalizedCarrier] || carrier;
        }
        
        // 打印完整的订单对象，以便调试
        console.log(`完整订单对象:`, JSON.stringify(o, null, 2));
        
        // 从多个可能的字段中获取快递单号，包括嵌套对象中的字段
        // 优先使用快递单号相关字段，避免使用订单号字段
        const expressNumber = o.details?.tracking_number || 
          (o as any)['快递单号'] || (o as any).快递单号 || 
          (o as any)['物流单号'] || (o as any).物流单号 || 
          (o as any)['tracking_number'] || (o as any).tracking_number || 
          (o as any)['logistics_number'] || (o as any).logistics_number || 
          (o as any)['express_number'] || (o as any).express_number || 
          (o as any)['delivery_number'] || (o as any).delivery_number || 
          (o as any)['运单号'] || (o as any).运单号 || 
          (o as any)['kddh'] || (o as any).kddh || 
          o.details?.['快递单号'] || o.details?.快递单号 || 
          o.details?.['物流单号'] || o.details?.物流单号 || 
          o.details?.logistics_number || o.details?.express_number || 
          o.details?.delivery_number || o.details?.['运单号'] || 
          o.details?.运单号 || o.details?.kddh;
        
        // 打印提取到的快递单号
        console.log(`提取到的快递单号:`, expressNumber);
        
        // 只有在快递单号存在且有效的情况下才添加到分组
        if (expressNumber && expressNumber.toString().trim() !== '') {
          if (!ordersByCarrier[carrier]) {
            ordersByCarrier[carrier] = [];
          }
          
          ordersByCarrier[carrier].push({ order_number: expressNumber, phone });
          console.log(`成功添加订单到分组，快递公司: ${carrier}，快递单号: ${expressNumber}`);
        } else {
          console.warn(`订单缺少有效快递单号，跳过处理:`, o);
          allErrors.push(`订单缺少有效快递单号，跳过处理`);
        }
      });
      
      // 为每个快递公司创建一个任务
      const tasks = [];
      for (const [carrier, orders] of Object.entries(ordersByCarrier)) {
        const kddhList = orders.map(o => {
          const tail = o.phone.length >= 4 ? o.phone.slice(-4) : '';
          return tail ? `${o.order_number}||${tail}` : o.order_number;
        });
        
        const kddhsString = kddhList.join(',');
        tasks.push({ carrier, kddhsString, orders });
      }

      // 2. 为每个快递公司创建任务并查询物流信息
      let allLogisticsResults: any[] = [];
      let totalTasks = tasks.length;
      let completedTasks = 0;
      
      console.log('=== 开始处理批量导入订单 ===');
      console.log(`总订单数: ${newOrders.length}`);
      console.log(`快递公司分组: ${Object.keys(ordersByCarrier).length} 个`);
      console.log(`分组详情:`, Object.entries(ordersByCarrier).map(([k, v]) => `${k}: ${v.length}个订单`));
      
      for (const task of tasks) {
        const { carrier, kddhsString, orders } = task;
        
        try {
          console.log(`=== 开始处理快递公司 ${carrier} 的订单 ===`);
          console.log(`订单数: ${orders.length}`);
          console.log(`订单号和手机号:`, orders.map(o => `${o.order_number}||${o.phone.slice(-4)}`));
          
          // 创建任务
          const createRes = await apiService.createBatchLogisticsTask({
            kdgs: carrier,
            kddhs: kddhsString,
            zffs: 'jinbi',
            isBackTaskName: 'yes'
          });

          console.log(`创建任务响应:`, createRes);
          
          if (!(createRes as any).success || (createRes as any).data?.code !== 1) {
            const errorMsg = `为快递公司 ${carrier} 创建任务失败: ${(createRes as any).data?.msg || (createRes as any).message || '未知错误'}`;
            console.error(errorMsg);
            allErrors.push(errorMsg);
            completedTasks++;
            continue;
          }

          const taskName = (createRes as any).data.msg;
          console.log(`创建任务成功，任务名称: ${taskName}`);
          set({ taskStatus: 'polling', taskProgress: Math.floor((completedTasks / totalTasks) * 100) });

          // 轮询进度
          let logisticsResults: any[] = [];
          let retries = 0;
          const maxRetries = 240; // 最多等 40 分钟 (240次 × 10秒 = 2400秒 = 40分钟)
          let taskCompleted = false;
          let lastRequestTime = 0;
          const minRequestInterval = 10000; // 最小请求间隔，单位：毫秒，保持10秒

          while (retries < maxRetries) {
            try {
              // 计算距离上次请求的时间间隔
              const now = Date.now();
              const timeSinceLastRequest = now - lastRequestTime;
              
              // 如果距离上次请求的时间间隔小于最小请求间隔，等待到最小请求间隔
              if (timeSinceLastRequest < minRequestInterval) {
                const waitTime = minRequestInterval - timeSinceLastRequest;
                console.log(`距离上次请求时间过短，等待 ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
              
              // 记录本次请求的时间
              lastRequestTime = Date.now();
              
              // 支持分页查询，处理最多800条订单
              let currentPage = 1;
              let totalPages = 1;
              let requestRejected = false;
              
              do {
                const selectRes = await apiService.getBatchLogisticsResult({
                  taskname: taskName,
                  pageno: currentPage
                });

                console.log(`轮询第 ${retries} 次，页码 ${currentPage} 响应:`, selectRes);
                
                // 检查是否是请求被驳回的错误
                const isMsgString = typeof (selectRes as any).data?.msg === 'string';
                const isMessageString = typeof (selectRes as any).message === 'string';
                const isRequestRejected = (isMsgString && (selectRes as any).data?.msg.includes('此任务刚刚select过一次，故本次请求被驳回')) || 
                                         (isMessageString && (selectRes as any).message.includes('此任务刚刚select过一次，故本次请求被驳回'));
                
                if (isRequestRejected) {
                  // 处理请求被驳回错误，增加重试间隔
                  console.warn(`请求被驳回，增加重试间隔 (第${retries}次重试)`);
                  // 使用指数退避策略，每次收到驳回响应时，将重试间隔翻倍
                  const backoffInterval = Math.min(2000 * Math.pow(2, retries), 60000); // 最大60秒
                  console.log(`使用指数退避策略，重试间隔: ${backoffInterval}ms`);
                  await new Promise(resolve => setTimeout(resolve, backoffInterval));
                  // 标记请求被驳回，跳过当前do-while循环的剩余迭代
                  requestRejected = true;
                  break;
                } else if ((selectRes as any).success) {
                  if ((selectRes as any).data?.code === 1) {
                    const { jindu, totalpage, list } = (selectRes as any).data.msg;
                    console.log(`轮询第 ${retries} 次，进度 ${jindu}%，数据条数 ${list?.length || 0}`);
                    set({ taskProgress: Math.floor((completedTasks / totalTasks) * 100 + (jindu / totalTasks) * 100) }); // 更新进度条

                    if (list && list.length > 0) {
                      console.log(`获取到物流信息:`, list.map(l => l.kddh));
                      // 避免重复添加物流信息
                      const newResults = list.filter((item: any) => 
                        !logisticsResults.some((existing: any) => existing.kddh === item.kddh)
                      );
                      logisticsResults = [...logisticsResults, ...newResults];
                      console.log(`当前累计物流信息: ${logisticsResults.length}条`);
                    }

                    totalPages = totalpage || 1;
                    currentPage++;

                    // 只有当进度达到100%且已经查询了所有页面时，才退出循环
                    if (jindu === 100 && currentPage > totalPages) {
                      console.log(`任务完成，进度 100%，已查询所有 ${totalPages} 页`);
                      taskCompleted = true;
                      break;
                    }
                  } else {
                    const errorMsg = `轮询失败: ${(selectRes as any).data?.msg || '未知错误'}`;
                    console.error(errorMsg);
                    allErrors.push(errorMsg);
                  }
                } else {
                  const errorMsg = `轮询请求失败: ${selectRes.message || '网络错误'}`;
                  console.error(errorMsg);
                  allErrors.push(errorMsg);
                }
              } while (currentPage <= totalPages && !requestRejected); // 移除分页限制，查询所有页面的物流信息
              
              // 如果请求被驳回，跳过当前while循环的剩余迭代，进入下一次while循环
              if (requestRejected) {
                console.log(`请求被驳回，跳过当前轮询迭代`);
                retries++;
                continue;
              }
              
              // 只有当任务真正完成时才退出轮询
              if (taskCompleted) {
                console.log(`轮询结束，获取到 ${logisticsResults.length} 条物流信息`);
                break;
              }
            } catch (error) {
              const errorMsg = `轮询查询进度失败: ${(error as Error).message}`;
              console.error(errorMsg);
              allErrors.push(errorMsg);
            }
            retries++;
          }

          // 将查询到的物流信息添加到总结果中
          if (logisticsResults.length > 0) {
            console.log(`为快递公司 ${carrier} 获取到 ${logisticsResults.length} 条物流信息`);
            // 避免重复添加物流信息
            const newResults = logisticsResults.filter((item: any) => 
              !allLogisticsResults.some((existing: any) => existing.kddh === item.kddh)
            );
            allLogisticsResults = [...allLogisticsResults, ...newResults];
            console.log(`当前总物流信息: ${allLogisticsResults.length}条`);
          } else {
            const errorMsg = `为快递公司 ${carrier} 未获取到物流信息`;
            console.error(errorMsg);
            allErrors.push(errorMsg);
          }
        } catch (error) {
          const errorMsg = `处理快递公司 ${carrier} 的订单失败: ${(error as Error).message}`;
          console.error(errorMsg);
          allErrors.push(errorMsg);
        } finally {
          completedTasks++;
          console.log(`=== 完成处理快递公司 ${carrier} 的订单 ===`);
          set({ taskProgress: Math.floor((completedTasks / totalTasks) * 100) });
        }
      }

      console.log(`=== 批量导入订单处理完成 ===`);
      console.log(`总订单数: ${newOrders.length}`);
      console.log(`获取到物流信息的订单数: ${allLogisticsResults.length}`);
      console.log(`错误信息:`, allErrors);
      
      if (allLogisticsResults.length === 0) {
        const errorMsg = `未获取到任何物流信息，请检查订单数据是否正确。错误详情: ${allErrors.join('; ')}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      set({ taskStatus: 'saving', taskProgress: 100 });

      // 4. 合并数据并入库
      // 将查询到的物流信息 (allLogisticsResults) 匹配回 newOrders
      console.log('=== 开始匹配物流信息到订单 ===');
      console.log(`总订单数: ${newOrders.length}`);
      console.log(`总物流信息数: ${allLogisticsResults.length}`);
      
      const ordersToSave = newOrders.map(order => {
        // 从多个可能的字段中获取快递单号，包括嵌套对象中的字段
        const expressNumber = order.details?.tracking_number || 
          (order as any)['快递单号'] || (order as any).快递单号 || 
          (order as any)['物流单号'] || (order as any).物流单号 || 
          (order as any)['tracking_number'] || (order as any).tracking_number || 
          (order as any)['logistics_number'] || (order as any).logistics_number || 
          (order as any)['express_number'] || (order as any).express_number || 
          (order as any)['delivery_number'] || (order as any).delivery_number || 
          (order as any)['运单号'] || (order as any).运单号 || 
          (order as any)['kddh'] || (order as any).kddh || 
          order.details?.['快递单号'] || order.details?.快递单号 || 
          order.details?.['物流单号'] || order.details?.物流单号 || 
          order.details?.logistics_number || order.details?.express_number || 
          order.details?.delivery_number || order.details?.['运单号'] || 
          order.details?.运单号 || order.details?.kddh;
        
        // 找到对应的物流结果
        const logInfo = allLogisticsResults.find((l: any) => {
          if (!l.kddh) return false;
          
          const logisticsKddh = String(l.kddh).trim();
          const orderExpressNumber = String(expressNumber).trim();
          const orderNumber = String(order.order_number).trim();
          
          // 优先使用快递单号匹配（与查询时使用的相同字段）
          if (logisticsKddh === orderExpressNumber) {
            console.log(`✅ 订单 ${order.order_number} 通过快递单号匹配成功: ${orderExpressNumber}`);
            return true;
          }
          
          // 如果kddh包含"||"分隔符，说明是"单号||手机尾号"格式
          if (logisticsKddh.includes('||')) {
            const parts = logisticsKddh.split('||');
            const trackingNumber = parts[0].trim();
            if (trackingNumber === orderExpressNumber) {
              console.log(`✅ 订单 ${order.order_number} 通过快递单号(带手机尾号)匹配成功: ${trackingNumber}`);
              return true;
            }
          }
          
          // 其次使用订单号匹配（作为备选方案）
          if (logisticsKddh === orderNumber) {
            console.log(`✅ 订单 ${order.order_number} 通过订单号匹配成功: ${orderNumber}`);
            return true;
          }
          
          if (logisticsKddh.includes('||')) {
            const parts = logisticsKddh.split('||');
            const trackingNumber = parts[0].trim();
            if (trackingNumber === orderNumber) {
              console.log(`✅ 订单 ${order.order_number} 通过订单号(带手机尾号)匹配成功: ${trackingNumber}`);
              return true;
            }
          }
          
          // 最后使用包含匹配（但要求完全包含，避免部分匹配）
          if (logisticsKddh.includes(orderExpressNumber)) {
            console.log(`✅ 订单 ${order.order_number} 通过快递单号包含匹配成功: ${orderExpressNumber} 在 ${logisticsKddh} 中`);
            return true;
          }
          
          if (logisticsKddh.includes(orderNumber)) {
            console.log(`✅ 订单 ${order.order_number} 通过订单号包含匹配成功: ${orderNumber} 在 ${logisticsKddh} 中`);
            return true;
          }
          
          return false;
        });
        
        if (logInfo) {
          console.log(`✅ 订单 ${order.order_number} 匹配到物流信息，状态: ${logInfo.wuliuzhuangtai}`);
        } else {
          console.log(`❌ 订单 ${order.order_number} 未匹配到物流信息`);
          console.log(`   订单号: ${order.order_number}`);
          console.log(`   快递单号: ${expressNumber}`);
          console.log(`   可用的物流信息数量: ${allLogisticsResults.length}`);
          if (allLogisticsResults.length > 0) {
            console.log(`   前5条物流信息的kddh:`, allLogisticsResults.slice(0, 5).map(l => l.kddh));
            const matchingLogistics = allLogisticsResults.filter(l => {
              const logisticsKddh = String(l.kddh).trim();
              return logisticsKddh.includes(String(expressNumber).trim()) || 
                     logisticsKddh.includes(String(order.order_number).trim());
            });
            if (matchingLogistics.length > 0) {
              console.log(`   找到可能相关的物流信息:`, matchingLogistics.map(l => l.kddh));
            }
          }
        }
        
        // 只有在获取到物流信息的情况下才创建订单
        if (logInfo) {
          // 准备基础订单数据，只包含后端接受的字段
          const phone = order.details?.phone ? String(order.details.phone).trim() : '';
          const recipient = order.details?.recipient ? String(order.details.recipient).trim() : '';
          
          // 确保customer_name长度大于或等于2个字符，优先使用表格中的客户/项目名称
          let customerName = order.customer_name || recipient || '';
          if (!customerName || customerName.length < 2) {
            customerName = '未知'; // 2个字符，满足长度要求
          }
          
          const baseOrder = {
            order_number: order.order_number,
            customer_name: customerName,
            department_key: order.department_key || 'EAST',
            carrier: order.details?.carrier || order.carrier || '',
            carrier_code: order.details?.carrier_code || order.carrier_code || '',
            receiverPhone: phone // 后端期望的字段名是 receiverPhone
          };
          
          // 解析物流轨迹信息
          const timeline = [];
          let isDelivered = false;
          if (logInfo.xiangxiwuliu) {
            // 分割详细物流信息，提取时间和描述
            const logisticsLines = logInfo.xiangxiwuliu.split('<br>');
            for (const line of logisticsLines) {
              const timeMatch = line.match(/<i>([^<]+)<\/i>\s*\|\s*(.+)/);
              if (timeMatch) {
                const [, timeStr, description] = timeMatch;
                const trimmedDescription = description.trim();
                // 使用当前时间作为timestamp，因为物流信息中的时间格式可能不符合ISO要求
                timeline.push({
                  timestamp: new Date().toISOString(),
                  description: trimmedDescription,
                  location: '' // 从描述中提取位置信息，这里暂时留空
                });
                
                // 检查轨迹中是否包含已签收/取出关键词
                if (trimmedDescription.includes('签收') || trimmedDescription.includes('取出') || trimmedDescription.includes('包裹已从代收点取出') || trimmedDescription.includes('包裹已送至') || trimmedDescription.includes('已从代收点取出')) {
                  isDelivered = true;
                }
              }
            }
          }
          
          return {
            ...baseOrder,
            status: isDelivered || logInfo.wuliuzhuangtai.includes('签收') || logInfo.wuliuzhuangtai.includes('取出') || logInfo.wuliuzhuangtai.includes('包裹已从代收点取出') || logInfo.wuliuzhuangtai.includes('包裹已送至') ? OrderStatus.DELIVERED :
                    logInfo.wuliuzhuangtai.includes('退回') ? OrderStatus.RETURNED :
                    logInfo.wuliuzhuangtai.includes('异常') || logInfo.wuliuzhuangtai.includes('问题') || logInfo.wuliuzhuangtai.includes('失败') || logInfo.wuliuzhuangtai.includes('派送不成功') || logInfo.wuliuzhuangtai.includes('未妥投') || logInfo.wuliuzhuangtai.includes('反签收') || logInfo.wuliuzhuangtai.includes('拒签') || logInfo.wuliuzhuangtai.includes('退件') || logInfo.wuliuzhuangtai.includes('无法') || logInfo.wuliuzhuangtai.includes('未通过') || logInfo.wuliuzhuangtai.includes('异常件') || logInfo.wuliuzhuangtai.includes('拒收') || logInfo.wuliuzhuangtai.includes('待进一步处理') || logInfo.wuliuzhuangtai.includes('问题件') || logInfo.wuliuzhuangtai.includes('转寄更改单') || logInfo.wuliuzhuangtai.includes('退货') || logInfo.wuliuzhuangtai.includes('无法正常派送') ? OrderStatus.EXCEPTION :
                    logInfo.wuliuzhuangtai.includes('运输') ? OrderStatus.IN_TRANSIT :
                    logInfo.wuliuzhuangtai.includes('无物流') ? OrderStatus.PENDING : OrderStatus.PENDING,
            details: {
              order_date: order.details?.order_date || new Date().toISOString(),
              destination: order.details?.destination || '',
              planned_ship_date: order.details?.planned_ship_date || new Date().toISOString(),
              carrier: order.details?.carrier || order.carrier || '',
              product_info: order.details?.product_info || '',
              phone: order.details?.phone || phone,
              note: order.details?.note || '',
              timeline: timeline,
              tracking_number: order.details?.tracking_number || (order as any).tracking_number || expressNumber,
              recipient: recipient, // 保存收货人姓名
              application_number: order.details?.application_number || order.application_number || '', // 保存申请单号/外部订单号
              internal_order_number: order.details?.internal_order_number || order.internal_order_number || '', // 保存内部订单号
              tracking: logInfo.xiangxiwuliu,
              trackingInfo: {
                status: logInfo.wuliuzhuangtai,
                latestTime: logInfo.zuixinshijian,
                latestInfo: logInfo.zuihouwuliu,
                origin: logInfo.wwlyuan,
                steps: logInfo.xiangxiwuliu,
                trackingNumber: logInfo.kddh,
                carrier: logInfo.kdgs,
                itemCount: logInfo.tiaoshu,
                sendTime: logInfo.fachushijian,
                queryTime: logInfo.chaxunshijian,
                orderNumber: logInfo.dingdanhao,
                noLogisticsReason: logInfo.wwlyuanyin
              }
            }
          };
        }
        // 没有物流信息时也创建订单，但状态设为待查询
        // 准备基础订单数据，只包含后端接受的字段
        const phone = order.details?.phone ? String(order.details.phone).trim() : '';
        const recipient = order.details?.recipient ? String(order.details.recipient).trim() : '';
        
        // 确保customer_name长度大于或等于2个字符，优先使用表格中的客户/项目名称
        let customerName = order.customer_name || recipient || '';
        if (!customerName || customerName.length < 2) {
          customerName = '未知'; // 2个字符，满足长度要求
        }
        
        const baseOrder = {
          order_number: order.order_number,
          customer_name: customerName,
          department_key: order.department_key || 'EAST',
          carrier: order.details?.carrier || order.carrier || '',
          carrier_code: order.details?.carrier_code || order.carrier_code || '',
          receiverPhone: phone // 后端期望的字段名是 receiverPhone
        };
        
        // 无论是否有物流信息，都创建订单
          // 没有物流信息时，状态设为 PENDING（待发货），等待后续手动刷新
          return {
            ...baseOrder,
            status: OrderStatus.PENDING, // 没有物流信息时设为待发货，等待后续查询
          details: {
            order_date: order.details?.order_date || new Date().toISOString(),
            destination: order.details?.destination || '',
            planned_ship_date: order.details?.planned_ship_date || new Date().toISOString(),
            carrier: order.details?.carrier || order.carrier || '',
            product_info: order.details?.product_info || '',
            phone: order.details?.phone || phone,
            note: order.details?.note || '',
            timeline: [],
            tracking_number: order.details?.tracking_number || (order as any).tracking_number || expressNumber,
            recipient: recipient, // 保存收货人姓名
            application_number: order.details?.application_number || order.application_number || '', // 保存申请单号/外部订单号
            internal_order_number: order.details?.internal_order_number || order.internal_order_number || '' // 保存内部订单号
          }
        };
      }); // 不再过滤，保留所有订单

      // 批量保存 (这里为了简单，循环调用 create，或者后端支持 bulk create)
      // 建议：循环调用 post /orders，虽然慢点但稳妥
      let savedCount = 0;
      for (const order of ordersToSave) {
        try {
           // 注意：这里需要确保 POST /orders 接口能接收 status 和 details
           await apiService.post('/orders', order);
           savedCount++;
           // 添加适当的延迟，避免请求频率过高
           await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒延迟
        } catch (e) {
           console.error('Save order failed', e);
        }
      }

      // 5. 完成
      // 更新本地状态和操作日志
      const state = get();
      const errorCount = newOrders.length - savedCount;
      
      const newLog: OperationLog = {
        id: Math.floor(Math.random() * 1000000),
        user_id: state.auth.user?.id,
        username: state.auth.user?.username || operator,
        operation_type: OperationType.IMPORT,
        target_type: TargetType.ORDER,
        target_id: 'batch_import',
        details: {
          description: `批量导入了 ${newOrders.length} 个订单，已成功 ${savedCount} 个，失败 ${errorCount} 个`,
          import_count: savedCount,
          failed_count: errorCount,
          operator: operator,
          source: 'API'
        },
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString()
      };
      
      // 重新获取所有订单以确保数据最新
      await get().fetchAllOrders();

      set((state) => {
        const updatedLogs = [newLog, ...state.operationLogs];
        saveOperationLogsToStorage(updatedLogs);
        return {
          loading: { importOrders: false },
          taskStatus: 'completed',
          taskProgress: 0,
          operationLogs: updatedLogs
        };
      });

      return { success: errorCount === 0, message: `批量导入了 ${newOrders.length} 个订单，已成功 ${savedCount} 个，失败 ${errorCount} 个` };

    } catch (error) {
      const msg = (error as Error).message;
      set({ loading: { importOrders: false }, error: { importOrders: msg }, taskStatus: 'error' });
      return { success: false, message: msg };
    }
  },
  
  exportOrders: async (filterCriteria = {}, operator = 'system') => {
    try {
      set({ loading: { exportOrders: true }, error: { exportOrders: null } });
      const response = await apiService.get<{ orders: Order[]; logs?: OperationLog[] }>('/orders/export', { ...filterCriteria });
      if (response.success && response.data?.orders) {
        set((state) => {
          const updatedLogs = response.data.logs ? [...response.data.logs, ...state.operationLogs] : state.operationLogs;
          saveOperationLogsToStorage(updatedLogs);
          return {
            operationLogs: updatedLogs,
            loading: { ...state.loading, exportOrders: false }
          };
        });
        return { success: true, message: '导出成功', data: response.data.orders };
      }
      set((state) => ({ loading: { ...state.loading, exportOrders: false } }));
      return { success: false, message: '导出失败', data: [] };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('导出订单失败:', error);
      set({ loading: { exportOrders: false }, error: { exportOrders: errorMessage } });
      return { success: false, message: errorMessage, data: [] };
    }
  },

  exportSingleOrder: async (orderId: number, operator = 'user') => {
    try {
      set({ loading: { exportOrders: true }, error: { exportOrders: null } });
      const response = await apiService.get<{ orders: Order[]; logs?: OperationLog[] }>(`/orders/export/${orderId}`);
      if (response.success && response.data?.orders) {
        // 调用现有的导出工具函数
        exportToExcel(response.data.orders, `订单导出_${orderId}`);
        set((state) => {
          const updatedLogs = response.data.logs ? [...response.data.logs, ...state.operationLogs] : state.operationLogs;
          saveOperationLogsToStorage(updatedLogs);
          return {
            operationLogs: updatedLogs,
            loading: { ...state.loading, exportOrders: false }
          };
        });
        return { success: true, message: '导出成功' };
      }
      set((state) => ({ loading: { ...state.loading, exportOrders: false } }));
      return { success: false, message: '导出失败' };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('导出订单失败:', error);
      set({ loading: { exportOrders: false }, error: { exportOrders: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  updateOrderStatus: async (id, newStatus?: OrderStatus) => {
    try {
      set({ 
        loading: { updateOrderStatus: true }, 
        error: { updateOrderStatus: null },
        refreshProgress: 0,
        refreshStatus: '开始刷新物流状态...'
      });
      
      const state = get();
      const order = state.orders.find(o => o.id === Number(id));
      
      if (!order) {
        throw new Error('订单不存在');
      }
      
      set({ refreshProgress: 10, refreshStatus: '准备物流数据...' });
      
      // 1. 准备数据：提取单号、手机号和快递公司
      // 快递公司名称到代码的映射
      const carrierNameToCode: Record<string, string> = {
        '顺丰': 'shunfeng',
        '申通': 'shentong',
        '圆通': 'yuantong',
        '韵达': 'yunda',
        '韵达快运': 'ydky',
        '中通': 'zhongtong',
        '中通快运': 'zhongtongkuaiyun',
        '极兔': 'jito',
        'EMS': 'ems',
        'EMS经济': 'eyb',
        '邮政国内小包': 'youzhengguonei',
        '京东高速查': 'jdgao',
        '京东验手机': 'jdbyphone',
        '京东': 'jd',
        '百世': 'huitongkuaidi',
        '百世快运': 'baishiwuliu',
        '宅急送': 'zhaijisong',
        '全峰': 'quanfengkuaidi',
        '德邦': 'debangwuliu',
        '跨越': 'kuayue',
        '安能': 'annengwuliu',
        '安能快递': 'ane66',
        '优速': 'youshuwuliu',
        '如风达': 'rufengda',
        '国通': 'guotongkuaidi',
        '加运美': 'jiayunmeiwuliu',
        '速尔': 'suer',
        '远成': 'yuanchengwuliu',
        'UEQ': 'ueq',
        '菜鸟': 'zhimakaimen',
        '全一': 'quanyikuaidi',
        '龙邦': 'longbanwuliu',
        '信丰': 'xinfengwuliu',
        '苏宁': 'suning',
        '佳吉': 'jiajiwuliu',
        'D速': 'dsukuaidi',
        '亚风': 'yafengsudi',
        '中铁快运': 'zhongtiekuaiyun',
        '天地华宇': 'tiandihuayu',
        '丰程': 'sccod',
        '晟邦': 'nanjingshengbang',
        '递四方': 'disifang',
        '蓝天国际': 'blueskyexpress',
        '程光': 'flyway',
        '富腾达': 'ftd',
        '转运四方': 'zhuanyunsifang',
        '澳世': 'ausexpress',
        'AOL澳通': 'aolau',
        '澳邮中国快运': 'auexpress',
        'FedEx': 'fedex',
        'FedEx中文': 'fedexcn',
        'UPS': 'ups',
        '品骏': 'pjbest',
        '长江国际': 'changjiang',
        '邮政国际': 'youzhengguoji',
        '斑马物流': 'banma',
        '捷安达': 'jieanda',
        'C＆C': 'cncexp',
        '极地': 'polarexpress',
        '全速快运': 'quansu',
        '优优': 'youyou',
        '自动识别': 'auto',
        '黄马甲': 'huangmajia',
        '东骏': 'dongjun',
        '菜鸟农村': 'cnnc',
        '增益': 'zengyisudi',
        '快服务': 'kfwnet',
        '日日顺': 'rrs',
        '新邦': 'xinbangwuliu',
        '运通': 'yuntongkuaidi',
        'KJDE': 'kjde',
        'EWE': 'ewe',
        '大田': 'datianwuliu',
        '远成快运': 'ycgky',
        '易客满': 'ecmscn',
        '联昊通': 'lianhaowuliu',
        '南方传媒': 'ndwl',
        'DHL中国': 'dhl',
        'DHL国际': 'dhlen',
        'USPS': 'usps',
        '嘉里大通': 'jialidatong',
        '黑猫宅急便': 'yct',
        'EMS英文': 'emsen',
        '原飞航': 'yfh',
        '特急送': 'lntjs',
        '华企快运': 'huaqikuaiyun',
        '速通': 'sut56',
        '京广': 'jinguangsudikuaijian',
        '盛辉': 'shenghuiwuliu',
        '安迅': 'anxl',
        '香港环球快运': 'huanqiuabc',
        '远航国际': 'yuanhhk',
        '平安达腾飞': 'pingandatengfei',
        '顺心捷达': 'sxjdfreight',
        '上海同城快递': 'shpost',
        '九曳': 'jiuyescm',
        '优邦': 'ubonex',
        '澳洲飞跃': 'rlgaus',
        '山西建华': 'sxjh',
        '春风': 'spring56',
        '新配盟': 'zmkmkd',
        '迅达': 'xdexpress',
        '陆本': 'luben',
        '日昱': 'riyuwuliu',
        '欧亚专线': 'euasia',
        '澳德': 'auod',
        '商桥': 'shangqiao56',
        'TNT': 'tnt',
        '尚途国际': 'shangtu',
        '中环': 'zhonghuan',
        '壹米滴答': 'yimidida',
        'COE': 'coe',
        '风驰': 'fengchi',
        '威盛': 'wherexpess',
        '易达通': 'qexpress',
        '易达国际': 'eta100',
        '新元国际': 'xynyc',
        '一速递': 'oneexpress',
        '中翼国际': 'chnexp',
        '方舟国际': 'arkexpress',
        '卓志': 'chinaicip',
        '中通国际': 'ztog',
        '众邮': 'zhongyouex',
        '澳捷': 'ajl',
        '龙行速运': 'longcps',
        '中集冷云': 'cccc58',
        '宏递': 'hd',
        'EFS（平安快递）': 'efs',
        '三盛': 'sansheng',
        '贝海国际': 'xlobo',
        '盛丰': 'sfwl',
        '美快': 'meiquick',
        '速腾': 'suteng',
        '韵达全': 'ydquan',
        '行云': 'xyb2b',
        '海带宝': 'haidaibao',
        '汇森': 'huisenky',
        '丰网': 'fengwang',
        '三象': 'sxexpress',
        '新杰': 'sunjex',
        '科捷': 'kejie',
        '明达': 'tmwexpress',
        '海信': 'savor',
        '安得': 'annto',
        '京东全': 'jdquan',
        '哪吒': 'nezha',
        '上海同城快寄': 'shpost',
        '快捷快': 'gdkjk56',
        '宇鑫': 'yuxinwuliu',
        '联运通': 'szuem',
        '中健云康': 'concare',
        '中通冷链': 'ztocc',
        '速邮达': 'suyoda',
        '奔力': 'blex56',
        '泛球': 'fanqiu',
        '安敏': 'anmin56',
        '极速达': 'jsdky',
        '速必达': 'subida',
        '志方': 'zfex56',
        'Jingle': 'jingleexpressx',
        '德坤': 'dekuncn',
        '一站通': 'yztex',
        'OCS': 'ocs',
        '万家': 'wjwl',
        '申通非缓存': 'stonocache',
        'EMS非缓存': 'emsnocache',
        '邮速达': 'inpostysd',
        '中通非缓存': 'ztonocache',
        '无忧': 'aliexpress',
        'Aramex': 'aramex',
        '菜鸟大件': 'cndj',
        'Amazon': 'amazon',
        '华通': 'huatong',
        '云途': 'yunexpress',
        '小米': 'xiaomiwuliu',
        '京东前半程': 'jdqian',
        '融辉': 'ronghui',
        'Uniuni': 'uniuni',
        'Pig': 'piggyship',
        'RoyalMail': 'royal',
        '万邦': 'wanb',
        '快弟来了': 'kder',
        'YWE': 'ywe',
        '景光': 'jgwl',
        '安顺快运': 'anshun',
        '加拿大邮政': 'canpost',
        'UBI': 'ubi',
        'Sagawa': 'sagawa',
        '佳成': 'jiacheng',
        '日本邮政': 'japanpost',
        '华翰': 'huahanwuliu',
        '上海守务': 'shshouwu',
        '笨鸟': 'benniao',
        '奇普文': 'quipuwin',
        '意大利邮政': 'posteit',
        'EVRi': 'evri',
        'KoreaPost': 'koreapost',
        'GOFO': 'gofo',
        'SwiftX': 'swiftx',
        '顺衍': 'shunyanwl'
      };
      
      // 提取手机号
      const phone = order.details?.phone || (order as any).receiverPhone || '';
      
      // 提取快递公司
      let carrier = order.carrier_code || order.details?.carrier_code || order.carrier || order.details?.carrier || 'auto';
      if (carrier !== 'auto') {
        const normalizedCarrier = carrier.trim();
        carrier = carrierNameToCode[normalizedCarrier] || carrier;
      }
      
      // 提取快递单号
      const expressNumber = order.details?.tracking_number || 
        (order as any)['快递单号'] || (order as any).快递单号 || 
        (order as any)['物流单号'] || (order as any).物流单号 || 
        (order as any)['tracking_number'] || (order as any).tracking_number || 
        (order as any)['logistics_number'] || (order as any).logistics_number || 
        (order as any)['express_number'] || (order as any).express_number || 
        (order as any)['delivery_number'] || (order as any).delivery_number || 
        (order as any)['运单号'] || (order as any).运单号 || 
        (order as any)['kddh'] || (order as any).kddh || 
        order.details?.['快递单号'] || order.details?.快递单号 || 
        order.details?.['物流单号'] || order.details?.物流单号 || 
        order.details?.logistics_number || order.details?.express_number || 
        order.details?.delivery_number || order.details?.['运单号'] || 
        order.details?.运单号 || order.details?.kddh ||
        order.order_number;
      
      if (!expressNumber || expressNumber.toString().trim() === '') {
        throw new Error('快递单号缺失');
      }
      
      set({ refreshProgress: 20, refreshStatus: '构建物流请求...' });
      
      // 2. 构建kddhsString格式
      const tail = phone.length >= 4 ? phone.slice(-4) : '';
      const kddhsString = tail ? `${expressNumber}||${tail}` : expressNumber;
      
      set({ refreshProgress: 30, refreshStatus: '创建物流任务...' });
      
      // 3. 创建物流任务
      const createRes = await apiService.createBatchLogisticsTask({
        kdgs: carrier,
        kddhs: kddhsString,
        zffs: 'jinbi',
        isBackTaskName: 'yes'
      });
      
      console.log(`创建任务响应:`, createRes);
      
      if (!(createRes as any).success || (createRes as any).data?.code !== 1) {
        throw new Error(`创建物流任务失败: ${(createRes as any).data?.msg || (createRes as any).message || '未知错误'}`);
      }
      
      const taskName = (createRes as any).data.msg;
      console.log(`创建任务成功，任务名称: ${taskName}`);
      
      set({ refreshProgress: 40, refreshStatus: '查询物流信息...' });
      
      // 4. 轮询进度
      let logisticsResults: any[] = [];
      let retries = 0;
      const maxRetries = 240; // 最多等 40 分钟 (240次 × 10秒 = 2400秒 = 40分钟)
      let taskCompleted = false;
      let lastRequestTime = 0;
      const minRequestInterval = 10000; // 最小请求间隔，单位：毫秒
      
      while (retries < maxRetries) {
        try {
          // 计算距离上次请求的时间间隔
          const now = Date.now();
          const timeSinceLastRequest = now - lastRequestTime;
          
          // 如果距离上次请求的时间间隔小于最小请求间隔，等待到最小请求间隔
          if (timeSinceLastRequest < minRequestInterval) {
            const waitTime = minRequestInterval - timeSinceLastRequest;
            console.log(`距离上次请求时间过短，等待 ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          // 记录本次请求的时间
          lastRequestTime = Date.now();
          
          // 支持分页查询
          let currentPage = 1;
          let totalPages = 1;
          let requestRejected = false;
          
          do {
            const selectRes = await apiService.getBatchLogisticsResult({
              taskname: taskName,
              pageno: currentPage
            });

            console.log(`轮询第 ${retries} 次，页码 ${currentPage} 响应:`, selectRes);
            
            // 检查是否是请求被驳回的错误
            const isMsgString = typeof (selectRes as any).data?.msg === 'string';
            const isMessageString = typeof (selectRes as any).message === 'string';
            const isRequestRejected = (isMsgString && (selectRes as any).data?.msg.includes('此任务刚刚select过一次，故本次请求被驳回')) || 
                                     (isMessageString && (selectRes as any).message.includes('此任务刚刚select过一次，故本次请求被驳回'));
            
            if (isRequestRejected) {
              // 处理请求被驳回错误，增加重试间隔
              console.warn(`请求被驳回，增加重试间隔 (第${retries}次重试)`);
              // 使用指数退避策略，每次收到驳回响应时，将重试间隔翻倍
              const backoffInterval = Math.min(2000 * Math.pow(2, retries), 60000); // 最大60秒
              console.log(`使用指数退避策略，重试间隔: ${backoffInterval}ms`);
              await new Promise(resolve => setTimeout(resolve, backoffInterval));
              // 标记请求被驳回，跳过当前do-while循环的剩余迭代
              requestRejected = true;
              break;
            } else if ((selectRes as any).success) {
              if ((selectRes as any).data?.code === 1) {
                const { jindu, totalpage, list } = (selectRes as any).data.msg;
                console.log(`轮询第 ${retries} 次，进度 ${jindu}%，数据条数 ${list?.length || 0}`);
                
                // 更新进度
                const currentProgress = 40 + (jindu * 50 / 100); // 40-90%
                set({ refreshProgress: Math.floor(currentProgress), refreshStatus: `查询物流信息... ${jindu}%` });

                if (list && list.length > 0) {
                  console.log(`获取到物流信息:`, list.map(l => l.kddh));
                  console.log(`物流信息详情:`, list);
                  // 避免重复添加物流信息
                  const newResults = list.filter((item: any) => 
                    !logisticsResults.some((existing: any) => existing.kddh === item.kddh)
                  );
                  logisticsResults = [...logisticsResults, ...newResults];
                  console.log(`当前累计物流信息: ${logisticsResults.length}条`);
                  console.log(`累计物流信息详情:`, logisticsResults);
                }

                totalPages = totalpage || 1;
                currentPage++;

                if (jindu === 100) {
                  console.log(`任务完成，进度 100%`);
                  taskCompleted = true;
                  break;
                }
              } else {
                const errorMsg = `轮询失败: ${(selectRes as any).data?.msg || '未知错误'}`;
                console.error(errorMsg);
                throw new Error(errorMsg);
              }
            } else {
              const errorMsg = `轮询请求失败: ${(selectRes as any).message || '网络错误'}`;
              console.error(errorMsg);
              throw new Error(errorMsg);
            }
          } while (currentPage <= totalPages && !requestRejected);
          
          retries++;
          
          if (taskCompleted) {
            break;
          }
        } catch (pollingError) {
          const errorMessage = (pollingError as Error).message;
          console.error(`轮询物流信息失败:`, errorMessage);
          retries++;
          
          // 使用指数退避策略，每次轮询失败时，将重试间隔翻倍
          const backoffInterval = Math.min(2000 * Math.pow(2, retries), 60000); // 最大60秒
          console.log(`使用指数退避策略，重试间隔: ${backoffInterval}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffInterval));
        }
      }
      
      if (logisticsResults.length === 0) {
        throw new Error('未获取到物流信息');
      }
      
      set({ refreshProgress: 90, refreshStatus: '更新订单状态...' });
      
      // 5. 处理物流结果并更新订单状态
      const logisticsInfo = logisticsResults[0]; // 只处理第一个结果，因为是单个订单
      
      console.log('物流信息详情:', logisticsInfo);
      console.log('物流状态字段:', logisticsInfo.wuliuzhuangtai);
      console.log('物流状态包含异常:', logisticsInfo.wuliuzhuangtai.includes('异常'));
      console.log('物流状态包含异常件:', logisticsInfo.wuliuzhuangtai.includes('异常件'));
      
      // 解析物流轨迹信息
      const timeline = [];
      let isDelivered = false;
      if (logisticsInfo.xiangxiwuliu) {
        const logisticsLines = logisticsInfo.xiangxiwuliu.split('<br>');
        for (const line of logisticsLines) {
          const timeMatch = line.match(/<i>([^<]+)<\/i>\s*\|\s*(.+)/);
          if (timeMatch) {
            const [, timeStr, description] = timeMatch;
            const trimmedDescription = description.trim();
            const trimmedTimeStr = timeStr.trim();
            
            try {
              const parsedDate = new Date(trimmedTimeStr);
              const timestamp = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
              
              timeline.push({
                timestamp: timestamp,
                description: trimmedDescription,
                location: '未知地点'
              });
              
              if (trimmedDescription.includes('签收') || trimmedDescription.includes('取出') || trimmedDescription.includes('包裹已从代收点取出') || trimmedDescription.includes('包裹已送至') || trimmedDescription.includes('已从代收点取出')) {
                isDelivered = true;
              }
            } catch (dateError) {
              console.warn('解析物流时间失败:', trimmedTimeStr, dateError);
            }
          }
        }
      }
      
      // 使用新的物流信息覆盖原来的物流信息
      const updatedOrder = {
        ...order,
        // 明确指定客户名称，确保它被包含在updatedOrder对象中
        customer_name: order.customer_name || '',
        details: {
          ...order.details,
          timeline: timeline,
          tracking_number: logisticsInfo.kddh,
          carrier: logisticsInfo.kdgs
        },
        carrier: logisticsInfo.kdgs,
        status: isDelivered || logisticsInfo.wuliuzhuangtai.includes('签收') || logisticsInfo.wuliuzhuangtai.includes('取出') || logisticsInfo.wuliuzhuangtai.includes('包裹已从代收点取出') || logisticsInfo.wuliuzhuangtai.includes('包裹已送至') ? OrderStatus.DELIVERED :
                logisticsInfo.wuliuzhuangtai.includes('退回') ? OrderStatus.RETURNED :
                logisticsInfo.wuliuzhuangtai.includes('异常') || logisticsInfo.wuliuzhuangtai.includes('问题') || logisticsInfo.wuliuzhuangtai.includes('失败') || logisticsInfo.wuliuzhuangtai.includes('派送不成功') || logisticsInfo.wuliuzhuangtai.includes('未妥投') || logisticsInfo.wuliuzhuangtai.includes('反签收') || logisticsInfo.wuliuzhuangtai.includes('拒签') || logisticsInfo.wuliuzhuangtai.includes('退件') || logisticsInfo.wuliuzhuangtai.includes('无法') || logisticsInfo.wuliuzhuangtai.includes('未通过') || logisticsInfo.wuliuzhuangtai.includes('异常件') || logisticsInfo.wuliuzhuangtai.includes('拒收') || logisticsInfo.wuliuzhuangtai.includes('待进一步处理') || logisticsInfo.wuliuzhuangtai.includes('问题件') || logisticsInfo.wuliuzhuangtai.includes('转寄更改单') || logisticsInfo.wuliuzhuangtai.includes('退货') || logisticsInfo.wuliuzhuangtai.includes('无法正常派送') ? OrderStatus.EXCEPTION :
                logisticsInfo.wuliuzhuangtai.includes('运输') ? OrderStatus.IN_TRANSIT :
                logisticsInfo.wuliuzhuangtai.includes('无物流') ? OrderStatus.PENDING : OrderStatus.PENDING,
        updated_at: new Date().toISOString()
      };
      
      // 更新订单状态
      set((state) => ({
        orders: state.orders.map(o => o.id === Number(id) ? updatedOrder : o),
        loading: { ...state.loading, updateOrderStatus: false },
        refreshProgress: 100,
        refreshStatus: '刷新完成'
      }));
      
      // 保存更新后的订单到后端
      try {
        // 定义常量
        const CUSTOMER_NAME_FIELD = 'customer_name';
        const RECIPIENT_FIELD = 'recipient';
        
        console.log('保存更新后的订单到后端:', updatedOrder);
        console.log('保存订单，客户名称:', order.details?.[RECIPIENT_FIELD] || order[CUSTOMER_NAME_FIELD]);
        
        // 构建后端期望的订单格式，只包含后端DTO中定义的字段
        const orderToSave = {
          order_number: updatedOrder.order_number,
          customer_name: order.customer_name || '',
          department_key: updatedOrder.department_key || 'EAST',
          carrier: updatedOrder.details?.carrier || updatedOrder.carrier || '',
          carrier_code: updatedOrder.carrier_code || updatedOrder.details?.carrier_code || '',
          receiverPhone: updatedOrder.details?.phone || '',
          status: updatedOrder.status,
          details: {
            order_date: order.details?.order_date,
            destination: order.details?.destination,
            planned_ship_date: order.details?.planned_ship_date,
            carrier: updatedOrder.details?.carrier,
            product_info: order.details?.product_info,
            phone: order.details?.phone,
            note: order.details?.note,
            timeline: updatedOrder.details?.timeline,
            tracking_number: updatedOrder.details?.tracking_number,
            // 确保收货人名称也被保存
            recipient: order.details?.[RECIPIENT_FIELD] || ''
          }
        };
        
        // 调用后端API保存订单
        await apiService.put(`/orders/${id}`, orderToSave);
        console.log('订单保存成功');
        
        // 重新获取所有订单，确保本地状态与后端同步
        await get().fetchAllOrders();
        console.log('重新获取订单成功');
      } catch (error) {
        console.error('保存订单到后端失败:', error);
        // 保存失败不影响用户体验，仍然返回成功
      }
      
      // 3秒后清除刷新状态
      setTimeout(() => {
        set({ refreshStatus: null, refreshProgress: 0 });
      }, 3000);
      
      return { success: true, message: '物流状态已更新', data: { order: updatedOrder } };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('更新订单状态失败:', errorMessage);
      set({ 
        loading: { updateOrderStatus: false }, 
        error: { updateOrderStatus: errorMessage },
        refreshProgress: 100,
        refreshStatus: `刷新失败: ${errorMessage}`
      });
      
      // 3秒后清除刷新状态
      setTimeout(() => {
        set({ refreshStatus: null, refreshProgress: 0 });
      }, 3000);
      
      return { success: false, message: errorMessage };
    }
  },

  refreshAllTracking: async () => {
    try {
      set({ loading: { refreshAllTracking: true }, error: { refreshAllTracking: null }, taskProgress: 0, taskStatus: 'creating' });
      
      const state = get();
      const activeOrders = state.orders.filter(o => !o.is_archived);
      
      // 1. 准备数据：提取单号、手机号和快递公司，按快递公司分组
      // 格式：单号1||手机尾号1,单号2||手机尾号2,...
      
      // 快递公司名称到代码的映射
      const carrierNameToCode: Record<string, string> = {
        '顺丰': 'shunfeng',
        '申通': 'shentong',
        '圆通': 'yuantong',
        '韵达': 'yunda',
        '韵达快运': 'ydky',
        '中通': 'zhongtong',
        '中通快运': 'zhongtongkuaiyun',
        '极兔': 'jito',
        'EMS': 'ems',
        'EMS经济': 'eyb',
        '邮政国内小包': 'youzhengguonei',
        '京东高速查': 'jdgao',
        '京东验手机': 'jdbyphone',
        '京东': 'jd',
        '百世': 'huitongkuaidi',
        '百世快运': 'baishiwuliu',
        '宅急送': 'zhaijisong',
        '全峰': 'quanfengkuaidi',
        '德邦': 'debangwuliu',
        '跨越': 'kuayue',
        '安能': 'annengwuliu',
        '安能快递': 'ane66',
        '优速': 'youshuwuliu',
        '如风达': 'rufengda',
        '国通': 'guotongkuaidi',
        '加运美': 'jiayunmeiwuliu',
        '速尔': 'suer',
        '远成': 'yuanchengwuliu',
        'UEQ': 'ueq',
        '菜鸟': 'zhimakaimen',
        '全一': 'quanyikuaidi',
        '龙邦': 'longbanwuliu',
        '信丰': 'xinfengwuliu',
        '苏宁': 'suning',
        '佳吉': 'jiajiwuliu',
        'D速': 'dsukuaidi',
        '亚风': 'yafengsudi',
        '中铁快运': 'zhongtiekuaiyun',
        '天地华宇': 'tiandihuayu',
        '丰程': 'sccod',
        '晟邦': 'nanjingshengbang',
        '递四方': 'disifang',
        '蓝天国际': 'blueskyexpress',
        '程光': 'flyway',
        '富腾达': 'ftd',
        '转运四方': 'zhuanyunsifang',
        '澳世': 'ausexpress',
        'AOL澳通': 'aolau',
        '澳邮中国快运': 'auexpress',
        'FedEx': 'fedex',
        'FedEx中文': 'fedexcn',
        'UPS': 'ups',
        '品骏': 'pjbest',
        '长江国际': 'changjiang',
        '邮政国际': 'youzhengguoji',
        '斑马物流': 'banma',
        '捷安达': 'jieanda',
        'C＆C': 'cncexp',
        '极地': 'polarexpress',
        '全速快运': 'quansu',
        '优优': 'youyou',
        '自动识别': 'auto',
        '黄马甲': 'huangmajia',
        '东骏': 'dongjun',
        '菜鸟农村': 'cnnc',
        '增益': 'zengyisudi',
        '快服务': 'kfwnet',
        '日日顺': 'rrs',
        '新邦': 'xinbangwuliu',
        '运通': 'yuntongkuaidi',
        'KJDE': 'kjde',
        'EWE': 'ewe',
        '大田': 'datianwuliu',
        '远成快运': 'ycgky',
        '易客满': 'ecmscn',
        '联昊通': 'lianhaowuliu',
        '南方传媒': 'ndwl',
        'DHL中国': 'dhl',
        'DHL国际': 'dhlen',
        'USPS': 'usps',
        '嘉里大通': 'jialidatong',
        '黑猫宅急便': 'yct',
        'EMS英文': 'emsen',
        '原飞航': 'yfh',
        '特急送': 'lntjs',
        '华企快运': 'huaqikuaiyun',
        '速通': 'sut56',
        '京广': 'jinguangsudikuaijian',
        '盛辉': 'shenghuiwuliu',
        '安迅': 'anxl',
        '香港环球快运': 'huanqiuabc',
        '远航国际': 'yuanhhk',
        '平安达腾飞': 'pingandatengfei',
        '顺心捷达': 'sxjdfreight',
        '上海同城快递': 'shpost',
        '九曳': 'jiuyescm',
        '优邦': 'ubonex',
        '澳洲飞跃': 'rlgaus',
        '山西建华': 'sxjh',
        '春风': 'spring56',
        '新配盟': 'zmkmkd',
        '迅达': 'xdexpress',
        '陆本': 'luben',
        '日昱': 'riyuwuliu',
        '欧亚专线': 'euasia',
        '澳德': 'auod',
        '商桥': 'shangqiao56',
        'TNT': 'tnt',
        '尚途国际': 'shangtu',
        '中环': 'zhonghuan',
        '壹米滴答': 'yimidida',
        'COE': 'coe',
        '风驰': 'fengchi',
        '威盛': 'wherexpess',
        '易达通': 'qexpress',
        '易达国际': 'eta100',
        '新元国际': 'xynyc',
        '一速递': 'oneexpress',
        '中翼国际': 'chnexp',
        '方舟国际': 'arkexpress',
        '卓志': 'chinaicip',
        '中通国际': 'ztog',
        '众邮': 'zhongyouex',
        '澳捷': 'ajl',
        '龙行速运': 'longcps',
        '中集冷云': 'cccc58',
        '宏递': 'hd',
        'EFS（平安快递）': 'efs',
        '三盛': 'sansheng',
        '贝海国际': 'xlobo',
        '盛丰': 'sfwl',
        '美快': 'meiquick',
        '速腾': 'suteng',
        '韵达全': 'ydquan',
        '行云': 'xyb2b',
        '海带宝': 'haidaibao',
        '汇森': 'huisenky',
        '丰网': 'fengwang',
        '三象': 'sxexpress',
        '新杰': 'sunjex',
        '科捷': 'kejie',
        '明达': 'tmwexpress',
        '海信': 'savor',
        '安得': 'annto',
        '京东全': 'jdquan',
        '哪吒': 'nezha',
        '上海同城快寄': 'shpost',
        '快捷快': 'gdkjk56',
        '宇鑫': 'yuxinwuliu',
        '联运通': 'szuem',
        '中健云康': 'concare',
        '中通冷链': 'ztocc',
        '速邮达': 'suyoda',
        '奔力': 'blex56',
        '泛球': 'fanqiu',
        '安敏': 'anmin56',
        '极速达': 'jsdky',
        '速必达': 'subida',
        '志方': 'zfex56',
        'Jingle': 'jingleexpressx',
        '德坤': 'dekuncn',
        '一站通': 'yztex',
        'OCS': 'ocs',
        '万家': 'wjwl',
        '申通非缓存': 'stonocache',
        'EMS非缓存': 'emsnocache',
        '邮速达': 'inpostysd',
        '中通非缓存': 'ztonocache',
        '无忧': 'aliexpress',
        'Aramex': 'aramex',
        '菜鸟大件': 'cndj',
        'Amazon': 'amazon',
        '华通': 'huatong',
        '云途': 'yunexpress',
        '小米': 'xiaomiwuliu',
        '京东前半程': 'jdqian',
        '融辉': 'ronghui',
        'Uniuni': 'uniuni',
        'Pig': 'piggyship',
        'RoyalMail': 'royal',
        '万邦': 'wanb',
        '快弟来了': 'kder',
        'YWE': 'ywe',
        '景光': 'jgwl',
        '安顺快运': 'anshun',
        '加拿大邮政': 'canpost',
        'UBI': 'ubi',
        'Sagawa': 'sagawa',
        '佳成': 'jiacheng',
        '日本邮政': 'japanpost',
        '华翰': 'huahanwuliu',
        '上海守务': 'shshouwu',
        '笨鸟': 'benniao',
        '奇普文': 'quipuwin',
        '意大利邮政': 'posteit',
        'EVRi': 'evri',
        'KoreaPost': 'koreapost',
        'GOFO': 'gofo',
        'SwiftX': 'swiftx',
        '顺衍': 'shunyanwl'
      };
      
      const ordersByCarrier: Record<string, Array<{ order_number: string; phone: string; order: any }>> = {};
      
      // 初始化错误数组
      let allErrors: string[] = [];
      
      // 按快递公司分组订单
      activeOrders.forEach(o => {
        const phone = o.details?.phone ? String(o.details.phone).trim() : '';
        // 从订单数据中提取快递公司信息
        let carrier = o.details?.carrier || o.carrier || (o as any).express_company || 'auto';
        
        // 转换快递公司名称为代码
        if (carrier !== 'auto') {
          const normalizedCarrier = carrier.trim();
          carrier = carrierNameToCode[normalizedCarrier] || carrier;
        }
        
        // 从多个可能的字段中获取快递单号
        const expressNumber = o.details?.tracking_number || 
          (o as any)['快递单号'] || (o as any).快递单号 || 
          (o as any)['物流单号'] || (o as any).物流单号 || 
          (o as any)['tracking_number'] || (o as any).tracking_number || 
          (o as any)['logistics_number'] || (o as any).logistics_number || 
          (o as any)['express_number'] || (o as any).express_number || 
          (o as any)['delivery_number'] || (o as any).delivery_number || 
          (o as any)['运单号'] || (o as any).运单号 || 
          (o as any)['kddh'] || (o as any).kddh || 
          o.details?.['快递单号'] || o.details?.快递单号 || 
          o.details?.['物流单号'] || o.details?.物流单号 || 
          o.details?.logistics_number || o.details?.express_number || 
          o.details?.delivery_number || o.details?.['运单号'] || 
          o.details?.运单号 || o.details?.kddh ||
          o.order_number;
        
        // 只有在快递单号存在且有效的情况下才添加到分组
        if (expressNumber && expressNumber.toString().trim() !== '') {
          if (!ordersByCarrier[carrier]) {
            ordersByCarrier[carrier] = [];
          }
          
          ordersByCarrier[carrier].push({ order_number: expressNumber, phone, order: o });
        } else {
          console.warn(`订单缺少有效快递单号，跳过处理:`, o);
          allErrors.push(`订单 ${o.order_number} 缺少有效快递单号，跳过处理`);
        }
      });
      
      // 为每个快递公司创建一个任务
      const tasks = [];
      for (const [carrier, orders] of Object.entries(ordersByCarrier)) {
        const kddhList = orders.map(o => {
          const tail = o.phone.length >= 4 ? o.phone.slice(-4) : '';
          return tail ? `${o.order_number}||${tail}` : o.order_number;
        });
        
        const kddhsString = kddhList.join(',');
        tasks.push({ carrier, kddhsString, orders });
      }

      // 2. 为每个快递公司创建任务并查询物流信息
      let allLogisticsResults: any[] = [];
      let totalTasks = tasks.length;
      let completedTasks = 0;
      
      console.log('=== 开始处理批量刷新订单 ===');
      console.log(`总订单数: ${activeOrders.length}`);
      console.log(`快递公司分组: ${Object.keys(ordersByCarrier).length} 个`);
      console.log(`分组详情:`, Object.entries(ordersByCarrier).map(([k, v]) => `${k}: ${v.length}个订单`));
      
      for (const task of tasks) {
        const { carrier, kddhsString, orders } = task;
        
        try {
          console.log(`=== 开始处理快递公司 ${carrier} 的订单 ===`);
          console.log(`订单数: ${orders.length}`);
          console.log(`订单号和手机号:`, orders.map(o => `${o.order_number}||${o.phone.slice(-4)}`));
          
          // 创建任务
          const createRes = await apiService.createBatchLogisticsTask({
            kdgs: carrier,
            kddhs: kddhsString,
            zffs: 'jinbi',
            isBackTaskName: 'yes'
          });

          console.log(`创建任务响应:`, createRes);
          
          if (!(createRes as any).success || (createRes as any).data?.code !== 1) {
            const errorMsg = `为快递公司 ${carrier} 创建任务失败: ${(createRes as any).data?.msg || (createRes as any).message || '未知错误'}`;
            console.error(errorMsg);
            allErrors.push(errorMsg);
            completedTasks++;
            continue;
          }

          const taskName = (createRes as any).data.msg;
          console.log(`创建任务成功，任务名称: ${taskName}`);
          set({ taskStatus: 'polling', taskProgress: Math.floor((completedTasks / totalTasks) * 100) });

          // 轮询进度
          let logisticsResults: any[] = [];
          let retries = 0;
          const maxRetries = 240; // 最多等 40 分钟 (240次 × 10秒 = 2400秒 = 40分钟)
          let taskCompleted = false;
          let lastRequestTime = 0;
          const minRequestInterval = 10000; // 最小请求间隔，单位：毫秒

          while (retries < maxRetries) {
            try {
              // 计算距离上次请求的时间间隔
              const now = Date.now();
              const timeSinceLastRequest = now - lastRequestTime;
              
              // 如果距离上次请求的时间间隔小于最小请求间隔，等待到最小请求间隔
              if (timeSinceLastRequest < minRequestInterval) {
                const waitTime = minRequestInterval - timeSinceLastRequest;
                console.log(`距离上次请求时间过短，等待 ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
              
              // 记录本次请求的时间
              lastRequestTime = Date.now();
              
              // 支持分页查询，处理最多800条订单
              let currentPage = 1;
              let totalPages = 1;
              let requestRejected = false;
              
              do {
                const selectRes = await apiService.getBatchLogisticsResult({
                  taskname: taskName,
                  pageno: currentPage
                });

                console.log(`轮询第 ${retries} 次，页码 ${currentPage} 响应:`, selectRes);
                
                // 检查是否是请求被驳回的错误
                const isMsgString = typeof (selectRes as any).data?.msg === 'string';
                const isMessageString = typeof (selectRes as any).message === 'string';
                const isRequestRejected = (isMsgString && (selectRes as any).data?.msg.includes('此任务刚刚select过一次，故本次请求被驳回')) || 
                                         (isMessageString && (selectRes as any).message.includes('此任务刚刚select过一次，故本次请求被驳回'));
                
                if (isRequestRejected) {
                  // 处理请求被驳回错误，增加重试间隔
                  console.warn(`请求被驳回，增加重试间隔 (第${retries}次重试)`);
                  // 使用指数退避策略，每次收到驳回响应时，将重试间隔翻倍
                  const backoffInterval = Math.min(2000 * Math.pow(2, retries), 60000); // 最大60秒
                  console.log(`使用指数退避策略，重试间隔: ${backoffInterval}ms`);
                  await new Promise(resolve => setTimeout(resolve, backoffInterval));
                  // 标记请求被驳回，跳过当前do-while循环的剩余迭代
                  requestRejected = true;
                  break;
                } else if ((selectRes as any).success) {
                  if ((selectRes as any).data?.code === 1) {
                    const { jindu, totalpage, list } = (selectRes as any).data.msg;
                    console.log(`轮询第 ${retries} 次，进度 ${jindu}%，数据条数 ${list?.length || 0}`);
                    set({ taskProgress: Math.floor((completedTasks / totalTasks) * 100 + (jindu / totalTasks) * 100) }); // 更新进度条

                    if (list && list.length > 0) {
                      console.log(`获取到物流信息:`, list.map(l => l.kddh));
                      // 避免重复添加物流信息
                      const newResults = list.filter((item: any) => 
                        !logisticsResults.some((existing: any) => existing.kddh === item.kddh)
                      );
                      logisticsResults = [...logisticsResults, ...newResults];
                      console.log(`当前累计物流信息: ${logisticsResults.length}条`);
                    }

                    totalPages = totalpage || 1;
                    currentPage++;

                    if (jindu === 100) {
                      console.log(`任务完成，进度 100%`);
                      taskCompleted = true;
                      break;
                    }
                  } else {
                    const errorMsg = `轮询失败: ${(selectRes as any).data?.msg || '未知错误'}`;
                    console.error(errorMsg);
                    allErrors.push(errorMsg);
                  }
                } else {
                  const errorMsg = `轮询失败: ${(selectRes as any).message || '未知错误'}`;
                  console.error(errorMsg);
                  allErrors.push(errorMsg);
                }
              } while (currentPage <= totalPages && !requestRejected);
              
              retries++;
              
              if (taskCompleted) {
                break;
              }
            } catch (pollingError) {
              const errorMessage = (pollingError as Error).message;
              console.error(`轮询物流信息失败:`, errorMessage);
              allErrors.push(`轮询物流信息失败: ${errorMessage}`);
              retries++;
              
              // 使用指数退避策略，每次轮询失败时，将重试间隔翻倍
              const backoffInterval = Math.min(2000 * Math.pow(2, retries), 60000); // 最大60秒
              console.log(`使用指数退避策略，重试间隔: ${backoffInterval}ms`);
              await new Promise(resolve => setTimeout(resolve, backoffInterval));
            }
          }
          
          // 处理物流结果
          if (logisticsResults.length > 0) {
            console.log(`处理 ${logisticsResults.length} 条物流信息`);
            allLogisticsResults = [...allLogisticsResults, ...logisticsResults];
            
            // 更新订单状态和物流信息
            const updatedOrders = state.orders.map(order => {
              const trackingNumber = order.details?.tracking_number || order.order_number;
              const logisticsInfo = logisticsResults.find(l => l.kddh === trackingNumber);
              
              if (logisticsInfo) {
                const timeline = [];
                let isDelivered = false;
                if (logisticsInfo.xiangxiwuliu) {
                  const logisticsLines = logisticsInfo.xiangxiwuliu.split('<br>');
                  for (const line of logisticsLines) {
                    const timeMatch = line.match(/<i>([^<]+)<\/i>\s*\|\s*(.+)/);
                    if (timeMatch) {
                      const [, timeStr, description] = timeMatch;
                      const trimmedDescription = description.trim();
                      const trimmedTimeStr = timeStr.trim();
                      
                      try {
                        const parsedDate = new Date(trimmedTimeStr);
                        const timestamp = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
                        
                        timeline.push({
                          timestamp: timestamp,
                          description: trimmedDescription,
                          location: '未知地点'
                        });
                        
                        if (trimmedDescription.includes('签收') || trimmedDescription.includes('取出') || trimmedDescription.includes('包裹已从代收点取出') || trimmedDescription.includes('包裹已送至') || trimmedDescription.includes('已从代收点取出')) {
                          isDelivered = true;
                        }
                      } catch (dateError) {
                        console.warn('解析物流时间失败:', trimmedTimeStr, dateError);
                      }
                    }
                  }
                }
            
            return {
              ...order,
              details: {
                ...order.details,
                timeline: timeline,
                tracking_number: logisticsInfo.kddh,
                carrier: logisticsInfo.kdgs
              },
              carrier: logisticsInfo.kdgs,
              status: isDelivered || logisticsInfo.wuliuzhuangtai.includes('签收') || logisticsInfo.wuliuzhuangtai.includes('取出') || logisticsInfo.wuliuzhuangtai.includes('包裹已从代收点取出') || logisticsInfo.wuliuzhuangtai.includes('包裹已送至') ? OrderStatus.DELIVERED :
                      logisticsInfo.wuliuzhuangtai.includes('退回') ? OrderStatus.RETURNED :
                      logisticsInfo.wuliuzhuangtai.includes('运输') ? OrderStatus.IN_TRANSIT :
                      logisticsInfo.wuliuzhuangtai.includes('无物流') ? OrderStatus.PENDING : OrderStatus.PENDING,
              updated_at: new Date().toISOString()
            };
              }
              return order;
            });
            
            set({ orders: updatedOrders });
            
            // 保存更新后的订单到后端
            try {
              // 定义常量
              const CUSTOMER_NAME_FIELD = 'customer_name';
              const RECIPIENT_FIELD = 'recipient';
              
              console.log('保存批量更新的订单到后端');
              for (const updatedOrder of updatedOrders) {
                const originalOrder = state.orders.find(o => o.id === updatedOrder.id);
                if (originalOrder && updatedOrder.details?.timeline && updatedOrder.details.timeline.length > 0) {
                  console.log('保存订单，客户名称:', originalOrder.details?.[RECIPIENT_FIELD] || originalOrder[CUSTOMER_NAME_FIELD]);
                  
                  // 构建后端期望的订单格式，只包含后端DTO中定义的字段
                  const orderToSave = {
                    order_number: updatedOrder.order_number,
                    customer_name: originalOrder.customer_name || '',
                    department_key: updatedOrder.department_key || 'EAST',
                    carrier: updatedOrder.details?.carrier || updatedOrder.carrier || '',
                    carrier_code: updatedOrder.carrier_code || updatedOrder.details?.carrier_code || '',
                    receiverPhone: updatedOrder.details?.phone || '',
                    status: updatedOrder.status,
                    details: {
                      order_date: originalOrder.details?.order_date,
                      destination: originalOrder.details?.destination,
                      planned_ship_date: originalOrder.details?.planned_ship_date,
                      carrier: updatedOrder.details?.carrier,
                      product_info: originalOrder.details?.product_info,
                      phone: originalOrder.details?.phone,
                      note: originalOrder.details?.note,
                      timeline: updatedOrder.details?.timeline,
                      tracking_number: updatedOrder.details?.tracking_number,
                      // 确保收货人名称也被保存
                      recipient: originalOrder.details?.[RECIPIENT_FIELD] || ''
                    }
                  };
                  
                  await apiService.put(`/orders/${updatedOrder.id}`, orderToSave);
                  console.log(`订单 ${updatedOrder.id} 保存成功`);
                }
              }
              
              await get().fetchAllOrders();
              console.log('批量更新订单保存成功并重新获取订单');
            } catch (error) {
              console.error('保存批量更新的订单到后端失败:', error);
            }
          }
          
          completedTasks++;
          set({ taskProgress: Math.floor((completedTasks / totalTasks) * 100) });
        } catch (error) {
          const errorMessage = (error as Error).message;
          console.error(`处理快递公司 ${carrier} 的订单失败:`, errorMessage);
          allErrors.push(`处理快递公司 ${carrier} 的订单失败: ${errorMessage}`);
          completedTasks++;
          set({ taskProgress: Math.floor((completedTasks / totalTasks) * 100) });
        }
      }
      
      set({ 
        loading: { refreshAllTracking: false }, 
        taskStatus: 'completed',
        taskProgress: 100
      });
      
      if (allErrors.length > 0) {
        console.error('批量刷新过程中出现错误:', allErrors);
        return { success: false, message: `刷新完成，但有 ${allErrors.length} 个错误`, data: { errors: allErrors, results: allLogisticsResults } };
      } else {
        return { success: true, message: `成功刷新 ${allLogisticsResults.length} 条物流信息`, data: { results: allLogisticsResults } };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('批量刷新物流信息失败:', errorMessage);
      set({ loading: { refreshAllTracking: false }, error: { refreshAllTracking: errorMessage }, taskStatus: 'error' });
      return { success: false, message: errorMessage };
    }
  },
  
  // 辅助方法：根据物流状态计算订单状态
  calculateOrderStatusFromLogistics: (logisticsStatus: string): OrderStatus => {
    const statusLower = logisticsStatus.toLowerCase();
    if (statusLower.includes('签收') || statusLower.includes('已送达') || statusLower.includes('delivered')) {
      return OrderStatus.DELIVERED;
    } else if (statusLower.includes('退回') || statusLower.includes('returned')) {
      return OrderStatus.RETURNED;
    } else if (statusLower.includes('运输') || statusLower.includes('派送') || statusLower.includes('transit') || statusLower.includes('shipping')) {
      return OrderStatus.IN_TRANSIT;
    } else if (statusLower.includes('无物流') || statusLower.includes('疑似无物流') || statusLower.includes('待查询')) {
      return OrderStatus.PENDING;
    } else {
      return OrderStatus.PENDING;
    }
  },
  
  addOperationLog: (log) => set((state) => {
    const updatedLogs = [log, ...state.operationLogs];
    saveOperationLogsToStorage(updatedLogs);
    return { operationLogs: updatedLogs };
  }),
  
  calculateWarningStatus: async (order): Promise<WarningStatus> => {
    try {
      const response = await apiService.post<WarningStatusApiResponse>('/orders/calculate-warning', { order });
      return response.success && response.data ? response.data.warningStatus : WarningStatus.NONE;
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('计算预警状态失败:', errorMessage);
      return WarningStatus.NONE;
    }
  },
  
  updateAllWarningStatuses: async () => {
    try {
      set({ loading: { updateAllWarningStatuses: true }, error: { updateAllWarningStatuses: null } });
      const response = await apiService.post<UpdatedWarningsApiResponse>('/orders/update-all-warnings');
      if (response.success && response.data) {
        set((state) => {
          const updatedLogs = response.data.logs ? [...response.data.logs, ...state.operationLogs] : state.operationLogs;
          saveOperationLogsToStorage(updatedLogs);
          return {
            orders: response.data.updatedOrders,
            operationLogs: updatedLogs,
            loading: { ...state.loading, updateAllWarningStatuses: false }
          };
        });
      } else {
        set((state) => ({ loading: { ...state.loading, updateAllWarningStatuses: false } }));
      }
      return { success: response.success, message: response.message || '批量更新预警状态成功', data: response.data };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('批量更新预警状态失败:', errorMessage);
      set({ loading: { updateAllWarningStatuses: false }, error: { updateAllWarningStatuses: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  // 用户相关操作
  fetchAllUsers: async () => {
    try {
      set({ loading: { fetchAllUsers: true }, error: { fetchAllUsers: null } });
      const response = await apiService.getAllUsers();
      if (response.success && response.data?.users) {
        set((state) => ({
          users: response.data.users,
          loading: { ...state.loading, fetchAllUsers: false },
          error: { ...state.error, fetchAllUsers: null }
        }));
        return { success: true, message: '获取用户列表成功' };
      } else {
        set({ loading: { fetchAllUsers: false }, error: { fetchAllUsers: '获取失败' } });
        return { success: false, message: '获取失败' };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('获取用户列表失败:', errorMessage);
      set({ loading: { fetchAllUsers: false }, error: { fetchAllUsers: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  // 获取操作日志
  fetchOperationLogs: async () => {
    try {
      set({ loading: { fetchOperationLogs: true }, error: { fetchOperationLogs: null } });
      const response = await apiService.get('/operation-logs');
      if (response.success) {
        // 确保我们使用的是正确的日志数据格式
        // 后端返回的格式：{ success: true, data: { logs: [], pagination: {} } }
        const logs = (response as any)?.data?.logs || [];
        set((state) => {
          saveOperationLogsToStorage(logs);
          return {
            operationLogs: logs, // 使用后端返回的日志数据
            loading: { ...state.loading, fetchOperationLogs: false },
            error: { ...state.error, fetchOperationLogs: null }
          };
        });
        return { success: true, message: '获取操作日志成功' };
      } else {
        set({ loading: { fetchOperationLogs: false }, error: { fetchOperationLogs: response.message || '获取失败' } });
        return { success: false, message: response.message || '获取失败' };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('获取操作日志失败:', errorMessage);
      set({ loading: { fetchOperationLogs: false }, error: { fetchOperationLogs: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  createUser: async (userData: any) => {
    try {
      set({ loading: { createUser: true }, error: { createUser: null } });
      const response = await apiService.createUser(userData);
      if (response.success && response.data?.user) {
        set((state) => {
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id || 0,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.CREATE,
            target_type: TargetType.USER,
            target_id: response.data.user.id.toString(),
            details: {
              description: `创建了新用户 ${response.data.user.username}`,
              username: response.data.user.username,
              role: response.data.user.role
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };

          return {
            users: [...state.users, response.data.user],
            operationLogs: (() => {
              const updatedLogs = [newLog, ...state.operationLogs];
              saveOperationLogsToStorage(updatedLogs);
              return updatedLogs;
            })(),
            loading: { ...state.loading, createUser: false },
            error: { ...state.error, createUser: null }
          };
        });
        return { success: true, message: '用户创建成功' };
      } else {
        set({ loading: { createUser: false }, error: { createUser: '创建失败' } });
        return { success: false, message: '创建失败' };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('创建用户失败:', errorMessage);
      set({ loading: { createUser: false }, error: { createUser: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  updateUser: async (userId: number, userData: any) => {
    try {
      set({ loading: { updateUser: true }, error: { updateUser: null } });
      const response = await apiService.updateUser(userId, userData);
      if (response.success && response.data?.user) {
        set((state) => {
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id || 0,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.UPDATE,
            target_type: TargetType.USER,
            target_id: userId.toString(),
            details: {
              description: `更新了用户 ${response.data.user.username} 的信息`,
              user_id: userId,
              username: response.data.user.username,
              updated_fields: Object.keys(userData)
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };

          return {
            users: state.users.map(user => user.id === userId ? response.data?.user : user),
            operationLogs: (() => {
              const updatedLogs = [newLog, ...state.operationLogs];
              saveOperationLogsToStorage(updatedLogs);
              return updatedLogs;
            })(),
            loading: { ...state.loading, updateUser: false },
            error: { ...state.error, updateUser: null }
          };
        });
        return { success: true, message: '用户更新成功' };
      } else {
        set({ loading: { updateUser: false }, error: { updateUser: '更新失败' } });
        return { success: false, message: '更新失败' };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('更新用户失败:', errorMessage);
      set({ loading: { updateUser: false }, error: { updateUser: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  deleteUser: async (userId: number) => {
    try {
      set({ loading: { deleteUser: true }, error: { deleteUser: null } });
      
      // Get the user before deletion to include in the log
      const state = get();
      const userToDelete = state.users.find(user => user.id === userId);
      
      const response = await apiService.deleteUser(userId);
      if (response.success) {
        set((state) => {
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id || 0,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.DELETE,
            target_type: TargetType.USER,
            target_id: userId.toString(),
            details: {
              description: `删除了用户 ${userToDelete?.username || '未知用户'}`,
              user_id: userId,
              username: userToDelete?.username || '未知用户'
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };

          return {
            users: state.users.filter(user => user.id !== userId),
            operationLogs: (() => {
              const updatedLogs = [newLog, ...state.operationLogs];
              saveOperationLogsToStorage(updatedLogs);
              return updatedLogs;
            })(),
            loading: { ...state.loading, deleteUser: false },
            error: { ...state.error, deleteUser: null }
          };
        });
        return { success: true, message: '用户删除成功' };
      } else {
        set({ loading: { deleteUser: false }, error: { deleteUser: '删除失败' } });
        return { success: false, message: '删除失败' };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('删除用户失败:', errorMessage);
      set({ loading: { deleteUser: false }, error: { deleteUser: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  // 认证相关操作
  login: async (user, token) => {
    // 更新本地存储
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('token', token);
    
    // 创建登录日志
    const loginLog: OperationLog = {
      id: Math.floor(Math.random() * 1000000),
      user_id: user.id,
      username: user.username,
      operation_type: OperationType.LOGIN,
      target_type: TargetType.USER,
      target_id: user.id.toString(),
      details: {
        description: `用户 ${user.username} 登录系统`
      },
      ip_address: '127.0.0.1',
      created_at: new Date().toISOString()
    };
    
    // 先更新登录状态和本地日志
    set((state) => {
      const updatedLogs = [loginLog, ...state.operationLogs];
      saveOperationLogsToStorage(updatedLogs);
      return {
        auth: {
          isAuthenticated: true,
          user,
          token,
          csrfToken: state.auth.csrfToken || null
        },
        operationLogs: updatedLogs
      };
    });
    
    // 然后获取完整的操作日志历史
    try {
      const response = await apiService.get('/operation-logs');
      if (response.success) {
        // 确保我们使用的是正确的日志数据格式
        // 后端返回的格式：{ success: true, data: { logs: [], pagination: {} } }
        const logs = (response as any)?.data?.logs || [];
        // 添加最新的登录日志到后端返回的日志列表
        set((state) => {
          const updatedLogs = [loginLog, ...logs];
          saveOperationLogsToStorage(updatedLogs);
          return {
            operationLogs: updatedLogs
          };
        });
      }
    } catch (error) {
      console.error('登录后获取操作日志失败:', error);
      // 获取失败不影响登录流程，继续使用本地日志
    }
  },

  logout: async () => {
    // 在单个set调用中创建登出日志并更新状态
    const state = get();
    const username = state.auth.user?.username || '未知用户';
    const userId = state.auth.user?.id || 0;
    
    // 创建登出日志
    const logoutLog: OperationLog = {
      id: Math.floor(Math.random() * 1000000),
      user_id: userId,
      username,
      operation_type: OperationType.LOGOUT,
      target_type: TargetType.USER,
      target_id: userId.toString(),
      details: {
        description: `用户 ${username} 退出系统`
      },
      ip_address: '127.0.0.1',
      created_at: new Date().toISOString()
    };
    
    // 将日志保存到后端
    try {
      await apiService.createOperationLog(logoutLog);
    } catch (error) {
      console.error('保存登出日志到后端失败:', error);
      // 保存失败不影响主流程
    }
    
    // 更新状态
    set((state) => {
      const updatedLogs = [logoutLog, ...state.operationLogs];
      saveOperationLogsToStorage(updatedLogs);
      return {
        auth: {
          isAuthenticated: false,
          user: null,
          token: null,
          csrfToken: null
        },
        operationLogs: updatedLogs
      };
    });
    
    // 清除本地存储
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('token');
    localStorage.removeItem('csrfToken');
  },

  setCsrfToken: (token) => {
    // 保存CSRF令牌到本地存储
    localStorage.setItem('csrfToken', token);
    
    // 更新状态
    set((state) => ({
      auth: {
        ...state.auth,
        csrfToken: token
      }
    }));
  },

  fetchAllOrders: async (page = 1, limit = 100000) => {
    try {
      const state = get();
      if (!state.auth.isAuthenticated || !state.auth.user) {
        console.log('fetchAllOrders: 用户未登录');
        return { success: false, message: '用户未登录' };
      }
      
      set({ loading: { fetchAllOrders: true }, error: { fetchAllOrders: null } });
      
      // ✅ 修复：只从本地后端API获取订单数据，移除直接调用第三方物流API的部分
      console.log('fetchAllOrders: 开始调用本地后端API获取订单数据...');
      let localOrders: Order[] = [];
      let paginationData = {
        total: 0,
        page: page,
        limit: limit,
        totalPages: 0,
      };
      
      try {
        const localResponse = await apiService.get<{ orders: Order[], pagination: any }>('/orders', { page, limit, is_archived: false }, { useCache: false });
        if (localResponse.success && localResponse.data && localResponse.data.orders) {
          console.log(`fetchAllOrders: 本地后端API返回了 ${localResponse.data.orders.length} 条订单数据`);
          // 添加调试日志，查看返回的订单数据中customer_name字段的值
          console.log('fetchAllOrders: 订单数据示例:', localResponse.data.orders.slice(0, 3).map(o => ({ id: o.id, order_number: o.order_number, customer_name: o.customer_name })));
          localOrders = localResponse.data.orders;
          paginationData = localResponse.data.pagination || paginationData;
        }
      } catch (localError) {
        console.error('fetchAllOrders: 调用本地后端API失败:', (localError as Error).message);
        throw localError;
      }
      
      console.log(`fetchAllOrders: 总共 ${localOrders.length} 条订单数据`);
      console.log('fetchAllOrders: 分页数据:', paginationData);
      
      // ✅ 修复：保留原有的客户名称，防止被新返回的数据覆盖
      // 保存当前订单的客户名称映射
      const currentCustomerNames = new Map<number, string>();
      state.orders.forEach(order => {
        if (order.customer_name && order.customer_name !== 'N/A' && order.customer_name !== '未知客户') {
          currentCustomerNames.set(order.id, order.customer_name);
        }
      });
      
      // 处理新获取的订单数据，保留原有的客户名称
      const processedOrders = localOrders.map(order => {
        // 如果当前订单有保存的客户名称，使用它覆盖新返回的客户名称
        if (currentCustomerNames.has(order.id)) {
          return {
            ...order,
            customer_name: currentCustomerNames.get(order.id) || order.customer_name
          };
        }
        return order;
      });
      
      // 更新状态
      set((state) => ({
        orders: processedOrders,
        pagination: paginationData,
        loading: { ...state.loading, fetchAllOrders: false }
      }));
      
      return { 
        success: true, 
        message: `成功获取 ${processedOrders.length} 条订单数据` 
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('fetchAllOrders: 获取订单数据失败:', errorMessage, error);
      
      set({ loading: { fetchAllOrders: false }, error: { fetchAllOrders: errorMessage } });
      return { success: false, message: `获取订单数据失败: ${errorMessage}` };
    }
  },
  loadMoreOrders: async () => {
    try {
      const state = get();
      if (!state.auth.isAuthenticated || !state.auth.user) {
        console.log('loadMoreOrders: 用户未登录');
        return { success: false, message: '用户未登录' };
      }
      
      const currentPage = state.pagination.page;
      const totalPages = state.pagination.totalPages;
      
      if (currentPage >= totalPages) {
        console.log('loadMoreOrders: 已经是最后一页');
        return { success: false, message: '已经是最后一页' };
      }
      
      set({ loading: { loadMoreOrders: true }, error: { loadMoreOrders: null } });
      
      const nextPage = currentPage + 1;
      const limit = state.pagination.limit;
      
      console.log(`loadMoreOrders: 开始加载第 ${nextPage} 页订单数据...`);
      
      const localResponse = await apiService.get<{ orders: Order[], pagination: any }>('/orders', { page: nextPage, limit, is_archived: false }, { useCache: false });
      if (localResponse.success && localResponse.data && localResponse.data.orders) {
        console.log(`loadMoreOrders: 本地后端API返回了 ${localResponse.data.orders.length} 条订单数据`);
        
        const newOrders = localResponse.data.orders;
        const updatedOrders = [...state.orders, ...newOrders];
        
        // 更新状态
        set((state) => ({
          orders: updatedOrders,
          pagination: {
            ...state.pagination,
            page: nextPage,
            ...localResponse.data.pagination,
          },
          loading: { ...state.loading, loadMoreOrders: false }
        }));
        
        return { 
          success: true, 
          message: `成功加载 ${newOrders.length} 条订单数据` 
        };
      }
      
      // 添加默认返回值
      set({ loading: { loadMoreOrders: false } });
      return { success: false, message: '未返回订单数据' };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('loadMoreOrders: 加载订单数据失败:', errorMessage, error);
      
      set({ loading: { loadMoreOrders: false }, error: { loadMoreOrders: errorMessage } });
      return { success: false, message: `加载订单数据失败: ${errorMessage}` };
    }
  },
  updateUserProfile: async (userData) => {
    try {
      const state = get();
      const currentUser = state.auth.user;
      
      if (!currentUser) {
        console.log('updateUserProfile: 用户未登录');
        return { success: false, message: '用户未登录' };
      }
      
      set({ loading: { updateUserProfile: true }, error: { updateUserProfile: null } });
      
      // 调试：查看发送到后端的数据和当前用户信息
      console.log('发送到后端的用户数据:', userData);
      console.log('当前用户信息:', currentUser);
      
      // 调用后端API更新用户信息
      const response = await apiService.put(`/users/${currentUser.id}`, userData);
      
      console.log('后端返回的响应:', response);
      
      let updatedUser;
      
      if (response.success) {
        // 修复：正确处理后端返回的数据格式
        // 后端返回格式: { success: true, data: { user } }
        // 经过api.ts响应拦截器处理后: { success: true, data: { data: { user } }, message: '请求成功' }
        
        if ((response as any)?.data?.user) {
          // 最常见的情况：经过响应拦截器处理后的格式
          updatedUser = (response as any).data.user;
        } else if ((response as any)?.user) {
          // 直接从响应中获取user
          updatedUser = (response as any).user;
        } else {
          // 后备方案：直接使用当前用户信息 + 更新的数据
          updatedUser = { ...currentUser, ...userData };
        }
        
        // 确保updatedUser包含所有必要的字段，特别是id和token相关的信息
        const finalUpdatedUser = {
          ...currentUser,  // 保留原有用户信息（包括id、token等）
          ...updatedUser,  // 更新修改的字段
          id: currentUser.id, // 确保ID不会被错误修改
          token: state.auth.token // 确保token不会丢失
        };
        
        // 更新本地存储
        localStorage.setItem('user', JSON.stringify(finalUpdatedUser));
        localStorage.setItem('isAuthenticated', 'true'); // 确保isAuthenticated仍然是true
        localStorage.setItem('token', state.auth.token); // 确保token也被保存
        
        // 调试：检查本地存储的内容
        console.log('最终更新的用户信息:', finalUpdatedUser);
        console.log('本地存储的user:', localStorage.getItem('user'));
        console.log('本地存储的isAuthenticated:', localStorage.getItem('isAuthenticated'));
        console.log('本地存储的token:', localStorage.getItem('token'));
        
        // 创建操作日志
        const newLog: OperationLog = {
          id: Math.floor(Math.random() * 1000000),
          user_id: finalUpdatedUser.id,
          username: finalUpdatedUser.username,
          operation_type: OperationType.UPDATE,
          target_type: TargetType.USER,
          target_id: finalUpdatedUser.id.toString(),
          details: {
            description: `用户 ${finalUpdatedUser.username} 更新了个人信息`,
            changes: userData
          },
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString()
        };

        // 将日志保存到后端
        try {
          await apiService.createOperationLog(newLog);
        } catch (error) {
          console.error('保存操作日志到后端失败:', error);
          // 保存失败不影响主流程
        }
        
        // 更新状态
        set((state) => {
          const updatedLogs = [newLog, ...state.operationLogs];
          saveOperationLogsToStorage(updatedLogs);
          return {
            auth: {
              ...state.auth,
              user: finalUpdatedUser,
              token: state.auth.token // 再次确保token不会丢失
            },
            operationLogs: updatedLogs,
            loading: { ...state.loading, updateUserProfile: false }
          };
        });
        
        return { success: true, message: '更新个人信息成功' };
      } else {
        // 如果后端API调用失败，回退到本地更新
        console.log('后端API调用失败，回退到本地更新');
        
        // 创建本地更新的用户信息
        const localUpdatedUser = {
          ...currentUser,
          ...userData,
          updated_at: new Date().toISOString(),
          id: currentUser.id, // 确保ID不会被错误修改
          token: state.auth.token // 确保token不会丢失
        };
        
        // 更新本地存储
        localStorage.setItem('user', JSON.stringify(localUpdatedUser));
        localStorage.setItem('isAuthenticated', 'true'); // 确保isAuthenticated仍然是true
        localStorage.setItem('token', state.auth.token); // 确保token也被保存
        
        // 调试：检查本地存储的内容
        console.log('本地更新后的用户信息:', localUpdatedUser);
        
        // 创建操作日志
        const newLog: OperationLog = {
          id: Math.floor(Math.random() * 1000000),
          user_id: localUpdatedUser.id,
          username: localUpdatedUser.username,
          operation_type: OperationType.UPDATE,
          target_type: TargetType.USER,
          target_id: localUpdatedUser.id.toString(),
          details: {
            description: `用户 ${localUpdatedUser.username} 更新了个人信息 (本地更新)`,
            changes: userData
          },
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString()
        };

        // 将日志保存到后端
        try {
          await apiService.createOperationLog(newLog);
        } catch (error) {
          console.error('保存操作日志到后端失败:', error);
          // 保存失败不影响主流程
        }
        
        // 更新状态
        set((state) => {
          const updatedLogs = [newLog, ...state.operationLogs];
          saveOperationLogsToStorage(updatedLogs);
          return {
            auth: {
              ...state.auth,
              user: localUpdatedUser,
              token: state.auth.token // 确保token不会丢失
            },
            operationLogs: updatedLogs,
            loading: { ...state.loading, updateUserProfile: false }
          };
        });
        
        return { 
          success: false, 
          message: `更新个人信息失败，但已在本地保存: ${response.message || '服务器错误'}` 
        };
      }
    } catch (error) {
      // 调试：查看错误详情
      console.error('更新个人信息失败:', error);
      
      // 确保本地存储仍然保持认证状态
      localStorage.setItem('isAuthenticated', 'true');
      
      // 调试：检查本地存储的内容
      console.log('错误处理后的本地存储:');
      console.log('isAuthenticated:', localStorage.getItem('isAuthenticated'));
      console.log('user:', localStorage.getItem('user'));
      console.log('token:', localStorage.getItem('token'));
      
      // 更新状态，停止加载
      set({ loading: { updateUserProfile: false }, error: { updateUserProfile: '更新失败，请稍后重试' } });
      
      return { success: false, message: '更新失败，请稍后重试' };
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    try {
      const state = get();
      if (!state.auth.user) {
        return { success: false, message: '用户未登录' };
      }
      
      set({ loading: { changePassword: true }, error: { changePassword: null } });
      const response = await apiService.put(`/users/${state.auth.user.id}/password`, { oldPassword, password: newPassword });
      
      if (response.success) {
        // 创建操作日志
        const newLog: OperationLog = {
          id: Math.floor(Math.random() * 1000000),
          user_id: state.auth.user.id,
          username: state.auth.user.username,
          operation_type: OperationType.UPDATE,
          target_type: TargetType.USER,
          target_id: state.auth.user.id.toString(),
          details: {
            description: `用户 ${state.auth.user.username} 修改了密码`
          },
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString()
        };
        
        set((state) => {
          const updatedLogs = [newLog, ...state.operationLogs];
          saveOperationLogsToStorage(updatedLogs);
          return {
            operationLogs: updatedLogs,
            loading: { ...state.loading, changePassword: false }
          };
        });
        
        return { success: true, message: response.message || '修改密码成功' };
      }
      
      set((state) => ({ loading: { ...state.loading, changePassword: false } }));
      return { success: false, message: response.message || '修改密码失败' };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('修改密码失败:', errorMessage);
      set({ loading: { changePassword: false }, error: { changePassword: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  isAdmin: () => {
    const state = get();
    return state.auth.user?.role === Role.ADMIN;
  },

  isUser: () => {
    const state = get();
    return state.auth.user?.role === Role.USER;
  },

  getStats: (departmentKey?) => {
    const state = get();
    const targetOrders = departmentKey 
      ? state.orders.filter(o => o.department_key === departmentKey && !o.is_archived)
      : state.orders.filter(o => !o.is_archived);
    
    const stats = {
      key: departmentKey || 'all',
      name: departmentKey ? (DEPARTMENT_DICT[departmentKey]?.name || '未知部门') : '全部部门',
      total: targetOrders.length,
      [OrderStatus.PENDING]: 0,
      [OrderStatus.IN_TRANSIT]: 0,
      [OrderStatus.DELIVERED]: 0,
      [OrderStatus.RETURNED]: 0,
      warningCount: 0,
      delayShipmentCount: 0,
      transitAbnormalCount: 0
    };

    targetOrders.forEach(o => {
      stats[o.status]++;
      
      // Count warnings
      if (o.warning_status !== WarningStatus.NONE) {
        stats.warningCount++;
      }
      
      if (o.warning_status === WarningStatus.DELAY_SHIPMENT) {
        stats.delayShipmentCount++;
      } else if (o.warning_status === WarningStatus.TRANSIT_ABNORMAL) {
        stats.transitAbnormalCount++;
      }
    });

    return stats;
  },
  
  getFilteredOrders: (department?, status?, warningStatus?) => {
    const state = get();
    return state.orders.filter(order => {
      if (order.is_archived) return false;
      if (department && order.department_key !== department) return false;
      if (status && order.status !== status) return false;
      if (warningStatus && order.warning_status !== warningStatus) return false;
      return true;
    });
  }
}));