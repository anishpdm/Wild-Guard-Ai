// lib/screens/dashboard_screen.dart
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/models.dart';
import '../services/mock_data.dart';
import '../theme/app_theme.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext ctx) {
    final latest = MockData.recentTrack.last;
    return Scaffold(
      backgroundColor: AppColors.forest,
      appBar: AppBar(
        backgroundColor: AppColors.forest2,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Dashboard', style: TextStyle(fontFamily:'Syne', fontWeight:FontWeight.w800, fontSize:17, color:AppColors.textPrimary)),
          const Text('Wayanad Wildlife Sanctuary · Live', style: TextStyle(fontFamily:'DMMono', fontSize:10, color:AppColors.textMuted)),
        ]),
        actions: [
          _StatusPill('● LIVE', AppColors.leaf3),
          const Gap(8),
          if (latest.intrusionRisk > 0.7)
            _StatusPill('⚠ CRITICAL', AppColors.red2, blink: true),
          const Gap(12),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(14),
        child: Column(children: [
          // Stat cards
          GridView.count(
            crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 2.2,
            children: [
              _StatCard('Tracked Animal', 'WY_ELE_F01', Icons.location_on_rounded, AppColors.leaf3),
              _StatCard('Intrusion Risk', '${(latest.intrusionRisk*100).toInt()}%', Icons.warning_amber_rounded,
                latest.intrusionRisk > 0.7 ? AppColors.red2 : AppColors.amber3),
              _StatCard('Distance', '${latest.distanceToSettlementKm} km', Icons.social_distance_rounded, AppColors.amber3),
              _StatCard('Active Alerts', '${MockData.alerts.length}', Icons.notifications_active_rounded, AppColors.red2),
            ],
          ).animate().fadeIn(delay: 100.ms),

          const Gap(14),

          // Map
          _MapCard().animate().fadeIn(delay: 200.ms),

          const Gap(14),

          // Risk gauge
          _RiskGaugeCard(risk: latest.intrusionRisk).animate().fadeIn(delay: 300.ms),

          const Gap(14),

          // Recent GPS fixes
          _RecentFixesCard().animate().fadeIn(delay: 400.ms),
        ]),
      ),
    );
  }
}

class _StatusPill extends StatefulWidget {
  final String text; final Color color; final bool blink;
  const _StatusPill(this.text, this.color, {this.blink = false});
  @override State<_StatusPill> createState() => _StatusPillState();
}
class _StatusPillState extends State<_StatusPill> with SingleTickerProviderStateMixin {
  late AnimationController _c;
  @override void initState() { super.initState(); _c = AnimationController(vsync:this,duration:900.ms)..repeat(reverse:true); }
  @override void dispose() { _c.dispose(); super.dispose(); }
  @override Widget build(BuildContext ctx) {
    final w = Container(
      padding: const EdgeInsets.symmetric(horizontal:10,vertical:4),
      decoration: BoxDecoration(
        color: widget.color.withOpacity(0.12),
        border: Border.all(color: widget.color.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(widget.text, style: TextStyle(fontFamily:'DMMono', fontSize:10, color:widget.color)),
    );
    return widget.blink ? FadeTransition(opacity: Tween(begin:0.4,end:1.0).animate(_c), child:w) : w;
  }
}

class _StatCard extends StatelessWidget {
  final String label, value; final IconData icon; final Color color;
  const _StatCard(this.label, this.value, this.icon, this.color);
  @override Widget build(BuildContext ctx) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.cardBg, borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.border),
    ),
    child: Row(children: [
      Container(width:38, height:38, decoration: BoxDecoration(
        color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10),
      ), child: Icon(icon, color: color, size: 20)),
      const Gap(10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(label, style: const TextStyle(fontFamily:'DMMono', fontSize:9, color:AppColors.textMuted, letterSpacing:0.8)),
        const Gap(2),
        Text(value, style: TextStyle(fontFamily:'Syne', fontWeight:FontWeight.w800, fontSize:16, color:color)),
      ])),
    ]),
  );
}

