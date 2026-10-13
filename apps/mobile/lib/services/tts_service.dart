import 'package:flutter_tts/flutter_tts.dart';

class TtsService {
  final FlutterTts _flutterTts = FlutterTts();
  bool _isInitialized = false;
  bool isAutoReadEnabled = true;
  double speechRate = 0.5; // Tốc độ chuẩn tự nhiên
  double pitch = 1.0;

  Future<void> init() async {
    if (_isInitialized) return;

    try {
      await _flutterTts.setLanguage('vi-VN');
      await _flutterTts.setSpeechRate(speechRate);
      await _flutterTts.setPitch(pitch);
      await _flutterTts.setVolume(1.0);
      _isInitialized = true;
    } catch (e) {
      // Fallback nếu thiết bị chưa cài pack tiếng Việt
      print('[TTS] Lỗi khởi tạo tiếng Việt: $e');
    }
  }

  Future<void> speak(String text) async {
    if (!isAutoReadEnabled || text.trim().isEmpty) return;
    await init();
    try {
      await _flutterTts.stop();
      await _flutterTts.speak(text);
    } catch (e) {
      print('[TTS] Lỗi phát âm thanh: $e');
    }
  }

  Future<void> speakTaskCompleted([String? customSummary]) async {
    const String defaultPhrase = 'Đã xong task, Sếp vào kiểm tra đi ạ.';
    if (customSummary != null && customSummary.isNotEmpty) {
      await speak('$defaultPhrase $customSummary');
    } else {
      await speak(defaultPhrase);
    }
  }

  Future<void> stop() async {
    await _flutterTts.stop();
  }
}

final ttsService = TtsService();
