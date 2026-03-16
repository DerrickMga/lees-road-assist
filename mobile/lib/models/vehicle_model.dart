class VehicleModel {
  final String id;
  final String ownerId;
  final String make;
  final String model;
  final String? year;
  final String registrationNumber;
  final String? colour;
  final String? fuelType;
  final String vehicleClass;

  VehicleModel({
    required this.id,
    required this.ownerId,
    required this.make,
    required this.model,
    this.year,
    required this.registrationNumber,
    this.colour,
    this.fuelType,
    required this.vehicleClass,
  });

  factory VehicleModel.fromJson(Map<String, dynamic> json) => VehicleModel(
        id: json['id'],
        ownerId: json['owner_id'],
        make: json['make'],
        model: json['model'],
        year: json['year'],
        registrationNumber: json['registration_number'],
        colour: json['colour'],
        fuelType: json['fuel_type'],
        vehicleClass: json['vehicle_class'],
      );

  Map<String, dynamic> toJson() => {
        'make': make,
        'model': model,
        'year': year,
        'registration_number': registrationNumber,
        'colour': colour,
        'fuel_type': fuelType,
        'vehicle_class': vehicleClass,
      };
}
