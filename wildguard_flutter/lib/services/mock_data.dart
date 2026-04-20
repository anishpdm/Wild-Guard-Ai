// lib/services/mock_data.dart
import '../models/models.dart';

class MockData {

  // ── Camera Nodes ────────────────────────────────────────────────────────
  // CAM-01 = LIVE (phone camera)
  // CAM-02..06 = recorded videos
  static List<CameraNode> cameras = const [
    CameraNode(
      id: 'CAM-01', name: 'Live Demo Camera',
      location: 'Muthanga Gate', lat: 11.6235, lon: 76.1814,
      zone: 'core', boundaryKm: 6.2, status: CameraStatus.online,
      elephantDetected: false, confidence: 0.0, boundaryAlert: false,
      isLive: true, videoAsset: null,
      videoLabel: 'Phone camera — live feed',
    ),
    CameraNode(
      id: 'CAM-02', name: 'Ambalavayal Fringe',
      location: '11.6170, 76.2170', lat: 11.617, lon: 76.217,
      zone: 'fringe', boundaryKm: 1.4, status: CameraStatus.online,
      elephantDetected: true, confidence: 0.88, boundaryAlert: false,
      isLive: false, videoAsset: 'assets/videos/cam02_elephant_forest.mp4',
      videoLabel: 'Elephant in forest — day',
    ),
    CameraNode(
      id: 'CAM-03', name: 'Sulthan Bathery East',
      location: '11.6480, 76.2580', lat: 11.648, lon: 76.258,
      zone: 'boundary', boundaryKm: 0.9, status: CameraStatus.online,
      elephantDetected: true, confidence: 0.96, boundaryAlert: true,
      isLive: false, videoAsset: 'assets/videos/cam03_boundary_night.mp4',
      videoLabel: 'Boundary approach — night IR',
    ),
    CameraNode(
      id: 'CAM-04', name: 'Pulpalli Corridor',
      location: '11.7330, 76.1830', lat: 11.733, lon: 76.183,
      zone: 'boundary', boundaryKm: 1.1, status: CameraStatus.online,
      elephantDetected: true, confidence: 0.93, boundaryAlert: true,
      isLive: false, videoAsset: 'assets/videos/cam04_herd_corridor.mp4',
      videoLabel: 'Elephant herd — corridor',
    ),
    CameraNode(
      id: 'CAM-05', name: 'Muttil Forest',
      location: '11.6820, 76.1820', lat: 11.682, lon: 76.182,
      zone: 'fringe', boundaryKm: 2.3, status: CameraStatus.warning,
      elephantDetected: true, confidence: 0.91, boundaryAlert: false,
      isLive: false, videoAsset: 'assets/videos/cam05_elephant_walking.mp4',
      videoLabel: 'Single elephant walking — dusk',
    ),
    CameraNode(
      id: 'CAM-06', name: 'Nulpuzha Waterhole',
      location: '11.5830, 76.1500', lat: 11.583, lon: 76.15,
      zone: 'core', boundaryKm: 4.8, status: CameraStatus.online,
      elephantDetected: false, confidence: 0.0, boundaryAlert: false,
      isLive: false, videoAsset: 'assets/videos/cam06_waterhole_clear.mp4',
      videoLabel: 'Waterhole — no activity',
    ),
  ];

  // ── GPS Track (last 12 hours) ────────────────────────────────────────────
  static List<ElephantFix> recentTrack = [
    ElephantFix(eventId:1, timestamp:DateTime.now().subtract(const Duration(hours:6)),
      lat:11.6430, lon:76.1982, state:BehaviourState.foraging,
      speedKmh:1.2, distanceToSettlementKm:5.8, habitat:'Dense forest',
      nearestSettlement:'Muthanga', intrusionRisk:0.06, tempC:29.1, humidityPct:72, isNight:false),
    ElephantFix(eventId:2, timestamp:DateTime.now().subtract(const Duration(hours:5)),
      lat:11.6390, lon:76.2045, state:BehaviourState.foraging,
      speedKmh:0.9, distanceToSettlementKm:5.2, habitat:'Forest',
      nearestSettlement:'Muthanga', intrusionRisk:0.08, tempC:30.2, humidityPct:68, isNight:false),
    ElephantFix(eventId:3, timestamp:DateTime.now().subtract(const Duration(hours:4)),
      lat:11.6350, lon:76.2120, state:BehaviourState.roaming,
      speedKmh:3.2, distanceToSettlementKm:4.1, habitat:'Forest',
      nearestSettlement:'Ambalavayal', intrusionRisk:0.12, tempC:31.5, humidityPct:65, isNight:false),
    ElephantFix(eventId:4, timestamp:DateTime.now().subtract(const Duration(hours:3)),
      lat:11.6317, lon:76.2190, state:BehaviourState.roaming,
      speedKmh:4.1, distanceToSettlementKm:3.2, habitat:'Forest fringe',
      nearestSettlement:'Ambalavayal', intrusionRisk:0.28, tempC:32.1, humidityPct:62, isNight:false),
    ElephantFix(eventId:5, timestamp:DateTime.now().subtract(const Duration(hours:2)),
      lat:11.6258, lon:76.2214, state:BehaviourState.roaming,
      speedKmh:5.2, distanceToSettlementKm:2.1, habitat:'Forest fringe',
      nearestSettlement:'Ambalavayal', intrusionRisk:0.45, tempC:32.8, humidityPct:60, isNight:true),
    ElephantFix(eventId:6, timestamp:DateTime.now().subtract(const Duration(hours:1)),
      lat:11.6201, lon:76.2081, state:BehaviourState.approachingSettlement,
      speedKmh:6.8, distanceToSettlementKm:0.9, habitat:'Settlement edge',
      nearestSettlement:'Ambalavayal', intrusionRisk:0.94, tempC:28.4, humidityPct:74, isNight:true),
    ElephantFix(eventId:7, timestamp:DateTime.now().subtract(const Duration(minutes:30)),
      lat:11.6201, lon:76.2090, state:BehaviourState.approachingSettlement,
      speedKmh:2.1, distanceToSettlementKm:0.85, habitat:'Settlement edge',
      nearestSettlement:'Ambalavayal', intrusionRisk:0.96, tempC:28.1, humidityPct:75, isNight:true),
  ];

