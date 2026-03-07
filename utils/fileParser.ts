import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import { Order, OrderStatus, WarningStatus, DEPARTMENT_DICT, DEPARTMENTS } from '../types';

// 快递公司名称到代码的映射
export const CARRIER_NAME_TO_CODE: Record<string, string> = {
  '顺丰速运': 'shunfeng',
  '圆通速递': 'yuantong',
  '京东物流': 'jd',
  '跨越速运': 'kuayue',
  '中通快递': 'zhongtong'
};

// 快递公司代码到名称的映射
export const CARRIER_CODE_TO_NAME: Record<string, string> = {
  'shunfeng': '顺丰速运',
  'yuantong': '圆通速递',
  'jd': '京东物流',
  'kuayue': '跨越速运',
  'zhongtong': '中通快递'
};

// 导入模板字段映射
interface ImportRow {
  '客户/项目名称': string;
  '申请单号/外部订单号':string;
  '收货地址': string;
  '收货人':string;
  '收货人电话': string;
  '物料名称': string;
  '订单号':string;
  '快递公司': string;
  '快递单号':string;
  '下单日期'?: string;
  '计划发货日'?: string;
  '备注'?: string;
}

export const parseExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // 验证表头
        const headers = jsonData[0] as string[];
        const normalizedHeaders = headers.map(h => String(h).trim().replace(/\s+/g, '').toLowerCase());
        const requiredHeaders = ['客户/项目', '申请单号/外部订单号', '收货地址', '收货人', '收货人电话', '物料名称', '订单号', '快递公司', '快递单号'];
        
        for (const header of requiredHeaders) {
          let found = false;
          // 尝试精确匹配
          const normalizedHeader = String(header).trim().replace(/\s+/g, '').toLowerCase();
          if (normalizedHeaders.includes(normalizedHeader)) {
            found = true;
          }
          // 如果精确匹配失败，尝试模糊匹配
          if (!found) {
            for (const h of normalizedHeaders) {
              if (header === '客户/项目' && (h.includes('客户') && h.includes('项目'))) {
                found = true;
                break;
              } else if (header === '申请单号/外部订单号' && (h.includes('申请单号') || h.includes('外部订单号'))) {
                found = true;
                break;
              } else if (h.includes(header.replace(/\s+/g, '').toLowerCase())) {
                found = true;
                break;
              }
            }
          }
          if (!found) {
            reject(new Error(`Excel文件缺少必要列: ${header}`));
            return;
          }
        }
        
        // 转换为对象数组（跳过表头）
        const rows = jsonData.slice(1).map((row: any[]) => {
          const rowObj: Record<string, any> = {};
          headers.forEach((header, index) => {
            // 使用标准化的列名作为键（去除空格并转换为小写）
            const normalizedHeader = String(header).trim().replace(/\s+/g, '').toLowerCase();
            rowObj[normalizedHeader] = row[index];
            
            // 为常用字段添加别名映射
            // 优先处理客户/项目列，确保其映射不会被其他包含"客户"的列覆盖
            if (normalizedHeader.includes('客户') && normalizedHeader.includes('项目')) {
              rowObj['客户/项目'.replace(/\s+/g, '').toLowerCase()] = row[index];
            } else if (normalizedHeader.includes('申请单号') || normalizedHeader.includes('外部订单号')) {
              rowObj['申请单号/外部订单号'.replace(/\s+/g, '').toLowerCase()] = row[index];
            } else if (normalizedHeader.includes('收货地址')) {
              rowObj['收货地址'.replace(/\s+/g, '').toLowerCase()] = row[index];
            } else if (normalizedHeader.includes('收货人电话') || normalizedHeader.includes('电话')) {
              rowObj['收货人电话'.replace(/\s+/g, '').toLowerCase()] = row[index];
            } else if (normalizedHeader.includes('收货人') && !normalizedHeader.includes('电话')) {
              rowObj['收货人'.replace(/\s+/g, '').toLowerCase()] = row[index];
            } else if (normalizedHeader.includes('物料名称')) {
              rowObj['物料名称'.replace(/\s+/g, '').toLowerCase()] = row[index];
            } else if (normalizedHeader.includes('订单号')) {
              rowObj['订单号'.replace(/\s+/g, '').toLowerCase()] = row[index];
            } else if (normalizedHeader.includes('快递公司')) {
              rowObj['快递公司'.replace(/\s+/g, '').toLowerCase()] = row[index];
            } else if (normalizedHeader.includes('快递单号')) {
              rowObj['快递单号'.replace(/\s+/g, '').toLowerCase()] = row[index];
            } else if (normalizedHeader.includes('下单日期')) {
              rowObj['下单日期'.replace(/\s+/g, '').toLowerCase()] = row[index];
            } else if (normalizedHeader.includes('计划发货日') || normalizedHeader.includes('计划发货日期')) {
              rowObj['计划发货日'.replace(/\s+/g, '').toLowerCase()] = row[index];
            }
          });
          return rowObj;
        });
        
        resolve(rows);
      } catch (error) {
        reject(new Error('解析Excel文件失败: ' + (error as Error).message));
      }
    };
    
    reader.onerror = () => reject(new Error('读取Excel文件失败'));
    reader.readAsArrayBuffer(file);
  });
};

