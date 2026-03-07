import React, { Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';

// 直接导入组件，暂时不使用懒加载
import { Dashboard } from './pages/Dashboard';
import { DepartmentList } from './pages/DepartmentList';
import { OrderDetail } from './pages/OrderDetail';
import { Admin } from './pages/Admin';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { UserProfile } from './pages/UserProfile';
import { DebugAuth } from './pages/DebugAuth';
import { useLogisticsStore } from './services/store';
import { Role } from './types';
import { apiService } from './services/api';

// 受保护路由组件
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly = false }) => {
  const isAuthenticated = useLogisticsStore(state => state.auth.isAuthenticated);
  const isAdmin = useLogisticsStore(state => state.auth.user?.role === Role.ADMIN);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// 公共路由组件（已登录用户重定向）
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useLogisticsStore(state => state.auth.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  // 在应用启动时获取CSRF令牌
  useEffect(() => {
    // 检查认证状态
    const authState = useLogisticsStore.getState().auth;
    console.log('应用启动时的认证状态:', {
      isAuthenticated: authState?.isAuthenticated,
      hasToken: !!authState?.token,
      hasUser: !!authState?.user
    });
    
    // 发送一个简单的GET请求来获取CSRF令牌
    apiService.get('/auth/csrf-token')
      .catch(() => {
        // 忽略错误，因为这只是为了获取CSRF令牌
        console.log('已尝试获取CSRF令牌');
      });
  }, []);

  return (
    <HashRouter>
      <Suspense fallback={<div className="flex items-center justify-center h-screen text-white font-mono">加载中...</div>}>
        <Routes>
          {/* 公共路由 */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          {/* 调试页面，无需登录即可访问 */}
          <Route path="/debug-auth" element={<DebugAuth />} />
          
          {/* 受保护路由 */}
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/departments" element={<ProtectedRoute><Layout><DepartmentList /></Layout></ProtectedRoute>} />
          <Route path="/order/:id" element={<ProtectedRoute><Layout><OrderDetail /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><UserProfile /></Layout></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly={true}><Layout><Admin /></Layout></ProtectedRoute>} />
          
          {/* 404路由 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

export default App;