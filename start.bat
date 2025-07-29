@echo off

REM --- Check for Python Installation --- 
python --version >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo ==================================================================
    echo ERROR: Python installation not found in system PATH.
    echo Please install Python to run this application.
    echo Download from: https://www.python.org/downloads/
    echo IMPORTANT: During installation, ensure you check the box similar to 
    echo            'Add Python X.X to PATH'.
    echo ==================================================================
    echo.
    echo Press any key to go to python website...
    pause >nul
    start https://www.python.org/downloads/
    exit /b 1
)


echo Starting Chantier Planning Tool using Waitress...

REM Change to the backend directory
cd backend

REM Ensure Python environment (like venv) is active if you use one.

echo Ensuring backend dependencies are up-to-date...
REM Install/update dependencies quietly (-q flag)
pip install -q -r requirements.txt

REM Ensure waitress is installed (should be in requirements.txt)
REM pip install waitress

echo Starting Waitress server on http://127.0.0.1:5000

REM Open the waiting page in the default browser
start wait.html

REM Start the waitress server (this command will now block until stopped)
echo Server running. Close this window to stop server.
waitress-serve --host=127.0.0.1 --port=5000 app:app

echo Server stopped.

REM --- Cleanup Step (Optional but recommended) --- 
echo Attempting cleanup of process potentially listening on port 5000...
FOR /F "tokens=5" %%P IN ('netstat -a -n -o ^| findstr ":5000.*LISTENING"') DO (
    echo Found process %%P listening on port 5000. Attempting to terminate.
    taskkill /F /PID %%P
)

pause
REM Removed the final pause command for quicker exit on Ctrl+C