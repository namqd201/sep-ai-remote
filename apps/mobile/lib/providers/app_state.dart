import 'dart:async';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/task.dart';
import '../models/session.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../services/tts_service.dart';
import '../services/notification_service.dart';

class AppState extends ChangeNotifier {
  String serverUrl = 'http://127.0.0.1:3000';
  String pairingCode = '888999';
  String? token;

  bool isPaired = false;
  bool isPcOnline = false;
  bool isWsConnected = false;
  String pcHostname = 'Windows Dev PC';

  List<TaskModel> tasks = [];
  List<SessionModel> sessions = [];
  String? selectedSessionId;
  bool isLoading = false;

  StreamSubscription? _wsSub;

  Future<void> init() async {
    await ttsService.init();
    await notificationService.init();
  }

  Future<bool> pair(String url, String code) async {
    isLoading = true;
    notifyListeners();

    try {
      serverUrl = url;
      pairingCode = code;
      apiService.setConfig(serverUrl, null);

      final res = await apiService.pair(pairingCode, 'Điện thoại của Sếp');
      if (res['success'] == true) {
        token = res['token'];
        isPaired = true;
        apiService.setConfig(serverUrl, token);

        // Kết nối WebSocket
        final wsUrl = serverUrl.replaceFirst('http', 'ws') + '/ws';
        wsService.connect(wsUrl, token!);
        _subscribeToWebSocket();

        await refreshAll();
        isLoading = false;
        notifyListeners();
        return true;
      }
    } catch (e) {
      print('[AppState] Lỗi kết nối: $e');
    }

    isLoading = false;
    notifyListeners();
    return false;
  }

  void _subscribeToWebSocket() {
    _wsSub?.cancel();
    _wsSub = wsService.events.listen((msg) {
      final event = msg['event'];
      final payload = msg['payload'];

      if (event == 'bridge_status') {
        isPcOnline = payload['isOnline'] ?? false;
        pcHostname = payload['hostname'] ?? pcHostname;
        notifyListeners();
      } else if (event == 'sessions_updated') {
        if (payload['sessions'] != null) {
          sessions = (payload['sessions'] as List)
              .map((s) => SessionModel.fromJson(s))
              .toList();
          notifyListeners();
        }
      } else if (event == 'task_updated') {
        final updatedTask = TaskModel.fromJson(payload);
        final idx = tasks.indexWhere((t) => t.id == updatedTask.id);
        if (idx >= 0) {
          tasks[idx] = updatedTask;
        } else {
          tasks.insert(0, updatedTask);
        }
        notifyListeners();
      } else if (event == 'task_completed') {
        final title = payload['title'] ?? 'Task';
        final summary = payload['summary'];
        final ttsText = payload['ttsVoiceText'] ??
            "Sếp Nam ơi, em đã làm xong task '$title' mà sếp giao rồi. Sếp còn việc gì cần em làm nữa không ạ. Sếp vào kiểm tra task kia nhé.";

        // 1. Đọc giọng nói AI tiếng Việt
        ttsService.speak(ttsText);

        // 2. Hiển thị thông báo đẩy
        notificationService.showNotification(
          id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          title: 'Đã hoàn thành: $title',
          body: summary ?? ttsText,
        );

        refreshTasks();
      }
    });
  }

  Future<void> refreshAll() async {
    await Future.wait([
      refreshStatus(),
      refreshSessions(),
      refreshTasks(),
    ]);
  }

  Future<void> refreshStatus() async {
    try {
      final res = await apiService.getPcStatus();
      if (res['status'] != null) {
        isPcOnline = res['status']['isOnline'] ?? false;
        pcHostname = res['status']['hostname'] ?? pcHostname;
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> refreshSessions() async {
    try {
      sessions = await apiService.getSessions();
      if (selectedSessionId == null && sessions.isNotEmpty) {
        selectedSessionId = sessions.first.sessionId;
      }
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshTasks() async {
    try {
      tasks = await apiService.getTasks();
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> sendTask(String prompt, {String? title, String? targetSessionId}) async {
    if (prompt.trim().isEmpty) return false;

    final idempotencyKey = const Uuid().v4();
    try {
      final res = await apiService.createTask(
        prompt: prompt,
        title: title,
        sessionId: targetSessionId ?? selectedSessionId,
        idempotencyKey: idempotencyKey,
      );

      if (res['success'] == true) {
        await refreshTasks();
        return true;
      }
    } catch (e) {
      print('[AppState] Lỗi tạo task: $e');
    }
    return false;
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    wsService.disconnect();
    super.dispose();
  }
}
