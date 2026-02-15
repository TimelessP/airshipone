import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ELECTRICAL_CONFIG,
  computeMainBusPowered,
  estimateBatteryRuntime,
  getElectricalTelemetry,
  stepElectricalTick,
  type ElectricalState
} from '../src/sim/electrical';

const TICK_SECONDS = 1 / 25;

const baseState = (overrides: Partial<ElectricalState> = {}): ElectricalState => ({
  batteryACharge: 100,
  batteryBCharge: 100,
  batteryAConnectedToBus: true,
  batteryBConnectedToBus: true,
  solarPanelsConnected: false,
  mainBusConnected: true,
  lightsMainOn: true,
  ...overrides
});

const runTicks = (
  state: ElectricalState,
  ticks: number,
  options: { batterySupplyModuleCount: number; solarEffectiveness: number }
): ElectricalState => {
  let current = { ...state };

  for (let i = 0; i < ticks; i += 1) {
    const next = stepElectricalTick(
      current,
      {
        tickSeconds: TICK_SECONDS,
        batterySupplyModuleCount: options.batterySupplyModuleCount,
        solarEffectiveness: options.solarEffectiveness
      },
      DEFAULT_ELECTRICAL_CONFIG
    );

    current = {
      ...current,
      batteryACharge: next.batteryACharge,
      batteryBCharge: next.batteryBCharge
    };
  }

  return current;
};

