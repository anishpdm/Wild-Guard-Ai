// lib/theme/app_theme.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  // Forest palette
  static const forest     = Color(0xFF0A1A0F);
  static const forest2    = Color(0xFF0F2318);
  static const forest3    = Color(0xFF142D1E);

  // Leaf greens
  static const leaf       = Color(0xFF16A34A);
  static const leaf2      = Color(0xFF22C55E);
  static const leaf3      = Color(0xFF4ADE80);

  // Amber / warning
  static const amber      = Color(0xFFD97706);
  static const amber2     = Color(0xFFF59E0B);
  static const amber3     = Color(0xFFFBBF24);

  // Red / critical
  static const red        = Color(0xFFDC2626);
  static const red2       = Color(0xFFEF4444);

  // Text
  static const textPrimary   = Color(0xFFE8F5E0);
  static const textSecondary = Color(0xFFA3C4A8);
  static const textMuted     = Color(0xFF6B9E72);

  // Card / border
  static const cardBg    = Color(0xFF0F2318);
  static const border    = Color(0x2D16A34A);
  static const border2   = Color(0x5216A34A);
}

class AppTheme {
  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.forest,
    colorScheme: const ColorScheme.dark(
      primary:   AppColors.leaf2,
      secondary: AppColors.amber2,
      error:     AppColors.red2,
      surface:   AppColors.forest2,
    ),
    textTheme: GoogleFonts.dmSansTextTheme(ThemeData.dark().textTheme).copyWith(
      displayLarge:  GoogleFonts.syne(fontWeight: FontWeight.w800, color: AppColors.textPrimary),
      displayMedium: GoogleFonts.syne(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
      titleLarge:    GoogleFonts.syne(fontWeight: FontWeight.w700, color: AppColors.textPrimary, fontSize: 18),
      titleMedium:   GoogleFonts.syne(fontWeight: FontWeight.w600, color: AppColors.textPrimary, fontSize: 15),
      titleSmall:    GoogleFonts.syne(fontWeight: FontWeight.w600, color: AppColors.textPrimary, fontSize: 13),
      bodyLarge:     GoogleFonts.dmSans(color: AppColors.textPrimary, fontSize: 14),
      bodyMedium:    GoogleFonts.dmSans(color: AppColors.textSecondary, fontSize: 13),
      bodySmall:     GoogleFonts.dmMono(color: AppColors.textMuted, fontSize: 11),
      labelSmall:    GoogleFonts.dmMono(color: AppColors.textMuted, fontSize: 10, letterSpacing: 1.2),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.forest2,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
    ),
    cardTheme: CardTheme(
      color: AppColors.cardBg,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border, width: 1),
      ),
    ),
    dividerColor: AppColors.border,
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.forest2,
      selectedItemColor: AppColors.leaf3,
      unselectedItemColor: AppColors.textMuted,
    ),
  );
}
