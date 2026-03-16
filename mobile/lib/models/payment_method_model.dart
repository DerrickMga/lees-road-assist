class PaymentMethodModel {
  final String id;
  final String label;
  final String type;
  final String accountNumber;
  final bool isDefault;

  PaymentMethodModel({
    required this.id,
    required this.label,
    required this.type,
    required this.accountNumber,
    this.isDefault = false,
  });

  factory PaymentMethodModel.fromJson(Map<String, dynamic> json) {
    return PaymentMethodModel(
      id: (json['id'] ?? '').toString(),
      label: (json['label'] ?? '').toString(),
      type: (json['type'] ?? 'cash').toString(),
      accountNumber: (json['account_number'] ?? '').toString(),
      isDefault: json['is_default'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'label': label,
      'type': type,
      'account_number': accountNumber,
      'is_default': isDefault,
    };
  }
}
