// lib/screens/camera_screen.dart
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import 'package:camera/camera.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import '../models/models.dart';
import '../services/mock_data.dart';
import '../theme/app_theme.dart';

class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key});
  @override State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> with TickerProviderStateMixin {
  int _selectedIdx = 0;
  bool _gridMode = false;
  CameraController? _liveCamCtrl;
  bool _liveCamReady = false;

  final Map<String, _VideoEntry> _players = {};

  @override
  void initState() {
    super.initState();
    _initLiveCamera();
    _preloadVideos();
  }

  Future<void> _initLiveCamera() async {
    try {
      final cams = await availableCameras();
      if (cams.isEmpty) return;
      _liveCamCtrl = CameraController(cams[0], ResolutionPreset.high,
        enableAudio: false);
      await _liveCamCtrl!.initialize();
      if (mounted) setState(() => _liveCamReady = true);
    } catch (_) {}
  }

  void _preloadVideos() {
    for (final cam in MockData.cameras) {
      if (!cam.isLive && cam.videoAsset != null) {
        final ctrl = VideoPlayerController.asset(cam.videoAsset!);
        final entry = _VideoEntry(ctrl);
        _players[cam.id] = entry;
        ctrl.initialize().then((_) {
          ctrl.setLooping(true);
          if (cam.id == MockData.cameras[_selectedIdx].id) ctrl.play();
          if (mounted) setState(() => entry.ready = true);
        });
      }
    }
  }

  @override
  void dispose() {
    _liveCamCtrl?.dispose();
    for (final e in _players.values) { e.chewie?.dispose(); e.ctrl.dispose(); }
    super.dispose();
  }

  void _selectCamera(int idx) {
    // Pause previous
    final prev = MockData.cameras[_selectedIdx];
    _players[prev.id]?.ctrl.pause();

    setState(() { _selectedIdx = idx; _gridMode = false; });

    // Play selected
    final next = MockData.cameras[idx];
    _players[next.id]?.ctrl.play();
  }

  @override
  Widget build(BuildContext context) {
    final cams = MockData.cameras;
    final selected = cams[_selectedIdx];
    final alertCount = cams.where((c) => c.boundaryAlert).length;

    return Scaffold(
      backgroundColor: AppColors.forest,
      body: Column(
        children: [
          // ── Top bar ────────────────────────────────────────────────────
          _TopBar(alertCount: alertCount, gridMode: _gridMode,
            onGridToggle: () => setState(() => _gridMode = !_gridMode)),

          // ── Body ───────────────────────────────────────────────────────
          Expanded(
            child: Row(
              children: [
                // Camera list sidebar
                _CameraList(
                  cameras: cams, selectedIdx: _selectedIdx,
                  players: _players, onSelect: _selectCamera,
                ),

                // Main feed area
                Expanded(
                  child: Column(
                    children: [
                      // Feed label bar
                      _FeedBar(camera: selected),

                      // Main view
                      Expanded(
                        child: _gridMode
                          ? _GridView(cameras: cams, players: _players,
                              liveCamCtrl: _liveCamReady ? _liveCamCtrl : null,
                              onSelect: _selectCamera)
                          : _SingleView(camera: selected,
                              player: _players[selected.id],
                              liveCamCtrl: selected.isLive && _liveCamReady ? _liveCamCtrl : null),
                      ),

                      // Stats bar
                      _StatsBar(cameras: cams),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Video entry wrapper ───────────────────────────────────────────────────────
class _VideoEntry {
  final VideoPlayerController ctrl;
  ChewieController? chewie;
  bool ready = false;
  _VideoEntry(this.ctrl);
}

// ── Top bar ───────────────────────────────────────────────────────────────────
class _TopBar extends StatelessWidget {
  final int alertCount;
  final bool gridMode;
  final VoidCallback onGridToggle;
  const _TopBar({required this.alertCount, required this.gridMode, required this.onGridToggle});

  @override
  Widget build(BuildContext ctx) => Container(
    height: 52, color: AppColors.forest2,
    padding: const EdgeInsets.symmetric(horizontal: 16),
    child: Row(children: [
      const Text('🎥', style: TextStyle(fontSize: 20)),
      const Gap(10),
      Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
        const Text('Camera Surveillance & Object Detection',
          style: TextStyle(fontFamily: 'Syne', fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
        const Text('Wayanad Wildlife Sanctuary · 6 nodes · AI-powered detection',
          style: TextStyle(fontFamily: 'DMMono', fontSize: 10, color: AppColors.textMuted)),
      ]),
      const Spacer(),
      _Pill(label: '6/6 ONLINE', color: AppColors.leaf3, icon: Icons.circle, blink: false),
      const Gap(8),
      _Pill(label: '5 DETECTED', color: AppColors.amber3, icon: Icons.search, blink: false),
      const Gap(8),
      if (alertCount > 0)
        _Pill(label: '$alertCount BREACH', color: AppColors.red2, icon: Icons.warning_amber_rounded, blink: true),
      const Gap(8),
      _TbBtn(label: gridMode ? '⬛ Single' : '⊞ Grid', active: gridMode, onTap: onGridToggle),
    ]),
  );
}

class _Pill extends StatefulWidget {
  final String label; final Color color; final IconData icon; final bool blink;
  const _Pill({required this.label, required this.color, required this.icon, required this.blink});
  @override State<_Pill> createState() => _PillState();
}
class _PillState extends State<_Pill> with SingleTickerProviderStateMixin {
  late AnimationController _c;
  @override void initState() { super.initState(); _c = AnimationController(vsync:this,duration:const Duration(milliseconds:900))..repeat(reverse:true); }
  @override void dispose() { _c.dispose(); super.dispose(); }
  @override Widget build(BuildContext ctx) {
    final base = Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: widget.color.withOpacity(0.12),
        border: Border.all(color: widget.color.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(widget.icon, color: widget.color, size: 8),
        const Gap(5),
        Text(widget.label, style: TextStyle(fontFamily:'DMMono', fontSize:10, color: widget.color)),
      ]),
    );
    return widget.blink ? FadeTransition(opacity: Tween(begin:0.4,end:1.0).animate(_c), child: base) : base;
  }
}

class _TbBtn extends StatelessWidget {
  final String label; final bool active; final VoidCallback onTap;
  const _TbBtn({required this.label, required this.active, required this.onTap});
  @override Widget build(BuildContext ctx) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: active ? AppColors.leaf.withOpacity(0.15) : Colors.transparent,
        border: Border.all(color: active ? AppColors.border2 : AppColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label, style: const TextStyle(fontFamily:'DMMono', fontSize: 10, color: AppColors.textSecondary)),
    ),
  );
}

// ── Camera list sidebar ───────────────────────────────────────────────────────
class _CameraList extends StatelessWidget {
  final List<CameraNode> cameras;
  final int selectedIdx;
  final Map<String, _VideoEntry> players;
  final void Function(int) onSelect;
  const _CameraList({required this.cameras, required this.selectedIdx, required this.players, required this.onSelect});

  @override
  Widget build(BuildContext ctx) => Container(
    width: 200,
    color: AppColors.forest2,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Cameras', style: TextStyle(fontFamily:'Syne', fontWeight:FontWeight.w700, fontSize:13, color:AppColors.textPrimary)),
            Text('${cameras.where((c)=>c.elephantDetected).length} active',
              style: const TextStyle(fontFamily:'DMMono', fontSize:10, color:AppColors.textMuted)),
          ]),
        ),
        const Divider(height: 1, color: AppColors.border),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: cameras.length,
            itemBuilder: (_, i) => _CamListItem(
              cam: cameras[i], selected: selectedIdx == i,
              onTap: () => onSelect(i),
            ),
          ),
        ),
      ],
    ),
  );
}

