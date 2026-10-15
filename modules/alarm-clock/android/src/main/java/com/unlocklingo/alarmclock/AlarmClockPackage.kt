package com.unlocklingo.alarmclock

import android.content.Context
import expo.modules.core.BasePackage
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/** Registered by Expo autolinking (file name ends in Package.kt and imports BasePackage). */
class AlarmClockPackage : BasePackage() {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(AlarmLockScreenListener())
}
