import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageOpen, User, Lock, Mail, Phone, Building2 } from 'lucide-react';
import { DEPARTMENTS, DEPARTMENT_DICT, Role } from '../types';
import { useLogisticsStore } from '../services/store';
import { apiService } from '../services/api';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const login = useLogisticsStore(state => state.login);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: '',
    department: ''
  });
  const [errors, setErrors] = useState<{ 
    username?: string; 
    password?: string; 
    confirmPassword?: string; 
    email?: string; 
    phone?: string; 
    department?: string; 
    general?: string 
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // 清除对应字段的错误
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors: { 
      username?: string; 
      password?: string; 
      confirmPassword?: string; 
      email?: string; 
      phone?: string; 
      department?: string 
    } = {};

    // 用户名验证
    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名至少3个字符';
    }

    // 密码验证
    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少6个字符';
    }

    // 确认密码验证
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    // 邮箱验证
    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = '请输入有效的邮箱地址';
      }
    }

    // 手机号验证
    if (formData.phone.trim()) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(formData.phone)) {
        newErrors.phone = '请输入有效的手机号';
      }
    }

    // 部门验证
    if (!formData.department) {
      newErrors.department = '请选择所属部门';
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
      // 调用真实的注册API
      const { confirmPassword, ...registerData } = formData;
      const response = await apiService.post('/auth/register', registerData);
      
      if (response.success && response.data) {
        // 注册成功后跳转到登录页面，让用户手动登录
        navigate('/login');
      } else {
        // 注册失败，显示错误信息
        setErrors(prev => ({ ...prev, general: response.message || '注册失败，请稍后重试' }));
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, general: error instanceof Error ? error.message : '注册失败，请稍后重试' }));
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

        {/* 注册表单 */}
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

            <div className="mb-6">
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

            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="text-slate-500" size={20} />
                </div>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="确认密码"
                  className={`w-full pl-12 pr-4 py-3 bg-slate-700/50 border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300`}
                  disabled={isLoading}
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-2 text-red-400 text-sm">{errors.confirmPassword}</p>
              )}
            </div>

            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="text-slate-500" size={20} />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="邮箱"
                  className={`w-full pl-12 pr-4 py-3 bg-slate-700/50 border ${errors.email ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300`}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-red-400 text-sm">{errors.email}</p>
              )}
            </div>

            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="text-slate-500" size={20} />
                </div>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="手机号（可选）"
                  className={`w-full pl-12 pr-4 py-3 bg-slate-700/50 border ${errors.phone ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300`}
                  disabled={isLoading}
                />
              </div>
              {errors.phone && (
                <p className="mt-2 text-red-400 text-sm">{errors.phone}</p>
              )}
            </div>

            <div className="mb-8">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Building2 className="text-slate-500" size={20} />
                </div>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className={`w-full pl-12 pr-4 py-3 bg-slate-700/50 border ${errors.department ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 appearance-none`}
                  disabled={isLoading}
                >
                  <option value="" disabled>请选择所属部门</option>
                  {DEPARTMENTS.map(department => (
                    <option key={department.key} value={department.key}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.department && (
                <p className="mt-2 text-red-400 text-sm">{errors.department}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-mono font-bold tracking-wide rounded-lg transition-all duration-300 ${isLoading ? 'opacity-70 cursor-not-allowed' : 'shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]'}`}
            >
              {isLoading ? '注册中...' : '注册'}
            </button>
          </form>

          {/* 登录链接 */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              已有账号？
              <button
                onClick={() => navigate('/login')}
                className="ml-1 text-cyan-400 hover:text-cyan-300 transition-colors duration-300"
              >
                立即登录
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};