class _CamListItem extends StatelessWidget {
  final CameraNode cam; final bool selected; final VoidCallback onTap;
  const _CamListItem({required this.cam, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext ctx) {
    final dotColor = cam.boundaryAlert ? AppColors.red2
        : cam.elephantDetected ? AppColors.amber3
        : AppColors.leaf3;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: 150.ms,
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: selected ? AppColors.leaf.withOpacity(0.12)
              : cam.boundaryAlert ? AppColors.red.withOpacity(0.06) : Colors.transparent,
          border: Border.all(
            color: selected ? AppColors.border2
                : cam.boundaryAlert ? AppColors.red2.withOpacity(0.35) : AppColors.border,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 7, height: 7, decoration: BoxDecoration(
              color: dotColor, shape: BoxShape.circle,
              boxShadow: [if (cam.boundaryAlert || cam.elephantDetected)
                BoxShadow(color: dotColor.withOpacity(0.6), blurRadius: 5)],
            )),
            const Gap(7),
            Expanded(child: Text(cam.id,
              style: const TextStyle(fontFamily:'DMMono', fontSize:11, fontWeight:FontWeight.w500, color:AppColors.textPrimary))),
            if (cam.isLive)
              Container(padding: const EdgeInsets.symmetric(horizontal:5, vertical:1),
                decoration: BoxDecoration(color: AppColors.red.withOpacity(0.2),
                  border: Border.all(color: AppColors.red2.withOpacity(0.4)), borderRadius: BorderRadius.circular(4)),
                child: const Text('LIVE', style: TextStyle(fontFamily:'DMMono', fontSize:8, color:AppColors.red2))),
          ]),
          const Gap(3),
          Text(cam.name, style: const TextStyle(fontSize:11, fontWeight:FontWeight.w600, color:AppColors.textPrimary)),
          const Gap(2),
          Text(cam.videoLabel, style: const TextStyle(fontFamily:'DMMono', fontSize:9, color:AppColors.textMuted)),
          const Gap(5),
          Row(children: [
            _CamBadge(label: cam.boundaryAlert ? 'BREACH' : cam.elephantDetected ? 'DETECTED' : 'CLEAR',
              color: dotColor),
            const Gap(5),
            Text('${cam.boundaryKm}km', style: const TextStyle(fontFamily:'DMMono', fontSize:9, color:AppColors.textMuted)),
          ]),
          if (cam.elephantDetected) ...[
            const Gap(5),
            ClipRRect(borderRadius: BorderRadius.circular(2),
              child: LinearProgressIndicator(
                value: cam.confidence, minHeight: 2,
                backgroundColor: AppColors.border,
                color: cam.boundaryAlert ? AppColors.red2 : AppColors.amber3,
              )),
          ],
        ]),
      ),
    );
  }
}

