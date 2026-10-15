package com.unlocklingo.alarmclock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fired by AlarmManager. Starts ringing and schedules the next occurrence natively. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != AlarmScheduler.ACTION_FIRE) return
    val alarmId = intent.getStringExtra(AlarmScheduler.EXTRA_ALARM_ID) ?: return
    val store = AlarmStore(context)
    val spec = store.spec(alarmId) ?: return // deleted since it was scheduled
    val now = System.currentTimeMillis()

    if (intent.getBooleanExtra(AlarmScheduler.EXTRA_SNOOZE, false)) {
      store.setSnoozeUntil(alarmId, null)
    } else if (spec.repeats) {
      AlarmScheduler.scheduleNext(context, spec, now)
    } else {
      store.disable(alarmId)
      store.appendEvent("disabled", alarmId, now)
    }

    if (store.ringing() != null) return // another alarm is already ringing; don't stack them
    AlarmRingingService.start(context, alarmId)
  }
}