describe('electrical simulation integration', () => {
  it('charges empty batteries when solar is connected and effectiveness is positive', () => {
    const initial = baseState({
      batteryACharge: 0,
      batteryBCharge: 0,
      solarPanelsConnected: true,
      lightsMainOn: false,
      mainBusConnected: false
    });

    const final = runTicks(initial, 10, { batterySupplyModuleCount: 1, solarEffectiveness: 0.36 });

    expect(final.batteryACharge).toBeGreaterThan(0);
    expect(final.batteryBCharge).toBeGreaterThan(0);
  });

  it('is net-positive with solar connected at 36% effectiveness under nominal lights load', () => {
    const initial = baseState({
      batteryACharge: 10,
      batteryBCharge: 10,
      solarPanelsConnected: true,
      mainBusConnected: true,
      lightsMainOn: true
    });

    const telemetry = getElectricalTelemetry(initial, true, 0.36, DEFAULT_ELECTRICAL_CONFIG);
    expect(telemetry.netBatteryCurrentA).toBeGreaterThan(0);

    const final = runTicks(initial, 25 * 5, { batterySupplyModuleCount: 1, solarEffectiveness: 0.36 });
    expect(final.batteryACharge).toBeGreaterThan(initial.batteryACharge);
    expect(final.batteryBCharge).toBeGreaterThan(initial.batteryBCharge);
  });

  it('depletes connected batteries when solar is disconnected and load is on', () => {
    const initial = baseState({
      batteryACharge: 80,
      batteryBCharge: 60,
      solarPanelsConnected: false,
      mainBusConnected: true,
      lightsMainOn: true
    });

    const final = runTicks(initial, 25 * 30, { batterySupplyModuleCount: 1, solarEffectiveness: 0 });
    expect(final.batteryACharge).toBeLessThan(initial.batteryACharge);
    expect(final.batteryBCharge).toBeLessThan(initial.batteryBCharge);
  });

  it('does not change battery state when no battery supply module exists', () => {
    const initial = baseState({
      batteryACharge: 25,
      batteryBCharge: 75,
      solarPanelsConnected: true,
      mainBusConnected: true,
      lightsMainOn: true
    });

    const final = runTicks(initial, 25 * 20, { batterySupplyModuleCount: 0, solarEffectiveness: 1 });
    expect(final.batteryACharge).toBeCloseTo(initial.batteryACharge, 10);
    expect(final.batteryBCharge).toBeCloseTo(initial.batteryBCharge, 10);
  });

  it('clamps battery percentages to [0, 100]', () => {
    const drained = runTicks(
      baseState({ batteryACharge: 0.001, batteryBCharge: 0.001, solarPanelsConnected: false, lightsMainOn: true }),
      25 * 120,
      { batterySupplyModuleCount: 1, solarEffectiveness: 0 }
    );
    expect(drained.batteryACharge).toBeGreaterThanOrEqual(0);
    expect(drained.batteryBCharge).toBeGreaterThanOrEqual(0);

    const charged = runTicks(
      baseState({ batteryACharge: 99.9, batteryBCharge: 99.9, solarPanelsConnected: true, lightsMainOn: false, mainBusConnected: false }),
      25 * 120,
      { batterySupplyModuleCount: 1, solarEffectiveness: 1 }
    );
    expect(charged.batteryACharge).toBeLessThanOrEqual(100);
    expect(charged.batteryBCharge).toBeLessThanOrEqual(100);
  });

  it('reports main bus power only when supply, switches, and charged battery are all present', () => {
    const poweredState = baseState({ batteryACharge: 50, batteryBCharge: 0, mainBusConnected: true, lightsMainOn: true });
    expect(computeMainBusPowered(poweredState, true)).toBe(true);

    expect(computeMainBusPowered(baseState({ batteryACharge: 0, batteryBCharge: 0 }), true)).toBe(false);
    expect(computeMainBusPowered(baseState({ batteryACharge: 50, mainBusConnected: false }), true)).toBe(false);
    expect(computeMainBusPowered(baseState({ batteryACharge: 50, lightsMainOn: false }), true)).toBe(false);
    expect(computeMainBusPowered(poweredState, false)).toBe(false);
  });

  it('scales depletion rate by battery module count', () => {
    const initial = baseState({
      batteryACharge: 100,
      batteryBCharge: 100,
      solarPanelsConnected: false,
      mainBusConnected: true,
      lightsMainOn: true
    });

    const oneModule = runTicks(initial, 25 * 60, { batterySupplyModuleCount: 1, solarEffectiveness: 0 });
    const twoModules = runTicks(initial, 25 * 60, { batterySupplyModuleCount: 2, solarEffectiveness: 0 });

    const oneModuleDrain = initial.batteryACharge - oneModule.batteryACharge;
    const twoModulesDrain = initial.batteryACharge - twoModules.batteryACharge;

    expect(twoModulesDrain).toBeGreaterThan(0);
    expect(twoModulesDrain).toBeLessThan(oneModuleDrain);
    expect(twoModulesDrain).toBeCloseTo(oneModuleDrain / 2, 2);
  });

  it('estimates staged runtime when both batteries are connected with different charge levels', () => {
    const estimate = estimateBatteryRuntime(
      baseState({
        batteryACharge: 20,
        batteryBCharge: 80,
        batteryAConnectedToBus: true,
        batteryBConnectedToBus: true,
        solarPanelsConnected: false,
        mainBusConnected: true,
        lightsMainOn: true
      }),
      {
        batterySupplyModuleCount: 1,
        solarEffectiveness: 0
      },
      DEFAULT_ELECTRICAL_CONFIG
    );

    expect(estimate).not.toBeNull();
    expect(estimate?.trailingBattery).toBe('B');
    expect(estimate?.stageSharedHours).toBeGreaterThan(0);
    expect(estimate?.stageTrailingHours).toBeGreaterThan(0);
    expect(estimate?.totalHours).toBeCloseTo(7.5, 5);
  });

  it('returns no runtime estimate when battery drain is neutral or charging', () => {
    const estimate = estimateBatteryRuntime(
      baseState({
        batteryACharge: 50,
        batteryBCharge: 50,
        solarPanelsConnected: true,
        mainBusConnected: true,
        lightsMainOn: true
      }),
      {
        batterySupplyModuleCount: 1,
        solarEffectiveness: 0.36
      },
      DEFAULT_ELECTRICAL_CONFIG
    );

    expect(estimate).toBeNull();
  });

  it('splits discharge across both connected charged batteries and scales by module count', () => {
    const initial = baseState({
      batteryACharge: 100,
      batteryBCharge: 100,
      batteryAConnectedToBus: true,
      batteryBConnectedToBus: true,
      solarPanelsConnected: false,
      mainBusConnected: true,
      lightsMainOn: true
    });

    const oneModuleTick = stepElectricalTick(
      initial,
      {
        tickSeconds: TICK_SECONDS,
        batterySupplyModuleCount: 1,
        solarEffectiveness: 0
      },
      DEFAULT_ELECTRICAL_CONFIG
    );

    const twoModuleTick = stepElectricalTick(
      initial,
      {
        tickSeconds: TICK_SECONDS,
        batterySupplyModuleCount: 2,
        solarEffectiveness: 0
      },
      DEFAULT_ELECTRICAL_CONFIG
    );

    const oneModuleDrainA = initial.batteryACharge - oneModuleTick.batteryACharge;
    const oneModuleDrainB = initial.batteryBCharge - oneModuleTick.batteryBCharge;
    const twoModuleDrainA = initial.batteryACharge - twoModuleTick.batteryACharge;

    expect(oneModuleDrainA).toBeCloseTo(oneModuleDrainB, 10);
    expect(oneModuleDrainA).toBeCloseTo(0.00007407407407407407, 12);
    expect(twoModuleDrainA).toBeCloseTo(oneModuleDrainA / 2, 12);
  });

  it('scales runtime estimate with battery module count when both buses are active', () => {
    const state = baseState({
      batteryACharge: 100,
      batteryBCharge: 100,
      batteryAConnectedToBus: true,
      batteryBConnectedToBus: true,
      solarPanelsConnected: false,
      mainBusConnected: true,
      lightsMainOn: true
    });

    const oneModuleEstimate = estimateBatteryRuntime(
      state,
      {
        batterySupplyModuleCount: 1,
        solarEffectiveness: 0
      },
      DEFAULT_ELECTRICAL_CONFIG
    );

    const twoModuleEstimate = estimateBatteryRuntime(
      state,
      {
        batterySupplyModuleCount: 2,
        solarEffectiveness: 0
      },
      DEFAULT_ELECTRICAL_CONFIG
    );

    expect(oneModuleEstimate).not.toBeNull();
    expect(twoModuleEstimate).not.toBeNull();
    expect(oneModuleEstimate?.stageSharedHours).toBeCloseTo(15, 10);
    expect(oneModuleEstimate?.stageTrailingHours).toBeCloseTo(0, 10);
    expect(twoModuleEstimate?.stageSharedHours).toBeCloseTo(30, 10);
    expect(twoModuleEstimate?.totalHours).toBeCloseTo((oneModuleEstimate?.totalHours ?? 0) * 2, 10);
  });
});