class _CamBadge extends StatelessWidget {
  final String label; final Color color;
  const _CamBadge({required this.label, required this.color});
  @override Widget build(BuildContext ctx) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      color: color.withOpacity(0.15),
      border: Border.all(color: color.withOpacity(0.3)),
      borderRadius: BorderRadius.circular(4),
    ),
    child: Text(label, style: TextStyle(fontFamily:'DMMono', fontSize:8, color: color, fontWeight: FontWeight.w700)),
  );
}

// ── Feed label bar ────────────────────────────────────────────────────────────
class _FeedBar extends StatelessWidget {
  final CameraNode camera;
  const _FeedBar({required this.camera});
  @override Widget build(BuildContext ctx) => Container(
    height: 38, color: AppColors.glass,
    padding: const EdgeInsets.symmetric(horizontal: 14),
    child: Row(children: [
      Text('${camera.id} — ${camera.name}',
        style: const TextStyle(fontFamily:'Syne', fontWeight:FontWeight.w700, fontSize:13, color:AppColors.textPrimary)),
      const Gap(10),
      if (camera.isLive) _Pill(label:'🔴 LIVE', color:AppColors.red2, icon:Icons.circle, blink:true),
      if (!camera.isLive) _Pill(label:'▶ RECORDED', color:AppColors.leaf3, icon:Icons.play_circle_outline, blink:false),
      const Spacer(),
      if (camera.boundaryAlert)
        _Pill(label:'⚠ BOUNDARY BREACH', color:AppColors.red2, icon:Icons.warning_amber_rounded, blink:true),
      const Gap(8),
      Text('📍 ${camera.boundaryKm} km to settlement',
        style: const TextStyle(fontFamily:'DMMono', fontSize:10, color:AppColors.textMuted)),
    ]),
  );
}

