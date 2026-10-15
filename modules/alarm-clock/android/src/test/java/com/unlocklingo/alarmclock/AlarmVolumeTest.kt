package com.unlocklingo.alarmclock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AlarmVolumeTest {
  @Test fun fullVolumeWhenNotGradual() {
    assertEquals(1f, AlarmVolume.at(0, gradual = false), 0f)
  }

  @Test fun startsQuietButAudibleAndReachesFullVolume() {
    assertEquals(AlarmVolume.START_VOLUME, AlarmVolume.at(0, gradual = true), 0.0001f)
    assertEquals(1f, AlarmVolume.at(AlarmVolume.RAMP_MS, gradual = true), 0.0001f)
    assertEquals(1f, AlarmVolume.at(10 * AlarmVolume.RAMP_MS, gradual = true), 0.0001f)
  }

  @Test fun risesMonotonicallyAndGentlyAtFirst() {
    var previous = 0f
    for (ms in 0..AlarmVolume.RAMP_MS step AlarmVolume.STEP_MS) {
      val v = AlarmVolume.at(ms, gradual = true)
      assertTrue(v >= previous)
      previous = v
    }
    // Halfway through the ramp the volume is still below the midpoint (quadratic curve).
    assertTrue(AlarmVolume.at(AlarmVolume.RAMP_MS / 2, gradual = true) < 0.6f)
  }

  @Test fun negativeElapsedIsClamped() {
    assertEquals(AlarmVolume.START_VOLUME, AlarmVolume.at(-500, gradual = true), 0.0001f)
  }
}
