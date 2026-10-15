package com.unlocklingo.unlockcards

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder

/**
 * Opt-in listener for unlocks. ACTION_USER_PRESENT cannot be received by a
 * manifest receiver (Android 8+), so it is registered at runtime by this
 * foreground service. It shows a minimal, silent ongoing notification while on.
 */
class UnlockListenerService : Service() {
  private val unlockReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action == Intent.ACTION_USER_PRESENT) CardPresenter.onUnlock(context)
    }
  }
  private var registered = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    if (!startInForeground()) {
      stopSelf()
      return
    }
    // USER_PRESENT is a protected system broadcast, so no RECEIVER_(NOT_)EXPORTED flag is required.
    registerReceiver(unlockReceiver, IntentFilter(Intent.ACTION_USER_PRESENT))
    registered = true
    running = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Turned off while we were starting (or restarted by the system after being disabled).
    if (CardStore(this).config()?.let { it.mode == "unlock" && it.policy.enabled } != true) {
      stopSelf()
      return START_NOT_STICKY
    }
    // Every startForegroundService call must be answered with startForeground.
    if (!startInForeground()) stopSelf()
    return START_STICKY
  }

  override fun onDestroy() {
    if (registered) unregisterReceiver(unlockReceiver)
    registered = false
    running = false
    super.onDestroy()
  }

  /** Returns false when Android refuses a foreground start (background start restrictions). */
  private fun startInForeground(): Boolean = try {
    postForegroundNotification()
    true
  } catch (error: Exception) {
    android.util.Log.w("UnlockListenerService", "Foreground start refused", error)
    false
  }

  private fun postForegroundNotification() {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(CHANNEL_ID) == null) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Unlock learning", NotificationManager.IMPORTANCE_MIN).apply {
          description = "Shown while unlock learning is on. You can hide this channel in system settings."
          setShowBadge(false)
        },
      )
    }
    val open = PendingIntent.getActivity(
      this,
      0,
      Intent(Intent.ACTION_VIEW, Uri.parse("unlocklingo://unlock-settings")).setPackage(packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_MIN)
    }
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_menu_info_details)
      .setContentTitle("Unlock learning is on")
      .setContentText("Tap to change how often cards appear, or turn them off.")
      .setOngoing(true)
      .setContentIntent(open)
      .build()
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  companion object {
    private const val CHANNEL_ID = "unlock_listener"
    private const val NOTIFICATION_ID = 7102

    @Volatile
    var running = false
      private set

    /** Returns false if Android does not allow starting the listener right now. */
    fun start(context: Context): Boolean = try {
      val intent = Intent(context, UnlockListenerService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
      true
    } catch (error: Exception) {
      android.util.Log.w("UnlockListenerService", "Could not start unlock listener", error)
      false
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, UnlockListenerService::class.java))
    }
  }
}
