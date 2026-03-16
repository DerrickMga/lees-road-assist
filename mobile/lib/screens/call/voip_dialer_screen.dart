import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../providers/voip_provider.dart';

class VoipDialerScreen extends StatefulWidget {
  const VoipDialerScreen({super.key});

  @override
  State<VoipDialerScreen> createState() => _VoipDialerScreenState();
}

class _VoipDialerScreenState extends State<VoipDialerScreen> {
  final _numberController = TextEditingController();

  @override
  void dispose() {
    _numberController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final voip = context.watch<VoipProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('VoIP Calling')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: ListTile(
                leading: Icon(
                  voip.state == VoipState.registered ? Icons.check_circle : Icons.warning_amber,
                  color: voip.state == VoipState.registered ? Colors.green : Colors.orange,
                ),
                title: const Text('Connection Status'),
                subtitle: Text(voip.state.name),
                trailing: TextButton(
                  onPressed: voip.state == VoipState.registering ? null : () => voip.registerWithCredentials(),
                  child: const Text('Reconnect'),
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _numberController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Provider Extension / Number',
                hintText: 'e.g. 2638612166752',
                prefixIcon: Icon(Icons.dialpad),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              icon: const Icon(Icons.call),
              label: const Text('Start VoIP Call'),
              onPressed: () {
                final number = _numberController.text.trim().replaceAll('+', '');
                if (number.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Enter a number or extension first')),
                  );
                  return;
                }
                if (voip.state != VoipState.registered) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('VoIP not connected. Tap Reconnect first.')),
                  );
                  return;
                }
                voip.makeCall(number, sipDomain: AppConfig.sipDomain);
                Navigator.pushNamed(context, '/call/active');
              },
            ),
            const SizedBox(height: 12),
            const Text(
              'Tip: You can also call the assigned driver from the tracking screen once a request is active.',
            ),
          ],
        ),
      ),
    );
  }
}
