import React, { useState, useEffect } from 'react';
import { useLogisticsStore } from '../services/store';
import { OrderStatus, DEPARTMENTS, Order, WarningStatus, ORDER_STATUS_MAP, WARNING_STATUS_MAP } from '../types';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Download, ChevronRight, AlertCircle, Filter, Activity } from 'lucide-react';
import * as XLSX from 'xlsx';

export const DepartmentList: React.FC = () => {
  const { orders, fetchAllOrders } = useLogisticsStore();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') === 'risk' ? 'risk' : 'all';
  
  // 组件加载时获取订单数据
  useEffect(() => {
    fetchAllOrders();
  }, [fetchAllOrders]);

  const [customerFilter, setCustomerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter === 'risk' ? OrderStatus.PENDING : 'all');
  const [searchText, setSearchText] = useState('');
  const [isRiskMode, setIsRiskMode] = useState(initialFilter === 'risk');
  const [destinationFilter, setDestinationFilter] = useState('all');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [warningFilter, setWarningFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 日期范围选项
  const dateOptions = [
    { value: 'all', label: '所有日期' },
    { value: 'today', label: '今天' },
    { value: 'week', label: '近7天' },
    { value: 'month', label: '近30天' },
    { value: 'custom', label: '自定义' }
  ];

  // 获取唯一的目的地、承运商和客户列表
  const uniqueDestinations = [...new Set(orders.filter(o => !o.is_archived).map(o => o.details?.destination).filter(Boolean))].sort();
  const uniqueCarriers = [...new Set(orders.filter(o => !o.is_archived).map(o => o.details?.carrier).filter(Boolean))].sort();
  const uniqueCustomers = [...new Set(orders.filter(o => !o.is_archived).map(o => o.customer_name).filter(Boolean))].sort();

  // 日期筛选逻辑 - 基于计划发货日（导入订单中的发货时间字段）
  const isDateInRange = (order: Order) => {
    // 优先使用计划发货日，其次使用下单日期，最后使用创建时间
    const shipDateStr = order.details?.planned_ship_date || order.details?.order_date || order.created_at;
    if (!shipDateStr) return false;
    
    const orderDate = new Date(shipDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (dateFilter) {
      case 'today':
        return orderDate.toDateString() === today.toDateString();
      case 'week':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return orderDate >= weekAgo;
      case 'month':
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        return orderDate >= monthAgo;
      case 'custom':
        if (!startDate || !endDate) return true;
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return orderDate >= start && orderDate <= end;
      default:
        return true;
    }
  };

  // Filter Logic
  const filteredOrders = orders.filter(order => {
    if (order.is_archived) return false;
    if (customerFilter !== 'all' && order.customer_name !== customerFilter) return false;
    if (destinationFilter !== 'all' && order.details?.destination !== destinationFilter) return false;
    if (carrierFilter !== 'all' && order.details?.carrier !== carrierFilter) return false;
    
    // Risk Mode Override
    if (isRiskMode) {
      return order.warning_status !== WarningStatus.NONE && isDateInRange(order);
    }

    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (warningFilter !== 'all' && order.warning_status !== warningFilter) return false;
    if (!isDateInRange(order)) return false;
    
    if (searchText) {
      const lower = searchText.toLowerCase();
      return order.order_number.toLowerCase().includes(lower) || 
             order.customer_name.toLowerCase().includes(lower) ||
             (order.details?.destination || '').toLowerCase().includes(lower);
    }
    return true;
  });

  const isRisk = (order: Order) => {
    return order.warning_status !== WarningStatus.NONE;
  };

  const handleExport = () => {
      // 按ID正序排序，保持与导入顺序一致
      const sortedOrders = [...filteredOrders].sort((a, b) => a.id - b.id);
      
      // 准备导出数据 - 与导入模板格式一致，添加物流状态和物流信息
      const exportData = sortedOrders.map(o => ({
        '客户/项目名称': o.customer_name,
        '申请单号/外部订单号': o.details?.application_number || '',
        '收货地址': o.details?.destination || '',
        '收货人': o.details?.recipient || '',
        '收货人电话': o.details?.phone || '',
        '物料名称': o.details?.product_info || '',
        '订单号': o.details?.internal_order_number || o.order_number,
        '快递公司': o.details?.carrier || '',
        '快递单号': o.order_number,
        '下单日期': o.details?.order_date ? new Date(o.details.order_date).toLocaleDateString() : '',
        '计划发货日': o.details?.planned_ship_date ? new Date(o.details.planned_ship_date).toLocaleDateString() : '',
        '备注': o.details?.note || '',
        '物流状态': ORDER_STATUS_MAP[o.status] || o.status,
        '物流信息': o.details?.timeline && Array.isArray(o.details.timeline) && o.details.timeline.length > 0 ? 
          o.details.timeline.map((entry: any) => {
            const time = entry.time ? new Date(entry.time).toLocaleString() : '';
            const status = entry.status || '';
            const description = entry.description || '';
            return `${time} - ${status}: ${description}`;
          }).join('\n') : '暂无物流信息'
      }));
      
      // 创建工作簿和工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '订单数据');
      
      // 导出为XLSX文件
      XLSX.writeFile(workbook, 'logistics_export.xlsx');
  };

  // Helper for progress bar visual
  const getProgress = (status: OrderStatus) => {
    switch (status) {
        case OrderStatus.PENDING: return { width: '25%', color: 'bg-amber-500' };
        case OrderStatus.IN_TRANSIT: return { width: '65%', color: 'bg-blue-500' };
        case OrderStatus.DELIVERED: return { width: '100%', color: 'bg-green-500' };
        case OrderStatus.RETURNED: return { width: '100%', color: 'bg-red-500' };
        default: return { width: '0%', color: 'bg-slate-500' };
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 z-10">
        <div>
           <h2 className="text-2xl font-bold text-white tracking-wide font-mono">DETAILS // 业务明细</h2>
           <p className="text-cyan-500/60 text-xs font-mono mt-1">LOGISTICS_DATA_TABLE_V1</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={handleExport}
             className="flex items-center space-x-2 bg-slate-800 border border-slate-600 text-slate-300 px-4 py-2 hover:bg-slate-700 hover:text-white transition font-mono text-sm"
           >
             <Download size={14} />
             <span>导出 XLSX</span>
           </button>
        </div>
      </div>

      {/* Filters */}
      <div className="tech-card tech-border p-4 mb-6 flex flex-col lg:flex-row gap-4 items-end lg:items-center z-10">
         <div className="flex flex-col space-y-1 w-full lg:w-auto">
            <label className="text-[10px] font-bold text-cyan-500 uppercase font-mono">客户/项目筛选</label>
            <select 
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="all">所有客户/项目</option>
              {uniqueCustomers.map(customer => <option key={customer} value={customer}>{customer}</option>)}
            </select>
         </div>

         <div className="flex flex-col space-y-1 w-full lg:w-auto">
            <label className="text-[10px] font-bold text-cyan-500 uppercase font-mono">状态筛选</label>
            <div className="flex items-center space-x-4">
                 <select 
                    className="bg-slate-900 border border-slate-700 text-slate-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50 font-mono"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    disabled={isRiskMode}
                    >
                    <option value="all">所有状态</option>
                    {Object.values(OrderStatus).map(s => <option key={s} value={s}>{ORDER_STATUS_MAP[s]}</option>)}
                </select>
                <div className="flex items-center">
                    <input 
                        type="checkbox" 
                        id="riskCheck"
                        className="w-4 h-4 bg-slate-900 border-red-900 checked:bg-red-600 focus:ring-red-500 rounded-none"
                        checked={isRiskMode}
                        onChange={(e) => setIsRiskMode(e.target.checked)}
                    />
                    <label htmlFor="riskCheck" className={`ml-2 text-sm font-mono flex items-center ${isRiskMode ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                        <AlertCircle size={14} className="mr-1"/> 风险模式 (&gt;5天)
                    </label>
                </div>
            </div>
         </div>

         <div className="flex flex-col space-y-1 w-full lg:w-auto">
            <label className="text-[10px] font-bold text-cyan-500 uppercase font-mono">发货时间筛选</label>
            <div className="flex flex-col sm:flex-row gap-2">
                <select 
                    className="bg-slate-900 border border-slate-700 text-slate-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                >
                    {dateOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                {dateFilter === 'custom' && (
                    <div className="flex gap-2">
                        <input 
                            type="date" 
                            className="bg-slate-900 border border-slate-700 text-slate-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            placeholder="开始日期"
                        />
                        <span className="flex items-center text-slate-500">至</span>
                        <input 
                            type="date" 
                            className="bg-slate-900 border border-slate-700 text-slate-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            placeholder="结束日期"
                        />
                    </div>
                )}
            </div>
         </div>

         <div className="flex flex-col space-y-1 w-full lg:w-auto">
            <label className="text-[10px] font-bold text-cyan-500 uppercase font-mono">目的地</label>
            <select 
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              value={destinationFilter}
              onChange={(e) => setDestinationFilter(e.target.value)}
              disabled={isRiskMode}
            >
              <option value="all">所有目的地</option>
              {uniqueDestinations.map(dest => <option key={dest} value={dest}>{dest}</option>)}
            </select>
         </div>

         <div className="flex flex-col space-y-1 w-full lg:w-auto">
            <label className="text-[10px] font-bold text-cyan-500 uppercase font-mono">承运商</label>
            <select 
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              disabled={isRiskMode}
            >
              <option value="all">所有承运商</option>
              {uniqueCarriers.map(carrier => <option key={carrier} value={carrier}>{carrier}</option>)}
            </select>
         </div>

         <div className="flex flex-col space-y-1 w-full lg:w-auto">
            <label className="text-[10px] font-bold text-cyan-500 uppercase font-mono">预警状态</label>
            <select 
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              value={warningFilter}
              onChange={(e) => setWarningFilter(e.target.value)}
              disabled={isRiskMode}
            >
              <option value="all">所有状态</option>
              {Object.values(WarningStatus).map(status => <option key={status} value={status}>{WARNING_STATUS_MAP[status]}</option>)}
            </select>
         </div>

         <div className="flex-1 w-full lg:w-auto">
             <div className="relative group">
                <Search className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-cyan-400" size={18} />
                <input 
                  type="text" 
                  placeholder="搜索单号、客户名称或目的地..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-none text-sm focus:outline-none focus:border-cyan-500 font-mono transition-colors"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
             </div>
         </div>
      </div>

      {/* Table */}
      <div className="flex-1 tech-card tech-border overflow-hidden flex flex-col z-10">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-700 text-cyan-500">
                        <th className="p-4 text-xs font-mono uppercase tracking-widest">物流单号</th>
                        <th className="p-4 text-xs font-mono uppercase tracking-widest">运输进度</th>
                        <th className="p-4 text-xs font-mono uppercase tracking-widest">客户名称</th>
                        <th className="p-4 text-xs font-mono uppercase tracking-widest">目的地</th>
                        <th className="p-4 text-xs font-mono uppercase tracking-widest">下单日期</th>
                        <th className="p-4 text-xs font-mono uppercase tracking-widest">计划发货日</th>
                        <th className="p-4 text-xs font-mono uppercase tracking-widest">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {filteredOrders.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-slate-500 font-mono">暂无数据</td></tr>
                    ) : (
                        filteredOrders.map(order => {
                            const risk = isRisk(order);
                            const progress = getProgress(order.status);
                            return (
                                <tr 
                                  key={order.id} 
                                  className={`hover:bg-cyan-900/10 transition ${risk ? 'bg-red-950/10 hover:bg-red-900/20' : ''}`}
                                >
                                    <td className="p-4 text-sm font-mono text-cyan-400 tracking-wider">
                                        {order.order_number}
                                    </td>
                                    <td className="p-4 w-48">
                                        {/* Visual Progress Bar */}
                                        <div className="flex flex-col">
                                            <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                                                <span>{ORDER_STATUS_MAP[order.status]}</span>
                                                {risk && <span className="text-red-500 font-bold flex items-center"><AlertCircle size={8} className="mr-0.5"/> 延误</span>}
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full ${progress.color} shadow-[0_0_8px_currentColor] transition-all duration-500`} 
                                                    style={{ width: progress.width }}
                                                ></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-slate-300 max-w-xs truncate">
                                        {order.details?.recipient || 'N/A'}
                                    </td>
                                    <td className="p-4 text-sm text-slate-300 max-w-[200px] truncate whitespace-nowrap overflow-hidden text-ellipsis">
                                        {order.details?.destination || 'N/A'}
                                    </td>
                                    <td className="p-4 text-xs text-slate-400 font-mono whitespace-nowrap">
                                        {order.details?.order_date ? new Date(order.details.order_date).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="p-4 text-xs text-slate-400 font-mono whitespace-nowrap">
                                        {order.details?.planned_ship_date ? new Date(order.details.planned_ship_date).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="p-4">
                                        <Link to={`/order/${order.id}`} className="text-slate-500 hover:text-cyan-400 transition-colors">
                                            <ChevronRight size={18} />
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};