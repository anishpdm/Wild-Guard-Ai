// lib/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import '../theme/app_theme.dart';
import 'main_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  static const _validUser = 'admin';
  static const _validPass = 'wayanad2024';

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    await Future.delayed(const Duration(milliseconds: 900));
    if (_userCtrl.text.trim() == _validUser && _passCtrl.text == _validPass) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (_, __, ___) => const MainShell(),
          transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
          transitionDuration: const Duration(milliseconds: 500),
        ),
      );
    } else {
      setState(() { _error = 'Invalid credentials. Try admin / wayanad2024'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.forest,
      body: Stack(
        children: [
          // Background grid pattern
          Positioned.fill(
            child: CustomPaint(painter: _GridPainter()),
          ),
          // Radial glow center
          Positioned.fill(
            child: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(0, -0.2),
                  radius: 1.2,
                  colors: [Color(0x200F2318), Color(0xFF0A1A0F)],
                ),
              ),
            ),
          ),
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo
                  Container(
                    width: 72, height: 72,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft, end: Alignment.bottomRight,
                        colors: [AppColors.leaf, AppColors.leaf3],
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [BoxShadow(
                        color: AppColors.leaf2.withOpacity(0.3),
                        blurRadius: 24, spreadRadius: 2,
                      )],
                    ),
                    child: const Center(child: Text('🐘', style: TextStyle(fontSize: 36))),
                  ).animate().scale(duration: 600.ms, curve: Curves.elasticOut),

                  const Gap(20),
                  Text('WildGuard AI',
                    style: Theme.of(context).textTheme.displayMedium?.copyWith(fontSize: 28),
                  ).animate().fadeIn(delay: 200.ms),
                  const Gap(6),
                  Text('WAYANAD WILDLIFE SANCTUARY · KERALA',
                    style: Theme.of(context).textTheme.labelSmall,
                  ).animate().fadeIn(delay: 300.ms),
                  const Gap(4),
                  Text('Multi-Agent HWC Prevention Platform',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ).animate().fadeIn(delay: 400.ms),

                  const Gap(40),

                  // Card
                  Container(
                    width: 380,
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: AppColors.cardBg,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border2, width: 1),
                      boxShadow: [
                        BoxShadow(color: AppColors.leaf2.withOpacity(0.08), blurRadius: 40, spreadRadius: 4),
                        BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 40),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Sign In', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 22)),
                        const Gap(4),
                        Text('Forest Intelligence Admin Portal',
                          style: Theme.of(context).textTheme.bodyMedium),
                        const Gap(28),

                        if (_error != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.red.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.red2.withOpacity(0.4)),
                            ),
                            child: Row(children: [
                              const Icon(Icons.warning_amber_rounded, color: Color(0xFFFCA5A5), size: 16),
                              const Gap(8),
                              Expanded(child: Text(_error!,
                                style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 12))),
                            ]),
                          ),
                          const Gap(16),
                        ],

                        _fieldLabel('USERNAME'),
                        const Gap(7),
                        _inputField(controller: _userCtrl, hint: 'Enter username',
                          icon: Icons.person_outline_rounded),
                        const Gap(18),
                        _fieldLabel('PASSWORD'),
                        const Gap(7),
                        _inputField(controller: _passCtrl, hint: 'Enter password',
                          icon: Icons.lock_outline_rounded, obscure: _obscure,
                          suffix: IconButton(
                            icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                              color: AppColors.textMuted, size: 18),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                        ),
                        const Gap(28),

                        SizedBox(
                          width: double.infinity, height: 52,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.leaf,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              elevation: 0,
                            ),
                            onPressed: _loading ? null : _login,
                            child: _loading
                              ? const SizedBox(width: 22, height: 22,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : Text('Sign In →',
                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                    color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                          ),
                        ),
                        const Gap(20),

                        // Hint box
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.leaf.withOpacity(0.07),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(children: [
                            const Icon(Icons.info_outline, color: AppColors.textMuted, size: 14),
                            const Gap(8),
                            RichText(text: const TextSpan(
                              style: TextStyle(fontFamily: 'DMMono', fontSize: 11, color: AppColors.textMuted),
                              children: [
                                TextSpan(text: 'Demo: '),
                                TextSpan(text: 'admin', style: TextStyle(color: AppColors.leaf3)),
                                TextSpan(text: ' / '),
                                TextSpan(text: 'wayanad2024', style: TextStyle(color: AppColors.leaf3)),
                              ],
                            )),
                          ]),
                        ),
                      ],
                    ),
                  ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.05),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fieldLabel(String text) => Text(text,
    style: const TextStyle(
      fontFamily: 'DMMono', fontSize: 10, color: AppColors.textMuted, letterSpacing: 1.5));

  Widget _inputField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscure = false,
    Widget? suffix,
  }) => TextField(
    controller: controller,
    obscureText: obscure,
    style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
    onSubmitted: (_) => _login(),
    decoration: InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AppColors.textMuted),
      prefixIcon: Icon(icon, color: AppColors.textMuted, size: 18),
      suffixIcon: suffix,
      filled: true,
      fillColor: Colors.black26,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border2),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border2),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.leaf2, width: 1.5),
      ),
    ),
  );
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = const Color(0x0616A34A)..strokeWidth = 0.5;
    const step = 40.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), p);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
    }
  }
  @override bool shouldRepaint(_) => false;
}
