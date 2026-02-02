; ClipDrop - Toggle window visibility
; Requires AutoHotkey v2+
; Hotkey: Ctrl+Shift+V

#Requires AutoHotkey v2.0

^+v:: {
    if WinExist("ClipDrop") {
        if WinActive("ClipDrop") {
            WinHide("ClipDrop")
        } else {
            WinShow("ClipDrop")
            WinActivate("ClipDrop")
        }
    }
}
