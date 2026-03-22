@echo off
SET ADB_PATH=%localappdata%\Android\sdk\platform-tools\adb.exe
SET PACKAGE=com.vmjamtech.posandroid
SET LOGFILE=log-2025-23-11.txt
SET DEST_FOLDER=logs

mkdir %DEST_FOLDER%

"%ADB_PATH%" exec-out run-as %PACKAGE% cat /data/data/%PACKAGE%/files/%LOGFILE% > "%DEST_FOLDER%/%LOGFILE%"

echo Done.
pause
