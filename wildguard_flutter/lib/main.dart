// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme/app_theme.dart';
import 'screens/login_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Force portrait mode for demo
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: AppColors.forest2,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  runApp(const WildGuardApp());
}

class WildGuardApp extends StatelessWidget {
  const WildGuardApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'WildGuard AI — Wayanad',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.dark,
    home: const LoginScreen(),
  );
}
