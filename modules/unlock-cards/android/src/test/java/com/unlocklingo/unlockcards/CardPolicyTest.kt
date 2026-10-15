package com.unlocklingo.unlockcards

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

/** Same cases as src/features/unlock/domain/policy.test.ts. */
class CardPolicyTest {
  private val zone = TimeZone.getTimeZone("Europe/Berlin")

  private fun at(h: Int, m: Int = 0, day: Int = 11): Long =
    Calendar.getInstance(zone).apply { clear(); set(2026, Calendar.MARCH, day, h, m, 0) }.timeInMillis

  private fun hm(h: Int, m: Int = 0) = h * 60 + m

  private fun config(
    enabled: Boolean = true,
    max: Int = 10,
    cooldown: Int = 30,
    quiet: TimeWindow = TimeWindow(true, hm(23), hm(7)),
    work: TimeWindow = TimeWindow(false, hm(9), hm(17)),
    workDays: Set<Int> = setOf(1, 2, 3, 4, 5),
    frequency: String = "high",
    everyUnlock: Boolean = false,
  ) = PolicyConfig(enabled, max, cooldown, quiet, work, workDays, frequency, everyUnlock)

  private fun shown(vararg times: Long) = times.fold(CardPolicy.EMPTY) { s, t -> CardPolicy.recordShown(s, t, zone) }

  private fun decide(c: PolicyConfig, s: PolicyState, now: Long, roll: Double = 0.0) = CardPolicy.decide(c, s, now, roll, zone)

  @Test fun windows() {
    assertTrue(CardPolicy.inWindow(hm(23, 30), hm(23), hm(7)))
    assertTrue(CardPolicy.inWindow(hm(6, 59), hm(23), hm(7)))
    assertFalse(CardPolicy.inWindow(hm(7), hm(23), hm(7)))
    assertFalse(CardPolicy.inWindow(hm(12), hm(8), hm(8)))
  }

  @Test fun showsOnEligibleUnlock() = assertTrue(decide(config(), CardPolicy.EMPTY, at(12), 0.5).show)

  @Test fun disabled() = assertEquals("disabled", decide(config(enabled = false), CardPolicy.EMPTY, at(12)).reason)

  @Test fun cooldown() {
    val state = shown(at(12))
    assertEquals("cooldown", decide(config(), state, at(12, 20)).reason)
    assertTrue(decide(config(), state, at(12, 30)).show)
  }

  @Test fun dailyLimitResetsNextDay() {
    val state = shown(at(8), at(9), at(10))
    assertEquals("daily_limit", decide(config(max = 3), state, at(15)).reason)
    assertTrue(decide(config(max = 3), state, at(8, 0, 12)).show)
  }

  @Test fun quietHours() {
    assertEquals("quiet_hours", decide(config(), CardPolicy.EMPTY, at(23, 15)).reason)
    assertEquals("quiet_hours", decide(config(), CardPolicy.EMPTY, at(6, 30)).reason)
  }

  @Test fun workHoursOnlyOnWorkDays() {
    val c = config(work = TimeWindow(true, hm(9), hm(17)))
    assertEquals("work_hours", decide(c, CardPolicy.EMPTY, at(10)).reason)
    assertTrue(decide(c, CardPolicy.EMPTY, at(10, 0, 14)).show) // Saturday
  }

  @Test fun frequency() {
    assertTrue(decide(config(frequency = "low"), CardPolicy.EMPTY, at(12), 0.2).show)
    assertEquals("frequency", decide(config(frequency = "low"), CardPolicy.EMPTY, at(12), 0.5).reason)
  }

  @Test fun everyUnlockKeepsQuietHoursAndCap() {
    val c = config(everyUnlock = true, frequency = "low", max = 2)
    assertTrue(decide(c, shown(at(12)), at(12, 1), 0.99).show)
    assertEquals("daily_limit", decide(c, shown(at(12), at(12, 1)), at(12, 2)).reason)
    assertEquals("quiet_hours", decide(c, CardPolicy.EMPTY, at(23, 30)).reason)
  }

  @Test fun scheduledSlots() {
    assertEquals(at(12), CardPolicy.nextScheduledSlot(config(max = 8), shown(at(10)), at(10, 1), zone))
    assertEquals(at(10, 45), CardPolicy.nextScheduledSlot(config(max = 50, cooldown = 45), shown(at(10)), at(10, 1), zone))
    assertEquals(at(7, 0, 12), CardPolicy.nextScheduledSlot(config(max = 8), shown(at(22)), at(22, 1), zone))
    assertEquals(at(7, 0, 12), CardPolicy.nextScheduledSlot(config(max = 2), shown(at(9), at(15)), at(15, 1), zone))
    val work = config(max = 16, work = TimeWindow(true, hm(9), hm(17)), workDays = setOf(3))
    assertEquals(at(17), CardPolicy.nextScheduledSlot(work, CardPolicy.EMPTY, at(8, 30), zone))
    assertNull(CardPolicy.nextScheduledSlot(config(enabled = false), CardPolicy.EMPTY, at(12), zone))
  }
}
