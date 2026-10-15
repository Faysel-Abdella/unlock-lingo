package com.unlocklingo.alarmclock

/** In-process bridge from the ringing service to the JS module (when the app is running). */
object RingingEvents {
  @Volatile
  var listener: ((alarmId: String?) -> Unit)? = null

  /** [alarmId] is the alarm that started ringing, or null when ringing stopped. */
  fun emit(alarmId: String?) {
    listener?.invoke(alarmId)
  }
}