// ── Single view ───────────────────────────────────────────────────────────────
class _SingleView extends StatelessWidget {
  final CameraNode camera;
  final _VideoEntry? player;
  final CameraController? liveCamCtrl;
  const _SingleView({required this.camera, this.player, this.liveCamCtrl});

  @override
  Widget build(BuildContext ctx) => Stack(
    fit: StackFit.expand,
    children: [
      // Video/camera feed
      _buildFeed(),
      // HUD overlay
      _CameraHUD(camera: camera),
      // Detection box overlay
      if (camera.elephantDetected)
        _DetectionOverlay(camera: camera),
    ],
  );

  Widget _buildFeed() {
    if (camera.isLive && liveCamCtrl != null && liveCamCtrl!.value.isInitialized) {
      return CameraPreview(liveCamCtrl!);
    }
    if (!camera.isLive && player != null && player!.ready) {
      player!.chewie ??= ChewieController(
        videoPlayerController: player!.ctrl,
        autoPlay: true, looping: true, showControls: true,
        aspectRatio: 16/9,
        customControls: const MaterialControls(),
        materialProgressColors: ChewieProgressColors(
          playedColor: AppColors.leaf2,
          handleColor: AppColors.leaf3,
          backgroundColor: AppColors.border,
          bufferedColor: AppColors.border2,
        ),
      );
      return Chewie(controller: player!.chewie!);
    }
    // Fallback — simulated scene
    return _SimulatedScene(camera: camera);
  }
}

// ── Simulated scene (fallback when no video file) ─────────────────────────────
class _SimulatedScene extends StatefulWidget {
  final CameraNode camera;
  const _SimulatedScene({required this.camera});
  @override State<_SimulatedScene> createState() => _SimulatedSceneState();
}
class _SimulatedSceneState extends State<_SimulatedScene> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  @override void initState() { super.initState(); _ctrl = AnimationController(vsync:this, duration:4.s)..repeat(); }
  @override void dispose() { _ctrl.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext ctx) => AnimatedBuilder(
    animation: _ctrl,
    builder: (_,__) => CustomPaint(
      painter: _ForestScenePainter(
        camera: widget.camera,
        t: _ctrl.value,
        isNight: widget.camera.id == 'CAM-03' || widget.camera.id == 'CAM-04',
      ),
    ),
  );
}

class _ForestScenePainter extends CustomPainter {
  final CameraNode camera;
  final double t;
  final bool isNight;
  _ForestScenePainter({required this.camera, required this.t, required this.isNight});