export const parseCSVFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'utf-8',
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error('解析CSV文件失败: ' + results.errors[0].message));
          return;
        }
        resolve(results.data);
      },
      error: (error) => {
        reject(new Error('读取CSV文件失败: ' + error.message));
      }
    });
  });
};

export const processImportData = (rawData: any[]): { orders: Order[]; errors: Array<{ row: number; message: string }> } => {
  const orders: Order[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  // 修改 1: 集合用于存储已存在的【快递单号】，因为这才是物流系统的唯一标识
  const existingTrackingNumbers = new Set<string>();
  
  rawData.forEach((row, index) => {
    const importRow = row as ImportRow;
    const rowNumber = index + 2; // 行号从2开始（跳过表头）
    
    // 标准化列名，去除空格并转换为小写
    const getField = (fieldName: string) => {
      const normalizedField = fieldName.replace(/\s+/g, '').toLowerCase();
      // 尝试直接访问标准化的字段名
      if (importRow[normalizedField]) {
        return importRow[normalizedField];
      }
      // 尝试访问原始字段名（兼容旧格式）
      return importRow[fieldName];
    };
    
    // 验证必填字段
    if (!getField('客户/项目')) {
      errors.push({ row: rowNumber, message: '客户/项目不能为空' });
      return;
    }
    
    const recipient = String(getField('收货人')).trim();
    if (!recipient) {
      errors.push({ row: rowNumber, message: '收货人不能为空' });
      return;
    }
    
    // 客户名称对应表格中客户/项目的信息
    const customerName = String(getField('客户/项目')).trim();
    
    if (!getField('申请单号/外部订单号')) {
      errors.push({ row: rowNumber, message: '申请单号/外部订单号不能为空' });
      return;
    }
    
    if (!getField('收货地址')) {
      errors.push({ row: rowNumber, message: '收货地址不能为空' });
      return;
    }
    
    // ✅ 修复：添加电话不能为空验证
    if (!getField('收货人电话')) {
      errors.push({ row: rowNumber, message: '收货人电话不能为空' });
      return;
    }
    
    if (!getField('物料名称')) {
      errors.push({ row: rowNumber, message: '物料名称不能为空' });
      return;
    }
    
    if (!getField('订单号')) {
      errors.push({ row: rowNumber, message: '订单号不能为空' });
      return;
    }
    
    if (!getField('快递公司')) {
      errors.push({ row: rowNumber, message: '快递公司不能为空' });
      return;
    }
    
    if (!getField('快递单号')) {
      errors.push({ row: rowNumber, message: '快递单号不能为空' });
      return;
    }
    
    // 获取关键字段
    const internalOrderNumber = String(getField('订单号')).trim(); // 内部订单号 (可能重复)
    const trackingNumber = String(getField('快递单号')).trim();   // 快递单号 (应该是唯一的)
    
    // 修改 2: 检查【快递单号】是否重复，而不是订单号
    if (existingTrackingNumbers.has(trackingNumber)) {
      console.log(`跳过重复快递单号: ${trackingNumber} (第${rowNumber}行)`);
      return;
    }
    
    // ✅ 修复：添加快递单号格式验证
    const carrierName = String(getField('快递公司')).trim();
    const carrierCode = CARRIER_NAME_TO_CODE[carrierName] || '';
    
    if (carrierCode === 'zhongtong') {
      // 中通快递要求单号必须是纯数字
      if (!/^\d+$/.test(trackingNumber)) {
        errors.push({ row: rowNumber, message: '中通快递单号必须是纯数字格式' });
        return;
      }
    }
    
    // 验证日期格式 - 不再需要日期字段
    
    // 检查部门是否存在 - 不再需要部门字段
    
    try {
      // 从表格中读取下单日期和计划发货日，默认使用当前日期
      const currentDate = new Date().toISOString();
      
      // 尝试从表格中获取日期字段
      const getDateField = (fieldName: string) => {
        const dateValue = getField(fieldName);
        if (dateValue) {
          // 处理不同格式的日期
          const dateStr = String(dateValue).trim();
          if (dateStr) {
            try {
              // 尝试解析Excel日期
              if (!isNaN(Number(dateStr))) {
                // Excel日期格式（数字）
                const excelDate = Number(dateStr);
                const date = new Date((excelDate - 25569) * 86400 * 1000);
                return date.toISOString();
              } else {
                // 字符串日期格式
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                  return date.toISOString();
                }
              }
            } catch (e) {
              // 解析失败，使用当前日期
            }
          }
        }
        return currentDate;
      };
      
      const orderDate = getDateField('下单日期');
      const plannedShipDate = getDateField('计划发货日') || orderDate;
      
      const order: Order = {
        id: Math.floor(Math.random() * 1000000), // 临时ID，后端会生成实际ID
        // 修改 3: 核心修改！将系统的 order_number 设置为【快递单号】
        // 这样既保证了唯一性（解决导入失败），又保证了能查到物流（解决无物流信息）
        order_number: trackingNumber,
        customer_name: customerName,
        department_key: DEPARTMENTS[0].key, // 使用默认部门
        user_id: 1, // 添加默认用户ID，与后端实体默认值一致
        status: OrderStatus.PENDING,
        is_archived: false,
        warning_status: WarningStatus.NONE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        details: {
          order_date: orderDate,
          destination: String(getField('收货地址')).trim(),
          planned_ship_date: plannedShipDate,
          carrier: carrierName,
          carrier_code: carrierCode, // 添加快递公司代码
          product_info: String(getField('物料名称')).trim(),
          note: getField('备注') ? String(getField('备注')).trim() : undefined,
          phone: String(getField('收货人电话')).trim(),
          recipient: String(getField('收货人')).trim(),
          application_number: String(getField('申请单号/外部订单号')).trim(),
          tracking_number: trackingNumber,
          // 修改 4: 将原始的内部订单号保存到 details 中，方便后续查看
          internal_order_number: internalOrderNumber,
          // 也可以把内部订单号拼接到 application_number 后面，或者放在 note 里
          timeline: [],
          created_by: 'system' // 实际应用中应从用户上下文获取
        }
      };
      
      orders.push(order);
      // 修改 5: 记录已处理的快递单号
      existingTrackingNumbers.add(trackingNumber);
    } catch (error) {
      errors.push({ row: rowNumber, message: '数据处理错误: ' + (error as Error).message });
    }
  });
  
  return { orders, errors };
};

