// BLE advertisements rarely include a calibrated TX power, so fall back to a
// typical measured power at 1 m for consumer devices.
const DEFAULT_TX_POWER_DBM = -59;
// Path-loss exponent for indoor environments with obstacles.
const PATH_LOSS_EXPONENT = 2.2;

export function estimateDistanceMeters(rssi: number, txPower?: number | null): number | undefined {
  if (!Number.isFinite(rssi) || rssi >= 0) return undefined;
  const measuredPower = typeof txPower === 'number' && txPower < 0 ? txPower : DEFAULT_TX_POWER_DBM;
  const distance = Math.pow(10, (measuredPower - rssi) / (10 * PATH_LOSS_EXPONENT));
  return Math.round(distance * 10) / 10;
}

export type RssiSmoother = {
  next: (rssi: number) => number;
};

// One-dimensional Kalman filter so RSSI jitter does not reshuffle the list on
// every advertisement.
export function createRssiSmoother({
  processNoise = 0.008,
  measurementNoise = 4,
} = {}): RssiSmoother {
  let estimate: number | null = null;
  let errorCovariance = 1;

  return {
    next(rssi: number) {
      if (estimate === null) {
        estimate = rssi;
        return estimate;
      }
      errorCovariance += processNoise;
      const gain = errorCovariance / (errorCovariance + measurementNoise);
      estimate += gain * (rssi - estimate);
      errorCovariance *= 1 - gain;
      return estimate;
    },
  };
}
