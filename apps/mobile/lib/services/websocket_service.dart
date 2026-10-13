import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

class WebSocketService {
  WebSocketChannel? _channel;
  bool _isConnected = false;
  Timer? _heartbeatTimer;

  final StreamController<Map<String, dynamic>> _eventController =
      StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get events => _eventController.stream;
  bool get isConnected => _isConnected;

  void connect(String wsUrl, String token) {
    disconnect();

    try {
      final uri = Uri.parse(wsUrl);
      _channel = WebSocketChannel.connect(uri);
      _isConnected = true;

      // Gửi xác thực
      _send({
        'event': 'authenticate',
        'payload': {'token': token},
        'timestamp': DateTime.now().toIso8601String(),
      });

      _channel?.stream.listen(
        (data) {
          try {
            final parsed = jsonDecode(data.toString());
            _eventController.add(parsed);
          } catch (e) {
            // ignore parse error
          }
        },
        onDone: () {
          _isConnected = false;
          _cleanup();
        },
        onError: (err) {
          _isConnected = false;
          _cleanup();
        },
      );

      _heartbeatTimer = Timer.periodic(const Duration(seconds: 15), (_) {
        if (_isConnected) {
          _send({
            'event': 'ping',
            'payload': {},
            'timestamp': DateTime.now().toIso8601String(),
          });
        }
      });
    } catch (e) {
      _isConnected = false;
    }
  }

  void _send(Map<String, dynamic> data) {
    if (_channel != null && _isConnected) {
      _channel?.sink.add(jsonEncode(data));
    }
  }

  void _cleanup() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  void disconnect() {
    _cleanup();
    _channel?.sink.close();
    _channel = null;
    _isConnected = false;
  }
}

final wsService = WebSocketService();
