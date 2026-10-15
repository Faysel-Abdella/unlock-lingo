package com.unlocklingo.unlockcards

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/** A card prepared by JS from the learning queue. Text is pre-formatted for display. */
data class Card(
  val itemId: String,
  /** "flash" cards are self-graded from the notification; "quiz" cards open the app to answer. */
  val kind: String,
  val title: String,
  val subtitle: String?,
  val body: String,
  val example: String?,
)

data class CardsConfig(val mode: String, val policy: PolicyConfig)

/**
 * Native state for unlock cards: configuration, the card deck, policy counters
 * and an event log that JS imports into SQLite.
 */
class CardStore(context: Context) {
  private val prefs: SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun config(): CardsConfig? = prefs.getString(KEY_CONFIG, null)?.let { parseConfig(JSONObject(it)) }

  fun saveConfig(json: String) {
    parseConfig(JSONObject(json)) // validate before storing
    prefs.edit().putString(KEY_CONFIG, json).commit()
  }

  /** Replaces the deck. Cards already shown stay out because JS builds the deck from fresh state. */
  fun saveDeck(json: String) {
    JSONArray(json).let { array -> (0 until array.length()).forEach { parseCard(array.getJSONObject(it)) } }
    prefs.edit().putString(KEY_DECK, json).commit()
  }

  /** Removes and returns the next card, or null when the deck is empty. */
  @Synchronized
  fun takeCard(): Card? {
    val deck = JSONArray(prefs.getString(KEY_DECK, "[]"))
    if (deck.length() == 0) return null
    val card = parseCard(deck.getJSONObject(0))
    deck.remove(0)
    prefs.edit().putString(KEY_DECK, deck.toString()).commit()
    return card
  }

  fun deckSize(): Int = JSONArray(prefs.getString(KEY_DECK, "[]")).length()

  fun state(): PolicyState {
    val raw = prefs.getString(KEY_STATE, null) ?: return CardPolicy.EMPTY
    val json = JSONObject(raw)
    return PolicyState(
      day = json.optString("day").takeIf { it.isNotEmpty() },
      shownToday = json.optInt("shownToday", 0),
      lastShownAt = json.optLong("lastShownAt", 0L).takeIf { it > 0L },
    )
  }

  fun saveState(state: PolicyState) {
    val json = JSONObject().put("day", state.day ?: "").put("shownToday", state.shownToday).put("lastShownAt", state.lastShownAt ?: 0L)
    prefs.edit().putString(KEY_STATE, json.toString()).commit()
  }

  @Synchronized
  fun appendEvent(type: String, itemId: String, at: Long, extra: Map<String, Any?> = emptyMap()) {
    val events = JSONArray(prefs.getString(KEY_EVENTS, "[]"))
    val event = JSONObject().put("type", type).put("itemId", itemId).put("at", at)
    extra.forEach { (k, v) -> event.put(k, v) }
    events.put(event)
    // Bound the log in case JS does not run for a long time.
    while (events.length() > MAX_EVENTS) events.remove(0)
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

  private fun parseConfig(j: JSONObject): CardsConfig {
    val p = j.getJSONObject("policy")
    fun window(o: JSONObject) = TimeWindow(o.getBoolean("enabled"), o.getInt("start"), o.getInt("end"))
    val work = p.getJSONObject("workHours")
    val days = work.optJSONArray("days") ?: JSONArray()
    return CardsConfig(
      mode = j.getString("mode"),
      policy = PolicyConfig(
        enabled = p.getBoolean("enabled"),
        maxCardsPerDay = p.getInt("maxCardsPerDay"),
        cooldownMinutes = p.getInt("cooldownMinutes"),
        quietHours = window(p.getJSONObject("quietHours")),
        workHours = window(work),
        workDays = (0 until days.length()).map { days.getInt(it) }.toSet(),
        frequency = p.getString("frequency"),
        everyUnlock = p.getBoolean("everyUnlock"),
      ),
    )
  }

  private fun parseCard(j: JSONObject) = Card(
    itemId = j.getString("itemId"),
    kind = j.optString("kind", "flash"),
    title = j.getString("title"),
    subtitle = j.optString("subtitle").takeIf { it.isNotEmpty() },
    body = j.getString("body"),
    example = j.optString("example").takeIf { it.isNotEmpty() },
  )

  companion object {
    private const val PREFS = "unlock_lingo_cards"
    private const val KEY_CONFIG = "config"
    private const val KEY_DECK = "deck"
    private const val KEY_STATE = "state"
    private const val KEY_EVENTS = "events"
    private const val MAX_EVENTS = 500
  }
}
