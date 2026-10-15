package com.unlocklingo.unlockcards

import android.app.NotificationManager
import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class UnlockCardsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("UnlockCards")

    /**
     * Stores configuration and a freshly built deck (both JSON, validated natively),
     * then starts or stops the unlock listener / schedule to match.
     */
    AsyncFunction("configure") { configJson: String, deckJson: String ->
      val store = CardStore(context)
      store.saveConfig(configJson)
      store.saveDeck(deckJson)
      CardDelivery.apply(context)
    }

    /** Drains native events (shown, answered, saved, dismissed) for import into SQLite. */
    Function("consumeEvents") {
      CardStore(context).drainEvents()
    }

    Function("getStatus") {
      val store = CardStore(context)
      mapOf(
        "listenerRunning" to UnlockListenerService.running,
        "notificationsEnabled" to context.getSystemService(NotificationManager::class.java).areNotificationsEnabled(),
        "deckSize" to store.deckSize(),
        "shownToday" to CardPolicy.shownToday(store.state(), System.currentTimeMillis(), java.util.TimeZone.getDefault()),
      )
    }

    /** Shows one card right away, ignoring the policy. Used for "Show an example". */
    AsyncFunction("preview") { cardJson: String ->
      val j = JSONObject(cardJson)
      CardPresenter.show(
        context,
        Card(
          itemId = j.getString("itemId"),
          kind = j.optString("kind", "flash"),
          title = j.getString("title"),
          subtitle = j.optString("subtitle").takeIf { it.isNotEmpty() },
          body = j.getString("body"),
          example = j.optString("example").takeIf { it.isNotEmpty() },
        ),
      )
    }
  }
}
