@echo off
echo ============================================
echo   Mingli - Mingli H5 Dev Launcher
echo ============================================

if "%MINGLI_LLM_API_KEY%"=="" echo [WARN] MINGLI_LLM_API_KEY is not set - deterministic paipan works, AI interpretation unavailable. Setup: see docs\API-Key*.md
echo.
echo Starting backend (FastAPI serves frontend + API on :8000)...
start "mingli" cmd /c "cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo ============================================
echo   Frontend + API : http://localhost:8000
echo   API docs       : http://localhost:8000/docs
echo   Tunnel         : ngrok http 8000
echo ============================================
pause
