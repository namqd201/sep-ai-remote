Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)
' 1. Khởi động hệ thống Nhân viên quèn (chạy ngầm ẩn cửa sổ console đen)
WshShell.CurrentDirectory = projectDir
WshShell.Run "node scripts\start-all.js", 0, False

' 2. Đợi 3 giây để Backend và Ngrok khởi động ổn định, sau đó lập tức khóa màn hình để bảo mật
WScript.Sleep 3000
WshShell.Run "rundll32.exe user32.dll,LockWorkStation", 0, False
