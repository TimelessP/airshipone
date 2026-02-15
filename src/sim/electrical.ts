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
  batterySupplyModuleCount: number;
  solarEffectiveness: number;
}

export interface ElectricalTickOutput {
  batteryACharge: number;
  batteryBCharge: number;
  telemetry: ElectricalTelemetry;
}

export interface BatteryRuntimeEstimate {
  netBatteryDrainCurrentA: number;
  totalHours: number;
  stageSharedHours: number;
  stageTrailingHours: number;
  trailingBattery: 'A' | 'B' | null;
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

export const estimateBatteryRuntime = (
  state: ElectricalState,
  input: { batterySupplyModuleCount: number; solarEffectiveness: number },
  config: ElectricalConfig = DEFAULT_ELECTRICAL_CONFIG
): BatteryRuntimeEstimate | null => {
  const batterySupplyModuleCount = Math.max(0, Math.floor(input.batterySupplyModuleCount));
  if (batterySupplyModuleCount <= 0) {
    return null;
  }

  const batteryCapacityAh = config.batteryBankCapacityAh * Math.max(1, batterySupplyModuleCount);
  const batteryAAvailableAh =
    state.batteryAConnectedToBus && state.batteryACharge > 0.001 ? (clampPercent(state.batteryACharge) / 100) * batteryCapacityAh : 0;
  const batteryBAvailableAh =
    state.batteryBConnectedToBus && state.batteryBCharge > 0.001 ? (clampPercent(state.batteryBCharge) / 100) * batteryCapacityAh : 0;

  if (batteryAAvailableAh <= 0 && batteryBAvailableAh <= 0) {
    return null;
  }

  const loadCurrentA = getElectricalLoadCurrentA(state, config);
  const solarChargeCurrentA = getSolarChargeCurrentA(state, input.solarEffectiveness, config);
  const netBatteryDrainCurrentA = loadCurrentA - solarChargeCurrentA;
  if (netBatteryDrainCurrentA <= 0) {
    return null;
  }

  if (batteryAAvailableAh > 0 && batteryBAvailableAh > 0) {
    const sharedDrainCurrentA = netBatteryDrainCurrentA / 2;
    const weakerAh = Math.min(batteryAAvailableAh, batteryBAvailableAh);
    const strongerAh = Math.max(batteryAAvailableAh, batteryBAvailableAh);
    const stageSharedHours = sharedDrainCurrentA > 0 ? weakerAh / sharedDrainCurrentA : 0;
    const stageTrailingHours = (strongerAh - weakerAh) / netBatteryDrainCurrentA;
    const trailingBattery = batteryAAvailableAh > batteryBAvailableAh ? 'A' : batteryBAvailableAh > batteryAAvailableAh ? 'B' : null;

    return {
      netBatteryDrainCurrentA,
      totalHours: stageSharedHours + stageTrailingHours,
      stageSharedHours,
      stageTrailingHours,
      trailingBattery
    };
  }

  const availableAh = batteryAAvailableAh > 0 ? batteryAAvailableAh : batteryBAvailableAh;
  const trailingBattery: 'A' | 'B' = batteryAAvailableAh > 0 ? 'A' : 'B';
  const hours = availableAh / netBatteryDrainCurrentA;

  return {
    netBatteryDrainCurrentA,
    totalHours: hours,
    stageSharedHours: 0,
    stageTrailingHours: hours,
    trailingBattery
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

  const batterySupplyModuleCount = Math.max(0, Math.floor(input.batterySupplyModuleCount));
  const hasBatterySupplyModule = batterySupplyModuleCount > 0;
  const effectiveBatteryBankCapacityAh = config.batteryBankCapacityAh * Math.max(1, batterySupplyModuleCount);
  const activeBatteryCount = hasBatterySupplyModule ? getConnectedChargedBatteryCount(state) : 0;

  const loadCurrentA = getElectricalLoadCurrentA(state, config);
  if (activeBatteryCount > 0 && loadCurrentA > 0) {
    const perBatteryDischargeCurrentA = loadCurrentA / activeBatteryCount;
    const perBatteryDrainPct = ((perBatteryDischargeCurrentA * input.tickSeconds) / (3600 * effectiveBatteryBankCapacityAh)) * 100;
    if (state.batteryAConnectedToBus) {
      batteryACharge = clampPercent(batteryACharge - perBatteryDrainPct);
    }
    if (state.batteryBConnectedToBus) {
      batteryBCharge = clampPercent(batteryBCharge - perBatteryDrainPct);
    }
  }

  const solarChargeCurrentA = hasBatterySupplyModule ? getSolarChargeCurrentA(state, input.solarEffectiveness, config) : 0;
  if (solarChargeCurrentA > 0) {
    const perBatteryChargeCurrentA = solarChargeCurrentA / 2;
    const perBatteryChargePct = ((perBatteryChargeCurrentA * input.tickSeconds) / (3600 * effectiveBatteryBankCapacityAh)) * 100;
    batteryACharge = clampPercent(batteryACharge + perBatteryChargePct);
    batteryBCharge = clampPercent(batteryBCharge + perBatteryChargePct);
  }

  const telemetry = getElectricalTelemetry(
    {
      ...state,
      batteryACharge,
      batteryBCharge
    },
    hasBatterySupplyModule,
    input.solarEffectiveness,
    config
  );

  return {
    batteryACharge,
    batteryBCharge,
    telemetry
  };
};
