@echo "START: ANDROID BUILD DEBUG"

:: Build the Ionic app
call ionic build
IF %ERRORLEVEL% NEQ 0 (
    echo "Ionic build failed."
    exit %ERRORLEVEL%
)

:: Sync with Capacitor to update native Android project
call npx cap sync android
IF %ERRORLEVEL% NEQ 0 (
    echo "Capacitor sync failed."
    exit %ERRORLEVEL%
)

:: Build the Android project in debug mode using Gradle
cd android
call ./gradlew clean
IF %ERRORLEVEL% NEQ 0 (
    echo "Gradle build failed."
    exit %ERRORLEVEL%
)

:: Build the Android project in debug mode using Gradle
cd android
call ./gradlew assembleDebug
IF %ERRORLEVEL% NEQ 0 (
    echo "Gradle build failed."
    exit %ERRORLEVEL%
)

:: Set output APK path
set DEBUG_OUTPUT=.\app\build\outputs\apk\debug

@echo "START: CLEAN OLD FILES"
IF EXIST "%DEBUG_OUTPUT%\vpos-debug.apk" (
    del "%DEBUG_OUTPUT%\vpos-debug.apk"
)

cd %DEBUG_OUTPUT%

@echo "RENAME APK TO STANDARD NAME"
IF EXIST "app-debug.apk" (
    ren "app-debug.apk" "vpos-debug.apk"
)

@echo "INSTALL APK ON CONNECTED DEVICE"
IF EXIST "vpos-debug.apk" (
    adb install -r "vpos-debug.apk"
    IF %ERRORLEVEL% NEQ 0 (
        echo "APK installation failed."
        exit %ERRORLEVEL%
    )
) ELSE (
    echo "APK not found for installation."
)

@echo "DONE"
pause
