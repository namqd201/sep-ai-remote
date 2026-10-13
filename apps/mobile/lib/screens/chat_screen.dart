import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/colors.dart';
import '../providers/app_state.dart';
import '../services/stt_service.dart';
import '../services/tts_service.dart';

class ChatScreen extends StatefulWidget {
  final String? targetSessionId;

  const ChatScreen({Key? key, this.targetSessionId}) : super(key: key);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _msgController = TextEditingController();
  final List<Map<String, String>> _messages = [];
  bool _isListening = false;
  String? _activeSessionId;

  @override
  void initState() {
    super.initState();
    final appState = Provider.of<AppState>(context, listen: false);
    _activeSessionId = widget.targetSessionId ?? appState.selectedSessionId;

    _messages.add({
      'role': 'agent',
      'text': 'Chào Sếp! Em đang giữ nguyên ngữ cảnh và workspace của phiên làm việc. Sếp cần em hỗ trợ gì thêm ạ?',
    });
  }

  void _sendMessage() async {
    final text = _msgController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _messages.add({'role': 'boss', 'text': text});
      _msgController.clear();
    });

    final appState = Provider.of<AppState>(context, listen: false);
    final ok = await appState.sendTask(text, targetSessionId: _activeSessionId);

    if (ok) {
      ttsService.speak('Dạ Sếp Nam, em đã tiếp nhận yêu cầu và đang xử lý trên máy tính.');
      setState(() {
        _messages.add({
          'role': 'agent',
          'text': 'Dạ Sếp, em đã tiếp nhận yêu cầu và đang xử lý trên máy tính.',
        });
      });
    } else {
      ttsService.speak('Sếp Nam ơi, gửi tin nhắn thất bại rồi ạ. Sếp kiểm tra lại kết nối nhé!');
      setState(() {
        _messages.add({
          'role': 'agent',
          'text': '⚠️ Sếp Nam ơi, gửi yêu cầu thất bại! Vui lòng kiểm tra lại kết nối máy tính hoặc mạng.',
        });
      });
    }
  }

  void _toggleMic() async {
    if (_isListening) {
      await sttService.stopListening();
      setState(() => _isListening = false);
    } else {
      setState(() => _isListening = true);
      await sttService.startListening(
        onResult: (text) {
          setState(() {
            _msgController.text = text;
          });
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Hội thoại với Agent', style: TextStyle(color: AppColors.textPrimary, fontSize: 16)),
            Text(
              _activeSessionId != null ? 'Session: ${_activeSessionId!.substring(0, 8)}...' : 'Chưa chọn session',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Session Switcher
          if (appState.sessions.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: AppColors.surfaceLight,
              child: Row(
                children: [
                  const Icon(Icons.folder_outlined, color: AppColors.accent, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _activeSessionId ?? appState.sessions.first.sessionId,
                        isDense: true,
                        dropdownColor: AppColors.surface,
                        items: appState.sessions.map((s) {
                          return DropdownMenuItem<String>(
                            value: s.sessionId,
                            child: Text(
                              s.title,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setState(() => _activeSessionId = val);
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Message list
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (ctx, idx) {
                final msg = _messages[idx];
                final isBoss = msg['role'] == 'boss';

                return Align(
                  alignment: isBoss ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.of(context).size.width * 0.78,
                    ),
                    decoration: BoxDecoration(
                      color: isBoss ? AppColors.primary : AppColors.surface,
                      borderRadius: BorderRadius.circular(16).copyWith(
                        bottomRight: isBoss ? const Radius.circular(0) : const Radius.circular(16),
                        bottomLeft: isBoss ? const Radius.circular(16) : const Radius.circular(0),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isBoss ? 'Sếp:' : 'Agent Antigravity:',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: isBoss ? Colors.white70 : AppColors.accent,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          msg['text']!,
                          style: TextStyle(
                            color: isBoss ? Colors.white : AppColors.textPrimary,
                            fontSize: 14,
                          ),
                        ),
                        if (!isBoss) ...[
                          const SizedBox(height: 6),
                          GestureDetector(
                            onTap: () => ttsService.speak(msg['text']!),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.volume_up, color: AppColors.accent, size: 16),
                                SizedBox(width: 4),
                                Text('Đọc', style: TextStyle(color: AppColors.accent, fontSize: 11)),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Input bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: AppColors.surface,
            child: SafeArea(
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(
                      _isListening ? Icons.mic : Icons.mic_none,
                      color: _isListening ? AppColors.error : AppColors.accent,
                    ),
                    onPressed: _toggleMic,
                  ),
                  Expanded(
                    child: TextField(
                      controller: _msgController,
                      style: const TextStyle(color: AppColors.textPrimary),
                      decoration: const InputDecoration(
                        hintText: 'Nhập yêu cầu cho agent...',
                        hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 14),
                        border: InputBorder.none,
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.send, color: AppColors.primary),
                    onPressed: _sendMessage,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
