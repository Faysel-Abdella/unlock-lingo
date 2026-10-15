package com.unlocklingo.unlockcards

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import kotlin.random.Random

/** Decides whether to show a card and posts it as a notification. */
object CardPresenter {
  const val CHANNEL_ID = "learning_cards"
  const val NOTIFICATION_ID = 7101

  /** Called on every unlock while the listener runs. */
  fun onUnlock(context: Context) {
    val store = CardStore(context)
    val config = store.config() ?: return
    if (config.mode != "unlock") return
    present(context, store, config, roll = Random.nextDouble())
  }

  /** Called when a scheduled slot fires. The slot already respects spacing, so frequency is not rolled. */
  fun onScheduledSlot(context: Context) {
    val store = CardStore(context)
    val config = store.config() ?: return
    if (config.mode != "scheduled") return
    present(context, store, config, roll = 0.0)
    ScheduledCards.scheduleNext(context)
  }

  private fun present(context: Context, store: CardStore, config: CardsConfig, roll: Double) {
    val now = System.currentTimeMillis()
    val state = store.state()
    if (!CardPolicy.decide(config.policy, state, now, roll).show) return
    if (!notificationManager(context).areNotificationsEnabled()) return
    val card = store.takeCard() ?: return // nothing prepared: JS refills the deck when the app runs
    show(context, card)
    store.saveState(CardPolicy.recordShown(state, now))
    store.appendEvent("shown", card.itemId, now)
  }

  /** Posts a card. Also used for the "show an example card" preview. */
  fun show(context: Context, card: Card) {
    ensureChannel(context)
    val open = PendingIntent.getActivity(
      context,
      card.itemId.hashCode(),
      Intent(Intent.ACTION_VIEW, Uri.parse("unlocklingo://card?itemId=${Uri.encode(card.itemId)}"))
        .setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val text = listOfNotNull(card.body, card.example?.let { "“$it”" }).joinToString("\n\n")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
    }
    builder
      .setSmallIcon(android.R.drawable.ic_menu_info_details)
      .setContentTitle(listOfNotNull(card.title, card.subtitle).joinToString("  "))
      .setContentText(card.body)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setCategory(Notification.CATEGORY_RECOMMENDATION)
      .setContentIntent(open)
      .setDeleteIntent(CardActionReceiver.intent(context, CardActionReceiver.ACTION_DISMISS, card.itemId))
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)

    if (card.kind == "flash") {
      builder.addAction(action(context, "I know this", CardActionReceiver.ACTION_KNOW, card.itemId))
      builder.addAction(action(context, "Review later", CardActionReceiver.ACTION_LATER, card.itemId))
      builder.addAction(action(context, "Save", CardActionReceiver.ACTION_SAVE, card.itemId))
    }
    notificationManager(context).notify(NOTIFICATION_ID, builder.build())
  }

  fun cancel(context: Context) = notificationManager(context).cancel(NOTIFICATION_ID)

  private fun action(context: Context, title: String, action: String, itemId: String): Notification.Action =
    Notification.Action.Builder(
      Icon.createWithResource(context, android.R.drawable.ic_menu_info_details),
      title,
      CardActionReceiver.intent(context, action, itemId),
    ).build()

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = notificationManager(context)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Learning cards", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Short learning cards after you unlock your phone"
        // Silent: a card should be glanceable, never an interruption.
        setSound(null, null)
        enableVibration(false)
      },
    )
  }

  private fun notificationManager(context: Context): NotificationManager =
    context.getSystemService(NotificationManager::class.java)
}