export const generateImportTemplate = () => {
  const headers = ['客户/项目名称', '申请单号/外部订单号', '收货地址', '收货人', '收货人电话', '物料名称', '订单号', '快递公司', '快递单号', '下单日期', '计划发货日', '备注'];
  const sampleData = [
    ['项目Alpha', 'APPLY-001', '上海市', '张三', '13800138000', '电子元器件', 'ORDER-001', '顺丰速运', 'SF1234567890', '2026-01-23', '2026-01-23', '紧急订单'],
    ['客户B', 'APPLY-002', '广州市', '李四', '13900139000', '办公用品', 'ORDER-002', '圆通快递', 'YT0987654321', '2026-01-23', '2026-01-24', '']
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '订单导入模板');
  
  // 设置列宽
  worksheet['!cols'] = [
    { wch: 20 }, // 客户/项目名称
    { wch: 25 }, // 申请单号/外部订单号
    { wch: 15 }, // 收货地址
    { wch: 10 }, // 收货人
    { wch: 15 }, // 收货人电话
    { wch: 20 }, // 物料名称
    { wch: 15 }, // 订单号
    { wch: 12 }, // 快递公司
    { wch: 15 }, // 快递单号
    { wch: 12 }, // 下单日期
    { wch: 12 }, // 计划发货日
    { wch: 30 }  // 备注
  ];
  
  XLSX.writeFile(workbook, '订单导入模板.xlsx');
};

