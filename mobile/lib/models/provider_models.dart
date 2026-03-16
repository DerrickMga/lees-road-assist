class ProviderProfileModel {
  final int id;
  final int userId;
  final String? businessName;
  final String providerType;
  final String profileStatus;
  final String tier;
  final double averageRating;
  final int totalJobsCompleted;
  final int maxActiveJobs;
  final double serviceRadiusKm;
  final String? payoutMethod;
  final String? payoutAccountReference;
  final String availabilityStatus;

  ProviderProfileModel({
    required this.id,
    required this.userId,
    this.businessName,
    required this.providerType,
    required this.profileStatus,
    required this.tier,
    required this.averageRating,
    required this.totalJobsCompleted,
    required this.maxActiveJobs,
    required this.serviceRadiusKm,
    this.payoutMethod,
    this.payoutAccountReference,
    required this.availabilityStatus,
  });

  factory ProviderProfileModel.fromJson(Map<String, dynamic> json) {
    return ProviderProfileModel(
      id: (json['id'] as num).toInt(),
      userId: (json['user_id'] as num).toInt(),
      businessName: json['business_name'] as String?,
      providerType: (json['provider_type'] ?? 'individual').toString(),
      profileStatus: (json['profile_status'] ?? 'pending').toString(),
      tier: (json['tier'] ?? 'bronze').toString(),
      averageRating: (json['average_rating'] as num?)?.toDouble() ?? 0,
      totalJobsCompleted: (json['total_jobs_completed'] as num?)?.toInt() ?? 0,
      maxActiveJobs: (json['max_active_jobs'] as num?)?.toInt() ?? 5,
      serviceRadiusKm: (json['service_radius_km'] as num?)?.toDouble() ?? 50,
      payoutMethod: json['payout_method'] as String?,
      payoutAccountReference: json['payout_account_reference'] as String?,
      availabilityStatus: (json['availability_status'] ?? 'offline').toString(),
    );
  }
}

class ProviderEarningsModel {
  final double totalGross;
  final double totalCommission;
  final double totalNet;
  final int totalJobs;
  final String currency;

  ProviderEarningsModel({
    required this.totalGross,
    required this.totalCommission,
    required this.totalNet,
    required this.totalJobs,
    required this.currency,
  });

  factory ProviderEarningsModel.fromJson(Map<String, dynamic> json) {
    return ProviderEarningsModel(
      totalGross: (json['total_gross'] as num?)?.toDouble() ?? 0,
      totalCommission: (json['total_commission'] as num?)?.toDouble() ?? 0,
      totalNet: (json['total_net'] as num?)?.toDouble() ?? 0,
      totalJobs: (json['total_jobs'] as num?)?.toInt() ?? 0,
      currency: (json['currency'] ?? 'USD').toString(),
    );
  }
}

class ProviderJobModel {
  final int id;
  final String uuid;
  final int? assignmentId;
  final String? serviceTypeName;
  final String currentStatus;
  final String? pickupAddress;
  final String? issueDescription;
  final DateTime? createdAt;

  ProviderJobModel({
    required this.id,
    required this.uuid,
    this.assignmentId,
    this.serviceTypeName,
    required this.currentStatus,
    this.pickupAddress,
    this.issueDescription,
    this.createdAt,
  });

  factory ProviderJobModel.fromJson(Map<String, dynamic> json) {
    return ProviderJobModel(
      id: (json['id'] as num).toInt(),
      uuid: (json['uuid'] ?? '').toString(),
      assignmentId: (json['assignment_id'] as num?)?.toInt(),
      serviceTypeName: json['service_type_name'] as String?,
      currentStatus: (json['current_status'] ?? '').toString(),
      pickupAddress: json['pickup_address'] as String?,
      issueDescription: json['issue_description'] as String?,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at']) : null,
    );
  }
}

class ProviderAssetModel {
  final int id;
  final String assetType;
  final String? registrationNumber;
  final String? make;
  final String? model;
  final bool isActive;

  ProviderAssetModel({
    required this.id,
    required this.assetType,
    this.registrationNumber,
    this.make,
    this.model,
    required this.isActive,
  });

  factory ProviderAssetModel.fromJson(Map<String, dynamic> json) {
    return ProviderAssetModel(
      id: (json['id'] as num).toInt(),
      assetType: (json['asset_type'] ?? '').toString(),
      registrationNumber: json['registration_number'] as String?,
      make: json['make'] as String?,
      model: json['model'] as String?,
      isActive: json['is_active'] == true,
    );
  }
}

class ProviderDocumentModel {
  final int id;
  final String documentType;
  final String fileUrl;
  final String verificationStatus;

  ProviderDocumentModel({
    required this.id,
    required this.documentType,
    required this.fileUrl,
    required this.verificationStatus,
  });

  factory ProviderDocumentModel.fromJson(Map<String, dynamic> json) {
    return ProviderDocumentModel(
      id: (json['id'] as num).toInt(),
      documentType: (json['document_type'] ?? '').toString(),
      fileUrl: (json['file_url'] ?? '').toString(),
      verificationStatus: (json['verification_status'] ?? 'pending').toString(),
    );
  }
}

class ProviderCapabilityModel {
  final int id;
  final int serviceTypeId;
  final String name;
  final String code;

  ProviderCapabilityModel({
    required this.id,
    required this.serviceTypeId,
    required this.name,
    required this.code,
  });

  factory ProviderCapabilityModel.fromJson(Map<String, dynamic> json) {
    return ProviderCapabilityModel(
      id: (json['id'] as num).toInt(),
      serviceTypeId: (json['service_type_id'] as num).toInt(),
      name: (json['name'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
    );
  }
}

class ServiceTypeModel {
  final int id;
  final String name;
  final String code;

  ServiceTypeModel({
    required this.id,
    required this.name,
    required this.code,
  });

  factory ServiceTypeModel.fromJson(Map<String, dynamic> json) {
    return ServiceTypeModel(
      id: (json['id'] as num).toInt(),
      name: (json['name'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
    );
  }
}
