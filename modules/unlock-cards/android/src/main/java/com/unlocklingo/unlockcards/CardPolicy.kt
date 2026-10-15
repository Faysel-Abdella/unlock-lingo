package com.unlocklingo.unlockcards

import java.util.Calendar
import java.util.TimeZone
import kotlin.math.ceil
import kotlin.math.max

/**
 * Kotlin mirror of src/features/unlock/domain/policy.ts so the decision can be
 * made on unlock without JS. Pure (no Android dependencies) and unit-tested with
 * the same cases as the TypeScript version. Keep the two in sync.
 */
data class TimeWindow(val enabled: Boolean, val start: Int, val end: Int)

data class PolicyConfig(
  val enabled: Boolean,
  val maxCardsPerDay: Int,
  val cooldownMinutes: Int,
  val quietHours: TimeWindow,
  val workHours: TimeWindow,
  /** ISO weekdays (1 = Monday … 7 = Sunday) on which work hours apply. */
  val workDays: Set<Int>,
  /** "low" | "normal" | "high" */
  val frequency: String,
  val everyUnlock: Boolean,
)

/** [day] is the local day as yyyy-mm-dd, matching the JS date key. */
data class PolicyState(val day: String?, val shownToday: Int, val lastShownAt: Long?)

data class Decision(val show: Boolean, val reason: String?)

object CardPolicy {
  val EMPTY = PolicyState(null, 0, null)
  private const val SLOT_STEP_MS = 5 * 60_000L
  private const val SEARCH_LIMIT_MS = 8 * 86_400_000L

  fun probability(frequency: String): Double = when (frequency) {
    "low" -> 0.34
    "high" -> 1.0
    else -> 0.67
  }

  private fun calendar(ms: Long, zone: TimeZone): Calendar = Calendar.getInstance(zone).apply { timeInMillis = ms }

  fun dayKey(ms: Long, zone: TimeZone): String {
    val c = calendar(ms, zone)
    return String.format("%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
  }

  fun minuteOfDay(ms: Long, zone: TimeZone): Int {
    val c = calendar(ms, zone)
    return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE)
  }

  fun inWindow(minute: Int, start: Int, end: Int): Boolean {
    if (start == end) return false
    return if (start < end) minute in start until end else minute >= start || minute < end
  }

  fun shownToday(state: PolicyState, now: Long, zone: TimeZone): Int =
    if (state.day == dayKey(now, zone)) state.shownToday else 0

  fun blockedByTime(config: PolicyConfig, now: Long, zone: TimeZone): String? {
    val minute = minuteOfDay(now, zone)
    if (config.quietHours.enabled && inWindow(minute, config.quietHours.start, config.quietHours.end)) return "quiet_hours"
    val day = calendar(now, zone).get(Calendar.DAY_OF_WEEK).let { if (it == Calendar.SUNDAY) 7 else it - 1 }
    val work = config.workHours
    if (work.enabled && day in config.workDays && inWindow(minute, work.start, work.end)) return "work_hours"
    return null
  }

  fun decide(config: PolicyConfig, state: PolicyState, now: Long, roll: Double, zone: TimeZone = TimeZone.getDefault()): Decision {
    if (!config.enabled) return Decision(false, "disabled")
    if (shownToday(state, now, zone) >= config.maxCardsPerDay) return Decision(false, "daily_limit")
    blockedByTime(config, now, zone)?.let { return Decision(false, it) }
    if (!config.everyUnlock) {
      val last = state.lastShownAt
      if (last != null && now - last < config.cooldownMinutes * 60_000L) return Decision(false, "cooldown")
      if (roll >= probability(config.frequency)) return Decision(false, "frequency")
    }
    return Decision(true, null)
  }

  fun recordShown(state: PolicyState, now: Long, zone: TimeZone = TimeZone.getDefault()): PolicyState =
    PolicyState(dayKey(now, zone), shownToday(state, now, zone) + 1, now)

  private fun activeMinutesPerDay(config: PolicyConfig): Int {
    val q = config.quietHours
    if (!q.enabled || q.start == q.end) return 1440
    val quiet = if (q.start < q.end) q.end - q.start else 1440 - q.start + q.end
    return max(60, 1440 - quiet)
  }

  fun nextScheduledSlot(config: PolicyConfig, state: PolicyState, now: Long, zone: TimeZone = TimeZone.getDefault()): Long? {
    if (!config.enabled || config.maxCardsPerDay <= 0) return null
    val spacingMinutes = max(config.cooldownMinutes.toDouble(), activeMinutesPerDay(config).toDouble() / config.maxCardsPerDay)
    var candidate = max(now + 60_000L, (state.lastShownAt ?: now) + (spacingMinutes * 60_000L).toLong())
    candidate = (ceil(candidate.toDouble() / SLOT_STEP_MS) * SLOT_STEP_MS).toLong()
    var t = candidate
    while (t - candidate <= SEARCH_LIMIT_MS) {
      if (blockedByTime(config, t, zone) == null && shownToday(state, t, zone) < config.maxCardsPerDay) return t
      t += SLOT_STEP_MS
    }
    return null
  }
}
