import 'package:flutter/material.dart';

import '../../models/provider_models.dart';
import '../../services/provider_service.dart';

class ProviderJobsScreen extends StatefulWidget {
  const ProviderJobsScreen({super.key});

  @override
  State<ProviderJobsScreen> createState() => _ProviderJobsScreenState();
}

class _ProviderJobsScreenState extends State<ProviderJobsScreen> {
  List<ProviderJobModel> _jobs = [];
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
      final jobs = await ProviderService.listJobs();
      if (!mounted) return;
      setState(() => _jobs = jobs);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _runAction(ProviderJobModel job) async {
    final id = job.assignmentId;
    if (id == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Assignment ID missing for this job')),
      );
      return;
    }

    try {
      if (job.currentStatus == 'accepted' || job.currentStatus == 'en_route') {
        await ProviderService.markArrived(id);
      } else if (job.currentStatus == 'arrived') {
        await ProviderService.startService(id);
      } else if (job.currentStatus == 'in_service') {
        await ProviderService.completeService(id);
      }
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  String? _actionLabel(String status) {
    if (status == 'accepted' || status == 'en_route') return 'Mark Arrived';
    if (status == 'arrived') return 'Start Service';
    if (status == 'in_service') return 'Complete';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Provider Jobs')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? ListView(children: [const SizedBox(height: 120), Center(child: Text(_error!))])
                : _jobs.isEmpty
                    ? ListView(children: const [SizedBox(height: 120), Center(child: Text('No jobs assigned yet'))])
                    : ListView.builder(
                        itemCount: _jobs.length,
                        itemBuilder: (context, i) {
                          final job = _jobs[i];
                          final action = _actionLabel(job.currentStatus);
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(job.serviceTypeName ?? 'Service', style: Theme.of(context).textTheme.titleMedium),
                                  const SizedBox(height: 4),
                                  Text('Status: ${job.currentStatus}'),
                                  if (job.pickupAddress != null) Text('Pickup: ${job.pickupAddress}'),
                                  if (job.issueDescription != null && job.issueDescription!.isNotEmpty)
                                    Text('Issue: ${job.issueDescription}'),
                                  const SizedBox(height: 8),
                                  if (action != null)
                                    ElevatedButton(
                                      onPressed: () => _runAction(job),
                                      child: Text(action),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
