package com.unlocklingo.alarmclock

import java.util.Calendar
import java.util.TimeZone

/**
 * Native copy of an alarm, kept so alarms can be rescheduled without JS
 * (after reboot, app update, time change, or an emergency stop from the notification).
 * Pure Kotlin: no Android dependencies, unit-tested on the JVM.
 */
data class AlarmSpec(
  val id: String,
  val label: String,
  val hour: Int,
  val minute: Int,
  /** Bit (isoWeekday - 1); bit 0 = Monday. 0 = rings once. */
  val daysMask: Int,
  val enabled: Boolean,
  val vibrate: Boolean,
  val snoozeEnabled: Boolean,
  val snoozeMinutes: Int,
  val maxSnoozes: Int,
  /** A content:// alarm sound chosen by the user; null = the system's default alarm sound. */
  val soundUri: String? = null,
  /** Start quietly and reach full volume over [AlarmVolume.RAMP_MS]. */
  val gradualVolume: Boolean = true,
) {
  val repeats: Boolean get() = daysMask != 0
}

object AlarmSchedule {
  const val MAX_RING_MINUTES = 10L

  /** Calendar.DAY_OF_WEEK (1 = Sunday) to ISO weekday (7 = Sunday). */
  fun isoWeekday(calendarDay: Int): Int = if (calendarDay == Calendar.SUNDAY) 7 else calendarDay - 1

  /**
   * Next ring time strictly after [afterMillis], in wall-clock time of [zone].
   * Mirrors `nextOccurrence` in src/features/alarms/domain/schedule.ts.
   */
  fun nextOccurrence(spec: AlarmSpec, afterMillis: Long, zone: TimeZone = TimeZone.getDefault()): Long? {
    if (!spec.enabled) return null
    for (offset in 0..7) {
      val candidate = Calendar.getInstance(zone).apply {
        timeInMillis = afterMillis
        add(Calendar.DAY_OF_MONTH, offset)
        set(Calendar.HOUR_OF_DAY, spec.hour)
        set(Calendar.MINUTE, spec.minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      if (candidate.timeInMillis <= afterMillis) continue
      val day = isoWeekday(candidate.get(Calendar.DAY_OF_WEEK))
      if (spec.daysMask == 0 || (spec.daysMask and (1 shl (day - 1))) != 0) return candidate.timeInMillis
    }
    return null
  }
}

/** Gradual alarm volume. Pure Kotlin, unit-tested on the JVM. */
object AlarmVolume {
  const val RAMP_MS = 60_000L
  const val START_VOLUME = 0.15f
  const val STEP_MS = 1_000L

  /**
   * Player volume (relative to the alarm stream volume) [elapsedMs] after ringing
   * started. Rises along a curve that is gentle at first, since loudness is perceived
   * logarithmically, and is always audible from the first second.
   */
  fun at(elapsedMs: Long, gradual: Boolean, rampMs: Long = RAMP_MS): Float {
    if (!gradual || rampMs <= 0) return 1f
    val progress = (elapsedMs.coerceAtLeast(0).toDouble() / rampMs).coerceAtMost(1.0)
    return (START_VOLUME + (1f - START_VOLUME) * (progress * progress).toFloat()).coerceIn(START_VOLUME, 1f)
  }
}
