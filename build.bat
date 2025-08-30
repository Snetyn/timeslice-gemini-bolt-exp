@echo off
echo Building TimeSlice...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)
echo Build completed successfully!
echo.
echo Running service worker update...
call node update-sw.js
if %errorlevel% neq 0 (
    echo Service worker update failed!
    exit /b 1
)
echo.
echo ✅ All done! Your app is ready for deployment.
echo.
echo To test locally, run: npm run preview
pause
