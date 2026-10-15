package com.unlocklingo.alarmclock

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

/**
 * Keeps the alarm ringing until the learning challenge is completed, the user
 * snoozes, uses the emergency stop, or [AlarmSchedule.MAX_RING_MINUTES] pass.
 * Nothing here depends on JS: if the app UI cannot load, the alarm still
 * rings, still offers an emergency stop, and still times out.
 */
class AlarmRingingService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var currentAlarmId: String? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> intent.getStringExtra(AlarmScheduler.EXTRA_ALARM_ID)?.let { startRinging(it) } ?: stopSelf()
      ACTION_STOP -> finish(intent.getStringExtra(EXTRA_METHOD) ?: METHOD_CHALLENGE)
      ACTION_SNOOZE -> snooze()
      // Restarted by the system without an intent: there is nothing safe to resume.
      else -> stopSelf()
    }
    return START_NOT_STICKY
  }

  private fun startRinging(alarmId: String) {
    val store = AlarmStore(this)
    val spec = store.spec(alarmId)
    val now = System.currentTimeMillis()
    val snoozeCount = store.snoozeCount(alarmId)

    // startForeground must be called promptly after startForegroundService.
    startInForeground(buildNotification(alarmId, spec, showEmergency = false))
    currentAlarmId = alarmId
    store.setRinging(RingingState(alarmId, now, snoozeCount))
    store.appendEvent("fired", alarmId, now, mapOf("snoozeCount" to snoozeCount))

    acquireWakeLock()
    startSound()
    if (spec?.vibrate != false) startVibration()
    // If the app is open, JS navigates to the challenge itself. Otherwise the
    // full-screen intent (locked/screen off) or heads-up notification (in use) does.
    RingingEvents.emit(alarmId)

    // Safety valve 1: an emergency stop appears on the notification after a short delay.
    handler.postDelayed(
      { notificationManager().notify(NOTIFICATION_ID, buildNotification(alarmId, spec, showEmergency = true)) },
      EMERGENCY_DELAY_MS,
    )
    // Safety valve 2: never ring forever.
    handler.postDelayed({ finish(METHOD_TIMEOUT) }, AlarmSchedule.MAX_RING_MINUTES * 60_000L)
  }

  private fun snooze() {
    val store = AlarmStore(this)
    val ringing = store.ringing() ?: return finish(null)
    val spec = store.spec(ringing.alarmId)
    val used = store.snoozeCount(ringing.alarmId)
    if (spec == null || !spec.snoozeEnabled || used >= spec.maxSnoozes) return // not allowed: keep ringing
    val until = System.currentTimeMillis() + spec.snoozeMinutes * 60_000L
    store.setSnoozeCount(ringing.alarmId, used + 1)
    store.appendEvent("snoozed", ringing.alarmId, System.currentTimeMillis(), mapOf("until" to until))
    AlarmScheduler.scheduleSnooze(this, ringing.alarmId, until)
    store.setRinging(null)
    teardown()
  }

  /** Stops ringing. [method] is null when there was nothing to stop. */
  private fun finish(method: String?) {
    val store = AlarmStore(this)
    val ringing = store.ringing()
    if (ringing != null && method != null) {
      store.appendEvent("stopped", ringing.alarmId, System.currentTimeMillis(), mapOf("method" to method))
      store.setSnoozeCount(ringing.alarmId, 0)
      store.setSnoozeUntil(ringing.alarmId, null)
      AlarmScheduler.cancelSnooze(this, ringing.alarmId)
    }
    store.setRinging(null)
    teardown()
  }

  private fun teardown() {
    RingingEvents.emit(null)
    handler.removeCallbacksAndMessages(null)
    player?.runCatching { stop(); release() }
    player = null
    vibrator?.cancel()
    vibrator = null
    wakeLock?.takeIf { it.isHeld }?.release()
    wakeLock = null
    currentAlarmId = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    stopSelf()
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    player?.runCatching { release() }
    vibrator?.cancel()
    wakeLock?.takeIf { it.isHeld }?.release()
    super.onDestroy()
  }

  private fun startInForeground(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun acquireWakeLock() {
    val power = getSystemService(PowerManager::class.java)
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "UnlockLingo:alarm").apply {
      acquire(AlarmSchedule.MAX_RING_MINUTES * 60_000L + 30_000L)
    }
  }

  private fun alarmSoundUri(): Uri? =
    RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

  private fun startSound() {
    val uri = alarmSoundUri() ?: return
    try {
      player = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        setDataSource(this@AlarmRingingService, uri)
        isLooping = true
        prepare()
        start()
      }
    } catch (error: Exception) {
      // Vibration and the notification still alert the user.
      Log.w(TAG, "Could not play alarm sound", error)
      player?.release()
      player = null
    }
  }

  private fun startVibration() {
    val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      getSystemService(VibratorManager::class.java).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    val pattern = longArrayOf(0, 800, 600)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
      @Suppress("DEPRECATION")
      v.vibrate(VibrationEffect.createWaveform(pattern, 0), attributes)
    } else {
      @Suppress("DEPRECATION")
      v.vibrate(pattern, 0)
    }
    vibrator = v
  }

  private fun buildNotification(alarmId: String, spec: AlarmSpec?, showEmergency: Boolean): Notification {
    ensureChannel()
    val content = challengeIntent(this, alarmId)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_MAX)
    }
    builder
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(spec?.label?.takeIf { it.isNotBlank() } ?: "Alarm")
      .setContentText("Answer a few quick questions to stop the alarm.")
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(content)
      .setFullScreenIntent(content, true)

    val snoozesLeft = spec?.let { if (it.snoozeEnabled) it.maxSnoozes - AlarmStore(this).snoozeCount(alarmId) else 0 } ?: 0
    if (snoozesLeft > 0) {
      builder.addAction(action("Snooze ${spec?.snoozeMinutes ?: ""} min", serviceIntent(ACTION_SNOOZE, null, 1)))
    }
    if (showEmergency) {
      builder.addAction(action("Emergency stop", serviceIntent(ACTION_STOP, METHOD_EMERGENCY, 2)))
    }
    return builder.build()
  }

  private fun action(title: String, intent: PendingIntent): Notification.Action =
    Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_lock_idle_alarm), title, intent).build()

  private fun serviceIntent(action: String, method: String?, requestCode: Int): PendingIntent =
    PendingIntent.getService(
      this,
      requestCode,
      Intent(this, AlarmRingingService::class.java).setAction(action).putExtra(EXTRA_METHOD, method),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = notificationManager()
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Ringing alarms and their learning challenge"
        setSound(null, null) // the service plays the alarm sound itself, on the alarm stream
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      },
    )
  }

  private fun notificationManager(): NotificationManager = getSystemService(NotificationManager::class.java)

  companion object {
    private const val TAG = "AlarmRingingService"
    const val ACTION_START = "com.unlocklingo.alarmclock.START"
    const val ACTION_STOP = "com.unlocklingo.alarmclock.STOP"
    const val ACTION_SNOOZE = "com.unlocklingo.alarmclock.SNOOZE"
    const val EXTRA_METHOD = "method"
    const val METHOD_CHALLENGE = "challenge"
    const val METHOD_EMERGENCY = "emergency"
    const val METHOD_TIMEOUT = "timeout"
    const val CHANNEL_ID = "alarms"
    const val NOTIFICATION_ID = 7001
    private const val EMERGENCY_DELAY_MS = 2 * 60_000L

    fun challengeUrl(alarmId: String): String = "unlocklingo://alarm/ring?alarmId=${Uri.encode(alarmId)}"

    fun challengeIntent(context: Context, alarmId: String): PendingIntent =
      PendingIntent.getActivity(
        context,
        0,
        Intent(Intent.ACTION_VIEW, Uri.parse(challengeUrl(alarmId)))
          .setPackage(context.packageName)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    fun start(context: Context, alarmId: String) {
      val intent = Intent(context, AlarmRingingService::class.java)
        .setAction(ACTION_START)
        .putExtra(AlarmScheduler.EXTRA_ALARM_ID, alarmId)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }

    /** Called from the app while it is in the foreground. */
    fun request(context: Context, action: String, method: String? = null) {
      context.startService(Intent(context, AlarmRingingService::class.java).setAction(action).putExtra(EXTRA_METHOD, method))
    }
  }
}
