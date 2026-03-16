import 'package:flutter/material.dart';

import '../../services/api_service.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _phoneCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _sending = false;
  bool _resetting = false;
  bool _codeSent = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _otpCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    setState(() {
      _sending = true;
      _error = null;
      _success = null;
    });
    try {
      await ApiService.post('/auth/forgot-password', {
        'phone_or_email': _phoneCtrl.text.trim(),
      });
      if (!mounted) return;
      setState(() {
        _codeSent = true;
        _success = 'Reset code sent. Check SMS/WhatsApp or email.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _resetPassword() async {
    final newPassword = _passwordCtrl.text;
    if (newPassword.length < 6) {
      setState(() => _error = 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword != _confirmCtrl.text) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }

    setState(() {
      _resetting = true;
      _error = null;
      _success = null;
    });
    try {
      await ApiService.post('/auth/reset-password', {
        'phone_or_email': _phoneCtrl.text.trim(),
        'otp_code': _otpCtrl.text.trim(),
        'new_password': newPassword,
      });
      if (!mounted) return;
      setState(() => _success = 'Password reset successful. You can now sign in.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _resetting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reset Password')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Enter your phone/email to receive a reset code.'),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneCtrl,
              decoration: const InputDecoration(labelText: 'Phone or Email', prefixIcon: Icon(Icons.phone)),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _sending ? null : _sendCode,
              child: _sending
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(_codeSent ? 'Resend Code' : 'Send Reset Code'),
            ),
            const SizedBox(height: 16),
            if (_codeSent) ...[
              TextField(
                controller: _otpCtrl,
                decoration: const InputDecoration(labelText: 'OTP Code', prefixIcon: Icon(Icons.lock_open)),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordCtrl,
                decoration: const InputDecoration(labelText: 'New Password', prefixIcon: Icon(Icons.lock)),
                obscureText: true,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _confirmCtrl,
                decoration: const InputDecoration(labelText: 'Confirm Password', prefixIcon: Icon(Icons.lock)),
                obscureText: true,
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: _resetting ? null : _resetPassword,
                child: _resetting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Reset Password'),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            if (_success != null) ...[
              const SizedBox(height: 12),
              Text(_success!, style: const TextStyle(color: Colors.green)),
            ],
          ],
        ),
      ),
    );
  }
}
