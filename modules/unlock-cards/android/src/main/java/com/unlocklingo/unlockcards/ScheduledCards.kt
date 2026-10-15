package com.unlocklingo.unlockcards

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fallback delivery without a persistent service: cards at spread-out times.
 * Uses inexact, Doze-friendly alarms (no exact-alarm permission needed; a few
 * minutes' drift is fine for a learning card).
 */
object ScheduledCards {
  private const val WINDOW_MS = 15 * 60_000L

  fun scheduleNext(context: Context) {
    val store = CardStore(context)
    val config = store.config()
    cancel(context)
    if (config == null || config.mode != "scheduled") return
    val at = CardPolicy.nextScheduledSlot(config.policy, store.state(), System.currentTimeMillis()) ?: return
    context.getSystemService(AlarmManager::class.java).setWindow(AlarmManager.RTC_WAKEUP, at, WINDOW_MS, operation(context))
  }

  fun cancel(context: Context) {
    context.getSystemService(AlarmManager::class.java).cancel(operation(context))
  }

  private fun operation(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, ScheduledCardReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}

class ScheduledCardReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) = CardPresenter.onScheduledSlot(context)
}

/** Restores whichever delivery mode is on after reboot, update or clock change. */
class CardBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    CardDelivery.apply(context)
  }
}

object CardDelivery {
  /** Starts or stops the listener / schedule to match the stored configuration. */
  fun apply(context: Context) {
    val config = CardStore(context).config()
    val on = config?.policy?.enabled == true
    if (on && config?.mode == "unlock") UnlockListenerService.start(context) else UnlockListenerService.stop(context)
    if (on && config?.mode == "scheduled") ScheduledCards.scheduleNext(context) else ScheduledCards.cancel(context)
  }
}
