import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ELECTRICAL_CONFIG,
  computeMainBusPowered,
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
  options: { hasBatterySupplyModule: boolean; solarEffectiveness: number }
): ElectricalState => {
  let current = { ...state };

  for (let i = 0; i < ticks; i += 1) {
    const next = stepElectricalTick(
      current,
      {
        tickSeconds: TICK_SECONDS,
        hasBatterySupplyModule: options.hasBatterySupplyModule,
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

    const final = runTicks(initial, 10, { hasBatterySupplyModule: true, solarEffectiveness: 0.36 });

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

    const final = runTicks(initial, 25 * 5, { hasBatterySupplyModule: true, solarEffectiveness: 0.36 });
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

    const final = runTicks(initial, 25 * 30, { hasBatterySupplyModule: true, solarEffectiveness: 0 });
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

    const final = runTicks(initial, 25 * 20, { hasBatterySupplyModule: false, solarEffectiveness: 1 });
    expect(final.batteryACharge).toBeCloseTo(initial.batteryACharge, 10);
    expect(final.batteryBCharge).toBeCloseTo(initial.batteryBCharge, 10);
  });

  it('clamps battery percentages to [0, 100]', () => {
    const drained = runTicks(
      baseState({ batteryACharge: 0.001, batteryBCharge: 0.001, solarPanelsConnected: false, lightsMainOn: true }),
      25 * 120,
      { hasBatterySupplyModule: true, solarEffectiveness: 0 }
    );
    expect(drained.batteryACharge).toBeGreaterThanOrEqual(0);
    expect(drained.batteryBCharge).toBeGreaterThanOrEqual(0);

    const charged = runTicks(
      baseState({ batteryACharge: 99.9, batteryBCharge: 99.9, solarPanelsConnected: true, lightsMainOn: false, mainBusConnected: false }),
      25 * 120,
      { hasBatterySupplyModule: true, solarEffectiveness: 1 }
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
});
