import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_config.dart';
import '../../providers/request_provider.dart';
import '../../providers/voip_provider.dart';

class TrackingScreen extends StatefulWidget {
  const TrackingScreen({super.key});

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      final provider = context.read<RequestProvider>();
      if (provider.activeRequest != null) {
        provider.refreshRequest(provider.activeRequest!.id);
      }
    });
    // Listen for incoming calls while on tracking screen
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VoipProvider>().addListener(_onVoipStateChange);
    });
  }

  void _onVoipStateChange() {
    final voip = context.read<VoipProvider>();
    if (voip.state == VoipState.ringing && mounted) {
      Navigator.of(context).pushNamed('/call/incoming');
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    context.read<VoipProvider>().removeListener(_onVoipStateChange);
    super.dispose();
  }

  void _callDriver(BuildContext context, String? providerPhone) {
    final voip = context.read<VoipProvider>();
    if (voip.state != VoipState.registered) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('VoIP not connected. Retrying…')),
      );
      voip.registerWithCredentials();
      return;
    }
    // Normalise: strip + and use the extension digits
    final ext = (providerPhone ?? '').replaceAll('+', '');
    if (ext.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No driver phone number available')),
      );
      return;
    }
    voip.makeCall(ext, sipDomain: AppConfig.sipDomain);
    Navigator.of(context).pushNamed('/call/active');
  }

  @override
  Widget build(BuildContext context) {
    final requestProvider = context.watch<RequestProvider>();
    final voip = context.watch<VoipProvider>();
    final request = requestProvider.activeRequest;

    if (request == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Tracking')),
        body: const Center(child: Text('No active request')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Tracking Help')),
      body: Column(
        children: [
          // Map placeholder
          Container(
            height: 300,
            color: Colors.grey[200],
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.map, size: 64, color: Colors.grey),
                  const SizedBox(height: 8),
                  Text(
                    'Map View',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  Text(
                    '${request.customerLatitude.toStringAsFixed(4)}, ${request.customerLongitude.toStringAsFixed(4)}',
                    style: TextStyle(color: Colors.grey[500], fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Status card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          _StatusIndicator(status: request.status),
                          const SizedBox(height: 12),
                          Text(
                            request.statusLabel,
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          if (request.estimatedArrivalMinutes != null) ...[
                            const SizedBox(height: 4),
                            Text('ETA: ${request.estimatedArrivalMinutes} min'),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Service details
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Service: ${request.serviceLabel}'),
                          if (request.estimatedPrice != null)
                            Text('Estimated: ${request.currency} ${request.estimatedPrice!.toStringAsFixed(2)}'),
                          if (request.description != null) Text('Note: ${request.description}'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // ── Call Driver button ─────────────────────────────────
                  if (request.isActive)
                    ElevatedButton.icon(
                      icon: const Icon(Icons.call),
                      label: Text(
                        voip.state == VoipState.registered
                            ? 'Call Driver'
                            : voip.state == VoipState.registering
                                ? 'Connecting…'
                                : 'Call Driver',
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1B1F5C),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: voip.state == VoipState.registering
                          ? null
                          : () => _callDriver(context, request.providerPhone),
                    ),
                  const SizedBox(height: 8),
                  if (request.isActive && request.status != 'in_progress')
                    OutlinedButton(
                      onPressed: () async {
                        final nav = Navigator.of(context);
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Cancel Request?'),
                            content: const Text('Are you sure you want to cancel this request?'),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
                              TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes, Cancel')),
                            ],
                          ),
                        );
                        if (confirm == true && mounted) {
                          await requestProvider.cancelRequest(request.id);
                          if (mounted) nav.pop();
                        }
                      },
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                      child: const Text('CANCEL REQUEST'),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusIndicator extends StatelessWidget {
  final String status;
  const _StatusIndicator({required this.status});

  @override
  Widget build(BuildContext context) {
    final steps = ['searching', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed'];
    final currentIdx = steps.indexOf(status);

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(steps.length, (i) {
        final isActive = i <= currentIdx;
        return Container(
          width: 40,
          height: 6,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          decoration: BoxDecoration(
            color: isActive ? Theme.of(context).primaryColor : Colors.grey[300],
            borderRadius: BorderRadius.circular(3),
          ),
        );
      }),
    );
  }
}
