import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/colors.dart';
import '../services/stt_service.dart';
import '../providers/app_state.dart';

class VoiceInputModal extends StatefulWidget {
  const VoiceInputModal({Key? key}) : super(key: key);

  @override
  State<VoiceInputModal> createState() => _VoiceInputModalState();
}

class _VoiceInputModalState extends State<VoiceInputModal> {
  final TextEditingController _controller = TextEditingController();
  bool _isListening = false;
  String? _selectedSession;

  @override
  void initState() {
    super.initState();
    final appState = Provider.of<AppState>(context, listen: false);
    _selectedSession = appState.selectedSessionId;
  }

  void _toggleListening() async {
    if (_isListening) {
      await sttService.stopListening();
      setState(() => _isListening = false);
    } else {
      setState(() => _isListening = true);
      await sttService.startListening(
        onResult: (text) {
          setState(() {
            _controller.text = text;
          });
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);

    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Giao việc bằng giọng nói',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: AppColors.textMuted),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Chọn Session làm việc
          if (appState.sessions.isNotEmpty)
            DropdownButtonFormField<String>(
              value: _selectedSession ?? appState.sessions.first.sessionId,
              dropdownColor: AppColors.surfaceLight,
              decoration: InputDecoration(
                labelText: 'Phiên làm việc đích (Session)',
                labelStyle: const TextStyle(color: AppColors.textSecondary),
                filled: true,
                fillColor: AppColors.background,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              items: appState.sessions.map((s) {
                return DropdownMenuItem<String>(
                  value: s.sessionId,
                  child: Text(
                    s.title,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                  ),
                );
              }).toList(),
              onChanged: (val) {
                setState(() => _selectedSession = val);
              },
            ),
          const SizedBox(height: 16),

          // Ô nhập / xem trước văn bản đã nhận dạng
          TextField(
            controller: _controller,
            maxLines: 4,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: InputDecoration(
              hintText: 'Ví dụ: "Em sửa tiếp lỗi đăng nhập Google trong project NQD-LMS, chạy test rồi báo cáo anh."',
              hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
              filled: true,
              fillColor: AppColors.background,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
          const SizedBox(height: 16),

          // Nút bấm Micro ghi âm
          Center(
            child: GestureDetector(
              onTap: _toggleListening,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _isListening ? AppColors.error : AppColors.primary,
                  boxShadow: [
                    BoxShadow(
                      color: (_isListening ? AppColors.error : AppColors.primary).withOpacity(0.4),
                      blurRadius: _isListening ? 20 : 8,
                      spreadRadius: _isListening ? 4 : 1,
                    )
                  ],
                ),
                child: Icon(
                  _isListening ? Icons.mic : Icons.mic_none,
                  color: Colors.white,
                  size: 36,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              _isListening ? 'Đang lắng nghe Sếp nói...' : 'Bấm micro để nói tiếng Việt',
              style: TextStyle(
                color: _isListening ? AppColors.error : AppColors.textMuted,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Nút Gửi task
          ElevatedButton.icon(
            onPressed: () async {
              final text = _controller.text.trim();
              if (text.isEmpty) return;

              final ok = await appState.sendTask(
                text,
                targetSessionId: _selectedSession,
              );

              if (mounted) {
                if (ok) {
                  Navigator.pop(context);
                  ttsService.speak("Dạ Sếp Nam, em đã nhận task và bắt đầu làm trên máy tính rồi ạ!");
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Đã gửi task tới Antigravity thành công!'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                } else {
                  ttsService.speak("Sếp Nam ơi, gửi task thất bại rồi ạ. Sếp kiểm tra lại kết nối nhé!");
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Lỗi: Gửi task thất bại! Sếp vui lòng kiểm tra kết nối.'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            icon: const Icon(Icons.send, color: Colors.white),
            label: const Text(
              'Xác nhận & Gửi task',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
