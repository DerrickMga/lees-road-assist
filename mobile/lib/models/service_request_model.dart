class ServiceRequestModel {
  final String id;
  final String customerId;
  final String? providerId;
  final String? providerPhone;  // SIP extension / phone for in-app calling
  final String? vehicleId;
  final String serviceType;
  final String status;
  final String? description;
  final double customerLatitude;
  final double customerLongitude;
  final String? customerAddress;
  final double? destinationLatitude;
  final double? destinationLongitude;
  final String? destinationAddress;
  final double? estimatedPrice;
  final double? finalPrice;
  final String currency;
  final Map<String, dynamic>? pricingBreakdown;
  final int? estimatedArrivalMinutes;
  final double? distanceKm;
  final String channel;
  final String createdAt;
  final String? acceptedAt;
  final String? arrivedAt;
  final String? completedAt;

  ServiceRequestModel({
    required this.id,
    required this.customerId,
    this.providerId,
    this.providerPhone,
    this.vehicleId,
    required this.serviceType,
    required this.status,
    this.description,
    required this.customerLatitude,
    required this.customerLongitude,
    this.customerAddress,
    this.destinationLatitude,
    this.destinationLongitude,
    this.destinationAddress,
    this.estimatedPrice,
    this.finalPrice,
    required this.currency,
    this.pricingBreakdown,
    this.estimatedArrivalMinutes,
    this.distanceKm,
    required this.channel,
    required this.createdAt,
    this.acceptedAt,
    this.arrivedAt,
    this.completedAt,
  });

  factory ServiceRequestModel.fromJson(Map<String, dynamic> json) => ServiceRequestModel(
        id: json['id'].toString(),
        customerId: (json['customer_id'] ?? json['customer_user_id'] ?? '').toString(),
        providerId: json['provider_id']?.toString(),
        providerPhone: json['provider_phone'] as String?,
        vehicleId: json['vehicle_id']?.toString(),
        serviceType: json['service_type'],
        status: json['status'],
        description: json['description'],
        customerLatitude: (json['customer_latitude'] as num).toDouble(),
        customerLongitude: (json['customer_longitude'] as num).toDouble(),
        customerAddress: json['customer_address'],
        destinationLatitude: json['destination_latitude'] != null
            ? (json['destination_latitude'] as num).toDouble()
            : null,
        destinationLongitude: json['destination_longitude'] != null
            ? (json['destination_longitude'] as num).toDouble()
            : null,
        destinationAddress: json['destination_address'],
        estimatedPrice: json['estimated_price'] != null
            ? (json['estimated_price'] as num).toDouble()
            : null,
        finalPrice: json['final_price'] != null ? (json['final_price'] as num).toDouble() : null,
        currency: json['currency'],
        pricingBreakdown: json['pricing_breakdown'],
        estimatedArrivalMinutes: json['estimated_arrival_minutes'],
        distanceKm: json['distance_km'] != null ? (json['distance_km'] as num).toDouble() : null,
        channel: json['channel'],
        createdAt: json['created_at'],
        acceptedAt: json['accepted_at'],
        arrivedAt: json['arrived_at'],
        completedAt: json['completed_at'],
      );

  String get serviceLabel {
    const labels = {
      'battery_jumpstart': 'Battery Jumpstart',
      'towing': 'Towing',
      'puncture': 'Puncture / Tyre',
      'fuel_delivery': 'Fuel Delivery',
      'lockout': 'Lockout',
      'overheating': 'Overheating',
      'mechanical': 'Mechanical',
      'vehicle_recovery': 'Vehicle Recovery',
      'other': 'Other',
    };
    return labels[serviceType] ?? serviceType;
  }

  String get statusLabel {
    const labels = {
      'pending': 'Pending',
      'searching': 'Finding Provider...',
      'accepted': 'Accepted',
      'en_route': 'En Route',
      'arrived': 'Arrived',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'expired': 'Expired',
    };
    return labels[status] ?? status;
  }

  bool get isActive => ['pending', 'searching', 'accepted', 'en_route', 'arrived', 'in_progress'].contains(status);
}
