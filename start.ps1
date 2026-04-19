# FinAgent startup script for Windows
# Run from D:\finagent with: .\start.ps1

Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  FinAgent - AI Boardroom     " -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check for API key
if (-not $env:OPENAI_API_KEY) {
    $key = Read-Host "Enter your OPENAI_API_KEY"
    $env:OPENAI_API_KEY = $key
}

Write-Host "[1/2] Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\finagent\backend; venv\Scripts\activate; `$env:OPENAI_API_KEY='$env:OPENAI_API_KEY'; uvicorn main:app --reload --port 8000"

Start-Sleep -Seconds 3

Write-Host "[2/2] Starting Next.js frontend on http://localhost:3000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\finagent\frontend; npm run dev"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "FinAgent is running!" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""