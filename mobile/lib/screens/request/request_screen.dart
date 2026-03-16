import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/request_provider.dart';
import '../../services/api_service.dart';

const _paymentMethods = [
  {'id': 'cash',     'label': 'Cash on service',  'icon': '💵'},
  {'id': 'ecocash',  'label': 'EcoCash',           'icon': '📱'},
  {'id': 'innbucks', 'label': 'InnBucks',           'icon': '💳'},
  {'id': 'onemoney', 'label': 'OneMoney',           'icon': '💳'},
];

class RequestScreen extends StatefulWidget {
  const RequestScreen({super.key});

  @override
  State<RequestScreen> createState() => _RequestScreenState();
}

class _RequestScreenState extends State<RequestScreen> {
  final _descriptionController = TextEditingController();
  bool _submitted = false;
  String _paymentMethod = 'cash';
  Map<String, dynamic>? _priceEstimate;
  bool _loadingPrice = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    if (args != null && _priceEstimate == null && !_loadingPrice) {
      _fetchPriceEstimate(
        serviceType: args['serviceType'] as String,
        latitude: args['latitude'] as double,
        longitude: args['longitude'] as double,
      );
    }
  }

  Future<void> _fetchPriceEstimate({
    required String serviceType,
    required double latitude,
    required double longitude,
  }) async {
    setState(() => _loadingPrice = true);
    try {
      final result = await ApiService.post('/services/pricing/estimate', {
        'service_type_code': serviceType,
        'pickup_latitude': latitude,
        'pickup_longitude': longitude,
      });
      if (mounted) setState(() => _priceEstimate = result);
    } catch (_) {
      // Price estimate unavailable — not a blocking error
    } finally {
      if (mounted) setState(() => _loadingPrice = false);
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    if (args == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Request Help')),
        body: const Center(child: Text('Invalid request')),
      );
    }

    final serviceType = args['serviceType'] as String;
    final latitude = args['latitude'] as double;
    final longitude = args['longitude'] as double;
    final requestProvider = context.watch<RequestProvider>();

    final total = (_priceEstimate?['total'] as num?)?.toDouble();
    final currency = (_priceEstimate?['currency'] as String?) ?? 'USD';

    return Scaffold(
      appBar: AppBar(title: const Text('Confirm Request')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Service summary ──────────────────────────────────────────────
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Service', style: Theme.of(context).textTheme.labelLarge?.copyWith(color: Colors.grey[600])),
                    const SizedBox(height: 4),
                    Text(_serviceLabel(serviceType), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    Text('Your Location', style: Theme.of(context).textTheme.labelLarge?.copyWith(color: Colors.grey[600])),
                    const SizedBox(height: 4),
                    Text('Lat: ${latitude.toStringAsFixed(5)}, Lng: ${longitude.toStringAsFixed(5)}', style: const TextStyle(fontSize: 13)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // ── Price estimate ───────────────────────────────────────────────
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: Colors.amber.shade200),
              ),
              color: Colors.amber.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: _loadingPrice
                    ? const Row(children: [
                        SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                        SizedBox(width: 12),
                        Text('Calculating price…', style: TextStyle(fontSize: 13)),
                      ])
                    : _priceEstimate != null
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('💰 Price Estimate', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              const SizedBox(height: 10),
                              _priceRow('🔧 Service fee', _priceEstimate!['service_fee']),
                              _priceRow('📍 Callout fee', _priceEstimate!['callout_fee']),
                              if ((_priceEstimate!['towing_cost'] as num?) != null &&
                                  (_priceEstimate!['towing_cost'] as num) > 0)
                                _priceRow('🚛 Towing', _priceEstimate!['towing_cost']),
                              if ((_priceEstimate!['discount'] as num?) != null &&
                                  (_priceEstimate!['discount'] as num) > 0)
                                _priceRow('🎉 Discount', _priceEstimate!['discount'], isDiscount: true),
                              const Divider(height: 16),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Total', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                  Text(
                                    '\$$total $currency',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFFF59E0B)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Estimate only. Final price confirmed at dispatch.',
                                style: TextStyle(fontSize: 11, color: Colors.grey),
                              ),
                            ],
                          )
                        : const Text(
                            'Price unavailable — our team will quote on arrival.',
                            style: TextStyle(fontSize: 13, color: Colors.grey),
                          ),
              ),
            ),
            const SizedBox(height: 12),

            // ── Description ──────────────────────────────────────────────────
            TextFormField(
              controller: _descriptionController,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: 'Describe your issue (optional)',
                hintText: "e.g. Car won't start, battery is flat...",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey.shade200),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Payment method ───────────────────────────────────────────────
            Text('💳 Payment Method', style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.bold, color: Colors.grey[800])),
            const SizedBox(height: 8),
            ..._paymentMethods.map((m) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => setState(() => _paymentMethod = m['id']!),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _paymentMethod == m['id'] ? const Color(0xFFF59E0B) : Colors.grey.shade200,
                      width: _paymentMethod == m['id'] ? 2 : 1,
                    ),
                    color: _paymentMethod == m['id'] ? const Color(0xFFFEF9C3) : Colors.white,
                  ),
                  child: Row(
                    children: [
                      Text(m['icon']!, style: const TextStyle(fontSize: 20)),
                      const SizedBox(width: 12),
                      Text(m['label']!, style: const TextStyle(fontWeight: FontWeight.w500)),
                      if (_paymentMethod == m['id'])
                        const Spacer(),
                      if (_paymentMethod == m['id'])
                        const Icon(Icons.check_circle_rounded, color: Color(0xFFF59E0B), size: 20),
                    ],
                  ),
                ),
              ),
            )),

            if (requestProvider.error != null) ...[
              const SizedBox(height: 8),
              Text(requestProvider.error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
            ],
            const SizedBox(height: 16),

            // ── Submit ───────────────────────────────────────────────────────
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
              onPressed: requestProvider.isLoading || _submitted
                  ? null
                  : () async {
                      final nav = Navigator.of(context);
                      final result = await requestProvider.createRequest(
                        serviceType: serviceType,
                        latitude: latitude,
                        longitude: longitude,
                        description: _descriptionController.text.trim().isNotEmpty
                            ? _descriptionController.text.trim()
                            : null,
                      );
                      if (result != null && mounted) {
                        setState(() => _submitted = true);
                        nav.pushReplacementNamed('/tracking');
                      }
                    },
              child: requestProvider.isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                    )
                  : Text(
                      total != null
                          ? 'Confirm & Pay \$$total $currency'
                          : 'Confirm & Request Help',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _priceRow(String label, dynamic value, {bool isDiscount = false}) {
    final amount = (value as num?)?.toDouble() ?? 0.0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13)),
          Text(
            isDiscount ? '-\$${amount.toStringAsFixed(2)}' : '\$${amount.toStringAsFixed(2)}',
            style: TextStyle(fontSize: 13, color: isDiscount ? Colors.green[700] : null),
          ),
        ],
      ),
    );
  }

  String _serviceLabel(String type) {
    const labels = {
      'battery_jumpstart': 'Battery Jumpstart',
      'towing': 'Towing',
      'puncture': 'Puncture / Tyre Help',
      'tyre_change': 'Tyre Change',
      'fuel_delivery': 'Fuel Delivery',
      'lockout': 'Lockout Assistance',
      'lockout_rescue': 'Lockout Rescue',
      'overheating': 'Overheating Support',
      'mechanical': 'Mechanical Issue',
      'onsite_repair': 'On-Site Repair',
      'vehicle_recovery': 'Vehicle Recovery',
      'accident_assistance': 'Accident Assistance',
      'other': 'Emergency Assistance',
    };
    return labels[type] ?? type;
  }
}
