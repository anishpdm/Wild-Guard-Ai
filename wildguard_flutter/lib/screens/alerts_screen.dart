// lib/screens/alerts_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import '../models/models.dart';
import '../services/mock_data.dart';
import '../theme/app_theme.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});
  @override State<AlertsScreen> createState() => _AlertsScreenState();
}
class _AlertsScreenState extends State<AlertsScreen> {
  List<WildlifeAlert> _alerts = List.from(MockData.alerts);

  Color _levelColor(AlertLevel l) => switch(l){
    AlertLevel.critical => AppColors.red2,
    AlertLevel.warning  => AppColors.amber3,
    AlertLevel.info     => const Color(0xFF60A5FA),
  };

  @override Widget build(BuildContext ctx) => Scaffold(
    backgroundColor: AppColors.forest,
    appBar: AppBar(
      backgroundColor: AppColors.forest2,
      title: Row(children: [
        const Text('Alerts', style: TextStyle(fontFamily:'Syne', fontWeight:FontWeight.w800, fontSize:17, color:AppColors.textPrimary)),
        const Gap(10),
        Container(padding: const EdgeInsets.symmetric(horizontal:8,vertical:3),
          decoration: BoxDecoration(color: AppColors.red.withOpacity(0.2),
            border: Border.all(color: AppColors.red2.withOpacity(0.4)), borderRadius: BorderRadius.circular(20)),
          child: Text('${_alerts.where((a)=>!a.acknowledged).length} ACTIVE',
            style: const TextStyle(fontFamily:'DMMono', fontSize:10, color:AppColors.red2, fontWeight:FontWeight.w700))),
      ]),
    ),
    body: ListView.builder(
      padding: const EdgeInsets.all(14),
      itemCount: _alerts.length,
      itemBuilder: (_, i) {
        final a = _alerts[i];
        final col = _levelColor(a.level);
        return AnimatedOpacity(
          opacity: a.acknowledged ? 0.4 : 1.0, duration: 300.ms,
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: col.withOpacity(0.07),
              border: Border.all(color: col.withOpacity(0.3)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(children: [
              Container(width:10, height:10, margin:const EdgeInsets.only(top:2),
                decoration: BoxDecoration(color: col, shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color:col.withOpacity(0.4),blurRadius:5)])),
              const Gap(12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(a.message, style: const TextStyle(fontSize:13, color:AppColors.textPrimary, height:1.4)),
                const Gap(5),
                Text('📍 ${a.location} · ${a.cameraId} · ${a.timestamp.hour.toString().padLeft(2,'0')}:${a.timestamp.minute.toString().padLeft(2,'0')}',
                  style: const TextStyle(fontFamily:'DMMono', fontSize:10, color:AppColors.textMuted)),
              ])),
              const Gap(10),
              if (!a.acknowledged) GestureDetector(
                onTap: () => setState(() => _alerts[i] = a.copyWith(acknowledged: true)),
                child: Container(padding: const EdgeInsets.symmetric(horizontal:10,vertical:5),
                  decoration: BoxDecoration(color: AppColors.leaf.withOpacity(0.15),
                    border: Border.all(color: AppColors.border2), borderRadius: BorderRadius.circular(8)),
                  child: const Text('ACK', style: TextStyle(fontFamily:'DMMono', fontSize:10, color:AppColors.leaf3))),
              ) else const Text('DONE', style: TextStyle(fontFamily:'DMMono', fontSize:10, color:AppColors.textMuted)),
            ]),
          ).animate().fadeIn(delay: (i * 60).ms).slideX(begin: 0.05),
        );
      },
    ),
  );
}
