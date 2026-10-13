import 'package:flutter/material.dart';
import '../constants/colors.dart';
import '../services/tts_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _autoRead = true;
  double _speechRate = 0.5;
  bool _notifyComplete = true;
  bool _notifyOffline = true;

  @override
  void initState() {
    super.initState();
    _autoRead = ttsService.isAutoReadEnabled;
    _speechRate = ttsService.speechRate;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text('Cài đặt', style: TextStyle(color: AppColors.textPrimary)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Voice AI TTS Settings
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'VOICE AI TIẾNG VIỆT (TEXT-TO-SPEECH)',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text(
                    'Tự động đọc khi hoàn thành task',
                    style: TextStyle(color: AppColors.textPrimary, fontSize: 14),
                  ),
                  subtitle: const Text(
                    'Phát câu "Đã xong task, Sếp vào kiểm tra đi ạ."',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                  value: _autoRead,
                  activeColor: AppColors.primary,
                  onChanged: (val) {
                    setState(() {
                      _autoRead = val;
                      ttsService.isAutoReadEnabled = val;
                    });
                  },
                ),
                const Divider(color: AppColors.surfaceLight),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Tốc độ đọc giọng nói:', style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
                    Text('${(_speechRate * 2).toStringAsFixed(1)}x', style: const TextStyle(color: AppColors.accent)),
                  ],
                ),
                Slider(
                  value: _speechRate,
                  min: 0.3,
                  max: 1.0,
                  divisions: 7,
                  activeColor: AppColors.primary,
                  onChanged: (val) {
                    setState(() {
                      _speechRate = val;
                      ttsService.speechRate = val;
                    });
                  },
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () {
                    ttsService.speakTaskCompleted();
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.accent,
                    side: const BorderSide(color: AppColors.accent),
                  ),
                  icon: const Icon(Icons.volume_up),
                  label: const Text('Thử nghe câu thông báo mẫu'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Push Notifications
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'THÔNG BÁO ĐẨY (PUSH NOTIFICATIONS)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Thông báo khi task xong hoặc lỗi', style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
                  value: _notifyComplete,
                  activeColor: AppColors.primary,
                  onChanged: (val) => setState(() => _notifyComplete = val),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Cảnh báo khi máy tính mất kết nối', style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
                  value: _notifyOffline,
                  activeColor: AppColors.primary,
                  onChanged: (val) => setState(() => _notifyOffline = val),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Thông tin ứng dụng
          Center(
            child: Column(
              children: const [
                Text('Sếp AI Remote v1.0.0', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                SizedBox(height: 4),
                Text('Mobile Voice Control for Google Antigravity', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
