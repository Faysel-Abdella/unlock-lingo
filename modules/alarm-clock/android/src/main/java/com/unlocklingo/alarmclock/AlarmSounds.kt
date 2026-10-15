package com.unlocklingo.alarmclock

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.util.Log

/** Alarm sounds: the system list, the default, playback setup and a short preview. */
object AlarmSounds {
  private const val TAG = "AlarmSounds"
  private const val PREVIEW_MS = 8_000L
  private var preview: MediaPlayer? = null
  private val handler = android.os.Handler(android.os.Looper.getMainLooper())

  fun defaultUri(context: Context): Uri? =
    RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

  /** The device's alarm sounds as title/uri pairs (system sounds need no storage permission). */
  fun list(context: Context): List<Map<String, String>> {
    val manager = RingtoneManager(context).apply { setType(RingtoneManager.TYPE_ALARM) }
    val sounds = mutableListOf<Map<String, String>>()
    runCatching {
      manager.cursor.use { cursor ->
        while (cursor.moveToNext()) {
          val title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX) ?: continue
          val uri = manager.getRingtoneUri(cursor.position) ?: continue
          sounds += mapOf("title" to title, "uri" to uri.toString())
        }
      }
    }.onFailure { Log.w(TAG, "Could not list alarm sounds", it) }
    return sounds.distinctBy { it["uri"] }
  }

  /** A prepared player on the alarm stream, or null if the sound cannot be played. */
  fun createPlayer(context: Context, uri: Uri, looping: Boolean): MediaPlayer? {
    val player = MediaPlayer()
    return try {
      player.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      player.setDataSource(context, uri)
      player.isLooping = looping
      player.prepare()
      player
    } catch (error: Exception) {
      Log.w(TAG, "Could not play $uri", error)
      player.release()
      null
    }
  }

  /** Plays a few seconds of a sound (null = the default) so the user can choose. */
  fun startPreview(context: Context, uri: String?) {
    stopPreview()
    val target = uri?.let { runCatching { Uri.parse(it) }.getOrNull() } ?: defaultUri(context) ?: return
    preview = createPlayer(context, target, looping = false)?.apply { start() }
    handler.postDelayed({ stopPreview() }, PREVIEW_MS)
  }

  fun stopPreview() {
    handler.removeCallbacksAndMessages(null)
    preview?.runCatching { stop(); release() }
    preview = null
  }
}