  // ── Alerts ───────────────────────────────────────────────────────────────
  static List<WildlifeAlert> alerts = [
    WildlifeAlert(id:1, level:AlertLevel.critical,
      message:'🐘 WY_ELE_F01 within 0.85 km of Ambalavayal. BOUNDARY BREACH. Smart fence activated.',
      cameraId:'CAM-03', location:'Ambalavayal',
      timestamp:DateTime.now().subtract(const Duration(minutes:28))),
    WildlifeAlert(id:2, level:AlertLevel.critical,
      message:'⚠️ Intrusion risk CRITICAL (0.96) — SMS alert dispatched to 14 registered users.',
      cameraId:'CAM-03', location:'Ambalavayal fringe',
      timestamp:DateTime.now().subtract(const Duration(minutes:30))),
    WildlifeAlert(id:3, level:AlertLevel.warning,
      message:'🐘 CAM-04 detects elephant herd (3 individuals) in Pulpalli corridor. 1.1 km to settlement.',
      cameraId:'CAM-04', location:'Pulpalli',
      timestamp:DateTime.now().subtract(const Duration(minutes:45))),
    WildlifeAlert(id:4, level:AlertLevel.warning,
      message:'🌡️ Arduino Node-3 reports 34.2°C — heat stress movement toward water sources likely.',
      cameraId:'NODE-3', location:'Sulthan Bathery East',
      timestamp:DateTime.now().subtract(const Duration(hours:1))),
    WildlifeAlert(id:5, level:AlertLevel.info,
      message:'📡 CAM-02 object detection: Elephant (conf 88%) — foraging behaviour in fringe zone.',
      cameraId:'CAM-02', location:'Ambalavayal fringe',
      timestamp:DateTime.now().subtract(const Duration(hours:2))),
    WildlifeAlert(id:6, level:AlertLevel.info,
      message:'🌿 Seasonal context: Dry season — reduced water availability increases fringe movement.',
      cameraId:'SYSTEM', location:'Wayanad',
      timestamp:DateTime.now().subtract(const Duration(hours:3))),
  ];

  // ── Sensor Readings ──────────────────────────────────────────────────────
  static List<SensorReading> sensorReadings = [
    SensorReading(nodeId:'NODE-1', timestamp:DateTime.now(),
      tempC:31.4, humidityPct:68, soilMoisture:42, pirTriggered:false, ndvi:0.58, batteryPct:87),
    SensorReading(nodeId:'NODE-2', timestamp:DateTime.now(),
      tempC:32.1, humidityPct:65, soilMoisture:38, pirTriggered:true,  ndvi:0.51, batteryPct:92),
    SensorReading(nodeId:'NODE-3', timestamp:DateTime.now(),
      tempC:34.2, humidityPct:61, soilMoisture:31, pirTriggered:true,  ndvi:0.44, batteryPct:74),
    SensorReading(nodeId:'NODE-4', timestamp:DateTime.now(),
      tempC:30.8, humidityPct:70, soilMoisture:45, pirTriggered:false, ndvi:0.62, batteryPct:95),
  ];

  // ── Monthly risk data for charts ─────────────────────────────────────────
  static const List<double> monthlyRisk = [
    0.12, 0.15, 0.42, 0.56, 0.48, 0.18,
    0.14, 0.11, 0.22, 0.38, 0.19, 0.14,
  ];
  static const List<int> monthlyIncidents = [
    4, 3, 12, 18, 15, 6, 5, 4, 8, 11, 6, 4
  ];
  static const List<String> months = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ];
}
