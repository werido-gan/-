import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Mail, Phone, Building2, Save, Shield, Clock } from 'lucide-react';
import { DEPARTMENTS, Role } from '../types';
import { useLogisticsStore } from '../services/store';

export const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const user = useLogisticsStore(state => state.auth.user);
  const isAuthenticated = useLogisticsStore(state => state.auth.isAuthenticated);
  const updateUserProfile = useLogisticsStore(state => state.updateUserProfile);
  const changePassword = useLogisticsStore(state => state.changePassword);
  const logout = useLogisticsStore(state => state.logout);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    email: '',
    phone: '',
    department: ''
  });
  const [passwordFormData, setPasswordFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [errors, setErrors] = useState<{ 
    edit?: { email?: string; phone?: string; department?: string }; 
    password?: { oldPassword?: string; newPassword?: string; confirmNewPassword?: string }; 
    general?: string 
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');

  // 从store获取用户信息
  useEffect(() => {
    // 调试：检查认证状态变化
    console.log('UserProfile useEffect: 认证状态变化');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('user:', user);
    console.log('本地存储的isAuthenticated:', localStorage.getItem('isAuthenticated'));
    console.log('本地存储的user:', localStorage.getItem('user'));
    console.log('本地存储的token:', localStorage.getItem('token'));
    
    // 检查用户是否已认证
    if (!isAuthenticated || !user) {
      console.log('UserProfile useEffect: 用户未认证或user为空，跳转到登录页面');
      navigate('/login');
      return;
    }

    // 初始化编辑表单数据
    setEditFormData({
      email: user.email || '',
      phone: user.phone || '',
      department: user.department || ''
    });
  }, [navigate, isAuthenticated, user]);
  
  // 更简单的调试方式：直接监听认证状态变化
  useEffect(() => {
    console.log('UserProfile: 认证状态变化');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('user:', user);
    console.log('user?.id:', user?.id);
    console.log('user?.role:', user?.role);
  }, [isAuthenticated, user]);

  // 如果用户未加载，显示加载状态
  if (!user) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-cyan-400 text-lg font-mono">加载中...</div>
      </div>
    );
  }

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
    // 清除对应字段的错误
    if (errors.edit && errors.edit[name as keyof typeof errors.edit]) {
      setErrors(prev => ({
        ...prev,
        edit: { ...prev.edit, [name]: undefined }
      }));
    }
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordFormData(prev => ({ ...prev, [name]: value }));
    // 清除对应字段的错误
    if (errors.password && errors.password[name as keyof typeof errors.password]) {
      setErrors(prev => ({
        ...prev,
        password: { ...prev.password, [name]: undefined }
      }));
    }
  };

  const validateEditForm = () => {
    const newErrors: { email?: string; phone?: string; department?: string } = {};

    // 邮箱验证
    if (!editFormData.email.trim()) {
      newErrors.email = '请输入邮箱';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editFormData.email)) {
        newErrors.email = '请输入有效的邮箱地址';
      }
    }

    // 手机号验证
    if (editFormData.phone.trim()) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(editFormData.phone)) {
        newErrors.phone = '请输入有效的手机号';
      }
    }

    // 部门验证
    if (!editFormData.department) {
      newErrors.department = '请选择所属部门';
    }

    setErrors(prev => ({ ...prev, edit: newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const newErrors: { oldPassword?: string; newPassword?: string; confirmNewPassword?: string } = {};

    // 旧密码验证
    if (!passwordFormData.oldPassword) {
      newErrors.oldPassword = '请输入旧密码';
    }

    // 新密码验证
    if (!passwordFormData.newPassword) {
      newErrors.newPassword = '请输入新密码';
    } else if (passwordFormData.newPassword.length < 6) {
      newErrors.newPassword = '新密码至少6个字符';
    }

    // 确认新密码验证
    if (!passwordFormData.confirmNewPassword) {
      newErrors.confirmNewPassword = '请确认新密码';
    } else if (passwordFormData.confirmNewPassword !== passwordFormData.newPassword) {
      newErrors.confirmNewPassword = '两次输入的新密码不一致';
    }

    setErrors(prev => ({ ...prev, password: newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateEditForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // 模拟保存请求
      await new Promise(resolve => setTimeout(resolve, 800));

      // 使用store中的updateUserProfile方法更新用户信息
      // 只发送需要更新的字段，避免后端验证失败
      const result = await updateUserProfile(editFormData);
      
      console.log('updateUserProfile返回结果:', result);
      
      setIsEditing(false);

      if (result.success) {
        setErrors(prev => ({ ...prev, general: '个人信息更新成功' }));
      } else {
        setErrors(prev => ({ ...prev, general: result.message }));
      }
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setErrors(prev => ({ ...prev, general: undefined }));
      }, 3000);
    } catch (error) {
      console.error('handleSaveProfile错误:', error);
      setErrors(prev => ({ ...prev, general: '更新失败，请稍后重试' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePasswordForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // 使用store中的changePassword方法修改密码，传递旧密码和新密码
      const result = await changePassword(passwordFormData.oldPassword, passwordFormData.newPassword);
      
      if (!result.success) {
        setErrors(prev => ({
          ...prev,
          password: { ...prev.password, oldPassword: '旧密码不正确' },
          general: undefined
        }));
        setIsLoading(false);
        return;
      }

      // 重置密码表单
      setPasswordFormData({
        oldPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      });

      setErrors(prev => ({ ...prev, general: '密码修改成功' }));
      // 3秒后清除成功消息
      setTimeout(() => {
        setErrors(prev => ({ ...prev, general: undefined }));
      }, 3000);
    } catch (error) {
      setErrors(prev => ({ ...prev, general: '密码修改失败，请稍后重试' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    // 使用store中的logout方法登出
    logout();
    // 跳转到登录页面
    navigate('/login');
  };

  const getRoleName = (role: string) => {
    return role === Role.ADMIN ? '管理员' : '普通用户';
  };

  return (
    <div className="p-6 bg-slate-900/30 h-full w-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-cyan-900/30 rounded-xl">
              <User className="text-cyan-400" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-mono tracking-wider">个人信息管理</h1>
              <p className="text-slate-500 text-sm">管理您的账户信息和安全设置</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-900/30 hover:bg-red-800/50 text-red-400 hover:text-red-300 rounded-lg transition-all duration-300 flex items-center space-x-2"
          >
            <span>退出登录</span>
          </button>
        </div>

        {/* 成功/错误消息 */}
        {errors.general && (
          <div className={`mb-6 p-3 ${errors.general.includes('成功') ? 'bg-green-900/30 border border-green-700/50 text-green-300' : 'bg-red-900/30 border border-red-700/50 text-red-300'} rounded-lg text-sm`}>
            {errors.general}
          </div>
        )}

        {/* 个人信息卡片 */}
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-6 shadow-lg mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white font-mono">基本信息</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-cyan-900/30 hover:bg-cyan-800/50 text-cyan-400 hover:text-cyan-300 rounded-lg transition-all duration-300 flex items-center space-x-2"
              >
                <Save size={16} />
                <span>编辑</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                  className="px-4 py-2 bg-cyan-900/30 hover:bg-cyan-800/50 text-cyan-400 hover:text-cyan-300 rounded-lg transition-all duration-300 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  <span>{isLoading ? '保存中...' : '保存'}</span>
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditFormData({
                      email: user.email || '',
                      phone: user.phone || '',
                      department: user.department || ''
                    });
                    setErrors(prev => ({ ...prev, edit: undefined }));
                  }}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-300 rounded-lg transition-all duration-300"
                >
                  取消
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 用户名（不可编辑） */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <User className="text-slate-500" size={18} />
                <label className="text-slate-400 text-sm font-mono">用户名</label>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg text-white">{user.username}</div>
            </div>

            {/* 角色（不可编辑） */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Shield className="text-slate-500" size={18} />
                <label className="text-slate-400 text-sm font-mono">角色</label>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg text-white">
                <span className={`px-2 py-1 rounded text-xs font-mono ${user.role === Role.ADMIN ? 'bg-purple-900/50 text-purple-400' : 'bg-blue-900/50 text-blue-400'}`}>
                  {getRoleName(user.role)}
                </span>
              </div>
            </div>

            {/* 邮箱 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Mail className="text-slate-500" size={18} />
                <label className="text-slate-400 text-sm font-mono">邮箱</label>
              </div>
              {isEditing ? (
                <div>
                  <input
                    type="email"
                    name="email"
                    value={editFormData.email}
                    onChange={handleEditInputChange}
                    className={`w-full p-3 bg-slate-700/50 border ${errors.edit?.email ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300`}
                    disabled={isLoading}
                  />
                  {errors.edit?.email && (
                    <p className="mt-1 text-red-400 text-xs">{errors.edit.email}</p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-700/50 rounded-lg text-white">{user.email || '未设置'}</div>
              )}
            </div>

            {/* 手机号 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Phone className="text-slate-500" size={18} />
                <label className="text-slate-400 text-sm font-mono">手机号</label>
              </div>
              {isEditing ? (
                <div>
                  <input
                    type="tel"
                    name="phone"
                    value={editFormData.phone}
                    onChange={handleEditInputChange}
                    className={`w-full p-3 bg-slate-700/50 border ${errors.edit?.phone ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300`}
                    disabled={isLoading}
                  />
                  {errors.edit?.phone && (
                    <p className="mt-1 text-red-400 text-xs">{errors.edit.phone}</p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-700/50 rounded-lg text-white">{user.phone || '未设置'}</div>
              )}
            </div>

            {/* 所属部门 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Building2 className="text-slate-500" size={18} />
                <label className="text-slate-400 text-sm font-mono">所属部门</label>
              </div>
              {isEditing ? (
                <div>
                  <select
                    name="department"
                    value={editFormData.department}
                    onChange={handleEditInputChange}
                    className={`w-full p-3 bg-slate-700/50 border ${errors.edit?.department ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 appearance-none`}
                    disabled={isLoading}
                  >
                    <option value="" disabled>请选择所属部门</option>
                    {DEPARTMENTS.map(department => (
                      <option key={department.key} value={department.key}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                  {errors.edit?.department && (
                    <p className="mt-1 text-red-400 text-xs">{errors.edit.department}</p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-700/50 rounded-lg text-white">
                  {DEPARTMENTS.find(dept => dept.key === user.department)?.name || '未设置'}
                </div>
              )}
            </div>

            {/* 创建时间（不可编辑） */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Clock className="text-slate-500" size={18} />
                <label className="text-slate-400 text-sm font-mono">账户创建时间</label>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg text-white">
                {new Date(user.created_at).toLocaleString()}
              </div>
            </div>

            {/* 最后登录时间（不可编辑） */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Clock className="text-slate-500" size={18} />
                <label className="text-slate-400 text-sm font-mono">最后登录时间</label>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg text-white">
                {user.last_login ? new Date(user.last_login).toLocaleString() : '从未登录'}
              </div>
            </div>
          </div>
        </div>

        {/* 安全设置卡片 */}
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white font-mono">安全设置</h2>
          </div>

          <div className="space-y-6">
            {/* 密码修改 */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Lock className="text-slate-500" size={18} />
                <h3 className="text-lg font-semibold text-white">修改密码</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-slate-400 text-sm font-mono">旧密码</label>
                  <div>
                    <input
                      type="password"
                      name="oldPassword"
                      value={passwordFormData.oldPassword}
                      onChange={handlePasswordInputChange}
                      className={`w-full p-3 bg-slate-700/50 border ${errors.password?.oldPassword ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300`}
                      disabled={isLoading}
                    />
                    {errors.password?.oldPassword && (
                      <p className="mt-1 text-red-400 text-xs">{errors.password.oldPassword}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-slate-400 text-sm font-mono">新密码</label>
                  <div>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordFormData.newPassword}
                      onChange={handlePasswordInputChange}
                      className={`w-full p-3 bg-slate-700/50 border ${errors.password?.newPassword ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300`}
                      disabled={isLoading}
                    />
                    {errors.password?.newPassword && (
                      <p className="mt-1 text-red-400 text-xs">{errors.password.newPassword}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-slate-400 text-sm font-mono">确认新密码</label>
                  <div>
                    <input
                      type="password"
                      name="confirmNewPassword"
                      value={passwordFormData.confirmNewPassword}
                      onChange={handlePasswordInputChange}
                      className={`w-full p-3 bg-slate-700/50 border ${errors.password?.confirmNewPassword ? 'border-red-500' : 'border-slate-600'} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300`}
                      disabled={isLoading}
                    />
                    {errors.password?.confirmNewPassword && (
                      <p className="mt-1 text-red-400 text-xs">{errors.password.confirmNewPassword}</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleChangePassword}
                disabled={isLoading}
                className="mt-6 px-6 py-3 bg-cyan-900/30 hover:bg-cyan-800/50 text-cyan-400 hover:text-cyan-300 rounded-lg transition-all duration-300 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                <span>{isLoading ? '修改中...' : '修改密码'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};