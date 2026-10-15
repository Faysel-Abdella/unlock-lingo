package com.unlocklingo.alarmclock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

class AlarmScheduleTest {
  private val berlin = TimeZone.getTimeZone("Europe/Berlin")

  private fun local(y: Int, m: Int, d: Int, h: Int, min: Int = 0): Long =
    Calendar.getInstance(berlin).apply {
      clear()
      set(y, m - 1, d, h, min, 0)
    }.timeInMillis

  private fun spec(hour: Int, minute: Int = 0, daysMask: Int = 0, enabled: Boolean = true) =
    AlarmSpec("a", "", hour, minute, daysMask, enabled, true, true, 9, 3)

  // 2026-03-11 is a Wednesday.
  @Test fun ringsLaterToday() =
    assertEquals(local(2026, 3, 11, 7), AlarmSchedule.nextOccurrence(spec(7), local(2026, 3, 11, 6), berlin))

  @Test fun ringsTomorrowWhenTimeHasPassedOrIsNow() {
    assertEquals(local(2026, 3, 12, 5), AlarmSchedule.nextOccurrence(spec(5), local(2026, 3, 11, 6), berlin))
    assertEquals(local(2026, 3, 12, 6), AlarmSchedule.nextOccurrence(spec(6), local(2026, 3, 11, 6), berlin))
  }

  @Test fun skipsToNextSelectedWeekday() {
    val weekdays = 0b0011111
    assertEquals(local(2026, 3, 16, 7), AlarmSchedule.nextOccurrence(spec(7, daysMask = weekdays), local(2026, 3, 13, 8), berlin))
  }

  @Test fun keepsWallClockTimeAcrossDst() {
    val sunday = 1 shl 6
    val next = AlarmSchedule.nextOccurrence(spec(7, daysMask = sunday), local(2026, 3, 28, 12), berlin)!!
    val cal = Calendar.getInstance(berlin).apply { timeInMillis = next }
    assertEquals(7, cal.get(Calendar.HOUR_OF_DAY))
    assertEquals(29, cal.get(Calendar.DAY_OF_MONTH))
  }

  @Test fun disabledAlarmNeverRings() = assertNull(AlarmSchedule.nextOccurrence(spec(7, enabled = false), 0L, berlin))
}
