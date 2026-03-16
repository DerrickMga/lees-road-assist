import '../models/vehicle_model.dart';
import 'api_service.dart';

class VehicleService {
  static Future<List<VehicleModel>> listVehicles() async {
    final list = await ApiService.getList('/vehicles/');
    return list.map((item) => VehicleModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  static Future<VehicleModel> createVehicle({
    required String make,
    required String model,
    required String registrationNumber,
    String? year,
    String? colour,
    String? fuelType,
    String? transmissionType,
    String vehicleCategory = 'sedan',
    bool isDefault = false,
  }) async {
    final json = await ApiService.post('/vehicles/', {
      'make': make,
      'model': model,
      'registration_number': registrationNumber,
      if (year != null && year.isNotEmpty) 'year': year,
      if (colour != null && colour.isNotEmpty) 'colour': colour,
      if (fuelType != null && fuelType.isNotEmpty) 'fuel_type': fuelType,
      if (transmissionType != null && transmissionType.isNotEmpty) 'transmission_type': transmissionType,
      'vehicle_category': vehicleCategory,
      'is_default': isDefault,
    });
    return VehicleModel.fromJson(json);
  }

  static Future<void> deleteVehicle(String vehicleId) async {
    await ApiService.delete('/vehicles/$vehicleId');
  }
}
