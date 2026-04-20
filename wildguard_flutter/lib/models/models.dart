// lib/models/models.dart

enum AlertLevel { critical, warning, info }
enum BehaviourState { foraging, resting, roaming, approachingSettlement }
enum CameraStatus { online, offline, warning }

class ElephantFix {
  final int eventId;
  final DateTime timestamp;
  final double lat;
  final double lon;
  final BehaviourState state;
  final double speedKmh;
  final double distanceToSettlementKm;
  final String habitat;
  final String nearestSettlement;
  final double intrusionRisk;
  final double tempC;
  final double humidityPct;
  final bool isNight;

  const ElephantFix({
    required this.eventId, required this.timestamp,
    required this.lat, required this.lon,
    required this.state, required this.speedKmh,
    required this.distanceToSettlementKm, required this.habitat,
    required this.nearestSettlement, required this.intrusionRisk,
    required this.tempC, required this.humidityPct, required this.isNight,
  });

  String get stateLabel => switch (state) {
    BehaviourState.foraging              => 'Foraging',
    BehaviourState.resting               => 'Resting',
    BehaviourState.roaming               => 'Roaming',
    BehaviourState.approachingSettlement => 'Approaching Settlement',
  };

  String get riskLabel => intrusionRisk > 0.7 ? 'CRITICAL'
      : intrusionRisk > 0.4 ? 'HIGH'
      : intrusionRisk > 0.2 ? 'MODERATE' : 'LOW';
}

class WildlifeAlert {
  final int id;
  final AlertLevel level;
  final String message;
  final String cameraId;
  final String location;
  final DateTime timestamp;
  final bool acknowledged;

  const WildlifeAlert({
    required this.id, required this.level, required this.message,
    required this.cameraId, required this.location,
    required this.timestamp, this.acknowledged = false,
  });

  WildlifeAlert copyWith({bool? acknowledged}) => WildlifeAlert(
    id: id, level: level, message: message, cameraId: cameraId,
    location: location, timestamp: timestamp,
    acknowledged: acknowledged ?? this.acknowledged,
  );
}

class CameraNode {
  final String id;
  final String name;
  final String location;
  final double lat;
  final double lon;
  final String zone;           // core / fringe / boundary
  final double boundaryKm;
  final CameraStatus status;
  final bool elephantDetected;
  final double confidence;
  final bool boundaryAlert;
  final bool isLive;           // true = phone camera, false = recorded video
  final String? videoAsset;    // path to asset video (null if live)
  final String videoLabel;     // scene description

  const CameraNode({
    required this.id, required this.name, required this.location,
    required this.lat, required this.lon, required this.zone,
    required this.boundaryKm, required this.status,
    required this.elephantDetected, required this.confidence,
    required this.boundaryAlert, required this.isLive,
    this.videoAsset, required this.videoLabel,
  });
}

class SensorReading {
  final String nodeId;
  final DateTime timestamp;
  final double tempC;
  final double humidityPct;
  final double soilMoisture;
  final bool pirTriggered;
  final double ndvi;
  final double batteryPct;

  const SensorReading({
    required this.nodeId, required this.timestamp, required this.tempC,
    required this.humidityPct, required this.soilMoisture,
    required this.pirTriggered, required this.ndvi, required this.batteryPct,
  });
}
