@echo off
chcp 65001 >nul
setlocal

title T8-penguin-canvas Dev Launcher
echo ==================================================
echo 🐧 T8-penguin-canvas 开发启动器 v1.0.0
echo ==================================================

REM 释放端口 11422 / 18766
echo [1/2] 检查并释放端口 11422 / 18766...
for %%P in (11422 18766) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P "') do (
        echo  - 终止占用端口 %%P 的进程 PID=%%a
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM 启动开发服务(前后端并发)
echo [2/2] 启动前端(11422) + 后端(18766)...
cd /d "%~dp0"
start "T8 Backend" cmd /k "cd backend && npm start"
timeout /t 2 >nul
start "T8 Frontend" cmd /k "npm run dev:vite"
timeout /t 3 >nul

echo --------------------------------------------------
echo ✅ 已在新窗口启动:
echo    前端: http://127.0.0.1:11422
echo    后端: http://127.0.0.1:18766/api/status
echo --------------------------------------------------
start http://127.0.0.1:11422

endlocal
