// ignore_for_file: use_null_aware_elements

import '../models/provider_models.dart';
import 'api_service.dart';

class ProviderService {
  static Future<ProviderProfileModel> getProfile() async {
    final json = await ApiService.get('/providers/profile');
    return ProviderProfileModel.fromJson(json);
  }

  static Future<ProviderProfileModel> updateProfile({
    String? businessName,
    String? payoutMethod,
    String? payoutAccountReference,
    int? maxActiveJobs,
    double? serviceRadiusKm,
  }) async {
    final json = await ApiService.put('/providers/profile', {
      if (businessName != null) 'business_name': businessName,
      if (payoutMethod != null) 'payout_method': payoutMethod,
      if (payoutAccountReference != null) 'payout_account_reference': payoutAccountReference,
      if (maxActiveJobs != null) 'max_active_jobs': maxActiveJobs,
      if (serviceRadiusKm != null) 'service_radius_km': serviceRadiusKm,
    });
    return ProviderProfileModel.fromJson(json);
  }

  static Future<void> updateAvailability(String status) async {
    await ApiService.post('/providers/availability', {'status': status});
  }

  static Future<ProviderEarningsModel> getEarnings() async {
    final json = await ApiService.get('/providers/earnings');
    return ProviderEarningsModel.fromJson(json);
  }

  static Future<List<ProviderJobModel>> listJobs({String? statusFilter}) async {
    final json = await ApiService.getList('/providers/jobs', queryParams: statusFilter == null ? null : {'status_filter': statusFilter});
    return json.map((e) => ProviderJobModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> markArrived(int assignmentId) async {
    await ApiService.post('/providers/jobs/$assignmentId/arrived', {});
  }

  static Future<void> startService(int assignmentId) async {
    await ApiService.post('/providers/jobs/$assignmentId/start', {});
  }

  static Future<void> completeService(int assignmentId) async {
    await ApiService.post('/providers/jobs/$assignmentId/complete', {});
  }

  static Future<void> updateLocation({required double latitude, required double longitude}) async {
    await ApiService.post('/providers/location', {
      'latitude': latitude,
      'longitude': longitude,
    });
  }

  static Future<List<ProviderAssetModel>> listAssets() async {
    final json = await ApiService.getList('/providers/assets');
    return json.map((e) => ProviderAssetModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> createAsset({
    required String assetType,
    String? registrationNumber,
    String? make,
    String? model,
  }) async {
    await ApiService.post('/providers/assets', {
      'asset_type': assetType,
      if (registrationNumber != null && registrationNumber.isNotEmpty) 'registration_number': registrationNumber,
      if (make != null && make.isNotEmpty) 'make': make,
      if (model != null && model.isNotEmpty) 'model': model,
    });
  }

  static Future<void> deleteAsset(int assetId) async {
    await ApiService.delete('/providers/assets/$assetId');
  }

  static Future<List<ProviderDocumentModel>> listDocuments() async {
    final json = await ApiService.getList('/providers/documents');
    return json.map((e) => ProviderDocumentModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> createDocument({required String documentType, required String fileUrl}) async {
    await ApiService.post('/providers/documents', {
      'document_type': documentType,
      'file_url': fileUrl,
    });
  }

  static Future<void> deleteDocument(int documentId) async {
    await ApiService.delete('/providers/documents/$documentId');
  }

  static Future<List<ProviderCapabilityModel>> listCapabilities() async {
    final json = await ApiService.getList('/providers/capabilities');
    return json.map((e) => ProviderCapabilityModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<ServiceTypeModel>> listServiceTypes() async {
    final json = await ApiService.getList('/services/types');
    return json.map((e) => ServiceTypeModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> updateCapabilities(List<int> serviceTypeIds) async {
    await ApiService.put('/providers/capabilities', {'service_type_ids': serviceTypeIds});
  }
}
