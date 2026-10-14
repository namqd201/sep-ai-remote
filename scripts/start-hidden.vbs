Set WshShell = CreateObject("WScript.Shell")
' 1. Khởi động hệ thống Nhân viên quèn (chạy ngầm ẩn cửa sổ console đen)
WshShell.CurrentDirectory = "F:\Project\sep-ai-remote"
WshShell.Run "node scripts\start-all.js", 0, False

' 2. Đợi 3 giây để Backend và Ngrok khởi động ổn định, sau đó lập tức khóa màn hình để bảo mật
WScript.Sleep 3000
WshShell.Run "rundll32.exe user32.dll,LockWorkStation", 0, False
