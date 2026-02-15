import {
  DEFAULT_ELECTRICAL_CONFIG,
  estimateBatteryRuntime,
  type ElectricalConfig,
  type ElectricalState
} from '../sim/electrical';

export type BatteryLiveValueKey =
  | 'main-bus-connect'
  | 'solar-connect'
  | 'battery-a-connect'
  | 'battery-b-connect'
  | 'lights-main'
  | 'battery-a-charge'
  | 'battery-b-charge'
  | 'solar-effectiveness'
  | 'solar-charge-current'
  | 'load-current'
  | 'net-battery-current'
  | 'battery-runtime';

export interface BatteryMenuStats {
  mainBusConnected: boolean;
  solarPanelsConnected: boolean;
  batteryAConnectedToBus: boolean;
  batteryBConnectedToBus: boolean;
  lightsMainOn: boolean;
  batteryACharge: number;
  batteryBCharge: number;
  solarEffectiveness: number;
  solarChargeCurrentA: number;
  loadCurrentA: number;
  netBatteryCurrentA: number;
  batterySupplyModuleCount: number;
  batteryRuntimeEstimate: string;
}

interface BatteryRuntimeEstimateLabelInput {
  batterySupplyModuleCount: number;
  solarEffectiveness: number;
  loadCurrentA: number;
  netBatteryCurrentA: number;
  state: ElectricalState;
  config?: ElectricalConfig;
}

export const formatBatteryPercent = (value: number): string => {
  if (value < 1) {
    return `${value.toFixed(2)}%`;
  }
  return `${value.toFixed(1)}%`;
};

const formatRuntimeDuration = (hours: number): string => {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '0m';
  }

  const totalMinutes = Math.max(1, Math.round(hours * 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hoursPart = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutesPart = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hoursPart}h`;
  }
  if (hoursPart > 0) {
    return `${hoursPart}h ${minutesPart}m`;
  }
  return `${minutesPart}m`;
};

export const buildBatteryRuntimeEstimateLabel = (input: BatteryRuntimeEstimateLabelInput): string => {
  if (input.batterySupplyModuleCount <= 0) {
    return 'N/A (no battery modules)';
  }

  const hasConnectedChargedBattery =
    (input.state.batteryAConnectedToBus && input.state.batteryACharge > 0.001) ||
    (input.state.batteryBConnectedToBus && input.state.batteryBCharge > 0.001);
  if (!hasConnectedChargedBattery) {
    return 'N/A (no connected charged battery)';
  }

  if (input.loadCurrentA <= 0) {
    return 'No active battery draw';
  }

  if (input.netBatteryCurrentA >= 0) {
    return 'Holding/charging at current solar input';
  }

  const estimate = estimateBatteryRuntime(
    input.state,
    {
      batterySupplyModuleCount: input.batterySupplyModuleCount,
      solarEffectiveness: input.solarEffectiveness
    },
    input.config ?? DEFAULT_ELECTRICAL_CONFIG
  );

  if (!estimate) {
    return 'Estimate unavailable';
  }

  if (estimate.stageSharedHours > 0 && estimate.stageTrailingHours > 0 && estimate.trailingBattery) {
    return `A+B ${formatRuntimeDuration(estimate.stageSharedHours)} then ${estimate.trailingBattery} +${formatRuntimeDuration(estimate.stageTrailingHours)} (total ${formatRuntimeDuration(estimate.totalHours)})`;
  }

  if (estimate.stageSharedHours > 0) {
    return `A+B ${formatRuntimeDuration(estimate.totalHours)}`;
  }

  if (estimate.trailingBattery) {
    return `${estimate.trailingBattery} ${formatRuntimeDuration(estimate.totalHours)}`;
  }

  return formatRuntimeDuration(estimate.totalHours);
};

export const serializeBatteryMenuStats = (stats: BatteryMenuStats): string => {
  return [
    Number(stats.mainBusConnected),
    Number(stats.solarPanelsConnected),
    Number(stats.batteryAConnectedToBus),
    Number(stats.batteryBConnectedToBus),
    Number(stats.lightsMainOn),
    stats.batteryACharge.toFixed(6),
    stats.batteryBCharge.toFixed(6),
    stats.solarEffectiveness.toFixed(6),
    stats.solarChargeCurrentA.toFixed(6),
    stats.loadCurrentA.toFixed(6),
    stats.netBatteryCurrentA.toFixed(6),
    String(stats.batterySupplyModuleCount),
    stats.batteryRuntimeEstimate
  ].join('|');
};

export const getBatteryMenuLiveValueText = (key: BatteryLiveValueKey, stats: BatteryMenuStats, config: ElectricalConfig): string => {
  if (key === 'main-bus-connect') return stats.mainBusConnected ? 'Connected' : 'Disconnected';
  if (key === 'solar-connect') return stats.solarPanelsConnected ? 'Connected' : 'Disconnected';
  if (key === 'battery-a-connect') return stats.batteryAConnectedToBus ? 'Connected' : 'Disconnected';
  if (key === 'battery-b-connect') return stats.batteryBConnectedToBus ? 'Connected' : 'Disconnected';
  if (key === 'lights-main') return stats.lightsMainOn ? 'On' : 'Off';
  if (key === 'battery-a-charge') return formatBatteryPercent(stats.batteryACharge);
  if (key === 'battery-b-charge') return formatBatteryPercent(stats.batteryBCharge);
  if (key === 'solar-effectiveness') return `${(stats.solarEffectiveness * 100).toFixed(0)}%`;
  if (key === 'solar-charge-current') {
    return `${stats.solarChargeCurrentA.toFixed(1)} A (${config.solarArrayNominalVoltageV} V array → ${config.mainBusNominalVoltageV} V bus)`;
  }
  if (key === 'load-current') return `${stats.loadCurrentA.toFixed(1)} A @ ${config.mainBusNominalVoltageV} V`;
  if (key === 'battery-runtime') return stats.batteryRuntimeEstimate;
  const netLabel = stats.netBatteryCurrentA >= 0 ? '+' : '';
  return `${netLabel}${stats.netBatteryCurrentA.toFixed(1)} A`;
};
