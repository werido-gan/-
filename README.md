# 智能物流看板

## 项目介绍
智能物流看板是一个基于前后端分离架构的物流管理系统，提供订单管理、部门管理和物流信息查询等功能，帮助企业实现物流信息的集中管理和实时监控。

## 技术栈

### 前端
- React 19：UI 框架
- TypeScript 5.8：类型安全
- Vite 6：构建工具
- Zustand 5：状态管理
- Axios：HTTP 客户端
- Recharts：数据可视化

### 后端
- NestJS：Node.js 框架
- TypeScript 5.7：类型安全
- TypeORM：ORM 工具
- MySQL 8.0：数据库
- JWT：认证机制

## 功能特性

### 订单管理
- 订单列表展示
- 订单详情查看
- 订单状态管理
- 订单数据导出
- 批量导入订单
- 手动/批量刷新物流信息

### 部门管理
- 部门列表展示
- 部门信息查看

### 物流代理
- 物流信息查询与同步
- 物流状态自动识别
- 物流公司代码映射

## 安装步骤

### 前置条件
- Node.js 18.x 或更高版本
- npm 或 yarn 包管理器
- MySQL 8.0 数据库

### 前端安装
1. 进入项目根目录
```bash
cd d:/logistics-panel--20226.2.1-master/logistics-panel-main
```

2. 安装依赖
```bash
npm install
```

### 后端安装
1. 进入后端目录
```bash
cd d:/logistics-panel--20226.2.1-master/logistics-panel-main/logistics-backend
```

2. 安装依赖
```bash
npm install
```

## 运行方法

### 1. 启动数据库
- 使用本地 MySQL 或 Docker 运行 MySQL
- 创建数据库：`logistics`
- 配置数据库用户和密码

### 2. 配置环境变量

#### 后端环境变量
编辑 `logistics-backend/.env` 文件：
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_NAME=logistics

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRATION_TIME=3600s

# Server Configuration
PORT=3001
```

### 3. 启动后端服务

```bash
# 开发模式
cd d:/logistics-panel--20226.2.1-master/logistics-panel-main/logistics-backend
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

后端服务默认运行在 `http://localhost:3001`

### 4. 启动前端服务

```bash
# 开发模式
cd d:/logistics-panel--20226.2.1-master/logistics-panel-main
npm run dev

# 生产模式
npm run build
npm run preview
```

前端服务默认运行在 `http://localhost:3000`

## 项目结构

### 前端结构
```
智能看板/
├── components/         # 通用组件
├── dist/              # 构建输出目录
├── logistics-backend/ # 后端代码
├── .env.example       # 环境变量模板
├── App.tsx            # 应用入口组件
├── index.tsx          # 项目入口文件
├── package.json       # 项目配置
├── tsconfig.json      # TypeScript 配置
├── vite.config.ts     # Vite 配置
└── README.md          # 项目说明
```

### 后端结构
```
logistics-backend/
├── src/
│   ├── auth/          # 认证模块
│   ├── departments/   # 部门模块
│   ├── logistics-proxy/ # 物流代理模块
│   ├── orders/        # 订单模块
│   ├── users/         # 用户模块
│   ├── app.module.ts  # 应用主模块
│   └── main.ts        # 应用入口
├── .env               # 环境变量配置
├── .env.example       # 环境变量模板
├── package.json       # 项目配置
└── tsconfig.json      # TypeScript 配置
```

## API 接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册

### 订单接口
- `GET /api/orders` - 获取订单列表
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/orders` - 创建订单
- `PUT /api/orders/:id` - 更新订单
- `DELETE /api/orders/:id` - 删除订单

### 部门接口
- `GET /api/departments` - 获取部门列表
- `GET /api/departments/:id` - 获取部门详情

### 物流代理接口
- `POST /api/logistics-proxy/create` - 创建物流查询
- `POST /api/logistics-proxy/select` - 选择物流查询
- `POST /api/logistics-proxy/query-and-sync` - 查询并同步物流信息

## 环境变量说明

### 后端环境变量
- `DB_HOST` - 数据库主机地址
- `DB_PORT` - 数据库端口（默认：3306）
- `DB_USERNAME` - 数据库用户名
- `DB_PASSWORD` - 数据库密码
- `DB_NAME` - 数据库名称
- `JWT_SECRET` - JWT 签名密钥
- `JWT_EXPIRATION_TIME` - JWT 过期时间
- `PORT` - 后端服务端口（默认：3001）

## 开发指南

### 代码规范
- 使用 TypeScript 编写所有代码
- 遵循 ESLint 和 Prettier 代码规范
- 编写清晰的代码注释

## 注意事项

### 开发环境注意事项
1. 确保数据库服务正常运行
2. 配置正确的环境变量
3. 开发环境下前端会代理 API 请求到后端服务
4. JWT 密钥应使用安全的随机字符串
5. 定期备份数据库数据

## 许可证

MIT License
