@echo off
REM ACE — start everything for phone testing (backend + Expo dev server).
REM Prereqs done once: Docker Desktop installed, firewall rules "ACE backend 18000"
REM + "ACE Metro 8081", app\.env pointing at this PC's Wi-Fi IP.

cd /d "%~dp0"

echo [1/3] Starting backend (Docker)...
docker compose up -d

echo [2/3] Detecting Wi-Fi IPv4...
for /f "tokens=2 delims=:" %%a in ('netsh interface ip show address "Wi-Fi" ^| findstr "IP Address"') do set LANIP=%%a
set LANIP=%LANIP: =%
echo     Wi-Fi IP: %LANIP%
echo EXPO_PUBLIC_API_URL=http://%LANIP%:18000/api/v1> app\.env

echo [3/3] Starting Expo (scan the QR with your phone, Expo Go installed)...
cd app
set REACT_NATIVE_PACKAGER_HOSTNAME=%LANIP%
npx expo start
