import 'package:flutter/material.dart';

import '../../models/provider_models.dart';
import '../../services/provider_service.dart';

class ProviderHomeScreen extends StatefulWidget {
  const ProviderHomeScreen({super.key});

  @override
  State<ProviderHomeScreen> createState() => _ProviderHomeScreenState();
}

class _ProviderHomeScreenState extends State<ProviderHomeScreen> {
  ProviderProfileModel? _profile;
  ProviderEarningsModel? _earnings;
  int _jobs = 0;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile = await ProviderService.getProfile();
      final earnings = await ProviderService.getEarnings();
      final jobs = await ProviderService.listJobs();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _earnings = earnings;
        _jobs = jobs.length;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleAvailability(bool value) async {
    try {
      await ProviderService.updateAvailability(value ? 'available' : 'offline');
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    final earnings = _earnings;
    final isAvailable = profile?.availabilityStatus == 'available';

    return Scaffold(
      appBar: AppBar(title: const Text('Provider Dashboard')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? ListView(children: [const SizedBox(height: 120), Center(child: Text(_error!))])
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: SwitchListTile(
                          title: const Text('Availability'),
                          subtitle: Text(isAvailable ? 'Available for jobs' : 'Offline'),
                          value: isAvailable,
                          onChanged: _toggleAvailability,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Card(
                        child: ListTile(
                          title: Text(profile?.businessName ?? 'Provider'),
                          subtitle: Text('Tier: ${profile?.tier ?? '-'} • Status: ${profile?.profileStatus ?? '-'}'),
                          trailing: const Icon(Icons.verified_user),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: Card(
                              child: ListTile(
                                title: const Text('Jobs'),
                                subtitle: Text('$_jobs total'),
                              ),
                            ),
                          ),
                          Expanded(
                            child: Card(
                              child: ListTile(
                                title: const Text('Net Earnings'),
                                subtitle: Text('${earnings?.currency ?? 'USD'} ${earnings?.totalNet.toStringAsFixed(2) ?? '0.00'}'),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        icon: const Icon(Icons.work_outline),
                        label: const Text('View Jobs'),
                        onPressed: () => Navigator.pushNamed(context, '/provider-jobs'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.manage_accounts_outlined),
                        label: const Text('Manage Provider Profile'),
                        onPressed: () => Navigator.pushNamed(context, '/provider-profile'),
                      ),
                    ],
                  ),
      ),
    );
  }
}
