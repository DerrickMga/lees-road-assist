import 'package:flutter/material.dart';

import '../../models/vehicle_model.dart';
import '../../services/vehicle_service.dart';

class VehiclesScreen extends StatefulWidget {
  const VehiclesScreen({super.key});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  List<VehicleModel> _vehicles = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadVehicles();
  }

  Future<void> _loadVehicles() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await VehicleService.listVehicles();
      if (!mounted) return;
      setState(() => _vehicles = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openAddVehicleSheet() async {
    final formKey = GlobalKey<FormState>();
    final makeCtrl = TextEditingController();
    final modelCtrl = TextEditingController();
    final regCtrl = TextEditingController();
    final yearCtrl = TextEditingController();
    final colorCtrl = TextEditingController();
    String category = 'sedan';

    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Add Vehicle', style: Theme.of(ctx).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: makeCtrl,
                    decoration: const InputDecoration(labelText: 'Make'),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: modelCtrl,
                    decoration: const InputDecoration(labelText: 'Model'),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: regCtrl,
                    decoration: const InputDecoration(labelText: 'Registration Number'),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: yearCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Year (optional)'),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: colorCtrl,
                    decoration: const InputDecoration(labelText: 'Color (optional)'),
                  ),
                  const SizedBox(height: 8),
                  StatefulBuilder(
                    builder: (context, setModalState) {
                      return DropdownButtonFormField<String>(
                        initialValue: category,
                        decoration: const InputDecoration(labelText: 'Category'),
                        items: const [
                          DropdownMenuItem(value: 'sedan', child: Text('Sedan')),
                          DropdownMenuItem(value: 'suv', child: Text('SUV')),
                          DropdownMenuItem(value: 'truck', child: Text('Truck')),
                          DropdownMenuItem(value: 'motorbike', child: Text('Motorbike')),
                        ],
                        onChanged: (v) {
                          if (v == null) return;
                          setModalState(() => category = v);
                        },
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () async {
                      if (!formKey.currentState!.validate()) return;
                      try {
                        await VehicleService.createVehicle(
                          make: makeCtrl.text.trim(),
                          model: modelCtrl.text.trim(),
                          registrationNumber: regCtrl.text.trim(),
                          year: yearCtrl.text.trim().isEmpty ? null : yearCtrl.text.trim(),
                          colour: colorCtrl.text.trim().isEmpty ? null : colorCtrl.text.trim(),
                          vehicleCategory: category,
                        );
                        if (ctx.mounted) Navigator.pop(ctx, true);
                      } catch (e) {
                        if (!ctx.mounted) return;
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
                        );
                      }
                    },
                    child: const Text('Save Vehicle'),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    if (created == true) {
      await _loadVehicles();
    }
  }

  Future<void> _deleteVehicle(VehicleModel vehicle) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Vehicle'),
        content: Text('Remove ${vehicle.make} ${vehicle.model}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await VehicleService.deleteVehicle(vehicle.id);
      await _loadVehicles();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Vehicles')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAddVehicleSheet,
        icon: const Icon(Icons.add),
        label: const Text('Add Vehicle'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadVehicles,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? ListView(
                    children: [
                      const SizedBox(height: 120),
                      Center(child: Text(_error!, textAlign: TextAlign.center)),
                    ],
                  )
                : _vehicles.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 120),
                          Center(child: Text('No vehicles yet. Add your first vehicle.')),
                        ],
                      )
                    : ListView.builder(
                        itemCount: _vehicles.length,
                        itemBuilder: (context, i) {
                          final v = _vehicles[i];
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            child: ListTile(
                              leading: const Icon(Icons.directions_car),
                              title: Text('${v.make} ${v.model}'),
                              subtitle: Text('${v.registrationNumber} • ${v.vehicleCategory.toUpperCase()}'),
                              trailing: IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.red),
                                onPressed: () => _deleteVehicle(v),
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
