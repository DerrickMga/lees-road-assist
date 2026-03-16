class AppConfig {
  static const String appName = "Lee's Roadside Assist";
  // static const String apiBaseUrl = 'http://10.0.2.2:8000/api/v1'; // Android emulator
  static const String apiBaseUrl = 'http://localhost:8000/api/v1'; // iOS simulator
  static const String wsBaseUrl = 'ws://localhost:8000/api/v1/ws';

  // ── VoIP / SIP (KMG Vital Links platform) ───────────────────────────────
  static const String sipDomain = 'sip.kmgconnect.com';
  static const String sipWssUrl = 'wss://sip.kmgconnect.com:8089/ws';
  // STUN server for ICE negotiation
  static const String stunServer = 'stun:stun.l.google.com:19302';

  static const String whatsAppNumber = '+1234567890'; // Replace with actual number
  static const String supportEmail = 'support@leesrescue.com';

  static const Duration requestTimeout = Duration(seconds: 30);
  static const Duration locationUpdateInterval = Duration(seconds: 10);

  static const List<Map<String, String>> serviceTypes = [
    {'key': 'battery_jumpstart', 'label': 'Battery Jumpstart', 'icon': 'battery_charging_full'},
    {'key': 'towing', 'label': 'Towing', 'icon': 'local_shipping'},
    {'key': 'puncture', 'label': 'Puncture / Tyre Help', 'icon': 'tire_repair'},
    {'key': 'fuel_delivery', 'label': 'Fuel Delivery', 'icon': 'local_gas_station'},
    {'key': 'lockout', 'label': 'Lockout Assistance', 'icon': 'lock_open'},
    {'key': 'overheating', 'label': 'Overheating Support', 'icon': 'thermostat'},
    {'key': 'mechanical', 'label': 'Mechanical Issue', 'icon': 'build'},
    {'key': 'vehicle_recovery', 'label': 'Vehicle Recovery', 'icon': 'car_crash'},
    {'key': 'other', 'label': 'Other', 'icon': 'help_outline'},
  ];
}
