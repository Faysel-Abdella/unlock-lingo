package com.unlocklingo.alarmclock

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/** Talks to AlarmManager. Every alarm uses setAlarmClock when exact alarms are allowed. */
object AlarmScheduler {
  const val ACTION_FIRE = "com.unlocklingo.alarmclock.FIRE"
  const val EXTRA_ALARM_ID = "alarmId"
  const val EXTRA_SNOOZE = "snooze"
  const val ALARMS_URL = "unlocklingo://alarms"

  fun canScheduleExact(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
  }

  /** Replaces the native schedule with [specs]. Returns each alarm's next trigger time. */
  fun syncAll(context: Context, specs: List<AlarmSpec>): Map<String, Long?> {
    val store = AlarmStore(context)
    val keep = specs.map { it.id }.toSet()
    store.specs().filter { it.id !in keep }.forEach {
      cancel(context, it.id)
      store.setSnoozeUntil(it.id, null)
    }
    store.saveSpecs(specs)
    return specs.associate { it.id to scheduleNext(context, it, System.currentTimeMillis()) }
  }

  fun scheduleNext(context: Context, spec: AlarmSpec, after: Long): Long? {
    val at = AlarmSchedule.nextOccurrence(spec, after)
    if (at == null) {
      cancelRegular(context, spec.id)
      return null
    }
    set(context, spec.id, at, snooze = false)
    return at
  }

  fun scheduleSnooze(context: Context, alarmId: String, at: Long) {
    AlarmStore(context).setSnoozeUntil(alarmId, at)
    set(context, alarmId, at, snooze = true)
  }

  /** After reboot or a clock change: rebuild everything from the stored copy. */
  fun rescheduleAll(context: Context) {
    val store = AlarmStore(context)
    val now = System.currentTimeMillis()
    store.specs().forEach { spec ->
      scheduleNext(context, spec, now)
      store.snoozeUntil(spec.id)?.let { until ->
        if (until > now) set(context, spec.id, until, snooze = true) else store.setSnoozeUntil(spec.id, null)
      }
    }
  }

  fun cancel(context: Context, alarmId: String) {
    cancelRegular(context, alarmId)
    cancelSnooze(context, alarmId)
  }

  fun cancelSnooze(context: Context, alarmId: String) {
    alarmManager(context).cancel(operation(context, alarmId, snooze = true))
  }

  private fun cancelRegular(context: Context, alarmId: String) {
    alarmManager(context).cancel(operation(context, alarmId, snooze = false))
  }

  private fun set(context: Context, alarmId: String, at: Long, snooze: Boolean) {
    val manager = alarmManager(context)
    val operation = operation(context, alarmId, snooze)
    if (canScheduleExact(context)) {
      val show = PendingIntent.getActivity(
        context,
        requestCode(alarmId, snooze),
        Intent(Intent.ACTION_VIEW, Uri.parse(ALARMS_URL)).setPackage(context.packageName)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      manager.setAlarmClock(AlarmManager.AlarmClockInfo(at, show), operation)
    } else {
      // Without exact-alarm access the closest Android allows is a Doze-aware inexact alarm.
      // The app warns the user and offers the settings screen to grant access.
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation)
    }
  }

  private fun operation(context: Context, alarmId: String, snooze: Boolean): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      requestCode(alarmId, snooze),
      Intent(context, AlarmReceiver::class.java)
        .setAction(ACTION_FIRE)
        .putExtra(EXTRA_ALARM_ID, alarmId)
        .putExtra(EXTRA_SNOOZE, snooze),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  /** Regular and snooze triggers of the same alarm use different request codes, so neither replaces the other. */
  private fun requestCode(alarmId: String, snooze: Boolean): Int = alarmId.hashCode() * 2 + if (snooze) 1 else 0

  private fun alarmManager(context: Context): AlarmManager = context.getSystemService(AlarmManager::class.java)
}