  @override
  void paint(Canvas canvas, Size size) {
    final W = size.width, H = size.height;

    // Sky
    final sky = Paint()..shader = LinearGradient(
      begin: Alignment.topCenter, end: Alignment.bottomCenter,
      colors: isNight
        ? const [Color(0xFF030508), Color(0xFF0A1A0F)]
        : const [Color(0xFF0A2A14), Color(0xFF1A4D28)],
    ).createShader(Rect.fromLTWH(0, 0, W, H * 0.5));
    canvas.drawRect(Rect.fromLTWH(0, 0, W, H * 0.5), sky);

    // Ground
    final ground = Paint()..shader = LinearGradient(
      begin: Alignment.topCenter, end: Alignment.bottomCenter,
      colors: isNight
        ? const [Color(0xFF091409), Color(0xFF040804)]
        : const [Color(0xFF112B18), Color(0xFF0A1A0F)],
    ).createShader(Rect.fromLTWH(0, H * 0.5, W, H * 0.5));
    canvas.drawRect(Rect.fromLTWH(0, H * 0.5, W, H * 0.5), ground);

    // Trees
    final treePaint = Paint()..color = isNight ? const Color(0xFF060F08) : const Color(0xFF0A2A14);
    for (int i = 0; i < 12; i++) {
      final tx = (i / 12) * W + 20;
      final th = H * (0.2 + (i % 3) * 0.05);
      final tw = th * 0.2;
      final path = Path()
        ..moveTo(tx, H * 0.5 - th)
        ..lineTo(tx - tw, H * 0.5)
        ..lineTo(tx + tw, H * 0.5)
        ..close();
      canvas.drawPath(path, treePaint);
    }

    // Elephant if detected
    if (camera.elephantDetected) {
      final ex = W * (0.35 + t * 0.03);
      final ey = H * 0.58;
      final es = W * 0.12;
      final bodyPaint = Paint()..color = isNight ? const Color(0xFF1A1A1A) : const Color(0xFF3A3530);

      // Body
      canvas.drawOval(Rect.fromCenter(center: Offset(ex, ey), width: es * 1.1, height: es * 0.7), bodyPaint);
      // Head
      canvas.drawOval(Rect.fromCenter(center: Offset(ex + es * 0.45, ey - es * 0.1), width: es * 0.5, height: es * 0.45), bodyPaint);
      // Trunk
      final trunkPath = Path()
        ..moveTo(ex + es * 0.65, ey)
        ..quadraticBezierTo(ex + es * 0.85, ey + es * 0.3, ex + es * 0.65, ey + es * 0.45);
      canvas.drawPath(trunkPath, Paint()..color = bodyPaint.color..strokeWidth = es * 0.09..style = PaintingStyle.stroke..strokeCap = StrokeCap.round);
    }

    // Scan line (night)
    if (isNight) {
      final scanY = (t * H * 1.2) % H;
      canvas.drawRect(Rect.fromLTWH(0, scanY, W, 1.5),
        Paint()..color = const Color(0x1400FF50));
    }

    // Timestamp
    final tp = TextPainter(
      text: TextSpan(text: '${DateTime.now().hour.toString().padLeft(2,'0')}:${DateTime.now().minute.toString().padLeft(2,'0')}:${DateTime.now().second.toString().padLeft(2,'0')}',
        style: TextStyle(fontFamily:'monospace', fontSize: W * 0.018, color: Colors.white54)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(8, H - 20));
  }

  @override bool shouldRepaint(_ForestScenePainter old) => old.t != t;
}

// ── Camera HUD overlay ────────────────────────────────────────────────────────
class _CameraHUD extends StatelessWidget {
  final CameraNode camera;
  const _CameraHUD({required this.camera});
  @override
  Widget build(BuildContext ctx) => Positioned.fill(
    child: Padding(
      padding: const EdgeInsets.all(10),
      child: Stack(children: [
        // Top-left
        Positioned(top:0, left:0, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _HudChip(camera.id, color: Colors.white54),
          const Gap(4),
          if (camera.elephantDetected && !camera.boundaryAlert)
            _HudChip('🐘 ELEPHANT DETECTED', color: AppColors.amber3, bold: true),
          if (camera.boundaryAlert)
            _HudChip('⚠ BOUNDARY BREACH', color: AppColors.red2, bold: true, blink: true),
          if (!camera.elephantDetected)
            _HudChip('✓ CLEAR', color: AppColors.leaf3),
        ])),
        // Top-right
        Positioned(top:0, right:0, child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          _HudChip('● REC', color: AppColors.red2, blink: true),
          if (camera.elephantDetected) ...[
            const Gap(4),
            _HudChip('CONF: ${(camera.confidence * 100).toStringAsFixed(1)}%', color: Colors.white60),
          ],
          const Gap(4),
          _HudChip(camera.zone.toUpperCase(), color: AppColors.textMuted),
        ])),
        // Bottom-left
        Positioned(bottom:0, left:0, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _HudChip('📍 ${camera.location}', color: Colors.white54),
          const Gap(3),
          _HudChip('🏘 ${camera.boundaryKm} km to settlement', color: Colors.white54),
        ])),
      ]),
    ),
  );
}

