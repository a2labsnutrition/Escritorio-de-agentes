@echo off
title Escritorio de Agentes
cd /d "%~dp0"

rem ===========================================================
rem  Sobe o escritorio e o mantem de pe.
rem
rem  Se o node cair por qualquer motivo, este laco sobe de novo
rem  em 3 segundos. Os sistemas dos agentes nao caem junto: eles
rem  nascem soltos e o escritorio reencontra cada um pelo pid
rem  guardado em data\vivos.json.
rem
rem  Para parar de verdade: feche esta janela.
rem ===========================================================

echo.
echo   ESCRITORIO DE AGENTES
echo   http://localhost:4321
echo.

:loop
node server.js
echo.
echo   [%date% %time%] o escritorio saiu. Subindo de novo em 3s...
echo   (feche esta janela para parar de vez)
timeout /t 3 /nobreak >nul
goto loop
