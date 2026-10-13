import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/task.dart';
import '../models/session.dart';

class ApiService {
  String baseUrl = 'http://127.0.0.1:3000';
  String? authToken;

  void setConfig(String url, String? token) {
    baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    authToken = token;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (authToken != null) 'Authorization': 'Bearer $authToken',
      };

  Future<Map<String, dynamic>> pair(String pairingCode, String deviceName) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/auth/pair'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'pairingCode': pairingCode,
        'deviceName': deviceName,
        'deviceType': 'mobile',
      }),
    );

    final data = jsonDecode(res.body);
    if (res.statusCode == 200 && data['success'] == true) {
      authToken = data['token'];
    }
    return data;
  }

  Future<Map<String, dynamic>> checkAuth() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/auth/me'),
      headers: _headers,
    );
    return jsonDecode(res.body);
  }

  Future<Map<String, dynamic>> getPcStatus() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/pc/status'),
      headers: _headers,
    );
    return jsonDecode(res.body);
  }

  Future<List<SessionModel>> getSessions() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/pc/sessions'),
      headers: _headers,
    );
    final data = jsonDecode(res.body);
    if (data['sessions'] != null) {
      return (data['sessions'] as List)
          .map((s) => SessionModel.fromJson(s))
          .toList();
    }
    return [];
  }

  Future<List<TaskModel>> getTasks({String? status}) async {
    String url = '$baseUrl/api/tasks';
    if (status != null && status != 'ALL') {
      url += '?status=$status';
    }
    final res = await http.get(Uri.parse(url), headers: _headers);
    final data = jsonDecode(res.body);
    if (data['tasks'] != null) {
      return (data['tasks'] as List).map((t) => TaskModel.fromJson(t)).toList();
    }
    return [];
  }

  Future<TaskModel?> getTask(String id) async {
    final res = await http.get(Uri.parse('$baseUrl/api/tasks/$id'), headers: _headers);
    final data = jsonDecode(res.body);
    if (data['task'] != null) {
      return TaskModel.fromJson(data['task']);
    }
    return null;
  }

  Future<Map<String, dynamic>> createTask({
    required String prompt,
    String? title,
    String? sessionId,
    String? idempotencyKey,
    List<TaskAttachmentModel>? attachments,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/tasks'),
      headers: _headers,
      body: jsonEncode({
        'prompt': prompt,
        'title': title,
        'sessionId': sessionId,
        'idempotencyKey': idempotencyKey,
        if (attachments != null) 'attachments': attachments.map((a) => a.toJson()).toList(),
      }),
    );
    return jsonDecode(res.body);
  }
}

final apiService = ApiService();
