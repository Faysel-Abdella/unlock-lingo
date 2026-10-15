package com.unlocklingo.alarmclock

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class RingingState(val alarmId: String, val firedAt: Long, val snoozeCount: Int)

/**
 * Native state in device-protected storage, so it is readable before the first
 * unlock after a reboot. SQLite (credential-protected) remains the source of truth
 * for alarm definitions; this is the copy the OS-level parts need.
 */
class AlarmStore(context: Context) {
  private val prefs: SharedPreferences =
    context.createDeviceProtectedStorageContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun specs(): List<AlarmSpec> {
    val array = JSONArray(prefs.getString(KEY_SPECS, "[]"))
    return (0 until array.length()).map { specFromJson(array.getJSONObject(it)) }
  }

  fun spec(id: String): AlarmSpec? = specs().firstOrNull { it.id == id }

  fun saveSpecs(specs: List<AlarmSpec>) {
    val array = JSONArray()
    specs.forEach { array.put(specToJson(it)) }
    prefs.edit().putString(KEY_SPECS, array.toString()).commit()
  }

  /** A one-time alarm turns itself off after ringing, like a system clock app. */
  fun disable(id: String) = saveSpecs(specs().map { if (it.id == id) it.copy(enabled = false) else it })

  /**
   * The alarm currently ringing. A record older than the maximum ring time is stale
   * (the process died mid-ring) and is cleared, so it can never block future alarms.
   */
  fun ringing(now: Long = System.currentTimeMillis()): RingingState? {
    val raw = prefs.getString(KEY_RINGING, null) ?: return null
    val json = JSONObject(raw)
    val state = RingingState(json.getString("alarmId"), json.getLong("firedAt"), json.optInt("snoozeCount", 0))
    if (now - state.firedAt > (AlarmSchedule.MAX_RING_MINUTES + 1) * 60_000L) {
      setRinging(null)
      return null
    }
    return state
  }

  fun setRinging(state: RingingState?) {
    val editor = prefs.edit()
    if (state == null) {
      editor.remove(KEY_RINGING)
    } else {
      editor.putString(
        KEY_RINGING,
        JSONObject().put("alarmId", state.alarmId).put("firedAt", state.firedAt).put("snoozeCount", state.snoozeCount).toString(),
      )
    }
    editor.commit()
  }

  fun snoozeCount(alarmId: String): Int = prefs.getInt(KEY_SNOOZE_COUNT + alarmId, 0)

  fun setSnoozeCount(alarmId: String, count: Int) {
    prefs.edit().putInt(KEY_SNOOZE_COUNT + alarmId, count).commit()
  }

  fun snoozeUntil(alarmId: String): Long? = prefs.getLong(KEY_SNOOZE_UNTIL + alarmId, 0L).takeIf { it > 0L }

  fun setSnoozeUntil(alarmId: String, until: Long?) {
    val editor = prefs.edit()
    if (until == null) editor.remove(KEY_SNOOZE_UNTIL + alarmId) else editor.putLong(KEY_SNOOZE_UNTIL + alarmId, until)
    editor.commit()
  }

  /** Outcome log for JS to import into SQLite (fired, snoozed, stopped, disabled). */
  @Synchronized
  fun appendEvent(type: String, alarmId: String, at: Long, extra: Map<String, Any?> = emptyMap()) {
    val events = JSONArray(prefs.getString(KEY_EVENTS, "[]"))
    val event = JSONObject().put("type", type).put("alarmId", alarmId).put("at", at)
    extra.forEach { (k, v) -> event.put(k, v) }
    events.put(event)
    prefs.edit().putString(KEY_EVENTS, events.toString()).commit()
  }

  @Synchronized
  fun drainEvents(): List<Map<String, Any?>> {
    val events = JSONArray(prefs.getString(KEY_EVENTS, "[]"))
    prefs.edit().putString(KEY_EVENTS, "[]").commit()
    return (0 until events.length()).map { index ->
      val json = events.getJSONObject(index)
      json.keys().asSequence().associateWith { key -> json.get(key).takeUnless { it == JSONObject.NULL } }
    }
  }

  private fun specToJson(s: AlarmSpec) = JSONObject()
    .put("id", s.id)
    .put("label", s.label)
    .put("hour", s.hour)
    .put("minute", s.minute)
    .put("daysMask", s.daysMask)
    .put("enabled", s.enabled)
    .put("vibrate", s.vibrate)
    .put("snoozeEnabled", s.snoozeEnabled)
    .put("snoozeMinutes", s.snoozeMinutes)
    .put("maxSnoozes", s.maxSnoozes)

  private fun specFromJson(j: JSONObject) = AlarmSpec(
    id = j.getString("id"),
    label = j.optString("label", ""),
    hour = j.getInt("hour"),
    minute = j.getInt("minute"),
    daysMask = j.optInt("daysMask", 0),
    enabled = j.optBoolean("enabled", true),
    vibrate = j.optBoolean("vibrate", true),
    snoozeEnabled = j.optBoolean("snoozeEnabled", true),
    snoozeMinutes = j.optInt("snoozeMinutes", 9),
    maxSnoozes = j.optInt("maxSnoozes", 3),
  )

  companion object {
    private const val PREFS = "unlock_lingo_alarms"
    private const val KEY_SPECS = "specs"
    private const val KEY_RINGING = "ringing"
    private const val KEY_EVENTS = "events"
    private const val KEY_SNOOZE_COUNT = "snooze_count:"
    private const val KEY_SNOOZE_UNTIL = "snooze_until:"
  }
}
