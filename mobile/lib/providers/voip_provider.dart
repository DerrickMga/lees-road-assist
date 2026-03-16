import 'package:sip_ua/sip_ua.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/voip_service.dart';

enum VoipState {
  unregistered,
  registering,
  registered,
  registrationFailed,
  calling,   // outbound, waiting for remote to answer
  ringing,   // incoming call waiting for local answer
  inCall,
}

class VoipProvider extends ChangeNotifier {
  final _svc = VoipService();

  VoipState _state = VoipState.unregistered;
  Call? _incomingCall;
  String? _remoteIdentity;
  bool _isMuted = false;
  String? _error;

  // ── Getters ──────────────────────────────────────────────────────────────
  VoipState get state => _state;
  Call? get incomingCall => _incomingCall;
  String? get remoteIdentity => _remoteIdentity;
  bool get isMuted => _isMuted;
  bool get isInCall =>
      _state == VoipState.inCall ||
      _state == VoipState.calling ||
      _state == VoipState.ringing;
  String? get error => _error;

  // ── Init / Registration ──────────────────────────────────────────────────

  Future<void> registerWithCredentials() async {
    if (_state == VoipState.registering || _state == VoipState.registered) {
      return;
    }
    _setState(VoipState.registering);

    try {
      // Fetch SIP credentials from our backend
      final creds = await ApiService.get('/voip/credentials');

      _svc.onRegistrationStateChange = _onRegistration;
      _svc.onCallStateChange = _onCallState;
      _svc.onIncomingCall = _onIncomingCall;

      await _svc.register(
        wssUrl: creds['wss_url'] as String,
        sipDomain: creds['sip_domain'] as String,
        username: creds['sip_username'] as String,
        password: creds['sip_password'] as String,
        displayName: creds['display_name'] as String? ?? '',
      );
    } catch (e) {
      _error = 'VoIP registration failed: $e';
      _setState(VoipState.registrationFailed);
    }
  }

  // ── Call actions ─────────────────────────────────────────────────────────

  /// [toExtension] is the remote SIP extension (e.g. "2638612166752")
  /// [sipDomain] defaults to sip.kmgconnect.com
  void makeCall(String toExtension, {String sipDomain = 'sip.kmgconnect.com'}) {
    _remoteIdentity = toExtension;
    _setState(VoipState.calling);
    _svc.makeCall(toExtension, sipDomain);
  }

  void answerCall() {
    _svc.answerCall();
    _setState(VoipState.inCall);
  }

  void hangup() {
    _svc.hangup();
    _incomingCall = null;
    _remoteIdentity = null;
    _isMuted = false;
    _setState(VoipState.registered);
  }

  void declineCall() {
    _svc.hangup();
    _incomingCall = null;
    _remoteIdentity = null;
    _setState(VoipState.registered);
  }

  void toggleMute() {
    _svc.toggleMute();
    _isMuted = !_isMuted;
    notifyListeners();
  }

  // ── Internal callbacks ───────────────────────────────────────────────────

  void _onRegistration(RegistrationState state) {
    switch (state.state) {
      case RegistrationStateEnum.REGISTERED:
        _setState(VoipState.registered);
        break;
      case RegistrationStateEnum.UNREGISTERED:
        _setState(VoipState.unregistered);
        break;
      case RegistrationStateEnum.REGISTRATION_FAILED:
        _error = state.cause?.toString();
        _setState(VoipState.registrationFailed);
        break;
      default:
        break;
    }
  }

  void _onIncomingCall(Call call) {
    _incomingCall = call;
    _remoteIdentity = call.remote_identity;
    _setState(VoipState.ringing);
  }

  void _onCallState(Call call, CallState state) {
    switch (state.state) {
      case CallStateEnum.CALL_INITIATION:
        if (call.direction == Direction.outgoing) {
          _setState(VoipState.calling);
        }
        break;
      case CallStateEnum.PROGRESS:
        if (call.direction == Direction.outgoing) _setState(VoipState.calling);
        break;
      case CallStateEnum.ACCEPTED:
      case CallStateEnum.CONFIRMED:
        _setState(VoipState.inCall);
        break;
      case CallStateEnum.ENDED:
      case CallStateEnum.FAILED:
        _incomingCall = null;
        _remoteIdentity = null;
        _isMuted = false;
        _setState(
          _svc.isRegistered ? VoipState.registered : VoipState.unregistered,
        );
        break;
      default:
        break;
    }
  }

  void _setState(VoipState newState) {
    _state = newState;
    notifyListeners();
  }
}
