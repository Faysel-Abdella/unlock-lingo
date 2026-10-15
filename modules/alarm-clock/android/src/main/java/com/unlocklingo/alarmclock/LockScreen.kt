package com.unlocklingo.alarmclock

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

/** Lets the app's activity appear over the lock screen, but only while an alarm is ringing. */
object LockScreen {
  fun show(activity: Activity) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      activity.setShowWhenLocked(true)
      activity.setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  fun release(activity: Activity) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      activity.setShowWhenLocked(false)
      activity.setTurnScreenOn(false)
    } else {
      @Suppress("DEPRECATION")
      activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  /** Applies the right state for the current ringing status. */
  fun sync(activity: Activity) {
    if (AlarmStore(activity).ringing() != null) show(activity) else release(activity)
  }
}

/**
 * Hooks into the React activity so the lock-screen flags are applied before the
 * first frame when a full-screen alarm intent launches or resumes the app.
 */
class AlarmLockScreenListener : ReactActivityLifecycleListener {
  private var activity: WeakReference<Activity>? = null

  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    this.activity = WeakReference(activity)
    LockScreen.sync(activity)
  }

  override fun onResume(activity: Activity) {
    this.activity = WeakReference(activity)
    LockScreen.sync(activity)
  }

  override fun onNewIntent(intent: Intent): Boolean {
    activity?.get()?.let { LockScreen.sync(it) }
    return false
  }
}
