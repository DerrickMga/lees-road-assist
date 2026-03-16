import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class ApiService {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'access_token';
  static String? _memoryToken; // in-memory fallback for simulator (Keychain unavailable)

  static Future<String?> getToken() async {
    if (_memoryToken != null) return _memoryToken;
    try {
      return await _storage.read(key: _tokenKey);
    } catch (_) {
      return null;
    }
  }

  static Future<void> setToken(String token) async {
    _memoryToken = token;
    try {
      await _storage.write(key: _tokenKey, value: token);
    } catch (_) {}
  }

  static Future<void> clearToken() async {
    _memoryToken = null;
    try {
      await _storage.delete(key: _tokenKey);
    } catch (_) {}
  }

  static Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('${AppConfig.apiBaseUrl}$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    ).timeout(AppConfig.requestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> get(String path, {Map<String, String>? queryParams}) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}$path').replace(queryParameters: queryParams);
    final response = await http.get(uri, headers: await _headers()).timeout(AppConfig.requestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    final response = await http.patch(
      Uri.parse('${AppConfig.apiBaseUrl}$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    ).timeout(AppConfig.requestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    final response = await http.put(
      Uri.parse('${AppConfig.apiBaseUrl}$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    ).timeout(AppConfig.requestTimeout);
    return _handleResponse(response);
  }

  static Future<void> delete(String path) async {
    final response = await http.delete(
      Uri.parse('${AppConfig.apiBaseUrl}$path'),
      headers: await _headers(),
    ).timeout(AppConfig.requestTimeout);
    if (response.statusCode >= 400) {
      throw ApiException(response.statusCode, _parseError(response));
    }
  }

  static Future<List<dynamic>> getList(String path, {Map<String, String>? queryParams}) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}$path').replace(queryParameters: queryParams);
    final response = await http.get(uri, headers: await _headers()).timeout(AppConfig.requestTimeout);
    if (response.statusCode >= 400) {
      throw ApiException(response.statusCode, _parseError(response));
    }
    return jsonDecode(response.body) as List<dynamic>;
  }

  static Map<String, dynamic> _handleResponse(http.Response response) {
    final body = jsonDecode(response.body);
    if (response.statusCode >= 400) {
      throw ApiException(response.statusCode, body['detail'] ?? 'Unknown error');
    }
    return body as Map<String, dynamic>;
  }

  static String _parseError(http.Response response) {
    try {
      return jsonDecode(response.body)['detail'] ?? 'Unknown error';
    } catch (_) {
      return 'Unknown error';
    }
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => 'ApiException($statusCode): $message';
}
