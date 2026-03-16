import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/request_provider.dart';
import 'providers/voip_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/auth/reset_password_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/request/request_screen.dart';
import 'screens/tracking/tracking_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/call/incoming_call_screen.dart';
import 'screens/call/active_call_screen.dart';
import 'screens/profile/vehicles_screen.dart';
import 'screens/profile/payment_methods_screen.dart';
import 'screens/call/voip_dialer_screen.dart';

void main() {
  runApp(const LeesRoadsideAssistApp());
}

class LeesRoadsideAssistApp extends StatelessWidget {
  const LeesRoadsideAssistApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => RequestProvider()),
        ChangeNotifierProvider(create: (_) => VoipProvider()),
      ],
      child: MaterialApp(
        title: "Lee's Express Courier",
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const _AuthGate(),
        routes: {
          '/login': (_) => const LoginScreen(),
          '/register': (_) => const RegisterScreen(),
          '/reset-password': (_) => const ResetPasswordScreen(),
          '/home': (_) => const HomeScreen(),
          '/request': (_) => const RequestScreen(),
          '/tracking': (_) => const TrackingScreen(),
          '/profile': (_) => const ProfileScreen(),
          '/vehicles': (_) => const VehiclesScreen(),
          '/payment-methods': (_) => const PaymentMethodsScreen(),
          '/call/incoming': (_) => const IncomingCallScreen(),
          '/call/active': (_) => const ActiveCallScreen(),
          '/voip': (_) => const VoipDialerScreen(),
        },
      ),
    );
  }
}

class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final auth = context.read<AuthProvider>();
    await auth.loadUser();
    if (!mounted) return;
    if (auth.isAuthenticated) {
      Navigator.pushReplacementNamed(context, '/home');
    } else {
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
