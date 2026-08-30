@echo off
REM ---------------------------------------------------------------
REM  CSSLP Flashcards - local launcher
REM  Double-click this file to serve the app and open it in your
REM  browser. Close this window (or press Ctrl+C) to stop.
REM ---------------------------------------------------------------
setlocal
cd /d "%~dp0"
set "PORT=8000"
set "URL=http://localhost:%PORT%/"

title CSSLP Flashcards - server on port %PORT%

where py >nul 2>&1 && goto :usepy
where python >nul 2>&1 && goto :usepython
where node >nul 2>&1 && goto :usenode
goto :nothingfound

:usepy
call :openbrowser
echo Serving CSSLP Flashcards with Python at %URL%
echo Close this window or press Ctrl+C to stop.
echo.
py -m http.server %PORT%
goto :stopped

:usepython
call :openbrowser
echo Serving CSSLP Flashcards with Python at %URL%
echo Close this window or press Ctrl+C to stop.
echo.
python -m http.server %PORT%
goto :stopped

:usenode
call :openbrowser
echo Serving CSSLP Flashcards with Node at %URL%
echo Close this window or press Ctrl+C to stop.
echo.
npx --yes http-server -p %PORT% -c-1
goto :stopped

:openbrowser
REM Wait ~2s for the server to bind, then open the default browser.
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & explorer %URL%"
exit /b

:nothingfound
echo.
echo   Neither Python nor Node.js was found on this machine.
echo.
echo   Easiest fix: install Python from
echo     https://www.python.org/downloads/
echo   and tick "Add python.exe to PATH" during setup.
echo   Then double-click this file again.
echo.
pause
goto :eof

:stopped
echo.
echo Server stopped.
pause
