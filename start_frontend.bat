@echo off
echo ========================================================
echo Starting VIKMO DealerDesk Frontend Dev Server (Vite)
echo Connected to Django API Backend at http://127.0.0.1:8000
echo ========================================================
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
pause
