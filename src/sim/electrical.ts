export interface ElectricalConfig {
  mainBusNominalVoltageV: number;
  batteryBankCapacityAh: number;
  mainLightsDrawA: number;
  solarArrayNominalVoltageV: number;
  solarArrayMaxCurrentA: number;
  solarMpptEfficiency: number;
}

export const DEFAULT_ELECTRICAL_CONFIG: ElectricalConfig = {
  mainBusNominalVoltageV: 28,
  batteryBankCapacityAh: 120,
  mainLightsDrawA: 16,
  solarArrayNominalVoltageV: 180,
  solarArrayMaxCurrentA: 96,
  solarMpptEfficiency: 0.95
};

export interface ElectricalState {
  batteryACharge: number;
  batteryBCharge: number;
  batteryAConnectedToBus: boolean;
  batteryBConnectedToBus: boolean;
  solarPanelsConnected: boolean;
  mainBusConnected: boolean;
  lightsMainOn: boolean;
}

export interface ElectricalTelemetry {
  loadCurrentA: number;
  solarChargeCurrentA: number;
  netBatteryCurrentA: number;
}

export interface ElectricalTickInput {
  tickSeconds: number;
  hasBatterySupplyModule: boolean;
  solarEffectiveness: number;
}

export interface ElectricalTickOutput {
  batteryACharge: number;
  batteryBCharge: number;
  telemetry: ElectricalTelemetry;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const clampPercent = (value: number): number => clamp(value, 0, 100);

const getConnectedChargedBatteryCount = (state: ElectricalState): number => {
  return Number(state.batteryAConnectedToBus && state.batteryACharge > 0.001) + Number(state.batteryBConnectedToBus && state.batteryBCharge > 0.001);
};

export const computeMainBusPowered = (state: ElectricalState, hasBatterySupplyModule: boolean): boolean => {
  if (!hasBatterySupplyModule) {
    return false;
  }

  const hasConnectedChargedBattery =
    (state.batteryAConnectedToBus && state.batteryACharge > 0.001) ||
    (state.batteryBConnectedToBus && state.batteryBCharge > 0.001);

  return state.mainBusConnected && state.lightsMainOn && hasConnectedChargedBattery;
};

export const getElectricalLoadCurrentA = (state: ElectricalState, config: ElectricalConfig = DEFAULT_ELECTRICAL_CONFIG): number => {
  return state.mainBusConnected && state.lightsMainOn ? config.mainLightsDrawA : 0;
};

export const getSolarChargeCurrentA = (
  state: ElectricalState,
  solarEffectiveness: number,
  config: ElectricalConfig = DEFAULT_ELECTRICAL_CONFIG
): number => {
  if (!state.solarPanelsConnected) {
    return 0;
  }

  const normalizedEffectiveness = clamp(solarEffectiveness, 0, 1);
  if (normalizedEffectiveness <= 0) {
    return 0;
  }

  const availableSolarPowerW =
    config.solarArrayNominalVoltageV * config.solarArrayMaxCurrentA * config.solarMpptEfficiency * normalizedEffectiveness;
  return availableSolarPowerW / config.mainBusNominalVoltageV;
};

export const getElectricalTelemetry = (
  state: ElectricalState,
  hasBatterySupplyModule: boolean,
  solarEffectiveness: number,
  config: ElectricalConfig = DEFAULT_ELECTRICAL_CONFIG
): ElectricalTelemetry => {
  const activeBatteryCount = hasBatterySupplyModule ? getConnectedChargedBatteryCount(state) : 0;
  const loadCurrentA = getElectricalLoadCurrentA(state, config);
  const solarChargeCurrentA = hasBatterySupplyModule ? getSolarChargeCurrentA(state, solarEffectiveness, config) : 0;
  const dischargeCurrentA = activeBatteryCount > 0 ? loadCurrentA : 0;

  return {
    loadCurrentA,
    solarChargeCurrentA,
    netBatteryCurrentA: solarChargeCurrentA - dischargeCurrentA
  };
};

export const stepElectricalTick = (
  state: ElectricalState,
  input: ElectricalTickInput,
  config: ElectricalConfig = DEFAULT_ELECTRICAL_CONFIG
): ElectricalTickOutput => {
  const nextBatteryACharge = state.batteryACharge;
  const nextBatteryBCharge = state.batteryBCharge;

  let batteryACharge = nextBatteryACharge;
  let batteryBCharge = nextBatteryBCharge;

  const activeBatteryCount = input.hasBatterySupplyModule ? getConnectedChargedBatteryCount(state) : 0;

  const loadCurrentA = getElectricalLoadCurrentA(state, config);
  if (activeBatteryCount > 0 && loadCurrentA > 0) {
    const perBatteryDischargeCurrentA = loadCurrentA / activeBatteryCount;
    const perBatteryDrainPct = ((perBatteryDischargeCurrentA * input.tickSeconds) / (3600 * config.batteryBankCapacityAh)) * 100;
    if (state.batteryAConnectedToBus) {
      batteryACharge = clampPercent(batteryACharge - perBatteryDrainPct);
    }
    if (state.batteryBConnectedToBus) {
      batteryBCharge = clampPercent(batteryBCharge - perBatteryDrainPct);
    }
  }

  const solarChargeCurrentA = input.hasBatterySupplyModule ? getSolarChargeCurrentA(state, input.solarEffectiveness, config) : 0;
  if (solarChargeCurrentA > 0) {
    const perBatteryChargeCurrentA = solarChargeCurrentA / 2;
    const perBatteryChargePct = ((perBatteryChargeCurrentA * input.tickSeconds) / (3600 * config.batteryBankCapacityAh)) * 100;
    batteryACharge = clampPercent(batteryACharge + perBatteryChargePct);
    batteryBCharge = clampPercent(batteryBCharge + perBatteryChargePct);
  }

  const telemetry = getElectricalTelemetry(
    {
      ...state,
      batteryACharge,
      batteryBCharge
    },
    input.hasBatterySupplyModule,
    input.solarEffectiveness,
    config
  );

  return {
    batteryACharge,
    batteryBCharge,
    telemetry
  };
};
