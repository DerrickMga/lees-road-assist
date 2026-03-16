import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_config.dart';
import '../../providers/request_provider.dart';
import '../../providers/voip_provider.dart';
import '../../services/location_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RequestProvider>().loadActiveRequest();
      // Register with SIP server after login
      context.read<VoipProvider>().registerWithCredentials();
    });
  }

  @override
  Widget build(BuildContext context) {
    final requestProvider = context.watch<RequestProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text("Lee's Express Courier"),
        actions: [
          IconButton(
            icon: const Icon(Icons.person),
            onPressed: () => Navigator.pushNamed(context, '/profile'),
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _buildServicesTab(context),
          _buildHistoryTab(requestProvider),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) => setState(() => _currentIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.history), label: 'History'),
        ],
      ),
      floatingActionButton: requestProvider.activeRequest != null
          ? FloatingActionButton.extended(
              onPressed: () => Navigator.pushNamed(context, '/tracking'),
              icon: const Icon(Icons.location_on),
              label: const Text('Track'),
              backgroundColor: Colors.orange,
            )
          : null,
    );
  }

  Widget _buildServicesTab(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // SOS Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _requestHelp(context, 'other'),
              icon: const Icon(Icons.sos, size: 28),
              label: const Text('GET HELP NOW', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                padding: const EdgeInsets.symmetric(vertical: 20),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text('Select a Service', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 0.9,
            ),
            itemCount: AppConfig.serviceTypes.length,
            itemBuilder: (ctx, i) {
              final service = AppConfig.serviceTypes[i];
              return _ServiceCard(
                label: service['label']!,
                iconName: service['icon']!,
                onTap: () => _requestHelp(context, service['key']!),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryTab(RequestProvider provider) {
    if (provider.requestHistory.isEmpty) {
      return const Center(child: Text('No service history yet'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: provider.requestHistory.length,
      itemBuilder: (ctx, i) {
        final req = provider.requestHistory[i];
        return Card(
          child: ListTile(
            leading: Icon(
              req.status == 'completed' ? Icons.check_circle : Icons.pending,
              color: req.status == 'completed' ? Colors.green : Colors.orange,
            ),
            title: Text(req.serviceLabel),
            subtitle: Text('${req.statusLabel} • ${req.currency} ${req.estimatedPrice?.toStringAsFixed(2) ?? "N/A"}'),
            trailing: Text(req.createdAt.substring(0, 10)),
            onTap: () {
              if (req.isActive) {
                Navigator.pushNamed(context, '/tracking');
              }
            },
          ),
        );
      },
    );
  }

  Future<void> _requestHelp(BuildContext context, String serviceType) async {
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final position = await LocationService.getCurrentLocation();
      if (mounted) {
        navigator.pushNamed('/request', arguments: {
          'serviceType': serviceType,
          'latitude': position.latitude,
          'longitude': position.longitude,
        });
      }
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }
}

class _ServiceCard extends StatelessWidget {
  final String label;
  final String iconName;
  final VoidCallback onTap;

  const _ServiceCard({required this.label, required this.iconName, required this.onTap});

  IconData _getIcon() {
    const map = {
      'battery_charging_full': Icons.battery_charging_full,
      'local_shipping': Icons.local_shipping,
      'tire_repair': Icons.tire_repair,
      'local_gas_station': Icons.local_gas_station,
      'lock_open': Icons.lock_open,
      'thermostat': Icons.thermostat,
      'build': Icons.build,
      'car_crash': Icons.car_crash,
      'help_outline': Icons.help_outline,
    };
    return map[iconName] ?? Icons.help_outline;
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(_getIcon(), size: 36, color: Theme.of(context).primaryColor),
              const SizedBox(height: 8),
              Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}
