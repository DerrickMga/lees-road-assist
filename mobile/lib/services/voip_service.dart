import 'package:sip_ua/sip_ua.dart';

/// Wraps dart_sip_ua's SipUaHelper as a singleton.
/// Provides register, make call, answer, hangup and mute operations.
class VoipService implements SipUaHelperListener {
  static final VoipService _instance = VoipService._internal();
  factory VoipService() => _instance;
  VoipService._internal();

  final SIPUAHelper _helper = SIPUAHelper();

  bool _initialized = false;
  Call? _currentCall;
  bool _muted = false;

  // ── Callbacks consumed by VoipProvider ──────────────────────────────────
  Function(RegistrationState)? onRegistrationStateChange;
  Function(TransportState)? onTransportStateChange;
  Function(Call, CallState)? onCallStateChange;
  Function(Call)? onIncomingCall;

  // ── Accessors ────────────────────────────────────────────────────────────
  bool get isRegistered => _helper.registered;
  Call? get currentCall => _currentCall;
  bool get isMuted => _muted;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  void initialize() {
    if (_initialized) return;
    _helper.addSipUaHelperListener(this);
    _initialized = true;
  }

  Future<void> register({
    required String wssUrl,
    required String sipDomain,
    required String username,
    required String password,
    String displayName = '',
  }) async {
    initialize();
    final settings = UaSettings()
      ..webSocketUrl = wssUrl
      ..uri = 'sip:$username@$sipDomain'
      ..authorizationUser = username
      ..password = password
      ..displayName = displayName.isNotEmpty ? displayName : username
      ..userAgent = 'LeesRoadAssist/1.0'
      ..dtmfMode = DtmfMode.INFO
      ..register = true
      ..iceServers = [
        {'url': 'stun:stun.l.google.com:19302'},
      ];
    await _helper.start(settings);
  }

  void makeCall(String toExtension, String sipDomain) {
    _helper.call('sip:$toExtension@$sipDomain', voiceOnly: true);
  }

  void answerCall() {
    _currentCall?.answer(_helper.buildCallOptions(true));
  }

  void hangup() {
    _currentCall?.hangup();
    _currentCall = null;
    _muted = false;
  }

  void toggleMute() {
    if (_currentCall == null) return;
    if (_muted) {
      _currentCall!.unmute(true, false);
    } else {
      _currentCall!.mute(true, false);
    }
    _muted = !_muted;
  }

  void unregister() {
    _helper.unregister();
  }

  // ── SipUaHelperListener ──────────────────────────────────────────────────

  @override
  void registrationStateChanged(RegistrationState state) {
    onRegistrationStateChange?.call(state);
  }

  @override
  void transportStateChanged(TransportState state) {
    onTransportStateChange?.call(state);
  }

  @override
  void callStateChanged(Call call, CallState state) {
    if (state.state == CallStateEnum.CALL_INITIATION) {
      _currentCall = call;
      if (call.direction == Direction.incoming) {
        onIncomingCall?.call(call);
      }
    }

    if (state.state == CallStateEnum.ENDED ||
        state.state == CallStateEnum.FAILED) {
      _currentCall = null;
    }

    onCallStateChange?.call(call, state);
  }

  @override
  void onNewMessage(SIPMessageRequest msg) {}

  @override
  void onNewNotify(Notify ntf) {}

  @override
  void onNewReinvite(ReInvite event) {}
}
