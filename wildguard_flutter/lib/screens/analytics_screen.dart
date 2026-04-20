// lib/screens/analytics_screen.dart
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import '../services/mock_data.dart';
import '../theme/app_theme.dart';

class AnalyticsScreen extends StatelessWidget {
  const AnalyticsScreen({super.key});
  @override Widget build(BuildContext ctx) => Scaffold(
    backgroundColor: AppColors.forest,
    appBar: AppBar(backgroundColor: AppColors.forest2,
      title: const Text('Analytics', style: TextStyle(fontFamily:'Syne',fontWeight:FontWeight.w800,fontSize:17,color:AppColors.textPrimary))),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: Column(children: [
        _ChartCard(title:'Monthly Intrusion Risk Score — 2022',
          child: SizedBox(height:180, child: BarChart(BarChartData(
            barGroups: MockData.monthlyRisk.asMap().entries.map((e) =>
              BarChartGroupData(x:e.key, barRods:[BarChartRodData(toY:e.value*100,
                color: e.value>0.4 ? AppColors.amber2 : AppColors.leaf2, width:16, borderRadius:BorderRadius.circular(4))])).toList(),
            titlesData: FlTitlesData(
              leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles:false)),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles:false)),
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles:false)),
              bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles:true, getTitlesWidget:(v,_)=>
                Text(MockData.months[v.toInt()], style:const TextStyle(fontFamily:'DMMono',fontSize:8,color:AppColors.textMuted)))),
            ),
            gridData: const FlGridData(show:false),
            borderData: FlBorderData(show:false),
          )))).animate().fadeIn(delay:100.ms),

        const Gap(14),

        _ChartCard(title:'Monthly Conflict Incidents — Wayanad',
          child: SizedBox(height:180, child: BarChart(BarChartData(
            barGroups: MockData.monthlyIncidents.asMap().entries.map((e) =>
              BarChartGroupData(x:e.key, barRods:[BarChartRodData(toY:e.value.toDouble(),
                color: e.value>10 ? AppColors.red2 : AppColors.amber3, width:16, borderRadius:BorderRadius.circular(4))])).toList(),
            titlesData: FlTitlesData(
              leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles:false)),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles:false)),
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles:false)),
              bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles:true, getTitlesWidget:(v,_)=>
                Text(MockData.months[v.toInt()], style:const TextStyle(fontFamily:'DMMono',fontSize:8,color:AppColors.textMuted)))),
            ),
            gridData: const FlGridData(show:false),
            borderData: FlBorderData(show:false),
          )))).animate().fadeIn(delay:200.ms),

        const Gap(14),

        _ChartCard(title:'Behavioural State Distribution',
          child: SizedBox(height:200, child: PieChart(PieChartData(
            sections: [
              PieChartSectionData(value:48, title:'Roaming\n48%', color:AppColors.leaf2, radius:70, titleStyle:const TextStyle(fontFamily:'DMMono',fontSize:9,color:Colors.black,fontWeight:FontWeight.w700)),
              PieChartSectionData(value:24, title:'Foraging\n24%', color:AppColors.leaf3, radius:70, titleStyle:const TextStyle(fontFamily:'DMMono',fontSize:9,color:Colors.black)),
              PieChartSectionData(value:24, title:'Approach\n24%', color:AppColors.red2, radius:70, titleStyle:const TextStyle(fontFamily:'DMMono',fontSize:9,color:Colors.white)),
              PieChartSectionData(value:4, title:'Rest\n4%', color:AppColors.textMuted, radius:70, titleStyle:const TextStyle(fontFamily:'DMMono',fontSize:9,color:Colors.white)),
            ],
            sectionsSpace: 2,
          )))).animate().fadeIn(delay:300.ms),
      ]),
    ),
  );
}

class _ChartCard extends StatelessWidget {
  final String title; final Widget child;
  const _ChartCard({required this.title, required this.child});
  @override Widget build(BuildContext ctx) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color:AppColors.cardBg, borderRadius:BorderRadius.circular(14), border:Border.all(color:AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style:const TextStyle(fontFamily:'Syne',fontWeight:FontWeight.w700,fontSize:13,color:AppColors.textPrimary)),
      const Gap(14),
      child,
    ]),
  );
}
