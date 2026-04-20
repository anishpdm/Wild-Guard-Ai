// lib/screens/sensors_screen.dart
import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import '../services/mock_data.dart';
import '../theme/app_theme.dart';

class SensorsScreen extends StatefulWidget {
  const SensorsScreen({super.key});
  @override State<SensorsScreen> createState() => _SensorsScreenState();
}
class _SensorsScreenState extends State<SensorsScreen> {
  late Map<String, double> _vals;
  final _rng = Random();
  Timer? _timer;

  @override void initState() {
    super.initState();
    final r = MockData.sensorReadings[0];
    _vals = { 'temp': r.tempC, 'hum': r.humidityPct, 'soil': r.soilMoisture, 'ndvi': r.ndvi, 'bat': r.batteryPct };
    _timer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!mounted) return;
      setState(() {
        _vals['temp'] = (_vals['temp']! + (_rng.nextDouble()-0.5)*0.4).clamp(20, 45);
        _vals['hum']  = (_vals['hum']!  + (_rng.nextDouble()-0.5)*1.2).clamp(20, 100);
        _vals['ndvi'] = (_vals['ndvi']! + (_rng.nextDouble()-0.5)*0.01).clamp(0.1, 0.95);
      });
    });
  }
  @override void dispose() { _timer?.cancel(); super.dispose(); }

  @override Widget build(BuildContext ctx) => Scaffold(
    backgroundColor: AppColors.forest,
    appBar: AppBar(backgroundColor: AppColors.forest2,
      title: Row(children: [
        const Text('Sensors', style: TextStyle(fontFamily:'Syne',fontWeight:FontWeight.w800,fontSize:17,color:AppColors.textPrimary)),
        const Gap(10),
        Container(padding: const EdgeInsets.symmetric(horizontal:8,vertical:3),
          decoration: BoxDecoration(color:AppColors.leaf.withOpacity(0.15),
            border:Border.all(color:AppColors.border2), borderRadius:BorderRadius.circular(20)),
          child: const Text('● LIVE', style: TextStyle(fontFamily:'DMMono',fontSize:10,color:AppColors.leaf3))),
      ])),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: Column(children: [
        // Live sensor grid
        GridView.count(
          crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1.6,
          children: [
            _SensorTile('Temperature', '${_vals['temp']!.toStringAsFixed(1)}°C', _vals['temp']!/45, AppColors.amber3),
            _SensorTile('Humidity', '${_vals['hum']!.toStringAsFixed(0)}%', _vals['hum']!/100, const Color(0xFF60A5FA)),
            _SensorTile('NDVI Proxy', _vals['ndvi']!.toStringAsFixed(3), _vals['ndvi']!, AppColors.leaf3),
            _SensorTile('Battery', '${_vals['bat']!.toStringAsFixed(0)}%', _vals['bat']!/100, AppColors.leaf2),
          ],
        ).animate().fadeIn(delay: 100.ms),

        const Gap(14),

        // Arduino nodes
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color:AppColors.cardBg, borderRadius:BorderRadius.circular(14), border:Border.all(color:AppColors.border)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Arduino Node Status', style: TextStyle(fontFamily:'Syne',fontWeight:FontWeight.w700,fontSize:14,color:AppColors.textPrimary)),
            const Gap(12),
            ...MockData.sensorReadings.map((s) => Padding(
              padding: const EdgeInsets.only(bottom:10),
              child: Row(children: [
                Container(width:8, height:8, decoration: BoxDecoration(
                  color: s.pirTriggered ? AppColors.amber3 : AppColors.leaf3,
                  shape:BoxShape.circle,
                  boxShadow:[BoxShadow(color:(s.pirTriggered?AppColors.amber3:AppColors.leaf3).withOpacity(0.5),blurRadius:6)],
                )),
                const Gap(10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(s.nodeId, style:const TextStyle(fontFamily:'DMMono',fontSize:12,fontWeight:FontWeight.w500,color:AppColors.textPrimary)),
                  Text('T:${s.tempC}°C  H:${s.humidityPct}%  Soil:${s.soilMoisture}%  NDVI:${s.ndvi}',
                    style:const TextStyle(fontFamily:'DMMono',fontSize:9,color:AppColors.textMuted)),
                ])),
                Container(padding: const EdgeInsets.symmetric(horizontal:8,vertical:3),
                  decoration: BoxDecoration(
                    color: s.pirTriggered ? AppColors.amber.withOpacity(0.15) : AppColors.leaf.withOpacity(0.1),
                    border: Border.all(color:(s.pirTriggered?AppColors.amber3:AppColors.leaf3).withOpacity(0.3)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(s.pirTriggered ? 'PIR TRIGGERED' : 'CLEAR',
                    style: TextStyle(fontFamily:'DMMono', fontSize:9,
                      color: s.pirTriggered ? AppColors.amber3 : AppColors.leaf3, fontWeight:FontWeight.w700))),
              ]),
            )),
            const Gap(6),
            Container(padding:const EdgeInsets.all(12),
              decoration:BoxDecoration(color:Colors.black26, borderRadius:BorderRadius.circular(10), border:Border.all(color:AppColors.border)),
              child: const Text('Arduino Uno + ESP32 WiFi · DHT22 · PIR · Soil Moisture\nMQTT → AWS IoT Core → Agent pipeline\nAll nodes transmitting on 30-second intervals',
                style:TextStyle(fontFamily:'DMMono',fontSize:10,color:AppColors.textMuted,height:1.6))),
          ]),
        ).animate().fadeIn(delay: 200.ms),
      ]),
    ),
  );
}

class _SensorTile extends StatelessWidget {
  final String label, value; final double pct; final Color color;
  const _SensorTile(this.label, this.value, this.pct, this.color);
  @override Widget build(BuildContext ctx) => AnimatedContainer(
    duration: 400.ms,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color:AppColors.cardBg, borderRadius:BorderRadius.circular(12), border:Border.all(color:AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style:const TextStyle(fontFamily:'DMMono',fontSize:9,color:AppColors.textMuted,letterSpacing:1)),
      const Gap(4),
      Text(value, style:TextStyle(fontFamily:'Syne',fontWeight:FontWeight.w800,fontSize:22,color:color)),
      const Spacer(),
      ClipRRect(borderRadius:BorderRadius.circular(3),
        child: LinearProgressIndicator(value:pct.clamp(0,1), minHeight:4,
          backgroundColor:AppColors.border, valueColor:AlwaysStoppedAnimation(color))),
    ]),
  );
}
