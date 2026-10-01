@echo off
setlocal EnableExtensions

rem ======================================================================
rem  Warehouse DB setup for Windows (PostgreSQL 16 or newer).
rem
rem  Creates the database warehouse_db and loads 01_schema.sql + 02_seed.sql.
rem  Double-click it or run it from cmd. Safe to re-run: it recreates the DB.
rem
rem  This file is ASCII-only on purpose: Cyrillic text inside .bat files
rem  breaks cmd.exe on some Windows builds.
rem ======================================================================

set "DB_NAME=warehouse_db"
set "DB_HOST=localhost"
set "DB_PORT=5432"
if not defined DB_USER set "DB_USER=postgres"

rem psql talks UTF-8 regardless of the console code page. The seed contains
rem characters that do not exist in Windows-1251 (the multiplication sign),
rem so the database MUST be UTF-8 and the client must say so.
set "PGCLIENTENCODING=UTF8"
rem Do not hang forever if the PostgreSQL service is stopped.
set "PGCONNECT_TIMEOUT=5"
rem Server error messages in English: on a Russian Windows they arrive in
rem Windows-1251 and turn into garbage in the cmd window (code page 866).
set "PGOPTIONS=-c lc_messages=C"

set "ERRFILE=%TEMP%\wh_psql_err.txt"
set "OUTFILE=%TEMP%\wh_psql_out.txt"

echo.
echo ===== Warehouse DB setup =====
echo.

rem ---- 1. Find psql.exe --------------------------------------------------
set "PSQL="
where psql >nul 2>nul && set "PSQL=psql"
if not defined PSQL for /f "delims=" %%V in ('dir /b /ad /o-n "%ProgramFiles%\PostgreSQL" 2^>nul') do if not defined PSQL if exist "%ProgramFiles%\PostgreSQL\%%V\bin\psql.exe" set "PSQL=%ProgramFiles%\PostgreSQL\%%V\bin\psql.exe"
if not defined PSQL goto :no_psql
echo Using psql: %PSQL%

rem ---- 2. Ask for credentials -------------------------------------------
echo.
set "IN_USER="
set /p "IN_USER=PostgreSQL user [%DB_USER%]: "
if defined IN_USER set "DB_USER=%IN_USER%"
if not defined PGPASSWORD set /p "PGPASSWORD=Password for %DB_USER% (what you typed is visible, press Enter if none): "

rem ---- 3. Check the connection ------------------------------------------
echo.
echo Connecting to %DB_HOST%:%DB_PORT% as %DB_USER% ...
"%PSQL%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -w -tAc "select 1" >nul 2>"%ERRFILE%"
if errorlevel 1 goto :conn_failed

rem ---- 4. Does the database already exist? ------------------------------
set "EXISTS="
"%PSQL%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -w -tAc "select 1 from pg_database where datname='%DB_NAME%'" >"%OUTFILE%" 2>nul
set /p "EXISTS=" <"%OUTFILE%"
if not defined EXISTS goto :create

echo.
echo Database %DB_NAME% already exists. Recreating it DELETES all its data.
echo Stop the backend and close pgAdmin or Rider DB tabs that use it first.
set "ANSWER="
set /p "ANSWER=Recreate it? Type y to continue, anything else cancels: "
if /i not "%ANSWER%"=="y" goto :cancelled

rem ---- 5. Drop and create (UTF-8) ---------------------------------------
:create
echo.
echo Creating database %DB_NAME% ...
"%PSQL%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -w -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS %DB_NAME% WITH (FORCE);"
if errorlevel 1 goto :fail
"%PSQL%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -w -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE %DB_NAME% ENCODING 'UTF8' TEMPLATE template0;" 2>nul
if not errorlevel 1 goto :load

echo Default locale does not allow UTF-8 here, retrying with the C locale ...
"%PSQL%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -w -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE %DB_NAME% ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;"
if errorlevel 1 goto :fail

rem ---- 6. Load schema and seed ------------------------------------------
:load
rem Run from the folder of this script and pass bare file names: psql then
rem never sees a path with spaces or non-Latin letters in it.
pushd "%~dp0"
echo Loading 01_schema.sql ...
"%PSQL%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -w -v ON_ERROR_STOP=1 -q -f 01_schema.sql
if errorlevel 1 goto :fail_popd
echo Loading 02_seed.sql ...
"%PSQL%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -w -v ON_ERROR_STOP=1 -q -f 02_seed.sql
if errorlevel 1 goto :fail_popd
popd

rem ---- 7. Show what was loaded ------------------------------------------
echo.
echo Loaded rows:
"%PSQL%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -w -c "select (select count(*) from warehouses) as warehouses, (select count(*) from users) as users, (select count(*) from products) as products, (select count(*) from documents) as documents;"

echo.
echo ===== DONE. Database %DB_NAME% is ready. =====
echo.
echo NEXT: point the backend at it. Either edit
echo   backend\WarehouseApi\WarehouseApi\appsettings.json
echo and set ConnectionStrings:Default to
echo   Host=%DB_HOST%;Port=%DB_PORT%;Database=%DB_NAME%;Username=%DB_USER%;Password=YOUR_PASSWORD
echo.
echo or, without editing any file, run in the SAME console window:
echo   set ConnectionStrings__Default=Host=%DB_HOST%;Port=%DB_PORT%;Database=%DB_NAME%;Username=%DB_USER%;Password=YOUR_PASSWORD
echo   dotnet run --urls http://localhost:5034
echo.
echo Test logins, password for all of them is password123:
echo   a.kovalev  - director of warehouse 1
echo   v.orlova   - director of warehouse 2
echo   admin      - system administrator
echo.
goto :end

:no_psql
echo.
echo psql.exe was not found.
echo Install PostgreSQL 16 or newer from https://www.postgresql.org/download/windows/
echo and keep "Command Line Tools" ticked in the installer, then run this file again.
echo.
echo No psql? Do it by hand in pgAdmin: create a database named %DB_NAME% with
echo encoding UTF8 (it MUST be UTF8), then run 01_schema.sql and 02_seed.sql
echo in that order from the Query Tool.
goto :end

:conn_failed
echo.
echo Could not connect. PostgreSQL said:
type "%ERRFILE%"
echo.
echo Check that the PostgreSQL service is running, the user name and password
echo are right, and that PostgreSQL listens on port %DB_PORT%.
goto :end

:fail_popd
popd
:fail
echo.
echo FAILED. See the error above. Nothing is half-loaded: each SQL file runs
echo in one transaction, so just fix the cause and run this file again.
goto :end

:cancelled
echo.
echo Cancelled, nothing was changed.

:end
echo.
pause
endlocal
