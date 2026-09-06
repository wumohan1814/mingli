@echo off
echo ============================================
echo   Taichu - Mingli H5 Dev Launcher
echo ============================================

echo.
echo Starting backend (FastAPI serves frontend + API on :8000)...
start "taichu" cmd /c "cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo ============================================
echo   Frontend + API : http://localhost:8000
echo   API docs       : http://localhost:8000/docs
echo   Tunnel         : ngrok http 8000
echo ============================================
pause
