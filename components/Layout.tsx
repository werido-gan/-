import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, List, Upload, PackageOpen, Cpu, User, LogOut } from 'lucide-react';
import { useLogisticsStore } from '../services/store';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  // 修复 1：补充 auth 层级的可选链，避免崩溃
  const isAdmin = useLogisticsStore(state => state.auth?.user?.role === 'admin');
  const logout = useLogisticsStore(state => state.logout);
  const username = useLogisticsStore(state => state.auth?.user?.username) || '未登录'; // 增加默认值
  const userRole = useLogisticsStore(state => state.auth?.user?.role) || '访客'; // 增加默认值

  const navItems = [
    { path: '/', label: '总控看板', icon: <LayoutDashboard size={18} /> },
    { path: '/departments', label: '业务明细', icon: <List size={18} /> },
    ...(isAdmin ? [{ path: '/admin', label: '数据中台', icon: <Upload size={18} /> }] : []),
    { path: '/profile', label: '个人信息', icon: <User size={18} /> },
  ];

  // 获取用户信息用于登录状态守卫
  const user = useLogisticsStore(state => state.auth?.user);

  // 修复 2：增加登录状态守卫，拦截未登录访问
  useEffect(() => {
    // 排除登录页本身，避免循环跳转
    if (!user && location.pathname !== '/login') {
      navigate('/login', { replace: true }); // replace 防止回退到未登录页面
    }
  }, [navigate, location.pathname, user]);

  // 修复 3：处理登出异步逻辑（无论 logout 是否异步，明确标注并处理）
  const handleLogout = async () => {
    try {
      // 若 logout 是异步接口调用，await 确保状态清理完成
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('登出失败：', error);
      // 增加错误提示，提升用户体验
      alert('登出失败，请重试！');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-transparent font-sans select-none">
      {/* 顶部导航栏 */}
      <header className="flex-shrink-0 h-16 bg-slate-900/90 border-b border-cyan-900/50 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        
        {/* 左侧：品牌 Logo 和状态显示 */}
        <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
          {/* Logo */}
          <div className="relative group">
            <div className="absolute inset-0 bg-cyan-500 blur-md opacity-40 group-hover:opacity-60 transition-opacity"></div>
            <PackageOpen className="text-cyan-400 relative z-10" size={24} sm:size={28} />
          </div>
          
          {/* 品牌信息 */}
          <div className="hidden sm:block">
            <h1 className="text-xl sm:text-2xl font-bold tracking-[0.2em] text-white font-mono leading-none">
              LOGI<span className="text-cyan-400">VIEW</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-cyan-600 tracking-widest mt-0.5">智能物流全景管控平台</p>
          </div>
          
          {/* 系统运行状态 */}
          <div className="hidden md:flex items-center space-x-2 border-l border-cyan-900/50 pl-3 sm:pl-4 ml-3 sm:ml-4">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]"></div>
            <p className="text-[10px] text-cyan-500 tracking-wider font-mono whitespace-nowrap">系统运行中</p>
          </div>
        </div>

        {/* 中间：导航菜单 */}
        <nav className="flex items-center space-x-1 overflow-x-auto flex-1 justify-start pl-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center space-x-2 px-4 sm:px-6 py-2 transition-all duration-300 group shrink-0 ${
                  isActive 
                    ? 'text-cyan-400' 
                    : 'text-slate-400 hover:text-cyan-200'
                }`}
              >
                {/* 激活指示条 */}
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                )}
                {/* 激活背景光效 */}
                {isActive && (
                   <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/20 to-transparent opacity-50"></div>
                )}

                <div className={`${isActive ? 'drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' : ''}`}>
                    {item.icon}
                </div>
                <span className="font-mono text-sm font-bold tracking-wide hidden sm:block whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
          
          {/* 登出按钮 */}
          <button
            onClick={handleLogout}
            className="relative flex items-center space-x-2 px-4 sm:px-6 py-2 transition-all duration-300 group text-slate-400 hover:text-cyan-200 shrink-0"
          >
            <div>
              <LogOut size={18} />
            </div>
            <span className="font-mono text-sm font-bold tracking-wide hidden sm:block whitespace-nowrap">退出登录</span>
          </button>
        </nav>

        {/* 右侧：用户信息 */}
        <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
          {/* 用户信息 */}
          <div className="hidden md:flex items-center space-x-2 text-sm text-slate-400 font-mono whitespace-nowrap">
            <span className="text-cyan-400">{username}</span>
            <span className="text-slate-700">|</span>
            <span>{userRole === 'admin' ? '管理员' : '普通用户'}</span>
          </div>
          
          {/* 装饰性版本号 */}
          <div className="hidden lg:flex items-center space-x-2 text-slate-600 font-mono text-xs border border-slate-800 px-2 py-1 bg-black/40 whitespace-nowrap">
             <Cpu size={12} />
             <span>内核 v2.1.0</span>
          </div>
        </div>
      </header>

      {/* 主内容区域 - 绝对禁止滚动，内容必须适配 */}
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
};