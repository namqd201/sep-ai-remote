Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "F:\Project\sep-ai-remote"
WshShell.Run "node scripts/start-all.js", 0, False
