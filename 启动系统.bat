@echo off
echo ========================================
echo 智能物流看板 - 启动脚本
echo ========================================
echo.

echo [1/2] 正在启动后端服务...
start "物流看板-后端" cmd /k "cd /d D:\project\logistics-panel-main\logistics-panel-main\logistics-backend && npm run start:dev"

echo 等待后端启动...
timeout /t 15 /nobreak

echo [2/2] 正在启动前端服务...
start "物流看板-前端" cmd /k "cd /d D:\project\logistics-panel-main\logistics-panel-main && npm run dev"

echo.
echo ========================================
echo 系统启动完成！
echo ========================================
echo 前端地址: http://localhost:3000
echo 后端地址: http://localhost:3001
echo API文档:  http://localhost:3001/api/docs
echo.
echo 请确保 XAMPP 中的 MySQL 已启动！
echo.
pause