class _HudChip extends StatefulWidget {
  final String text; final Color color; final bool bold; final bool blink;
  const _HudChip(this.text, {required this.color, this.bold = false, this.blink = false});
  @override State<_HudChip> createState() => _HudChipState();
}
class _HudChipState extends State<_HudChip> with SingleTickerProviderStateMixin {
  late AnimationController _c;
  @override void initState() { super.initState(); _c = AnimationController(vsync:this, duration:800.ms)..repeat(reverse:true); }
  @override void dispose() { _c.dispose(); super.dispose(); }
  @override Widget build(BuildContext ctx) {
    final chip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.65),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: widget.color.withOpacity(0.3), width: 0.5),
      ),
      child: Text(widget.text, style: TextStyle(
        fontFamily: 'DMMono', fontSize: 9,
        color: widget.color,
        fontWeight: widget.bold ? FontWeight.w700 : FontWeight.w400,
      )),
    );
    return widget.blink ? FadeTransition(opacity: Tween(begin:0.5,end:1.0).animate(_c), child: chip) : chip;
  }
}

// ── Detection bounding box overlay ───────────────────────────────────────────
class _DetectionOverlay extends StatelessWidget {
  final CameraNode camera;
  const _DetectionOverlay({required this.camera});
  @override
  Widget build(BuildContext ctx) => CustomPaint(
    painter: _BBoxPainter(camera: camera),
  );
}

class _BBoxPainter extends CustomPainter {
  final CameraNode camera;
  _BBoxPainter({required this.camera});
  @override
  void paint(Canvas canvas, Size size) {
    final col = camera.boundaryAlert ? AppColors.red2 : AppColors.amber3;
    final paint = Paint()..color = col..strokeWidth = 1.5..style = PaintingStyle.stroke;
    final dashPaint = Paint()..color = col.withOpacity(0.6)..strokeWidth = 0.8..style = PaintingStyle.stroke;

    // Bounding box (centred on elephant position)
    final bx = size.width * 0.22, by = size.height * 0.20;
    final bw = size.width * 0.38, bh = size.height * 0.55;
    final rect = Rect.fromLTWH(bx, by, bw, bh);

    // Dashed rect
    _drawDashedRect(canvas, rect, dashPaint);

    // Corner brackets
    const L = 14.0;
    for (final corner in [
      [rect.left, rect.top, 1.0, 1.0],
      [rect.right, rect.top, -1.0, 1.0],
      [rect.left, rect.bottom, 1.0, -1.0],
      [rect.right, rect.bottom, -1.0, -1.0],
    ]) {
      canvas.drawLine(Offset(corner[0], corner[1]), Offset(corner[0] + corner[2] * L, corner[1]), paint);
      canvas.drawLine(Offset(corner[0], corner[1]), Offset(corner[0], corner[1] + corner[3] * L), paint);
    }

    // Label background + text
    final labelRect = Rect.fromLTWH(bx, by - 22, bw, 20);
    canvas.drawRect(labelRect, Paint()..color = col.withOpacity(0.85));
    final tp = TextPainter(
      text: TextSpan(
        text: 'ELEPHANT  ${(camera.confidence * 100).toStringAsFixed(0)}%  |  ${camera.name.toUpperCase()}',
        style: const TextStyle(fontFamily: 'monospace', fontSize: 9, color: Colors.black, fontWeight: FontWeight.w700),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: bw);
    tp.paint(canvas, Offset(bx + 5, by - 17));
  }

  void _drawDashedRect(Canvas canvas, Rect rect, Paint paint) {
    const dashLen = 6.0, gapLen = 5.0;
    void drawDashed(Offset a, Offset b) {
      final dx = b.dx - a.dx, dy = b.dy - a.dy;
      final len = (b - a).distance;
      double d = 0;
      while (d < len) {
        final t1 = d / len, t2 = ((d + dashLen) / len).clamp(0, 1);
        canvas.drawLine(
          Offset(a.dx + dx * t1, a.dy + dy * t1),
          Offset(a.dx + dx * t2, a.dy + dy * t2), paint);
        d += dashLen + gapLen;
      }
    }
    drawDashed(rect.topLeft, rect.topRight);
    drawDashed(rect.topRight, rect.bottomRight);
    drawDashed(rect.bottomRight, rect.bottomLeft);
    drawDashed(rect.bottomLeft, rect.topLeft);
  }

  @override bool shouldRepaint(_) => false;
}

// ── Grid view ─────────────────────────────────────────────────────────────────
class _GridView extends StatelessWidget {
  final List<CameraNode> cameras;
  final Map<String, _VideoEntry> players;
  final CameraController? liveCamCtrl;
  final void Function(int) onSelect;
  const _GridView({required this.cameras, required this.players, this.liveCamCtrl, required this.onSelect});

