import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageOpen, User, Lock } from 'lucide-react';
import { useLogisticsStore } from '../services/store';
import { Role } from '../types';
import { apiService } from '../services/api';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const login = useLogisticsStore(state => state.login);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState<{ username?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // 清除对应字段的错误
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors: { username?: string; password?: string } = {};

    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // ✅ 修复：先获取CSRF令牌
      console.log('正在获取CSRF令牌...');
      const csrfResponse = await apiService.get('/auth/csrf-token');
      if (csrfResponse.success && csrfResponse.data?.csrfToken) {
        // 保存CSRF令牌到store
        useLogisticsStore.getState().setCsrfToken(csrfResponse.data.csrfToken);
        console.log('获取到CSRF令牌:', csrfResponse.data.csrfToken);
      }
      
      // 调用真实的登录API
      console.log('正在发送登录请求...');
      const response = await apiService.post('/auth/login', formData);
      
      if (response.success && response.data) {
        // 使用store中的login方法，添加真实token
        // 注意：后端返回的Token字段名是access_token
        const data = response.data as { user: any; access_token: string };
        
        // 检查返回的数据结构
        console.log('登录响应数据:', data);
        
        if (!data.access_token) {
          throw new Error('登录响应中缺少token');
        }
        
        login(data.user, data.access_token);

        // 登录成功后跳转到仪表盘
        navigate('/');
      } else {
        // 登录失败，显示错误信息
        setErrors(prev => ({ ...prev, general: response.message || '登录失败，请检查用户名和密码' }));
      }
    } catch (error: any) {
      // 处理错误响应，确保错误信息始终是字符串
      let errorMessage = '登录失败，请检查用户名和密码';
      if (error) {
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.message) {
          if (typeof error.message === 'string') {
            errorMessage = error.message;
          } else if (typeof error.message === 'object') {
            // 如果message是对象，尝试从中提取字符串信息
            if (error.message.message) {
              errorMessage = error.message.message;
            } else if (error.message.error) {
              errorMessage = error.message.error;
            } else {
              errorMessage = JSON.stringify(error.message);
            }
          }
        } else if (error.error) {
          errorMessage = error.error;
        }
      }
      setErrors(prev => ({ ...prev, general: errorMessage }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-black to-slate-900 p-4">
      <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-sm border border-cyan-900/50 rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.1)] overflow-hidden">
        {/* 头部 */}
        <div className="bg-slate-900/90 p-8 border-b border-cyan-900/30">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500 blur-md opacity-40"></div>
              <PackageOpen className="text-cyan-400 relative z-10" size={48} />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-[0.2em] text-white font-mono text-center mb-2">
            LOGI<span className="text-cyan-400">VIEW</span>
          </h1>
          <p className="text-[12px] text-cyan-600 tracking-widest text-center">智能物流全景管控平台</p>
        </div>

        {/* 登录表单 */}
        <div className="p-8">
          {errors.general && (
            <div className="mb-6 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="text-slate-500" size={20} />
                </div>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="用户名"
                  className={`w-full pl-12 pr-4 py-3 bg-slate-700/50 border ${errors.username ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300`}
                  disabled={isLoading}
                />
              </div>
              {errors.username && (
                <p className="mt-2 text-red-400 text-sm">{errors.username}</p>
              )}
            </div>

            <div className="mb-8">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="text-slate-500" size={20} />
                </div>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="密码"
                  className={`w-full pl-12 pr-4 py-3 bg-slate-700/50 border ${errors.password ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300`}
                  disabled={isLoading}
                />
              </div>
              {errors.password && (
                <p className="mt-2 text-red-400 text-sm">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-mono font-bold tracking-wide rounded-lg transition-all duration-300 ${isLoading ? 'opacity-70 cursor-not-allowed' : 'shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]'}`}
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* 注册链接 */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              还没有账号？
              <button
                onClick={() => navigate('/register')}
                className="ml-1 text-cyan-400 hover:text-cyan-300 transition-colors duration-300"
              >
                立即注册
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};