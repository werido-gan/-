export const exportToExcel = (
  data: any[], 
  fileName: string, 
  fieldMap: Record<string, string> = ORDER_FIELD_MAP,
  excludedFields: string[] = EXCLUDED_FIELDS
) => {
  // 按ID正序排序，保持与导入顺序一致
  const sortedData = [...data].sort((a, b) => a.id - b.id);
  
  // 转换数据，将英文字段名替换为中文，并过滤掉不需要的字段
  const transformedData = sortedData.map(item => {
    const transformedItem: any = {};
    Object.keys(item).forEach(key => {
      // 跳过需要过滤的字段
      if (excludedFields.includes(key)) {
        return;
      }
      
      // 处理嵌套的 details 字段
      if (key === 'details' && item[key]) {
        Object.keys(item[key]).forEach(detailKey => {
          const fullKey = `details.${detailKey}`;
          const chineseKey = fieldMap[fullKey] || fieldMap[detailKey] || detailKey;
          
          // 处理物流信息
          if (detailKey === 'timeline' && Array.isArray(item[key][detailKey])) {
            const timeline = item[key][detailKey];
            if (timeline.length > 0) {
              // 将时间线转换为可读文本
              const timelineText = timeline.map((entry: any) => {
                const time = entry.time ? new Date(entry.time).toLocaleString() : '';
                const status = entry.status || '';
                const description = entry.description || '';
                return `${time} - ${status}: ${description}`;
              }).join('\n');
              transformedItem[chineseKey] = timelineText;
            } else {
              transformedItem[chineseKey] = '暂无物流信息';
            }
          } else {
            transformedItem[chineseKey] = item[key][detailKey];
          }
        });
      } else {
        const chineseKey = fieldMap[key] || key;
        
        // 处理物流状态
        if (key === 'status') {
          transformedItem[chineseKey] = ORDER_STATUS_MAP[item[key]] || item[key];
        } else {
          transformedItem[chineseKey] = item[key];
        }
      }
    });
    return transformedItem;
  });

  const worksheet = XLSX.utils.json_to_sheet(transformedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '订单数据');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};