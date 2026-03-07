# Redis 安装和启动指南

## Windows 系统安装 Redis

### 方法 1：使用 Windows 安装包（推荐）

1. **下载 Redis for Windows**
   - 访问 [GitHub - tporadowski/redis](https://github.com/tporadowski/redis/releases)
   - 下载最新的 Windows 安装包（如：`Redis-x64-3.2.100.msi` 或更高版本）
 
2. **安装 Redis**
   - 运行安装包，按照默认设置完成安装
   - 选择 "Add Redis to Path" 选项，这样可以在任何位置使用 Redis 命令

3. **启动 Redis 服务**
   - 安装完成后，Redis 服务会自动启动
   - 可以通过 Windows 服务管理器查看 Redis 服务状态

### 方法 2：使用 Windows Subsystem for Linux (WSL)

1. **启用 WSL**
   - 打开 PowerShell 作为管理员
   - 运行命令：`wsl --install`
   - 重启电脑

2. **安装 Ubuntu**
   - 打开 Microsoft Store，搜索并安装 Ubuntu
   - 启动 Ubuntu 并设置用户名和密码

3. **在 Ubuntu 中安装 Redis**
   - 在 Ubuntu 终端中运行：
     ```bash
     sudo apt update
     sudo apt install redis-server
     ```

4. **启动 Redis 服务**
   - 运行：`sudo service redis-server start`

## 验证 Redis 服务

安装完成后，验证 Redis 是否正常运行：

```bash
# 检查 Redis 客户端版本
redis-cli --version

# 连接 Redis 服务器
redis-cli

# 测试连接
> ping
# 应该返回：PONG

# 退出
> exit
```

## 配置 Redis 连接

项目使用的 Redis 配置在 `.env` 文件中：

```env
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 重启后端服务

Redis 服务启动后，需要重启后端服务以启用分布式锁和任务队列功能：

```bash
# 停止当前后端服务
# 然后重新启动
cd d:\logistics-panel--20226.2.1-master\logistics-panel-main\logistics-backend
npm run start:dev
```

## 验证分布式锁和任务队列

后端服务重启后，查看日志：

```
Redis 连接成功，分布式锁功能已启用
```

此时，分布式锁和任务队列功能已经启用，系统可以：
- 防止任务重复执行
- 使用 BullMQ 进行分布式任务处理
- 提高系统并发性能
