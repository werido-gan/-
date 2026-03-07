import React, { useState, useEffect } from 'react';
import { useLogisticsStore } from '../services/store';
import { apiService } from '../services/api';
import { Role } from '../types';
import { Terminal, CheckCircle, AlertCircle, Lock, Key, Database, Users, Server, RefreshCw } from 'lucide-react';

export const DebugAuth: React.FC = () => {
  const authState = useLogisticsStore.getState().auth;
  const login = useLogisticsStore(state => state.login);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    localStorageData: {},
    storeData: {},
    csrfToken: '',
    apiConfig: {}
  });

  // 加载调试信息
  useEffect(() => {
    // 获取localStorage数据
    const localStorageData = {
      user: localStorage.getItem('user'),
      isAuthenticated: localStorage.getItem('isAuthenticated'),
      token: localStorage.getItem('token')
    };

    // 获取store数据
    const storeData = {
      auth: useLogisticsStore.getState().auth
    };

    // 获取CSRF令牌
    const csrfToken = useLogisticsStore.getState().auth.csrfToken;

    // 获取API配置
    const apiConfig = {
      baseURL: (apiService as any).axiosInstance.defaults.baseURL
    };

    setDebugInfo({
      localStorageData,
      storeData,
      csrfToken,
      apiConfig
    });
  }, []);

  // 测试API请求
  const testApiRequest = async () => {
    setLoading(true);
    setTestResult(null);
    setApiResponse(null);

    try {
      // 测试获取用户列表
      const response = await apiService.get('/users');
      setTestResult('✅ API请求成功');
      setApiResponse(response);
    } catch (error: any) {
      setTestResult('❌ API请求失败');
      setApiResponse({
        status: error.status,
        message: error.message,
        originalError: error
      });
    } finally {
      setLoading(false);
    }
  };

  // 测试登录
  const testLogin = async () => {
    setLoading(true);
    setTestResult(null);
    setApiResponse(null);

    try {
      // 使用默认的管理员账号测试登录
      const response = await apiService.post('/auth/login', {
        username: 'admin',
        password: 'admin123'
      });

      if (response.success && response.data) {
        const data = response.data as { user: any; access_token: string };
        login(data.user, data.access_token);
        setTestResult('✅ 登录成功');
        setApiResponse(response);

        // 重新加载调试信息
        const localStorageData = {
          user: localStorage.getItem('user'),
          isAuthenticated: localStorage.getItem('isAuthenticated'),
          token: localStorage.getItem('token')
        };
        const storeData = {
          auth: useLogisticsStore.getState().auth
        };
        setDebugInfo(prev => ({
          ...prev,
          localStorageData,
          storeData
        }));
      } else {
        setTestResult('❌ 登录失败');
        setApiResponse(response);
      }
    } catch (error: any) {
      setTestResult('❌ 登录请求失败');
      setApiResponse(error);
    } finally {
      setLoading(false);
    }
  };

  // 格式化JSON数据
  const formatJson = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return String(data);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-800 rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.1)] p-6">
          <div className="flex items-center gap-3 mb-6">
            <Terminal size={32} className="text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">认证调试工具</h1>
          </div>

          {/* 调试信息卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* 认证状态 */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-cyan-900/30">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="text-cyan-400" />
                <h2 className="text-lg font-semibold">认证状态</h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">已认证:</span>
                  <span className={`flex items-center gap-1 ${authState.isAuthenticated ? 'text-green-400' : 'text-red-400'}`}>
                    {authState.isAuthenticated ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {authState.isAuthenticated ? '是' : '否'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">用户角色:</span>
                  <span className={`font-mono ${authState.user?.role === Role.ADMIN ? 'text-purple-400' : 'text-blue-400'}`}>
                    {authState.user?.role || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">用户名:</span>
                  <span className="font-mono">{authState.user?.username || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Token信息 */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-cyan-900/30">
              <div className="flex items-center gap-2 mb-3">
                <Key className="text-cyan-400" />
                <h2 className="text-lg font-semibold">Token信息</h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Token存在:</span>
                  <span className={`flex items-center gap-1 ${authState.token ? 'text-green-400' : 'text-red-400'}`}>
                    {authState.token ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {authState.token ? '是' : '否'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Token内容:</span>
                  <div className="font-mono bg-slate-900 p-2 rounded text-xs overflow-x-auto max-h-20">
                    {authState.token || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* LocalStorage数据 */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-cyan-900/30">
              <div className="flex items-center gap-2 mb-3">
                <Database className="text-cyan-400" />
                <h2 className="text-lg font-semibold">LocalStorage数据</h2>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-400 block mb-1">user:</span>
                  <div className="font-mono bg-slate-900 p-2 rounded text-xs overflow-x-auto max-h-20">
                    {debugInfo.localStorageData.user || 'N/A'}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">isAuthenticated:</span>
                  <span className="font-mono">{debugInfo.localStorageData.isAuthenticated || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">token:</span>
                  <div className="font-mono bg-slate-900 p-2 rounded text-xs overflow-x-auto max-h-20">
                    {debugInfo.localStorageData.token || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* API配置 */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-cyan-900/30">
              <div className="flex items-center gap-2 mb-3">
                <Server className="text-cyan-400" />
                <h2 className="text-lg font-semibold">API配置</h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Base URL:</span>
                  <span className="font-mono">{debugInfo.apiConfig.baseURL || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">CSRF Token:</span>
                  <span className="font-mono">{debugInfo.csrfToken ? '存在' : '不存在'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 测试按钮 */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={testLogin}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              disabled={loading}
            >
              {loading ? <RefreshCw size={20} className="animate-spin" /> : <Users size={20} />}
              测试登录 (admin/admin123)
            </button>
            <button
              onClick={testApiRequest}
              className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
              disabled={loading}
            >
              {loading ? <RefreshCw size={20} className="animate-spin" /> : <Server size={20} />}
              测试API请求 (/users)
            </button>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className="bg-slate-900/50 rounded-lg p-4 border border-cyan-900/30 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="text-cyan-400" />
                <h2 className="text-lg font-semibold">测试结果</h2>
              </div>
              <div className={`text-lg font-semibold mb-3 ${testResult.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {testResult}
              </div>
              {apiResponse && (
                <div>
                  <span className="text-slate-400 block mb-1">响应数据:</span>
                  <pre className="font-mono bg-slate-900 p-3 rounded text-xs overflow-x-auto max-h-40">
                    {formatJson(apiResponse)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* 操作指南 */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-amber-900/30">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="text-amber-400" />
              <h2 className="text-lg font-semibold">操作指南</h2>
            </div>
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
              <li>如果您看到"Token不存在"，请先点击"测试登录"按钮</li>
              <li>如果登录失败，请检查用户名和密码是否正确</li>
              <li>如果登录成功但API请求失败，请检查控制台日志中的详细错误信息</li>
              <li>确保您的用户角色为"admin"才能访问用户管理和系统日志功能</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};