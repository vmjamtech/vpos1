@echo off
setlocal

if not defined JAVA_HOME (
    for /d %%J in ("C:\Program Files\Microsoft\jdk-21*") do if exist "%%~J\bin\java.exe" set "JAVA_HOME=%%~J"
)
if not defined JAVA_HOME (
    echo Java 21 was not found. Install JDK 21 or set JAVA_HOME.
    exit /b 1
)
if not defined ANDROID_HOME set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

if not exist "%JAVA_HOME%\bin\java.exe" (
    echo JAVA_HOME does not point to a JDK: %JAVA_HOME%
    exit /b 1
)

call npm.cmd run build
if errorlevel 1 exit /b %ERRORLEVEL%

call npm.cmd exec -- cap sync android
if errorlevel 1 exit /b %ERRORLEVEL%

pushd "%~dp0android"
call gradlew.bat assembleDebug
set "BUILD_EXIT=%ERRORLEVEL%"
popd
if not "%BUILD_EXIT%"=="0" exit /b %BUILD_EXIT%

set "APK_PATH=%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
if not exist "%APK_PATH%" (
    echo APK build completed but the expected file was not found: %APK_PATH%
    exit /b 1
)
echo APK ready: %APK_PATH%

adb get-state >nul 2>&1
if errorlevel 1 (
    echo No Android device is connected. Connect one with USB debugging enabled to install it.
) else (
    adb install -r "%APK_PATH%"
    if errorlevel 1 exit /b %ERRORLEVEL%
)
