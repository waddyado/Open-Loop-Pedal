@echo off
REM Run from project root. First time: npm install
cd /d "%~dp0"
echo Open Loop Pedal - starting dev...
call npm run dev
