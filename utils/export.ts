import * as XLSX from 'xlsx';

/**
 * 订单字段中文映射
 */
const ORDER_FIELD_MAP: Record<string, string> = {
  id: '订单ID',
  order_number: '物流单号',
  carrier_code: '快递公司编码',
  customer_name: '客户名称',
  department_key: '部门',
  carrier: '承运商',
  receiverPhone: '收货人电话',
  status: '订单状态',
  warning_status: '预警状态',
  is_archived: '是否归档',
  user_id: '用户ID',
  created_at: '创建时间',
  updated_at: '更新时间',
  details: '详细信息'
};

/**
 * 需要过滤掉的字段
 */
const EXCLUDED_FIELDS = ['id', 'user_id', 'details', 'carrier', 'carrier_code'];

/**
 * 导出数据到Excel文件
 * @param data 要导出的数据数组
 * @param fileName 导出的文件名（不含扩展名）
 * @param fieldMap 字段映射表，用于将英文字段名转换为中文表头
 * @param excludedFields 需要过滤掉的字段数组
 */
export const exportToExcel = (
  data: any[], 
  fileName: string, 
  fieldMap: Record<string, string> = ORDER_FIELD_MAP,
  excludedFields: string[] = EXCLUDED_FIELDS
) => {
  // 转换数据，将英文字段名替换为中文，并过滤掉不需要的字段
  const transformedData = data.map(item => {
    const transformedItem: any = {};
    Object.keys(item).forEach(key => {
      // 跳过需要过滤的字段
      if (excludedFields.includes(key)) {
        return;
      }
      const chineseKey = fieldMap[key] || key;
      transformedItem[chineseKey] = item[key];
    });
    return transformedItem;
  });

  const worksheet = XLSX.utils.json_to_sheet(transformedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '订单数据');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
