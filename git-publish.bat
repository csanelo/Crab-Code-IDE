@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

set "REMOTE=https://github.com/csanelo/Crab-Code-IDE.git"
set "BRANCH=main"
set "GIT_EMAIL=muradtedeev0912@mail.ru"
set "MESSAGE=%~1"
set "NEW_REPOSITORY=0"
if not defined MESSAGE set "MESSAGE=release: CrabCode 0.2.8"

if not exist "package.json" (
  echo This BAT must be located in the CrabCode project root next to package.json.
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo Git is not installed or is not available in PATH.
  echo Install Git for Windows and run this file again.
  pause
  exit /b 1
)

if not exist ".git" (
  git init
  if errorlevel 1 goto :failed
)

git rebase --abort >nul 2>&1
git rebase --quit >nul 2>&1
git merge --abort >nul 2>&1
git cherry-pick --abort >nul 2>&1

git config user.name >nul 2>&1
if errorlevel 1 git config user.name "csanelo"
git config user.email "%GIT_EMAIL%"

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REMOTE%"
) else (
  git remote set-url origin "%REMOTE%"
)
if errorlevel 1 goto :failed

git config credential.helper manager
git credential-manager version >nul 2>&1
if not errorlevel 1 (
  echo Sign in to the GitHub account linked to %GIT_EMAIL%.
  git credential-manager github logout >nul 2>&1
  git credential-manager github login
  if errorlevel 1 goto :failed
) else (
  echo GitHub will request browser authorization during fetch or push.
)

git rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 (
  set "NEW_REPOSITORY=1"
  git symbolic-ref HEAD refs/heads/%BRANCH%
  if errorlevel 1 goto :failed
  git rm -r --cached . >nul 2>&1
) else (
  git symbolic-ref -q HEAD >nul 2>&1
  if errorlevel 1 (
    git switch -C "%BRANCH%"
  ) else (
    git branch -M "%BRANCH%"
  )
  if errorlevel 1 goto :failed
)

echo.
echo Repository: %REMOTE%
echo Commit: %MESSAGE%
echo.

git add -A
if errorlevel 1 goto :failed

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%MESSAGE%"
  if errorlevel 1 goto :failed
) else (
  if "%NEW_REPOSITORY%"=="1" (
    git commit --allow-empty -m "%MESSAGE%"
    if errorlevel 1 goto :failed
  ) else (
    echo No file changes found. Creating a release commit.
    git commit --allow-empty -m "%MESSAGE%"
    if errorlevel 1 goto :failed
  )
)

if "%NEW_REPOSITORY%"=="1" (
  git fetch origin "%BRANCH%" >nul 2>&1
  if not errorlevel 1 (
    git merge "origin/%BRANCH%" --allow-unrelated-histories -s ours --no-edit
    if errorlevel 1 goto :failed
  )
) else (
  git ls-remote --exit-code --heads origin "%BRANCH%" >nul 2>&1
  if not errorlevel 1 (
    git fetch origin "%BRANCH%"
    if errorlevel 1 goto :failed
    git merge "origin/%BRANCH%" --no-edit
    if errorlevel 1 (
      git merge --abort >nul 2>&1
      echo.
      echo Merge failed. Resolve the conflicting files, then run this file again.
      pause
      exit /b 1
    )
  )
)

git push -u origin "%BRANCH%"
if errorlevel 1 goto :failed

echo.
echo All changes were committed and pushed successfully.
echo %REMOTE%
pause
exit /b 0

:failed
echo.
echo Git publish failed. Read the error above.
pause
exit /b 1
