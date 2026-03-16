import '../models/payment_method_model.dart';
import 'api_service.dart';

class PaymentMethodsService {
  static Future<List<PaymentMethodModel>> listMethods() async {
    final list = await ApiService.getList('/payments/methods');
    return list
        .map((item) => PaymentMethodModel.fromJson({
              'id': item['id'],
              'label': item['provider_name'],
              'type': item['payment_type'],
              'account_number': item['masked_reference'] ?? '',
              'is_default': item['is_default'] == true,
            }))
        .toList();
  }

  static Future<PaymentMethodModel> createMethod({
    required String label,
    required String type,
    required String accountNumber,
    bool isDefault = false,
  }) async {
    final json = await ApiService.post('/payments/methods', {
      'provider_name': label,
      'payment_type': type,
      'masked_reference': accountNumber,
      'is_default': isDefault,
    });
    return PaymentMethodModel.fromJson({
      'id': json['id'],
      'label': json['provider_name'],
      'type': json['payment_type'],
      'account_number': json['masked_reference'] ?? '',
      'is_default': json['is_default'] == true,
    });
  }

  static Future<void> setDefault(String methodId, PaymentMethodModel method) async {
    await ApiService.put('/payments/methods/$methodId', {
      'provider_name': method.label,
      'payment_type': method.type,
      'masked_reference': method.accountNumber,
      'is_default': true,
    });
  }

  static Future<void> deleteMethod(String methodId) async {
    await ApiService.delete('/payments/methods/$methodId');
  }
}