// 导出数据为Excel文件
export const exportOrdersToExcel = (orders: Order[], filterCriteria?: any) => {
  // 应用筛选条件
  let filteredOrders = [...orders];
  
  if (filterCriteria) {
      // 按部门筛选
      if (filterCriteria.department) {
        filteredOrders = filteredOrders.filter(order => order.department_key === filterCriteria.department);
      }
      
      // 按时间范围筛选
      if (filterCriteria.dateRange) {
        const startDate = new Date(filterCriteria.dateRange.start);
        const endDate = new Date(filterCriteria.dateRange.end);
        
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = order.details?.order_date ? new Date(order.details.order_date) : new Date();
          return orderDate >= startDate && orderDate <= endDate;
        });
      }
      
      // 按物流状态筛选
      if (filterCriteria.status) {
        filteredOrders = filteredOrders.filter(order => order.status === filterCriteria.status);
      }
      
      // 按承运商筛选
      if (filterCriteria.carrier) {
        filteredOrders = filteredOrders.filter(order => order.details?.carrier === filterCriteria.carrier);
      }
    
    // 按预警状态筛选
    if (filterCriteria.warningStatus) {
      filteredOrders = filteredOrders.filter(order => order.warning_status === filterCriteria.warningStatus);
    }
    
    // 按搜索关键词筛选（物流单号或客户名称）
    if (filterCriteria.searchTerm) {
      const searchTerm = filterCriteria.searchTerm.toLowerCase();
      filteredOrders = filteredOrders.filter(order => 
        order.order_number.toLowerCase().includes(searchTerm) ||
        order.customer_name.toLowerCase().includes(searchTerm)
      );
    }
  }
  
  // 转换数据格式，适合导出
  const exportData = filteredOrders.map(order => {
    // 获取最新轨迹节点
    const latestTrackingNode = order.details?.timeline?.length > 0 ? order.details.timeline[0] : null;
    
    return {
      '物流单号': order.order_number,
      '客户/项目名称': order.customer_name,
      '下单日期': order.details?.order_date ? new Date(order.details.order_date).toLocaleDateString() : '',
      '目的地': order.details?.destination || '',
      '计划发货日': order.details?.planned_ship_date ? new Date(order.details.planned_ship_date).toLocaleDateString() : '',
      '业务部门': order.department_key,
      '当前状态': order.status,
      '承运商': order.details?.carrier || '',
      '产品信息': order.details?.product_info || '',
      '备注': order.details?.note || '',
      '预警状态': order.warning_status,
      '最后更新时间': new Date(order.updated_at).toLocaleString(),
      '最新轨迹节点': latestTrackingNode ? `${latestTrackingNode.location} - ${latestTrackingNode.description}` : '无',
      '创建时间': order.created_at ? new Date(order.created_at).toLocaleString() : '',
      '创建人': order.details?.created_by || ''
    };
  });
  
  // 创建工作表
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '订单数据');
  
  // 设置列宽
  worksheet['!cols'] = [
    { wch: 15 }, // 物流单号
    { wch: 20 }, // 客户/项目名称
    { wch: 12 }, // 下单日期
    { wch: 15 }, // 目的地
    { wch: 15 }, // 计划发货日
    { wch: 12 }, // 业务部门
    { wch: 10 }, // 当前状态
    { wch: 12 }, // 承运商
    { wch: 20 }, // 产品信息
    { wch: 30 }, // 备注
    { wch: 12 }, // 预警状态
    { wch: 18 }, // 最后更新时间
    { wch: 30 }, // 最新轨迹节点
    { wch: 18 }, // 创建时间
    { wch: 10 }  // 创建人
  ];
  
  // 生成文件名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `物流订单数据_${timestamp}.xlsx`;
  
  // 导出文件
  XLSX.writeFile(workbook, filename);
};
