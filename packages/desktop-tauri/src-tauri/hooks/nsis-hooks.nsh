!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Delete application data on uninstallation
  RMDir /r "$LOCALAPPDATA\sh.paseo.desktop.tauri"
  RMDir /r "$PROFILE\.paseo"
!macroend
