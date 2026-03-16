class UserModel {
  final String id;
  final String firstName;
  final String lastName;
  final String phone;
  final String? email;
  final String role;
  final bool isActive;
  final bool isPhoneVerified;
  final String? profileImageUrl;

  UserModel({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.phone,
    this.email,
    required this.role,
    required this.isActive,
    required this.isPhoneVerified,
    this.profileImageUrl,
  });

  String get fullName => '$firstName $lastName'.trim();

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'].toString(),
        firstName: json['first_name'] ?? '',
        lastName: json['last_name'] ?? '',
        phone: json['phone'] ?? '',
        email: json['email'],
        role: json['role'] ?? 'customer',
        isActive: json['status'] == 'active',
        isPhoneVerified: json['is_phone_verified'] ?? false,
        profileImageUrl: json['profile_image_url'],
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'first_name': firstName,
        'last_name': lastName,
        'phone': phone,
        'email': email,
        'role': role,
        'status': isActive ? 'active' : 'inactive',
        'is_phone_verified': isPhoneVerified,
        'profile_image_url': profileImageUrl,
      };
}
