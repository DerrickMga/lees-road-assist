import 'package:flutter/material.dart';

import '../../models/provider_models.dart';
import '../../services/location_service.dart';
import '../../services/provider_service.dart';

class ProviderProfileScreen extends StatefulWidget {
  const ProviderProfileScreen({super.key});

  @override
  State<ProviderProfileScreen> createState() => _ProviderProfileScreenState();
}

class _ProviderProfileScreenState extends State<ProviderProfileScreen> {
  ProviderProfileModel? _profile;
  List<ProviderAssetModel> _assets = [];
  List<ProviderDocumentModel> _documents = [];
  List<ProviderCapabilityModel> _capabilities = [];
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
      final assets = await ProviderService.listAssets();
      final docs = await ProviderService.listDocuments();
      final caps = await ProviderService.listCapabilities();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _assets = assets;
        _documents = docs;
        _capabilities = caps;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveBusinessAndPayout() async {
    final business = TextEditingController(text: _profile?.businessName ?? '');
    final payoutMethod = TextEditingController(text: _profile?.payoutMethod ?? 'ecocash');
    final payoutRef = TextEditingController(text: _profile?.payoutAccountReference ?? '');

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Update Provider Profile'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: business, decoration: const InputDecoration(labelText: 'Business Name')),
            TextField(controller: payoutMethod, decoration: const InputDecoration(labelText: 'Payout Method')),
            TextField(controller: payoutRef, decoration: const InputDecoration(labelText: 'Payout Account Reference')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );

    if (ok != true) return;
    try {
      await ProviderService.updateProfile(
        businessName: business.text.trim(),
        payoutMethod: payoutMethod.text.trim(),
        payoutAccountReference: payoutRef.text.trim(),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _addAsset() async {
    final type = TextEditingController();
    final reg = TextEditingController();
    final make = TextEditingController();
    final model = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Asset'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: type, decoration: const InputDecoration(labelText: 'Asset Type (tow_truck, van...)')),
              TextField(controller: reg, decoration: const InputDecoration(labelText: 'Registration Number')),
              TextField(controller: make, decoration: const InputDecoration(labelText: 'Make')),
              TextField(controller: model, decoration: const InputDecoration(labelText: 'Model')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Add')),
        ],
      ),
    );

    if (ok != true || type.text.trim().isEmpty) return;
    try {
      await ProviderService.createAsset(
        assetType: type.text.trim(),
        registrationNumber: reg.text.trim(),
        make: make.text.trim(),
        model: model.text.trim(),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _addDocument() async {
    final type = TextEditingController();
    final url = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Document'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: type, decoration: const InputDecoration(labelText: 'Document Type')),
            TextField(controller: url, decoration: const InputDecoration(labelText: 'File URL')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Add')),
        ],
      ),
    );

    if (ok != true || type.text.trim().isEmpty || url.text.trim().isEmpty) return;
    try {
      await ProviderService.createDocument(documentType: type.text.trim(), fileUrl: url.text.trim());
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _manageCapabilities() async {
    try {
      final allTypes = await ProviderService.listServiceTypes();
      final selected = _capabilities.map((e) => e.serviceTypeId).toSet();

      if (!mounted) return;
      final picked = await showDialog<Set<int>>(
        context: context,
        builder: (ctx) {
          final temp = <int>{...selected};
          return AlertDialog(
            title: const Text('Service Capabilities'),
            content: SizedBox(
              width: 360,
              child: StatefulBuilder(
                builder: (ctx, setModalState) {
                  return ListView(
                    shrinkWrap: true,
                    children: allTypes
                        .map(
                          (s) => CheckboxListTile(
                            value: temp.contains(s.id),
                            title: Text(s.name),
                            subtitle: Text(s.code),
                            onChanged: (v) {
                              setModalState(() {
                                if (v == true) {
                                  temp.add(s.id);
                                } else {
                                  temp.remove(s.id);
                                }
                              });
                            },
                          ),
                        )
                        .toList(),
                  );
                },
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              ElevatedButton(onPressed: () => Navigator.pop(ctx, temp), child: const Text('Save')),
            ],
          );
        },
      );

      if (picked == null) return;
      await ProviderService.updateCapabilities(picked.toList());
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _sendCurrentLocation() async {
    try {
      final pos = await LocationService.getCurrentLocation();
      await ProviderService.updateLocation(latitude: pos.latitude, longitude: pos.longitude);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location updated successfully')),
      );
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

    return Scaffold(
      appBar: AppBar(title: const Text('Provider Profile')),
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
                        child: ListTile(
                          title: Text(profile?.businessName ?? 'Provider'),
                          subtitle: Text('Type: ${profile?.providerType ?? '-'} • Tier: ${profile?.tier ?? '-'}'),
                          trailing: TextButton(onPressed: _saveBusinessAndPayout, child: const Text('Edit')),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Card(
                        child: ListTile(
                          title: const Text('Capabilities'),
                          subtitle: Text(_capabilities.isEmpty ? 'No capabilities set' : _capabilities.map((e) => e.name).join(', ')),
                          trailing: TextButton(onPressed: _manageCapabilities, child: const Text('Manage')),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Card(
                        child: ListTile(
                          title: const Text('Assets'),
                          subtitle: Text('${_assets.length} asset(s)'),
                          trailing: TextButton(onPressed: _addAsset, child: const Text('Add')),
                        ),
                      ),
                      ..._assets.map(
                        (a) => ListTile(
                          leading: const Icon(Icons.local_shipping_outlined),
                          title: Text('${a.assetType} ${a.make ?? ''} ${a.model ?? ''}'.trim()),
                          subtitle: Text(a.registrationNumber ?? '-'),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline, color: Colors.red),
                            onPressed: () async {
                              await ProviderService.deleteAsset(a.id);
                              await _load();
                            },
                          ),
                        ),
                      ),
                      const Divider(),
                      Card(
                        child: ListTile(
                          title: const Text('Documents'),
                          subtitle: Text('${_documents.length} document(s)'),
                          trailing: TextButton(onPressed: _addDocument, child: const Text('Add')),
                        ),
                      ),
                      ..._documents.map(
                        (d) => ListTile(
                          leading: const Icon(Icons.description_outlined),
                          title: Text(d.documentType),
                          subtitle: Text('Status: ${d.verificationStatus}\n${d.fileUrl}'),
                          isThreeLine: true,
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline, color: Colors.red),
                            onPressed: () async {
                              await ProviderService.deleteDocument(d.id);
                              await _load();
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        icon: const Icon(Icons.my_location),
                        label: const Text('Send Current Location'),
                        onPressed: _sendCurrentLocation,
                      ),
                    ],
                  ),
      ),
    );
  }
}
