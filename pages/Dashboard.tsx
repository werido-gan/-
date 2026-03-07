import React, { useState, useEffect } from 'react';
import { useLogisticsStore } from '../services/store';
import { DEPARTMENTS, OrderStatus, WarningStatus, DEPARTMENT_DICT } from '../types';
import { StatCard } from '../components/StatCard';
import { Truck, Package, CheckCircle, AlertOctagon, AlertTriangle, Activity, PieChart as PieIcon, TrendingUp, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, AreaChart, Area, CartesianGrid, Legend 
} from 'recharts';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { orders, fetchAllOrders, auth } = useLogisticsStore();
  const currentDeptIndex = -1; // 固定为-1，只显示全集团物流总览
  const { isAuthenticated } = auth;
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');

  // 加载订单数据
  useEffect(() => {
    // 只有在用户已登录的情况下才获取订单数据
    if (isAuthenticated) {
      fetchAllOrders();
    }
  }, [fetchAllOrders, isAuthenticated]);

  const currentDeptName = '集团总部 // 全局总览';
  
  // 生成唯一客户/项目列表
  const uniqueCustomers = [...new Set(orders.filter(o => !o.is_archived).map(o => o.customer_name).filter(Boolean))].sort();
  
  // 根据选择的客户/项目过滤订单
  const targetOrders = orders.filter(o => {
    if (o.is_archived) return false;
    if (selectedCustomer === 'all') return true;
    return o.customer_name === selectedCustomer;
  });
  
  const stats = {
    key: 'all',
    name: '全部部门',
    total: targetOrders.length,
    [OrderStatus.PENDING]: 0,
    [OrderStatus.IN_TRANSIT]: 0,
    [OrderStatus.DELIVERED]: 0,
    [OrderStatus.RETURNED]: 0,
    [OrderStatus.EXCEPTION]: 0,
    warningCount: 0,
    delayShipmentCount: 0,
    transitAbnormalCount: 0
  };

  targetOrders.forEach(o => {
    stats[o.status]++;
    
    // Count warnings - include both warning_status and EXCEPTION status
    if (o.warning_status !== WarningStatus.NONE || o.status === OrderStatus.EXCEPTION) {
      stats.warningCount++;
    }
    
    if (o.warning_status === WarningStatus.DELAY_SHIPMENT) {
      stats.delayShipmentCount++;
    }
    
    if (o.warning_status === WarningStatus.TRANSIT_ABNORMAL || o.status === OrderStatus.EXCEPTION) {
      stats.transitAbnormalCount++;
    }
  });

  // 饼图数据
  const pieData = [
    { name: '待发货', value: stats[OrderStatus.PENDING], color: '#f59e0b' },
    { name: '运输中', value: stats[OrderStatus.IN_TRANSIT], color: '#3b82f6' },
    { name: '已签收', value: stats[OrderStatus.DELIVERED], color: '#22c55e' },
    { name: '已退回', value: stats[OrderStatus.RETURNED], color: '#ef4444' },
    { name: '运输异常', value: stats[OrderStatus.EXCEPTION], color: '#ec4899' },
  ].filter(item => item.value > 0);

  // 基于实际订单数据生成趋势图数据
  const trendData = [];
  if (orders.length > 0) {
    // 对于模拟数据，我们使用订单的created_at和updated_at字段来生成最近7天的数据
    // 首先找到最新的订单日期
    const allDates = orders.flatMap(order => {
      const dates = [
        new Date(order.created_at),
        new Date(order.updated_at)
      ];
      // 添加计划发货日
      if (order.details?.planned_ship_date) {
        dates.push(new Date(order.details.planned_ship_date));
      }
      return dates;
    });
    const latestDate = new Date(Math.max(...allDates.map(date => date.getTime())));
    
    // 生成从最新日期开始的过去7天的日期数组
    for (let i = 6; i >= 0; i--) {
      const date = new Date(latestDate);
      date.setDate(latestDate.getDate() - i);
      
      // 格式化日期为YYYY-MM-DD
      const dateStr = date.toISOString().split('T')[0];
      
      // 统计当天的发货数量（当天导入且状态为运输中的订单 + 当天更新为运输中状态的订单）
      const totalOrdersCount = orders.filter(order => {
        if (order.is_archived) return false;
        if (selectedCustomer !== 'all' && order.customer_name !== selectedCustomer) return false;
        
        // 获取订单创建日期（导入日期）
        const createdDate = new Date(order.created_at).toISOString().split('T')[0];
        // 获取订单更新日期
        const updatedDate = new Date(order.updated_at).toISOString().split('T')[0];
        
        // 条件1：当天导入且状态为运输中的订单
        const isCreatedTodayInTransit = createdDate === dateStr && order.status === OrderStatus.IN_TRANSIT;
        // 条件2：当天更新且状态为运输中的订单
        const isUpdatedTodayInTransit = updatedDate === dateStr && order.status === OrderStatus.IN_TRANSIT;
        
        return isCreatedTodayInTransit || isUpdatedTodayInTransit;
      }).length;
      
      // 统计当天的异常订单数量（有预警状态或异常状态的订单）
      const riskCount = orders.filter(order => {
        if (order.is_archived) return false;
        if (selectedCustomer !== 'all' && order.customer_name !== selectedCustomer) return false;
        // 使用计划发货日作为统计日期
        const orderDate = order.details?.planned_ship_date ? new Date(order.details.planned_ship_date).toISOString().split('T')[0] : order.updated_at.split('T')[0];
        return orderDate === dateStr && (order.warning_status !== WarningStatus.NONE || order.status === OrderStatus.EXCEPTION);
      }).length;
      
      // 添加到趋势数据
      trendData.push({
        date: dateStr,
        发货数量: totalOrdersCount,
        异常数量: riskCount
      });
    }
  }

  // 风险订单
  const riskOrders = orders.filter(o => {
    if (o.is_archived) return false;
    if (selectedCustomer !== 'all' && o.customer_name !== selectedCustomer) return false;
    return o.warning_status !== WarningStatus.NONE || o.status === OrderStatus.EXCEPTION;
  });

  return (
    <div className="h-full flex flex-col font-sans overflow-hidden">
      {/* 1. 顶部状态栏 - 固定高度 */}
      <div className="bg-slate-900/50 backdrop-blur-md px-6 py-3 border-b border-cyan-900/30 flex justify-between items-center z-20 flex-shrink-0 h-16">
        <div className="flex flex-col">
          <div className="flex items-center space-x-3">
             <Activity className="text-cyan-400 animate-pulse" size={24} />
             <h2 className="text-2xl font-bold text-white tracking-widest font-mono uppercase">
                全集团物流总览
             </h2>
             <div className="ml-4 flex items-center">
               <select 
                 value={selectedCustomer}
                 onChange={(e) => setSelectedCustomer(e.target.value)}
                 className="bg-slate-800/80 border border-cyan-700 text-cyan-400 text-sm font-mono px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
               >
                 <option value="all">所有客户/项目</option>
                 {uniqueCustomers.map(customer => (
                   <option key={customer} value={customer}>{customer}</option>
                 ))}
               </select>
             </div>
          </div>
          <div className="flex items-center space-x-4 mt-1">
              <p className="text-xs text-cyan-600 font-mono">
                 <span className="text-cyan-400">数据接入:</span> 实时流 (Live Stream)
              </p>
              {selectedCustomer !== 'all' && (
                <p className="text-xs text-cyan-400 font-mono">
                  <span className="text-cyan-400">当前项目:</span> {selectedCustomer}
                </p>
              )}
          </div>
        </div>
        <div className="text-right">
           <div className="text-3xl font-mono font-bold text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] leading-none">
             {new Date().toLocaleTimeString()}
           </div>
           <div className="text-xs text-slate-500 font-mono tracking-widest mt-1">
             {new Date().toLocaleDateString()} {['周日','周一','周二','周三','周四','周五','周六'][new Date().getDay()]}
           </div>
        </div>
      </div>

      {/* 2. 核心内容区 - 自适应高度，不允许滚动 */}
      <div className="flex-1 p-4 overflow-hidden grid grid-rows-[auto_1fr] gap-4 min-h-0">
        
        {/* Row 1: 关键指标卡 (KPI) - 高度自适应内容 */}
        <div className="grid grid-cols-6 gap-4 flex-shrink-0">
          <StatCard 
            title="待发货" 
            count={stats[OrderStatus.PENDING]} 
            total={stats.total} 
            colorClass="amber-500" 
            icon={<Package size={48} />}
          />
          <StatCard 
            title="运输中" 
            count={stats[OrderStatus.IN_TRANSIT]} 
            total={stats.total} 
            colorClass="blue-500" 
            icon={<Truck size={48} />}
          />
          <StatCard 
            title="已签收" 
            count={stats[OrderStatus.DELIVERED]} 
            total={stats.total} 
            colorClass="green-500" 
            icon={<CheckCircle size={48} />}
          />
          <StatCard 
            title="已退回" 
            count={stats[OrderStatus.RETURNED]} 
            total={stats.total} 
            colorClass="red-500" 
            icon={<AlertOctagon size={48} />}
          />
          <StatCard 
            title="延迟发货" 
            count={stats.delayShipmentCount} 
            total={stats.warningCount} 
            colorClass="orange-500" 
            icon={<AlertTriangle size={48} />}
          />
          <StatCard 
            title="运输异常" 
            count={stats[OrderStatus.EXCEPTION]} 
            total={stats.total} 
            colorClass="pink-500" 
            icon={<AlertCircle size={48} />}
          />
        </div>

        {/* Row 2: 图表层 (填充剩余空间) */}
        <div className="grid grid-cols-4 gap-4 min-h-0">
            {/* 状态占比 */}
            <div className="tech-card tech-border p-4 flex flex-col col-span-1">
                <h3 className="text-sm font-bold text-cyan-100 flex items-center mb-2 font-mono tracking-wider">
                    <PieIcon className="mr-2 text-cyan-500" size={16} />
                    状态占比分析
                </h3>
                <div className="flex-1 min-h-0 relative">
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={150} minHeight={150}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="50%"
                                    outerRadius="70%"
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', borderRadius: '4px', fontSize: '12px'}}
                                    itemStyle={{color: '#f8fafc'}}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36} 
                                    iconType="circle"
                                    formatter={(value) => <span className="text-slate-400 text-xs ml-1">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                            暂无数据
                        </div>
                    )}
                </div>
            </div>

            {/* 趋势图 */}
            <div className="tech-card tech-border p-4 flex flex-col col-span-2">
                 <h3 className="text-sm font-bold text-cyan-100 flex items-center mb-2 font-mono tracking-wider">
                    <TrendingUp className="mr-2 text-cyan-500" size={16} />
                    近七日发货/异常趋势
                </h3>
                <div className="flex-1 min-h-0 relative">
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', fontSize: '12px'}}
                                />
                                <Area type="monotone" dataKey="发货数量" stroke="#06b6d4" fillOpacity={1} fill="url(#colorOrders)" name="发货数量" />
                                <Area type="monotone" dataKey="异常数量" stroke="#ef4444" fillOpacity={1} fill="url(#colorRisk)" name="异常数量" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                            暂无数据
                        </div>
                    )}
                </div>
            </div>

            {/* 风险概览 */}
            <div className="bg-red-950/20 border border-red-900/50 p-4 flex flex-col justify-center relative overflow-hidden group col-span-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 to-transparent animate-pulse"></div>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <AlertTriangle size={32} className="text-red-500 mb-2 animate-bounce" />
                    <h3 className="text-sm font-bold tracking-widest font-mono text-red-500">总预警数</h3>
                    <span className="text-6xl font-mono font-bold text-white drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] my-2">
                        {stats.warningCount}
                    </span>
                    <div className="text-center text-xs text-red-400 space-y-1 mb-2">
                        <div>延迟发货: {stats.delayShipmentCount}</div>
                        <div>运输异常: {stats.transitAbnormalCount}</div>
                    </div>
                    <button 
                    onClick={() => navigate('/departments?filter=risk')}
                    className="mt-2 px-4 py-1 bg-red-600/20 hover:bg-red-600/40 border border-red-600 text-red-400 font-mono text-xs transition-all w-full text-center"
                    >
                        查看详情
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* 3. 底部滚动警报栏 - 固定高度 */}
      <div className="h-10 bg-black/80 border-t border-red-900/50 text-white flex items-center overflow-hidden relative z-30 flex-shrink-0">
        <div className="bg-red-900/80 px-4 h-full flex items-center font-bold z-10 shrink-0 font-mono text-sm tracking-widest shadow-[0_0_10px_rgba(220,38,38,0.5)]">
          风险预警实时播报
        </div>
        <div className="flex-1 overflow-hidden relative">
            <div className="animate-[ticker_30s_linear_infinite] absolute top-0 h-full flex items-center whitespace-nowrap">
                {riskOrders.length === 0 ? (
                    <div className="flex items-center space-x-12 px-4">
                        <span className="text-green-500 font-mono text-sm flex items-center whitespace-nowrap">
                            <CheckCircle size={14} className="mr-2"/> 系统运行正常 // 所有订单流转顺畅 // 暂无滞留风险
                        </span>
                        {/* 重复文本以实现无缝滚动效果 */}
                        <span className="text-green-500 font-mono text-sm flex items-center whitespace-nowrap">
                            <CheckCircle size={14} className="mr-2"/> 系统运行正常 // 所有订单流转顺畅 // 暂无滞留风险
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center space-x-12 px-4">
                        {riskOrders.map(order => (
                            <span key={order.id} className={`font-mono text-sm flex items-center whitespace-nowrap ${order.warning_status === WarningStatus.DELAY_SHIPMENT ? 'text-orange-400' : 'text-red-400'}`}>
                               {order.warning_status === WarningStatus.DELAY_SHIPMENT ? (
                                   <AlertTriangle size={14} className="mr-2"/>
                               ) : (
                                   <AlertCircle size={14} className="mr-2"/>
                               )}
                               [{order.department_key}] 单号: {order.order_number} ({order.customer_name}) - 
                               {order.warning_status === WarningStatus.DELAY_SHIPMENT ? '延迟发货' : '运输异常'}
                            </span>
                        ))}
                        {/* 复制一遍风险订单以实现无缝滚动 */}
                        {riskOrders.map(order => (
                            <span key={`dup-${order.id}`} className={`font-mono text-sm flex items-center whitespace-nowrap ${order.warning_status === WarningStatus.DELAY_SHIPMENT ? 'text-orange-400' : 'text-red-400'}`}>
                               {order.warning_status === WarningStatus.DELAY_SHIPMENT ? (
                                   <AlertTriangle size={14} className="mr-2"/>
                               ) : (
                                   <AlertCircle size={14} className="mr-2"/>
                               )}
                               [{order.department_key}] 单号: {order.order_number} ({order.customer_name}) - 
                               {order.warning_status === WarningStatus.DELAY_SHIPMENT ? '延迟发货' : '运输异常'}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};