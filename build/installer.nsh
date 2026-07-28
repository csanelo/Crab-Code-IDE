; Custom NSIS hooks: register "Open with CrabCode" in the Windows Explorer
; context menu for files, folders, and folder backgrounds — like VS Code.

!macro customInstall
  ; Path to the installed executable and its icon.
  DetailPrint "Registering 'Open with CrabCode' context menu entries"

  ; --- Right-click on a FILE ---
  WriteRegStr HKCU "Software\Classes\*\shell\CrabCode" "" "Открыть с помощью CrabCode"
  WriteRegStr HKCU "Software\Classes\*\shell\CrabCode" "Icon" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\""
  WriteRegStr HKCU "Software\Classes\*\shell\CrabCode\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""

  ; --- Right-click ON a folder ---
  WriteRegStr HKCU "Software\Classes\Directory\shell\CrabCode" "" "Открыть с помощью CrabCode"
  WriteRegStr HKCU "Software\Classes\Directory\shell\CrabCode" "Icon" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\""
  WriteRegStr HKCU "Software\Classes\Directory\shell\CrabCode\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""

  ; --- Right-click on the folder BACKGROUND (empty area inside a folder) ---
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\CrabCode" "" "Открыть с помощью CrabCode"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\CrabCode" "Icon" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\""
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\CrabCode\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%V$\""
!macroend

!macro customUnInstall
  DetailPrint "Removing 'Open with CrabCode' context menu entries"
  DeleteRegKey HKCU "Software\Classes\*\shell\CrabCode"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\CrabCode"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\CrabCode"
!macroend
