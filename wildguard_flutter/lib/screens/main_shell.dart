// lib/screens/main_shell.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:badges/badges.dart' as badges;
import '../theme/app_theme.dart';
import '../services/mock_data.dart';
import 'dashboard_screen.dart';
import 'camera_screen.dart';
import 'alerts_screen.dart';
import 'analytics_screen.dart';
import 'sensors_screen.dart';
import 'settings_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});
  @override State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _idx = 0;

  static const _screens = [
    DashboardScreen(), CameraScreen(), AlertsScreen(),
    AnalyticsScreen(), SensorsScreen(), SettingsScreen(),
  ];

  static const _labels = ['Dashboard', 'Cameras', 'Alerts', 'Analytics', 'Sensors', 'Settings'];
  static const _icons  = [
    Icons.dashboard_outlined, Icons.videocam_outlined, Icons.notifications_outlined,
    Icons.analytics_outlined, Icons.sensors_outlined, Icons.settings_outlined,
  ];
  static const _activeIcons = [
    Icons.dashboard_rounded, Icons.videocam_rounded, Icons.notifications_rounded,
    Icons.analytics_rounded, Icons.sensors_rounded, Icons.settings_rounded,
  ];

  @override
  Widget build(BuildContext ctx) {
    final alertCount = MockData.alerts.where((a) => !a.acknowledged).length;
    return Scaffold(
      backgroundColor: AppColors.forest,
      body: _screens[_idx].animate(key: ValueKey(_idx)).fadeIn(duration: 250.ms),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.forest2,
          border: Border(top: BorderSide(color: AppColors.border, width: 1)),
        ),
        child: SafeArea(
          child: SizedBox(
            height: 64,
            child: Row(
              children: List.generate(_labels.length, (i) {
                final active = _idx == i;
                final needsBadge = i == 2 && alertCount > 0;
                return Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _idx = i),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      needsBadge
                        ? badges.Badge(
                            badgeContent: Text('$alertCount',
                              style: const TextStyle(color:Colors.white, fontSize:9, fontWeight:FontWeight.w700)),
                            badgeStyle: const badges.BadgeStyle(badgeColor: AppColors.red),
                            child: Icon(_activeIcons[i], size: 22,
                              color: active ? AppColors.leaf3 : AppColors.textMuted),
                          )
                        : Icon(active ? _activeIcons[i] : _icons[i], size: 22,
                            color: active ? AppColors.leaf3 : AppColors.textMuted),
                      const SizedBox(height: 4),
                      Text(_labels[i],
                        style: TextStyle(
                          fontFamily: 'DMMono', fontSize: 10,
                          color: active ? AppColors.leaf3 : AppColors.textMuted,
                          fontWeight: active ? FontWeight.w500 : FontWeight.w400,
                        )),
                      if (active)
                        Container(width: 18, height: 2, margin: const EdgeInsets.only(top:3),
                          decoration: BoxDecoration(
                            color: AppColors.leaf3,
                            borderRadius: BorderRadius.circular(1),
                          )),
                    ]),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}