  @override
  Widget build(BuildContext ctx) => GridView.builder(
    padding: const EdgeInsets.all(8),
    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 3, crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 16/9,
    ),
    itemCount: cameras.length,
    itemBuilder: (_, i) {
      final cam = cameras[i];
      return GestureDetector(
        onTap: () => onSelect(i),
        child: Stack(fit: StackFit.expand, children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: _buildThumb(cam, i),
          ),
          Positioned(
            top: 5, left: 5,
            child: _HudChip(cam.id, color: Colors.white54),
          ),
          if (cam.elephantDetected)
            Positioned(top: 5, right: 5,
              child: _HudChip(cam.boundaryAlert ? '⚠ BREACH' : '🐘 DET',
                color: cam.boundaryAlert ? AppColors.red2 : AppColors.amber3, bold: true, blink: cam.boundaryAlert)),
          Positioned(bottom: 5, left: 5,
            child: _HudChip(cam.name, color: Colors.white60)),
          // Border
          Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: cam.boundaryAlert ? AppColors.red2.withOpacity(0.7)
                  : cam.elephantDetected ? AppColors.amber3.withOpacity(0.4)
                  : AppColors.border,
              width: cam.boundaryAlert ? 1.5 : 1,
            ),
          ))),
        ]),
      );
    },
  );

  Widget _buildThumb(CameraNode cam, int i) {
    if (cam.isLive && liveCamCtrl != null && liveCamCtrl!.value.isInitialized) {
      return CameraPreview(liveCamCtrl!);
    }
    final player = players[cam.id];
    if (player != null && player.ready) {
      return AspectRatio(aspectRatio: 16/9, child: VideoPlayer(player.ctrl));
    }
    return _SimulatedScene(camera: cam);
  }
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
class _StatsBar extends StatelessWidget {
  final List<CameraNode> cameras;
  const _StatsBar({required this.cameras});
  @override Widget build(BuildContext ctx) => Container(
    height: 48, color: AppColors.glass,
    padding: const EdgeInsets.symmetric(horizontal: 16),
    child: Row(children: [
      _Stat(value: cameras.where((c)=>c.elephantDetected).length.toString(), label: 'DETECTIONS', color: AppColors.amber3),
      _div(),
      _Stat(value: cameras.where((c)=>c.boundaryAlert).length.toString(), label: 'BOUNDARY ALERTS', color: AppColors.red2),
      _div(),
      _Stat(value: '${(cameras.where((c)=>c.elephantDetected).map((c)=>c.confidence).fold(0.0,(a,b)=>a>b?a:b)*100).toStringAsFixed(0)}%', label: 'PEAK CONFIDENCE', color: AppColors.textPrimary),
      _div(),
      const _Stat(value: 'YOLOv8', label: 'MODEL', color: AppColors.leaf3),
      _div(),
      const _Stat(value: '~120ms', label: 'INFERENCE', color: AppColors.textPrimary),
      const Spacer(),
      _Pill(label: '5 elephants tracked · SMS alert dispatched', color: AppColors.amber3, icon: Icons.info_outline, blink: false),
    ]),
  );
  Widget _div() => Container(width:1, height:24, color:AppColors.border, margin: const EdgeInsets.symmetric(horizontal:12));
}

class _Stat extends StatelessWidget {
  final String value, label; final Color color;
  const _Stat({required this.value, required this.label, required this.color});
  @override Widget build(BuildContext ctx) => Column(mainAxisAlignment: MainAxisAlignment.center, children: [
    Text(value, style: TextStyle(fontFamily:'Syne', fontWeight:FontWeight.w800, fontSize:15, color:color)),
    Text(label, style: const TextStyle(fontFamily:'DMMono', fontSize:8, color:AppColors.textMuted, letterSpacing:1)),
  ]);
}
