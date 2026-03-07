import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLogisticsStore } from '../services/store';
import { ArrowLeft, RefreshCw, Package, MapPin, Calendar, Truck, Clock, AlertTriangle, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { OrderStatus, WarningStatus, DEPARTMENT_DICT, ORDER_STATUS_MAP, WARNING_STATUS_MAP } from '../types';
import * as XLSX from 'xlsx';

export const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, updateOrderStatus, refreshProgress, refreshStatus } = useLogisticsStore();
  
  const order = orders.find(o => o.id === parseInt(id));
  if (!order) {
    return <div className="p-10 text-center text-red-500 font-mono">错误 404: 未找到订单</div>;
  }

  const handleRefresh = () => {
    // 无论订单状态如何，都允许手动刷新物流信息
    updateOrderStatus(order.id);
  };

  const handleExport = () => {
    // 导出订单功能
    try {
      // 准备导出数据
      const exportData = [{
        '订单ID': order.id,
        '订单号': order.order_number,
        '客户名称': order.customer_name,
        '部门': DEPARTMENT_DICT[order.department_key]?.name || order.department_key,
        '订单状态': ORDER_STATUS_MAP[order.status],
        '预警状态': WARNING_STATUS_MAP[order.warning_status],
        '物流单号': order.details?.tracking_number || order.order_number,
        '承运商': order.details?.carrier || 'N/A',
        '目的地': order.details?.destination || 'N/A',
        '计划发货日': order.details?.planned_ship_date ? new Date(order.details.planned_ship_date).toLocaleDateString() : 'N/A',
        '下单日期': order.details?.order_date ? new Date(order.details.order_date).toLocaleDateString() : 'N/A',
        '产品信息': order.details?.product_info || 'N/A',
        '备注': order.details?.note || 'N/A',
        '最后更新时间': new Date(order.updated_at).toLocaleString(),
        '创建时间': order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'
      }];
      
      // 创建工作簿和工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '订单详情');
      
      // 导出为XLSX文件
      XLSX.writeFile(workbook, `order_${order.id}_${order.order_number}.xlsx`);
    } catch (error) {
      console.error('导出订单失败:', error);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto h-full overflow-y-auto">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center text-slate-400 hover:text-cyan-400 mb-6 transition font-mono text-sm"
      >
        <ArrowLeft size={16} className="mr-1" /> 返回列表
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Info Dossier */}
        <div className="md:col-span-1 space-y-6">
            <div className="tech-card tech-border p-6 relative overflow-hidden">
                {/* Decoration Lines */}
                <div className="absolute top-0 right-0 p-2">
                    <div className="flex space-x-1">
                        <div className="w-8 h-1 bg-cyan-500/50"></div>
                        <div className="w-2 h-1 bg-cyan-500/50"></div>
                    </div>
                </div>

                <h2 className="text-lg font-bold text-white mb-6 flex items-center font-mono tracking-widest border-b border-slate-700 pb-2">
                    <Package className="mr-2 text-cyan-400" size={18}/>
                    物流清单
                </h2>
                
                <div className="space-y-6 font-mono">
                    <div>
                        <label className="text-[10px] text-cyan-600 uppercase tracking-widest">物流单号</label>
                        <p className="text-xl text-cyan-400 font-bold tracking-wider drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">{order.details?.tracking_number || order.order_number}</p>
                    </div>
                    <div>
                        <label className="text-[10px] text-cyan-600 uppercase tracking-widest">当前状态</label>
                        <div className="mt-1">
                             <span className={`px-3 py-1 text-sm border
                                ${order.status === OrderStatus.PENDING ? 'border-amber-500 text-amber-500' : ''}
                                ${order.status === OrderStatus.IN_TRANSIT ? 'border-blue-500 text-blue-500' : ''}
                                ${order.status === OrderStatus.DELIVERED ? 'border-green-500 text-green-500' : ''}
                                ${order.status === OrderStatus.RETURNED ? 'border-red-500 text-red-500' : ''}
                                ${order.status === OrderStatus.EXCEPTION ? 'border-orange-500 text-orange-500' : ''}
                            `}>
                                {ORDER_STATUS_MAP[order.status]}
                            </span>
                        </div>
                    </div>
                    {order.details?.trackingInfo?.status && (
                        <div>
                            <label className="text-[10px] text-cyan-600 uppercase tracking-widest">物流状态</label>
                            <p className="text-slate-300 mt-1 text-sm">{order.details.trackingInfo.status}</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="text-[10px] text-cyan-600 uppercase tracking-widest">承运商</label>
                             <div className="flex items-center mt-1 text-slate-300 text-sm">
                                <Truck size={14} className="mr-2 text-slate-500"/>
                                {order.details?.carrier || 'N/A'}
                             </div>
                        </div>
                        <div>
                             <label className="text-[10px] text-cyan-600 uppercase tracking-widest">所属部门</label>
                             <p className="text-slate-300 mt-1 text-sm">
                                {DEPARTMENT_DICT[order.department_key]?.name || order.department_key}
                             </p>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-cyan-600 uppercase tracking-widest">目的地</label>
                        <div className="flex items-center mt-1 text-slate-300 text-sm">
                            <MapPin size={14} className="mr-2 text-slate-500"/>
                            {order.details?.destination || 'N/A'}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-cyan-600 uppercase tracking-widest">计划发货日</label>
                        <div className="flex items-center mt-1 text-slate-300 text-sm">
                            <Calendar size={14} className="mr-2 text-slate-500"/>
                            {order.details?.planned_ship_date ? new Date(order.details.planned_ship_date).toLocaleDateString() : 'N/A'}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-cyan-600 uppercase tracking-widest">客户名称</label>
                        <p className="text-slate-200 mt-1 font-bold">{order.details?.recipient || '未知客户'}</p>
                    </div>
                    <div>
                        <label className="text-[10px] text-cyan-600 uppercase tracking-widest">下单日期</label>
                        <div className="flex items-center mt-1 text-slate-300 text-sm">
                             <Calendar size={14} className="mr-2 text-slate-500"/>
                             {order.details?.order_date ? new Date(order.details.order_date).toLocaleDateString() : 'N/A'}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-cyan-600 uppercase tracking-widest">预警状态</label>
                        <div className="flex items-center mt-1">
                            {order.warning_status === WarningStatus.NONE && (
                                <span className="flex items-center text-green-400 text-sm">
                                    <CheckCircle size={14} className="mr-2"/>
                                    {WARNING_STATUS_MAP[order.warning_status]}
                                </span>
                            )}
                            {order.warning_status === WarningStatus.DELAY_SHIPMENT && (
                                <span className="flex items-center text-orange-400 text-sm">
                                    <AlertTriangle size={14} className="mr-2"/>
                                    {WARNING_STATUS_MAP[order.warning_status]}
                                </span>
                            )}
                            {order.warning_status === WarningStatus.TRANSIT_ABNORMAL && (
                                <span className="flex items-center text-red-400 text-sm">
                                    <AlertCircle size={14} className="mr-2"/>
                                    {WARNING_STATUS_MAP[order.warning_status]}
                                </span>
                            )}
                            {/* WarningStatus.CUSTOM 不存在，已移除 */}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-cyan-600 uppercase tracking-widest">产品信息</label>
                        <p className="text-slate-300 mt-1 text-sm">{order.details?.product_info}</p>
                    </div>
                    {order.details?.note && (
                        <div>
                            <label className="text-[10px] text-cyan-600 uppercase tracking-widest">备注</label>
                            <p className="text-slate-300 mt-1 text-sm italic">{order.details?.note}</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] text-cyan-600 uppercase tracking-widest">最后更新时间</label>
                            <div className="flex items-center mt-1 text-slate-300 text-sm">
                                <Clock size={14} className="mr-2 text-slate-500"/>
                                {new Date(order.updated_at).toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-cyan-600 uppercase tracking-widest">创建时间</label>
                            <div className="flex items-center mt-1 text-slate-300 text-sm">
                                <Calendar size={14} className="mr-2 text-slate-500"/>
                                {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}
                            </div>
                        </div>
                    </div>
                    {/* 创建人和更新人字段不存在于Order接口中，已注释 */}
                    {/* {order.details?.created_by && (
                        <div>
                            <label className="text-[10px] text-cyan-600 uppercase tracking-widest">创建人</label>
                            <p className="text-slate-300 mt-1 text-sm">{order.details?.created_by}</p>
                        </div>
                    )}
                    {order.details?.updated_by && (
                        <div>
                            <label className="text-[10px] text-cyan-600 uppercase tracking-widest">更新人</label>
                            <p className="text-slate-300 mt-1 text-sm">{order.details?.updated_by}</p>
                        </div>
                    )} */}
                    {order.is_archived && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-cyan-600 uppercase tracking-widest">归档时间</label>
                                <div className="flex items-center mt-1 text-slate-300 text-sm">
                                    <Calendar size={14} className="mr-2 text-slate-500"/>
                                {order.details?.archived_at ? new Date(order.details?.archived_at).toLocaleString() : 'N/A'}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-cyan-600 uppercase tracking-widest">归档人</label>
                            <p className="text-slate-300 mt-1 text-sm">{order.details?.archived_by || 'N/A'}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800">
                    <button 
                    onClick={handleRefresh}
                    className="w-full flex items-center justify-center space-x-2 bg-cyan-900/30 hover:bg-cyan-800/50 border border-cyan-700 text-cyan-400 py-3 transition group"
                    >
                        <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500"/>
                        <span className="font-mono text-sm">手动刷新状态</span>
                    </button>
                    
                    {/* 刷新进度条 */}
                    {refreshStatus && (
                        <div className="mt-4">
                            <div className="text-sm text-cyan-400 mb-2 font-mono">{refreshStatus}</div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                                <div 
                                    className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${refreshProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                    
                    <div className="mt-4">
                        <button 
                        onClick={handleExport}
                        className="w-full flex items-center justify-center space-x-2 bg-green-900/30 hover:bg-green-800/50 border border-green-700 text-green-400 py-3 transition group"
                        >
                            <Download size={16} className="group-hover:scale-110 transition-transform duration-300"/>
                            <span className="font-mono text-sm">导出订单</span>
                        </button>
                    </div>
                    <div className="mt-3 flex items-center justify-center text-[10px] text-slate-500 font-mono">
                        <Clock size={10} className="mr-1" />
                        系统仅支持手动刷新
                    </div>
                </div>
            </div>
        </div>

        {/* Right Column: Timeline */}
        <div className="md:col-span-2">
            <div className="tech-card tech-border p-6 h-full relative">
                 <h2 className="text-lg font-bold text-white mb-8 font-mono tracking-widest border-b border-slate-700 pb-2">
                     物流轨迹追踪
                 </h2>

                 {order.details?.timeline?.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-slate-600">
                         <Package size={48} className="mb-4 opacity-20"/>
                         <p className="font-mono">暂无轨迹数据</p>
                         <button 
                             onClick={handleRefresh}
                             className="mt-4 px-4 py-2 text-sm border border-cyan-700 text-cyan-400 hover:bg-cyan-900/30 transition font-mono"
                         >
                             手动刷新物流信息
                         </button>
                     </div>
                 ) : (
                     <div className="relative border-l border-slate-700 ml-4 space-y-8 pl-8 py-2">
                         {order.details?.timeline?.map((node, index) => (
                            <div key={`${node.timestamp}-${index}`} className="relative group">
                                 {/* Dot */}
                                 <div className={`absolute -left-[37px] top-1 w-4 h-4 rounded-full border-2 shadow-[0_0_10px_currentColor]
                                     ${index === 0 ? 'bg-black border-cyan-400 text-cyan-400' : 'bg-black border-slate-600 text-slate-600'}
                                 `}></div>
                                  
                                 {/* Content */}
                                 <div className={`p-4 border ${index === 0 ? 'border-cyan-900/50 bg-cyan-950/10' : 'border-transparent'} rounded-none transition-colors`}>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                                        <div className="flex-1">
                                            <p className={`font-mono text-sm ${index === 0 ? 'text-cyan-300 font-bold' : 'text-slate-400'}`}>
                                                {node.description}
                                            </p>
                                            {/* ✅ 修复：移除对不存在的location字段的访问 */}
                                            {/* 如果需要显示位置信息，可以从description中提取或留空 */}
                                            <div className="flex items-center text-xs text-slate-500 mt-2 font-mono">
                                                <MapPin size={12} className="mr-1"/>
                                                当前位置: {node.location || '未知'}
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-cyan-700 mt-1 sm:mt-0 whitespace-nowrap">
                                            {new Date(node.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                 </div>
                             </div>
                         ))}
                         <div className="flex justify-center mt-8">
                             <button 
                                 onClick={handleRefresh}
                                 className="px-4 py-2 text-sm border border-cyan-700 text-cyan-400 hover:bg-cyan-900/30 transition font-mono"
                             >
                                 手动刷新物流信息
                             </button>
                         </div>
                     </div>
                 )}
            </div>
        </div>
      </div>
    </div>
  );
};