class _MapCard extends StatelessWidget {
  const _MapCard();
  @override Widget build(BuildContext ctx) {
    final track = MockData.recentTrack;
    return Container(
      height: 280,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.hardEdge,
      child: FlutterMap(
        options: const MapOptions(
          initialCenter: LatLng(11.635, 76.22),
          initialZoom: 11.5,
        ),
        children: [
          TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.wildguard.ai'),
          // Track polyline
          PolylineLayer(polylines: [
            Polyline(
              points: track.map((f) => LatLng(f.lat, f.lon)).toList(),
              color: AppColors.leaf2, strokeWidth: 3,
            ),
          ]),
          // Settlement markers
          MarkerLayer(markers: MockData.cameras.where((c) => c.boundaryAlert).map((c) =>
            Marker(
              point: LatLng(c.lat, c.lon), width: 30, height: 30,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.red2.withOpacity(0.2),
                  border: Border.all(color: AppColors.red2), shape: BoxShape.circle,
                ),
                child: const Icon(Icons.warning_amber_rounded, color: AppColors.red2, size: 16),
              ),
            ),
          ).toList()),
          // Current elephant position
          MarkerLayer(markers: [
            Marker(
              point: LatLng(track.last.lat, track.last.lon), width: 40, height: 40,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.leaf3.withOpacity(0.15),
                  border: Border.all(color: AppColors.leaf3, width: 1.5),
                  shape: BoxShape.circle,
                ),
                child: const Center(child: Text('🐘', style: TextStyle(fontSize: 16))),
              ),
            ),
          ]),
        ],
      ),
    );
  }
}

class _RiskGaugeCard extends StatelessWidget {
  final double risk;
  const _RiskGaugeCard({required this.risk});
  @override Widget build(BuildContext ctx) {
    final col = risk > 0.7 ? AppColors.red2 : risk > 0.4 ? AppColors.amber2 : AppColors.leaf2;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Current Intrusion Risk', style: TextStyle(fontFamily:'Syne', fontWeight:FontWeight.w700, fontSize:14, color:AppColors.textPrimary)),
          Container(padding: const EdgeInsets.symmetric(horizontal:8,vertical:3),
            decoration: BoxDecoration(color: col.withOpacity(0.15),
              border: Border.all(color: col.withOpacity(0.4)), borderRadius: BorderRadius.circular(20)),
            child: Text(risk > 0.7 ? 'CRITICAL' : risk > 0.4 ? 'HIGH' : 'LOW',
              style: TextStyle(fontFamily:'DMMono', fontSize:10, color:col, fontWeight:FontWeight.w700))),
        ]),
        const Gap(14),
        Row(children: [
          Text('${(risk*100).toInt()}%',
            style: TextStyle(fontFamily:'Syne', fontWeight:FontWeight.w800, fontSize:40, color:col)),
          const Spacer(),
          const Text('WY_ELE_F01\nAmbalavayal',
            style: TextStyle(fontFamily:'DMMono', fontSize:11, color:AppColors.textMuted, height:1.5),
            textAlign: TextAlign.right),
        ]),
        const Gap(10),
        ClipRRect(borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(value: risk, minHeight: 10,
            backgroundColor: AppColors.border,
            valueColor: AlwaysStoppedAnimation(col))),
        const Gap(6),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: const [
          Text('Low', style: TextStyle(fontFamily:'DMMono', fontSize:9, color:AppColors.textMuted)),
          Text('Medium', style: TextStyle(fontFamily:'DMMono', fontSize:9, color:AppColors.textMuted)),
          Text('Critical', style: TextStyle(fontFamily:'DMMono', fontSize:9, color:AppColors.textMuted)),
        ]),
      ]),
    );
  }
}

class _RecentFixesCard extends StatelessWidget {
  const _RecentFixesCard();
  @override Widget build(BuildContext ctx) {
    final fixes = MockData.recentTrack.reversed.take(5).toList();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Recent GPS Fixes', style: TextStyle(fontFamily:'Syne', fontWeight:FontWeight.w700, fontSize:14, color:AppColors.textPrimary)),
        const Gap(12),
        ...fixes.map((f) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(
              color: f.intrusionRisk > 0.7 ? AppColors.red2 : f.intrusionRisk > 0.4 ? AppColors.amber3 : AppColors.leaf3,
              shape: BoxShape.circle,
            )),
            const Gap(10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${f.lat.toStringAsFixed(4)}, ${f.lon.toStringAsFixed(4)} — ${f.stateLabel}',
                style: const TextStyle(fontFamily:'DMMono', fontSize:11, color:AppColors.textPrimary)),
              Text('${f.habitat} · ${f.distanceToSettlementKm} km · ${f.tempC}°C',
                style: const TextStyle(fontFamily:'DMMono', fontSize:9, color:AppColors.textMuted)),
            ])),
            Container(padding: const EdgeInsets.symmetric(horizontal:6,vertical:2),
              decoration: BoxDecoration(
                color: (f.intrusionRisk>0.7 ? AppColors.red2 : f.intrusionRisk>0.4 ? AppColors.amber3 : AppColors.leaf3).withOpacity(0.15),
                borderRadius: BorderRadius.circular(5),
              ),
              child: Text('${(f.intrusionRisk*100).toInt()}%',
                style: TextStyle(fontFamily:'DMMono', fontSize:9,
                  color: f.intrusionRisk>0.7 ? AppColors.red2 : f.intrusionRisk>0.4 ? AppColors.amber3 : AppColors.leaf3))),
          ]),
        )),
      ]),
    );
  }
}
