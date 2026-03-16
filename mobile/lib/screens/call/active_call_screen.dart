import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/voip_provider.dart';

/// Active call screen shown while a SIP call is connected.
class ActiveCallScreen extends StatefulWidget {
  const ActiveCallScreen({super.key});

  @override
  State<ActiveCallScreen> createState() => _ActiveCallScreenState();
}

class _ActiveCallScreenState extends State<ActiveCallScreen> {
  Timer? _timer;
  int _seconds = 0;
  bool _speakerOn = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _seconds++);
    });
    // Auto-pop when call ends
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VoipProvider>().addListener(_onVoipChange);
    });
  }

  void _onVoipChange() {
    final voip = context.read<VoipProvider>();
    if (!voip.isInCall && mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    context.read<VoipProvider>().removeListener(_onVoipChange);
    super.dispose();
  }

  String get _duration {
    final m = _seconds ~/ 60;
    final s = _seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final voip = context.watch<VoipProvider>();
    final remote = voip.remoteIdentity ?? 'Driver';
    final stateLabel = voip.state == VoipState.calling ? 'Calling…' : _duration;

    return Scaffold(
      backgroundColor: const Color(0xFF1B1F5C),
      body: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // ── Header ─────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.only(top: 60),
              child: Column(
                children: [
                  Container(
                    width: 90,
                    height: 90,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white12,
                    ),
                    child:
                        const Icon(Icons.person, size: 50, color: Colors.white),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    remote,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    stateLabel,
                    style: TextStyle(
                      color: voip.state == VoipState.calling
                          ? Colors.white60
                          : Colors.greenAccent,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),

            // ── Controls ───────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.only(bottom: 60),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _ControlButton(
                        icon: voip.isMuted ? Icons.mic_off : Icons.mic,
                        label: voip.isMuted ? 'Unmute' : 'Mute',
                        active: voip.isMuted,
                        onTap: voip.toggleMute,
                      ),
                      _ControlButton(
                        icon: _speakerOn
                            ? Icons.volume_up
                            : Icons.volume_down,
                        label: _speakerOn ? 'Speaker' : 'Earpiece',
                        active: _speakerOn,
                        onTap: () => setState(() => _speakerOn = !_speakerOn),
                      ),
                      _ControlButton(
                        icon: Icons.dialpad,
                        label: 'Keypad',
                        active: false,
                        onTap: () {},
                      ),
                    ],
                  ),
                  const SizedBox(height: 40),
                  // Hangup
                  GestureDetector(
                    onTap: () {
                      voip.hangup();
                      Navigator.of(context).pop();
                    },
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.red,
                      ),
                      child: const Icon(
                        Icons.call_end,
                        color: Colors.white,
                        size: 36,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'End Call',
                    style: TextStyle(color: Colors.white70),
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

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _ControlButton({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: active ? Colors.white24 : Colors.white12,
            ),
            child: Icon(icon, color: Colors.white, size: 28),
          ),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12)),
        ],
      ),
    );
  }
}
