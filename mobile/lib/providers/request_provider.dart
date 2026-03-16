// ignore_for_file: use_null_aware_elements
import 'package:flutter/material.dart';
import '../models/service_request_model.dart';
import '../services/api_service.dart';

class RequestProvider extends ChangeNotifier {
  ServiceRequestModel? _activeRequest;
  List<ServiceRequestModel> _requestHistory = [];
  bool _isLoading = false;
  String? _error;

  ServiceRequestModel? get activeRequest => _activeRequest;
  List<ServiceRequestModel> get requestHistory => _requestHistory;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<ServiceRequestModel?> createRequest({
    required String serviceType,
    required double latitude,
    required double longitude,
    String? address,
    String? vehicleId,
    String? description,
    double? destLat,
    double? destLng,
    String? destAddress,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await ApiService.post('/service-requests/', {
        'service_type': serviceType,
        'customer_latitude': latitude,
        'customer_longitude': longitude,
        if (address != null) 'customer_address': address,
        if (vehicleId != null) 'vehicle_id': vehicleId,
        if (description != null) 'description': description,
        if (destLat != null) 'destination_latitude': destLat,
        if (destLng != null) 'destination_longitude': destLng,
        if (destAddress != null) 'destination_address': destAddress,
      });
      _activeRequest = ServiceRequestModel.fromJson(response);
      _isLoading = false;
      notifyListeners();
      return _activeRequest;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Failed to create request. Please try again.';
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  Future<void> loadActiveRequest() async {
    try {
      final list = await ApiService.getList('/service-requests/');
      final requests = list.map((j) => ServiceRequestModel.fromJson(j)).toList();
      _activeRequest = requests.where((r) => r.isActive).isEmpty
          ? null
          : requests.firstWhere((r) => r.isActive);
      _requestHistory = requests;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshRequest(String requestId) async {
    try {
      final response = await ApiService.get('/service-requests/$requestId');
      _activeRequest = ServiceRequestModel.fromJson(response);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> cancelRequest(String requestId) async {
    try {
      await ApiService.patch('/service-requests/$requestId', {'status': 'cancelled'});
      _activeRequest = null;
      notifyListeners();
    } catch (_) {}
  }

  void clearActive() {
    _activeRequest = null;
    notifyListeners();
  }
}
