// lib/screens/settings_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override State<SettingsScreen> createState() => _SettingsScreenState();
}
class _SettingsScreenState extends State<SettingsScreen> {
  final Map<String, bool> _switches = {
    'sms': true, 'fence': true, 'email': false,
    'autonomous': true, 'xai': true, 'nightmode': true,
  };

  @override Widget build(BuildContext ctx) => Scaffold(
    backgroundColor: AppColors.forest,
    appBar: AppBar(backgroundColor: AppColors.forest2,
      title: const Text('Settings', style: TextStyle(fontFamily:'Syne',fontWeight:FontWeight.w800,fontSize:17,color:AppColors.textPrimary))),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: Column(children: [
        _SettingGroup('Alert Configuration', [
          _ToggleSetting('SMS Alerts', 'Fast2SMS — community notifications', 'sms', _switches, setState),
          _ToggleSetting('Email Reports', 'Daily digest to forest dept.', 'email', _switches, setState),
          _ToggleSetting('Smart Fence Trigger', 'Auto-activate on risk > 0.70', 'fence', _switches, setState),
          const _InfoRow('Risk Threshold', '0.70'),
        ]).animate().fadeIn(delay: 100.ms),

        const Gap(14),

        _SettingGroup('System Settings', [
          _ToggleSetting('Autonomous Mode', 'Agents act without approval', 'autonomous', _switches, setState),
          _ToggleSetting('XAI Logging', 'SHAP explanations per alert', 'xai', _switches, setState),
          _ToggleSetting('Night Mode Boost', 'Increase sensitivity 19:00–06:00', 'nightmode', _switches, setState),
          const _InfoRow('GPS Fix Interval', '30 min'),
        ]).animate().fadeIn(delay: 200.ms),

        const Gap(14),

        _SettingGroup('Case Study Info', const [
          _InfoRow('Study Area', 'Wayanad Wildlife Sanctuary'),
          _InfoRow('Subject Species', 'Elephas maximus'),
          _InfoRow('Individual', 'WY_ELE_F01 (Adult Female)'),
          _InfoRow('Framework', 'Multi-Agent AI (Cloud)'),
          _InfoRow('Hardware', 'Arduino Uno + ESP32'),
          _InfoRow('App', 'Flutter Android Demo'),
        ]).animate().fadeIn(delay: 300.ms),

        const Gap(14),

        // Logout
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color:AppColors.cardBg, borderRadius:BorderRadius.circular(14), border:Border.all(color:AppColors.border)),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: const [
              Text('Logged in as', style:TextStyle(fontFamily:'DMMono',fontSize:11,color:AppColors.textMuted)),
              Text('admin · Forest Intelligence', style:TextStyle(fontFamily:'DMMono',fontSize:11,color:AppColors.leaf3)),
            ]),
            const Gap(14),
            GestureDetector(
              onTap: () => Navigator.of(ctx).pushAndRemoveUntil(
                MaterialPageRoute(builder:(_) => const LoginScreen()), (_) => false),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.red.withOpacity(0.1),
                  border: Border.all(color: AppColors.red2.withOpacity(0.35)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.logout_rounded, color: Color(0xFFFCA5A5), size: 18),
                  Gap(8),
                  Text('Sign Out', style: TextStyle(fontFamily:'Syne', fontWeight:FontWeight.w700, fontSize:14, color: Color(0xFFFCA5A5))),
                ]),
              ),
            ),
          ]),
        ).animate().fadeIn(delay: 400.ms),
      ]),
    ),
  );
}

Widget _SettingGroup(String title, List<Widget> children) => Container(
  padding: const EdgeInsets.all(16),
  decoration: BoxDecoration(color:AppColors.cardBg, borderRadius:BorderRadius.circular(14), border:Border.all(color:AppColors.border)),
  child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
    Text(title, style:const TextStyle(fontFamily:'Syne',fontWeight:FontWeight.w700,fontSize:14,color:AppColors.textPrimary)),
    const Gap(4),
    const Divider(color:AppColors.border, height:20),
    ...children,
  ]),
);

class _ToggleSetting extends StatelessWidget {
  final String label, sub, key_;
  final Map<String, bool> map;
  final void Function(VoidCallback) setState_;
  const _ToggleSetting(this.label, this.sub, this.key_, this.map, this.setState_);
  @override Widget build(BuildContext ctx) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(children: [
      Expanded(child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
        Text(label, style:const TextStyle(fontSize:13,color:AppColors.textPrimary)),
        Text(sub, style:const TextStyle(fontFamily:'DMMono',fontSize:10,color:AppColors.textMuted)),
      ])),
      Switch(
        value: map[key_] ?? false,
        onChanged: (v) => setState_(() => map[key_] = v),
        activeColor: AppColors.leaf2,
        inactiveTrackColor: AppColors.border,
      ),
    ]),
  );
}

class _InfoRow extends StatelessWidget {
  final String k, v;
  const _InfoRow(this.k, this.v);
  @override Widget build(BuildContext ctx) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(mainAxisAlignment:MainAxisAlignment.spaceBetween, children: [
      Text(k, style:const TextStyle(fontSize:13,color:AppColors.textPrimary)),
      Text(v, style:const TextStyle(fontFamily:'DMMono',fontSize:11,color:AppColors.leaf3)),
    ]),
  );
}
