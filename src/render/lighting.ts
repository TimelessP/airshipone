export interface ShipSolarModel {
  shipLatitudeDeg: number;
  shipLongitudeDeg: number;
  shipAltitudeAslM: number;
  planetRotationDeg: number;
  planetOrbitalAngleDeg: number;
  planetDistanceAu: number;
  planetAxialTiltDeg: number;
}

export interface ShipSolarState {
  observerLatitudeDeg: number;
  observerLongitudeDeg: number;
  observerAltitudeAslM: number;
  localSolarTimeHours: number;
  elevationDeg: number;
  azimuthDeg: number;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeLongitudeDeg = (longitudeDeg: number): number => ((longitudeDeg + 180) % 360 + 360) % 360 - 180;

const getUtcDayOfYear = (date: Date): number => {
  const year = date.getUTCFullYear();
  const startOfYearUtc = Date.UTC(year, 0, 1);
  const startOfTodayUtc = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());
  return Math.floor((startOfTodayUtc - startOfYearUtc) / 86400000) + 1;
};

const calculateSubsolarPoint = (dateUtc: Date, model: ShipSolarModel): { latitudeDeg: number; longitudeDeg: number } => {
  const utcHours =
    dateUtc.getUTCHours() +
    dateUtc.getUTCMinutes() / 60 +
    dateUtc.getUTCSeconds() / 3600 +
    dateUtc.getUTCMilliseconds() / 3600000;
  const subsolarLongitudeDeg = normalizeLongitudeDeg(-15 * (utcHours - 12) + model.planetRotationDeg);

  const dayOfYear = getUtcDayOfYear(dateUtc);
  const seasonalAngleRad =
    ((dayOfYear - 172) * (2 * Math.PI / 365.25)) +
    model.planetOrbitalAngleDeg * DEG_TO_RAD;
  const subsolarLatitudeDeg = model.planetAxialTiltDeg * Math.cos(seasonalAngleRad);

  return {
    latitudeDeg: subsolarLatitudeDeg,
    longitudeDeg: subsolarLongitudeDeg
  };
};

const calculateSunElevationAzimuth = (
  observerLatitudeDeg: number,
  observerLongitudeDeg: number,
  subsolarLatitudeDeg: number,
  subsolarLongitudeDeg: number
): { elevationDeg: number; azimuthDeg: number } => {
  const obsLatRad = observerLatitudeDeg * DEG_TO_RAD;
  const obsLonRad = observerLongitudeDeg * DEG_TO_RAD;
  const sunLatRad = subsolarLatitudeDeg * DEG_TO_RAD;
  const sunLonRad = subsolarLongitudeDeg * DEG_TO_RAD;

  const deltaLonRad = sunLonRad - obsLonRad;

  const sinElevation =
    Math.sin(obsLatRad) * Math.sin(sunLatRad) +
    Math.cos(obsLatRad) * Math.cos(sunLatRad) * Math.cos(deltaLonRad);
  const elevationDeg = Math.asin(clamp(sinElevation, -1, 1)) * RAD_TO_DEG;

  const elevationRad = elevationDeg * DEG_TO_RAD;
  const cosElevation = Math.cos(elevationRad);
  if (Math.abs(cosElevation) < 1e-9) {
    return {
      elevationDeg,
      azimuthDeg: subsolarLatitudeDeg > observerLatitudeDeg ? 180 : 0
    };
  }

  const sinAzimuth = Math.sin(deltaLonRad) * Math.cos(sunLatRad) / cosElevation;
  const cosAzimuth =
    (Math.sin(sunLatRad) - Math.sin(obsLatRad) * Math.sin(elevationRad)) /
    (Math.cos(obsLatRad) * cosElevation);

  const azimuthDeg = (Math.atan2(sinAzimuth, cosAzimuth) * RAD_TO_DEG + 360) % 360;
  return { elevationDeg, azimuthDeg };
};

export const getShipSolarState = (utcMs: number, model: ShipSolarModel): ShipSolarState => {
  const utcNow = new Date(utcMs);
  const observerLatitudeDeg = clamp(model.shipLatitudeDeg, -90, 90);
  const observerLongitudeDeg = normalizeLongitudeDeg(model.shipLongitudeDeg);
  const observerAltitudeAslM = Math.max(0, model.shipAltitudeAslM);

  const utcHours =
    utcNow.getUTCHours() +
    utcNow.getUTCMinutes() / 60 +
    utcNow.getUTCSeconds() / 3600 +
    utcNow.getUTCMilliseconds() / 3600000;
  const localSolarTimeHours = ((utcHours + (observerLongitudeDeg / 15)) % 24 + 24) % 24;

  const { latitudeDeg: subsolarLat, longitudeDeg: subsolarLon } = calculateSubsolarPoint(utcNow, model);
  const { elevationDeg, azimuthDeg } = calculateSunElevationAzimuth(
    observerLatitudeDeg,
    observerLongitudeDeg,
    subsolarLat,
    subsolarLon
  );

  return {
    observerLatitudeDeg,
    observerLongitudeDeg,
    observerAltitudeAslM,
    localSolarTimeHours,
    elevationDeg,
    azimuthDeg
  };
};

export const getSolarChargeEffectiveness = (utcMs: number, model: ShipSolarModel, solarPanelsConnected: boolean): number => {
  if (!solarPanelsConnected) {
    return 0;
  }

  const { elevationDeg, observerAltitudeAslM } = getShipSolarState(utcMs, model);

  const sunFacingFactor = Math.max(0, Math.sin(elevationDeg * DEG_TO_RAD));
  const distanceFactor = 1 / Math.max(0.25, model.planetDistanceAu) ** 2;
  const altitudeBoost = 1 + clamp(observerAltitudeAslM / 12000, 0, 0.16);
  return clamp(sunFacingFactor * distanceFactor * altitudeBoost, 0, 1);
};
