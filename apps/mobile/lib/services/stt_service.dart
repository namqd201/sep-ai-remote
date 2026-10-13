import 'package:speech_to_text/speech_to_text.dart' as stt;

class SttService {
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isAvailable = false;
  bool isListening = false;

  Future<bool> init() async {
    try {
      _isAvailable = await _speech.initialize(
        onError: (val) => print('[STT] Lỗi: $val'),
        onStatus: (val) {
          if (val == 'done' || val == 'notListening') {
            isListening = false;
          }
        },
      );
      return _isAvailable;
    } catch (e) {
      _isAvailable = false;
      return false;
    }
  }

  Future<void> startListening({
    required Function(String text) onResult,
    Function()? onDone,
  }) async {
    if (!_isAvailable) {
      final ok = await init();
      if (!ok) return;
    }

    isListening = true;
    await _speech.listen(
      localeId: 'vi_VN',
      onResult: (result) {
        onResult(result.recognizedWords);
      },
    );
  }

  Future<void> stopListening() async {
    if (isListening) {
      await _speech.stop();
      isListening = false;
    }
  }
}

final sttService = SttService();
