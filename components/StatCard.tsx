import React from 'react';

interface StatCardProps {
  title: string;
  count: number;
  total: number;
  colorClass: string;
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, count, total, colorClass, icon }) => {
  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
  
  // 提取基础颜色名称（例如从 "bg-amber-500" 中提取 "amber-500"）
  const baseColor = colorClass.replace('bg-', '').replace('text-', '');

  return (
    <div className={`p-6 rounded-none tech-card tech-border relative overflow-hidden group hover:bg-slate-800/50 transition-all duration-300`}>
      {/* 角落装饰 */}
      <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l border-${baseColor} opacity-50`}></div>
      <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r border-${baseColor} opacity-50`}></div>

      <div className={`absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity text-${baseColor} blur-sm`}>
        {icon}
      </div>
      
      <div className="relative z-10">
        <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-1">{title}</p>
        <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white font-mono tracking-tighter drop-shadow-md">{count}</span>
            <span className="text-xs text-slate-500">UNITS</span>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
           <div className="w-full bg-slate-700/50 h-1 mr-4 overflow-hidden">
             <div 
                className={`h-full bg-${baseColor} shadow-[0_0_10px_currentColor]`} 
                style={{ width: `${percentage}%` }}
             ></div>
           </div>
           <span className={`text-xs font-mono font-bold text-${baseColor}`}>{percentage}%</span>
        </div>
      </div>
    </div>
  );
};