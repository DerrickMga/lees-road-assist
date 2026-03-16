import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/voip_provider.dart';

/// Full-screen overlay shown when an inbound SIP call arrives.
class IncomingCallScreen extends StatelessWidget {
  const IncomingCallScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final voip = context.watch<VoipProvider>();
    final caller = voip.remoteIdentity ?? 'Unknown';

    return Scaffold(
      backgroundColor: const Color(0xFF1B1F5C),
      body: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // ── Header ────────────────────────────────────────────────────
            const Padding(
              padding: EdgeInsets.only(top: 60),
              child: Column(
                children: [
                  Text(
                    'Incoming Call',
                    style: TextStyle(color: Colors.white70, fontSize: 18),
                  ),
                  SizedBox(height: 8),
                ],
              ),
            ),

            // ── Caller info ───────────────────────────────────────────────
            Column(
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white12,
                  ),
                  child: const Icon(Icons.person, size: 60, color: Colors.white),
                ),
                const SizedBox(height: 20),
                Text(
                  caller,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Driver',
                  style: TextStyle(color: Colors.white60, fontSize: 16),
                ),
              ],
            ),

            // ── Accept / Decline buttons ──────────────────────────────────
            Padding(
              padding: const EdgeInsets.only(bottom: 60),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Decline
                  _CallButton(
                    icon: Icons.call_end,
                    color: Colors.red,
                    label: 'Decline',
                    onTap: () {
                      voip.declineCall();
                      Navigator.of(context).pop();
                    },
                  ),
                  // Accept
                  _CallButton(
                    icon: Icons.call,
                    color: Colors.green,
                    label: 'Accept',
                    onTap: () {
                      voip.answerCall();
                      Navigator.of(context).pushReplacementNamed('/call/active');
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CallButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  const _CallButton({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GestureDetector(
          onTap: onTap,
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
            child: Icon(icon, color: Colors.white, size: 36),
          ),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Colors.white70)),
      ],
    );
  }
}
