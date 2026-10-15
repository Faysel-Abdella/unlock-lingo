package com.unlocklingo.unlockcards

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Handles card notification actions. Outcomes are logged for JS to import. */
class CardActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val itemId = intent.getStringExtra(EXTRA_ITEM_ID) ?: return
    val store = CardStore(context)
    val now = System.currentTimeMillis()
    when (intent.action) {
      ACTION_KNOW -> store.appendEvent("answered", itemId, now, mapOf("knewIt" to true))
      ACTION_LATER -> store.appendEvent("answered", itemId, now, mapOf("knewIt" to false))
      ACTION_SAVE -> store.appendEvent("saved", itemId, now)
      ACTION_DISMISS -> {
        store.appendEvent("dismissed", itemId, now)
        return // the notification is already gone
      }
      else -> return
    }
    CardPresenter.cancel(context)
  }

  companion object {
    const val ACTION_KNOW = "com.unlocklingo.unlockcards.KNOW"
    const val ACTION_LATER = "com.unlocklingo.unlockcards.LATER"
    const val ACTION_SAVE = "com.unlocklingo.unlockcards.SAVE"
    const val ACTION_DISMISS = "com.unlocklingo.unlockcards.DISMISS"
    private const val EXTRA_ITEM_ID = "itemId"

    fun intent(context: Context, action: String, itemId: String): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        (action + itemId).hashCode(),
        Intent(context, CardActionReceiver::class.java).setAction(action).putExtra(EXTRA_ITEM_ID, itemId),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
  }
}
