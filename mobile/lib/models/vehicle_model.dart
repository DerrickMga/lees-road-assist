class VehicleModel {
  final String id;
  final String ownerId;
  final String make;
  final String model;
  final String? year;
  final String registrationNumber;
  final String? colour;
  final String? fuelType;
  final String? transmissionType;
  final String vehicleCategory;
  final bool isDefault;

  VehicleModel({
    required this.id,
    required this.ownerId,
    required this.make,
    required this.model,
    this.year,
    required this.registrationNumber,
    this.colour,
    this.fuelType,
    this.transmissionType,
    required this.vehicleCategory,
    this.isDefault = false,
  });

  factory VehicleModel.fromJson(Map<String, dynamic> json) => VehicleModel(
        id: (json['id'] ?? '').toString(),
        ownerId: (json['owner_id'] ?? json['user_id'] ?? '').toString(),
        make: json['make'],
        model: json['model'],
        year: json['year'],
        registrationNumber: json['registration_number'],
        colour: json['colour'],
        fuelType: json['fuel_type'],
        transmissionType: json['transmission_type'],
        vehicleCategory: (json['vehicle_category'] ?? json['vehicle_class'] ?? 'sedan').toString(),
        isDefault: json['is_default'] == true,
      );

  Map<String, dynamic> toJson() => {
        'make': make,
        'model': model,
        'year': year,
        'registration_number': registrationNumber,
        'colour': colour,
        'fuel_type': fuelType,
        'transmission_type': transmissionType,
        'vehicle_category': vehicleCategory,
        'is_default': isDefault,
      };
}
