package com.unlocklingo.alarmclock

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AlarmSpecRecord : Record {
  @Field val id: String = ""
  @Field val label: String = ""
  @Field val hour: Int = 0
  @Field val minute: Int = 0
  @Field val daysMask: Int = 0
  @Field val enabled: Boolean = true
  @Field val vibrate: Boolean = true
  @Field val snoozeEnabled: Boolean = true
  @Field val snoozeMinutes: Int = 9
  @Field val maxSnoozes: Int = 3

  fun toSpec() = AlarmSpec(id, label, hour, minute, daysMask, enabled, vibrate, snoozeEnabled, snoozeMinutes, maxSnoozes)
}

class AlarmClockModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AlarmClock")

    Events("onRingingChanged")

    OnCreate {
      RingingEvents.listener = { alarmId -> sendEvent("onRingingChanged", mapOf("alarmId" to alarmId)) }
    }

    OnDestroy {
      RingingEvents.listener = null
    }

    /** Replaces the native schedule. Returns the next trigger time (ms) per alarm id, or null. */
    AsyncFunction("setAlarms") { specs: List<AlarmSpecRecord> ->
      AlarmScheduler.syncAll(context, specs.map { it.toSpec() }).mapValues { it.value?.toDouble() }
    }

    Function("getRinging") {
      AlarmStore(context).ringing()?.let {
        mapOf("alarmId" to it.alarmId, "firedAt" to it.firedAt.toDouble(), "snoozeCount" to it.snoozeCount)
      }
    }

    /** method: "challenge" | "emergency". Stops the sound and lets the lock screen take over again. */
    AsyncFunction("stopRinging") { method: String ->
      AlarmRingingService.request(context, AlarmRingingService.ACTION_STOP, method)
      appContext.currentActivity?.let { LockScreen.release(it) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("snooze") {
      AlarmRingingService.request(context, AlarmRingingService.ACTION_SNOOZE)
      appContext.currentActivity?.let { LockScreen.release(it) }
    }.runOnQueue(Queues.MAIN)

    /** Drains native outcome events (fired, snoozed, stopped, disabled) for import into SQLite. */
    Function("consumeEvents") {
      AlarmStore(context).drainEvents()
    }

    Function("getPermissionStatus") {
      val notifications = context.getSystemService(NotificationManager::class.java)
      val power = context.getSystemService(PowerManager::class.java)
      mapOf(
        "exactAlarms" to AlarmScheduler.canScheduleExact(context),
        "fullScreenIntent" to (Build.VERSION.SDK_INT < 34 || notifications.canUseFullScreenIntent()),
        "notifications" to notifications.areNotificationsEnabled(),
        "batteryOptimizationIgnored" to power.isIgnoringBatteryOptimizations(context.packageName),
      )
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        open(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, packageUri()))
      } else {
        openAppDetails()
      }
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        open(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, packageUri()))
      } else {
        openAppDetails()
      }
    }

    Function("openNotificationSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        open(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
      } else {
        openAppDetails()
      }
    }

    Function("openBatteryOptimizationSettings") {
      open(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }
  }

  private fun packageUri(): Uri = Uri.parse("package:${context.packageName}")

  private fun openAppDetails() = open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri()))

  private fun open(intent: Intent) {
    val activity = appContext.currentActivity
    if (activity != null) {
      activity.startActivity(intent)
    } else {
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
