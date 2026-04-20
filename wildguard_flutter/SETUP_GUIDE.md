# WildGuard AI — Flutter App Setup Guide
## Wayanad Wildlife Sanctuary · M.Tech Thesis Demo App

---

## 1. RECORDED VIDEOS — Download These (Free, CC0)

Place all downloaded MP4 files in: `assets/videos/`
Rename each file EXACTLY as shown below.

| File name | Download from | Description |
|-----------|---------------|-------------|
| `cam02_elephant_forest.mp4` | https://pixabay.com/videos/elephant-wild-forest-kerala-india-112696/ | **Kerala elephant in forest — day** ⭐ Best match |
| `cam03_boundary_night.mp4` | https://pixabay.com/videos/elephant-nature-forest-jungle-172005/ | Elephant at forest edge |
| `cam04_herd_corridor.mp4` | https://pixabay.com/videos/elephants-animal-wildlife-115697/ | Elephant herd walking |
| `cam05_elephant_walking.mp4` | https://pixabay.com/videos/elephant-wildlife-animal-62333/ | Single elephant walking |
| `cam06_waterhole_clear.mp4` | https://pixabay.com/videos/forest-jungle-nature-trees-green-9765/ | Forest scene, no animals |

### Alternative sources (if Pixabay requires login):
- **Pexels**: https://www.pexels.com/search/videos/elephant/  (no login needed)
  - Search "elephant forest" → download any free MP4
- **Videezy**: https://www.videezy.com/free-video/elephant
- **Coverr**: https://coverr.co/search?q=elephant

### Tip for your thesis presentation:
The Kerala-specific video (cam02) is from Pixabay user "Ravi_roshan" and is tagged
"elephant wild forest kerala india" — it is royalty-free and free to use in academic work.

---

## 2. CAM-01 — Live Phone Camera

CAM-01 uses your Android phone's rear camera directly via the `camera` Flutter package.
No video file needed — it streams in real time.

**For thesis demo**: Point the phone at the Wayanad forest boundary map printout,
or at any outdoor greenery — the detection overlay will appear on top.

---

## 3. Flutter Setup

### Prerequisites
```bash
flutter --version   # needs Flutter 3.10+
java --version      # needs Java 17+
```

### Install dependencies
```bash
cd wildguard_flutter
flutter pub get
```

### Android permissions (already in AndroidManifest — verify):
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-feature android:name="android.hardware.camera" android:required="false"/>
```

### Run on Android device
```bash
flutter run --release
```

### Build APK for demo
```bash
flutter build apk --release
# APK at: build/app/outputs/flutter-apk/app-release.apk
```

---

## 4. App Architecture

```
WildGuard AI Flutter App
├── Login Screen          admin / wayanad2024
├── Dashboard             GPS track map + risk gauge + stat cards
├── Camera Surveillance   CAM-01 live + CAM-02..06 recorded videos
│   ├── Detection overlay (bounding box, confidence, HUD)
│   ├── Grid view (all 6 cameras)
│   └── Single view (fullscreen with Chewie controls)
├── Alerts                Real-time alert feed with acknowledge
├── Analytics             Bar charts + pie charts (fl_chart)
├── Sensors               Live Arduino sensor readings
└── Settings              Toggles + logout
```

---

## 5. Login Credentials

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `wayanad2024` |

---

## 6. Thesis Citation for Videos

If you use Pixabay videos in your thesis demo, cite as:
> "Wildlife footage from Pixabay.com, licensed under the Pixabay Content License (free for commercial and non-commercial use). No attribution required."

---

## 7. Adding Real Detection (Optional, Advanced)

To add real YOLOv8 elephant detection on the live camera feed:

1. Export YOLOv8-nano to TensorFlow Lite:
   ```python
   from ultralytics import YOLO
   model = YOLO('yolov8n.pt')
   model.export(format='tflite')
   ```

2. Add to Flutter:
   ```yaml
   # pubspec.yaml
   tflite_flutter: ^0.10.4
   ```

3. Run inference on each camera frame using the `camera` package's `ImageStream`.

4. Draw bounding boxes using `CustomPaint` on top of `CameraPreview`.

This makes the live camera detection real instead of simulated.

---

Generated for M.Tech Thesis — Wayanad Human-Wildlife Conflict Prevention System
