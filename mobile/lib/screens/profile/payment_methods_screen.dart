import 'package:flutter/material.dart';

import '../../models/payment_method_model.dart';
import '../../services/payment_methods_service.dart';

class PaymentMethodsScreen extends StatefulWidget {
  const PaymentMethodsScreen({super.key});

  @override
  State<PaymentMethodsScreen> createState() => _PaymentMethodsScreenState();
}

class _PaymentMethodsScreenState extends State<PaymentMethodsScreen> {
  List<PaymentMethodModel> _methods = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final list = await PaymentMethodsService.listMethods();
    if (!mounted) return;
    setState(() {
      _methods = list;
      _loading = false;
    });
  }

  Future<void> _addMethod() async {
    final labelCtrl = TextEditingController();
    final accountCtrl = TextEditingController();
    String type = 'ecocash';

    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        final formKey = GlobalKey<FormState>();
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: Form(
            key: formKey,
            child: StatefulBuilder(
              builder: (ctx, setModalState) {
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Add Payment Method', style: Theme.of(ctx).textTheme.titleLarge),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: type,
                      decoration: const InputDecoration(labelText: 'Type'),
                      items: const [
                        DropdownMenuItem(value: 'ecocash', child: Text('EcoCash')),
                        DropdownMenuItem(value: 'innbucks', child: Text('InnBucks')),
                        DropdownMenuItem(value: 'onemoney', child: Text('OneMoney')),
                        DropdownMenuItem(value: 'cash', child: Text('Cash on Service')),
                      ],
                      onChanged: (v) {
                        if (v == null) return;
                        setModalState(() => type = v);
                      },
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: labelCtrl,
                      decoration: const InputDecoration(labelText: 'Label (e.g. Personal EcoCash)'),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: accountCtrl,
                      decoration: const InputDecoration(labelText: 'Phone/Account Number'),
                      validator: (v) {
                        if (type == 'cash') return null;
                        return (v == null || v.trim().isEmpty) ? 'Required' : null;
                      },
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () {
                        if (!formKey.currentState!.validate()) return;
                        Navigator.pop(ctx, true);
                      },
                      child: const Text('Add'),
                    ),
                  ],
                );
              },
            ),
          ),
        );
      },
    );

    if (added == true) {
      try {
        await PaymentMethodsService.createMethod(
          label: labelCtrl.text.trim(),
          type: type,
          accountNumber: accountCtrl.text.trim(),
          isDefault: _methods.isEmpty,
        );
        await _load();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _setDefault(PaymentMethodModel item) async {
    try {
      await PaymentMethodsService.setDefault(item.id, item);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _delete(PaymentMethodModel item) async {
    try {
      await PaymentMethodsService.deleteMethod(item.id);
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
    return Scaffold(
      appBar: AppBar(title: const Text('Payment Methods')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addMethod,
        icon: const Icon(Icons.add),
        label: const Text('Add Method'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _methods.isEmpty
              ? const Center(child: Text('No payment methods added yet.'))
              : ListView.builder(
                  itemCount: _methods.length,
                  itemBuilder: (context, i) {
                    final m = _methods[i];
                    return Card(
                      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: ListTile(
                        leading: const Icon(Icons.account_balance_wallet_outlined),
                        title: Text(m.label),
                        subtitle: Text('${m.type.toUpperCase()}${m.accountNumber.isNotEmpty ? ' • ${m.accountNumber}' : ''}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (!m.isDefault)
                              TextButton(
                                onPressed: () => _setDefault(m),
                                child: const Text('Set Default'),
                              )
                            else
                              const Chip(label: Text('Default')),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: Colors.red),
                              onPressed: () => _delete(m),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
