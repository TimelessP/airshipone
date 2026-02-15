import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/intel-one-mono/latin-400.css';
import '@fontsource/intel-one-mono/latin-700.css';
import '@fontsource/patrick-hand/latin-400.css';
import * as THREE from 'three';
import './styles.css';
import {
  buildModuleChainFromIds,
  createModuleFromTemplateId,
  getInsertableModuleChoices,
  isBatterySupplyModuleId,
  isFixedModuleType
} from './modules/registry';
import type { GeneratedModule, ModuleBlock, ModuleVolume } from './modules/types';
import { registerServiceWorker } from './pwa/register-sw';
import {
  DEFAULT_ELECTRICAL_CONFIG,
  computeMainBusPowered as computeMainBusPoweredForState,
  getElectricalTelemetry as getElectricalTelemetryForState,
  stepElectricalTick
} from './sim/electrical';

type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';
type Quality = 'low' | 'medium' | 'high';
type MenuName =
  | 'mainMenu'
  | 'settingsMenu'
  | 'graphicsMenu'
  | 'audioMenu'
  | 'controlsMenu'
  | 'advancedMenu'
  | 'aboutMenu'
  | 'insertModuleMenu'
  | 'captainsLetterMenu'
  | 'batteryControlMenu';
type MenuBehavior = 'submenu' | 'back' | 'close' | 'keep-open' | 'action';
type ControlAction = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back' | 'pause';

interface GraphicsSettings {
  pixelScale: number;
  showScanlines: boolean;
  quality: Quality;
}

interface AudioSettings {
  masterVolume: number;
  uiVolume: number;
  muted: boolean;
}

interface AdvancedSettings {
  autosaveSeconds: number;
  diagnostics: boolean;
}

interface GamepadButtonBinding {
  type: 'button';
  btn: number;
}

interface GamepadAxisBinding {
  type: 'axis';
  axis: number;
  dir: -1 | 1;
}

type ControlBinding = string | GamepadButtonBinding | GamepadAxisBinding | null;
type DualBinding = [ControlBinding, ControlBinding];
type ControlMap = Record<ControlAction, DualBinding>;

interface ControlsSettings {
  bindings: ControlMap;
  invertMouseY: boolean;
}

interface GameSettings {
  themeMode: ThemeMode;
  graphics: GraphicsSettings;
  audio: AudioSettings;
  controls: ControlsSettings;
  advanced: AdvancedSettings;
}

interface SimulationState {
  running: boolean;
  tick: number;
  heading: number;
  altitude: number;
  fuel: number;
  batteryACharge: number;
  batteryBCharge: number;
  batteryAConnectedToBus: boolean;
  batteryBConnectedToBus: boolean;
  solarPanelsConnected: boolean;
  mainBusConnected: boolean;
  lightsMainOn: boolean;
  mainBusPowered: boolean;
  playerPositionX: number;
  playerPositionY: number;
  playerPositionZ: number;
  playerYaw: number;
  playerPitch: number;
  playerLatitudeDeg: number;
  playerLongitudeDeg: number;
  planetRotationDeg: number;
  planetOrbitalAngleDeg: number;
  planetDistanceAu: number;
  planetAxialTiltDeg: number;
  updatedAt: number;
  moduleIds: string[];
  ladderLevelOffsets: number[];
  floorModuleIdsByLevel?: Record<string, string[]>;
}

type SimulationEvent =
  | { type: 'battery/toggle-a-bus' }
  | { type: 'battery/toggle-b-bus' }
  | { type: 'power/toggle-solar-connect' }
  | { type: 'power/toggle-main-bus-connect' }
  | { type: 'battery/toggle-lights-main' }
  | { type: 'ui/battery-menu-stats'; stats: BatteryMenuStats }
  | { type: 'power/main-bus-changed'; powered: boolean };

type LiveValueBindingKey =
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
  | 'net-battery-current';

interface BatteryMenuStats {
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
}

interface SaveEnvelope {
  v: 1;
  app: 'airshipone';
  savedAt: string;
  version: string;
  settings: GameSettings;
  simulation: SimulationState;
}

interface MenuStackEntry {
  menuName: MenuName;
}

interface MenuDefinition {
  isRoot: boolean;
  title: string;
  overview: string;
  itemBuilder?: () => MenuItem[];
  actions?: MenuAction[];
}

interface MenuAction {
  label: string;
  behavior: Exclude<MenuBehavior, 'action'>;
  target?: MenuName;
  onSelect?: () => void;
  danger?: boolean;
}

interface ActionMenuItem {
  type: 'action';
  label: string;
  behavior: MenuBehavior;
  target?: MenuName;
  value?: string;
  disabled?: boolean;
  onSelect?: () => void;
  danger?: boolean;
}

interface SettingAction {
  label: string;
  behavior: 'keep-open';
  onSelect: () => void;
}

interface SettingMenuItem {
  type: 'setting';
  label: string;
  value: string;
  liveValueKey?: LiveValueBindingKey;
  actions: SettingAction[];
}

interface ControlMenuItem {
  type: 'control';
  action: ControlAction;
  label: string;
  primary: ControlBinding;
  secondary: ControlBinding;
}

interface TextMenuItem {
  type: 'text';
  label: string;
  value: string;
  liveValueKey?: LiveValueBindingKey;
  href?: string;
}

interface ImageLinkMenuItem {
  type: 'image-link';
  label: string;
  src: string;
  href: string;
  alt: string;
}

interface LetterMenuItem {
  type: 'letter';
  from: string;
  to: string;
  subject: string;
  dateUtc: string;
  paragraphs: string[];
}

interface DividerMenuItem {
  type: 'divider';
}

type MenuItem = ActionMenuItem | SettingMenuItem | ControlMenuItem | TextMenuItem | ImageLinkMenuItem | LetterMenuItem | DividerMenuItem;

interface ControlsListeningState {
  action: ControlAction;
  slot: 0 | 1;
  element: HTMLButtonElement;
  baseline?: {
    buttons: boolean[];
    axes: number[];
  };
  gamepadPollId: number | null;
  ignoreKeyCode: string | null;
  ignoreKeyUntil: number;
}

type ActionState = Record<ControlAction, boolean>;

const app = document.getElementById('app');
if (!app) {
  throw new Error('App root not found');
}

const STORAGE_KEY = 'airshipone-save-v1';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';
const modeCycle: ThemeMode[] = ['system', 'light', 'dark'];
const CONTROL_ACTIONS: readonly ControlAction[] = ['left', 'right', 'up', 'down', 'confirm', 'back', 'pause'];
const CONTROL_LABELS: Record<ControlAction, string> = {
  left: 'Move Left',
  right: 'Move Right',
  up: 'Move Up',
  down: 'Move Down',
  confirm: 'Confirm / Interact',
  back: 'Back / Cancel',
  pause: 'Pause / Menu'
};

const defaultControls = (): ControlMap => ({
  left: ['KeyA', { type: 'axis', axis: 0, dir: -1 }],
  right: ['KeyD', { type: 'axis', axis: 0, dir: 1 }],
  up: ['KeyW', { type: 'axis', axis: 1, dir: -1 }],
  down: ['KeyS', { type: 'axis', axis: 1, dir: 1 }],
  confirm: ['Enter', { type: 'button', btn: 0 }],
  back: ['Escape', { type: 'button', btn: 1 }],
  pause: ['KeyP', { type: 'button', btn: 9 }]
});

const defaultSettings = (): GameSettings => ({
  themeMode: 'system',
  graphics: {
    pixelScale: 1,
    showScanlines: false,
    quality: 'medium'
  },
  audio: {
    masterVolume: 80,
    uiVolume: 70,
    muted: false
  },
  controls: {
    bindings: defaultControls(),
    invertMouseY: false
  },
  advanced: {
    autosaveSeconds: 10,
    diagnostics: false
  }
});

const defaultSimulation = (): SimulationState => ({
  running: false,
  tick: 0,
  heading: 0,
  altitude: 2200,
  fuel: 100,
  batteryACharge: 100,
  batteryBCharge: 100,
  batteryAConnectedToBus: true,
  batteryBConnectedToBus: true,
  solarPanelsConnected: false,
  mainBusConnected: true,
  lightsMainOn: true,
  mainBusPowered: false,
  playerPositionX: 0,
  playerPositionY: 1.68,
  playerPositionZ: 0,
  playerYaw: 0,
  playerPitch: 0,
  playerLatitudeDeg: 51.4779,
  playerLongitudeDeg: 0,
  planetRotationDeg: 0,
  planetOrbitalAngleDeg: 0,
  planetDistanceAu: 1,
  planetAxialTiltDeg: 23.44,
  updatedAt: Date.now(),
  moduleIds: ['cockpit_mk1', 'captains_cabin_mk1', 'radio_room_mk1', 'cargo_mk1'],
  ladderLevelOffsets: [],
  floorModuleIdsByLevel: {
    '0': ['captains_cabin_mk1', 'radio_room_mk1']
  }
});

const cloneBinding = (binding: ControlBinding): ControlBinding => {
  if (!binding || typeof binding === 'string') {
    return binding;
  }
  return { ...binding };
};

const cloneControls = (value: ControlMap): ControlMap => {
  const clone = {} as ControlMap;
  CONTROL_ACTIONS.forEach((action) => {
    const binding = value[action];
    clone[action] = [cloneBinding(binding[0]), cloneBinding(binding[1])];
  });
  return clone;
};

let appVersion = 'dev';
const loadVersion = async () => {
  const versionUrl = new URL(`${import.meta.env.BASE_URL}version.js`, window.location.href).toString();
  const response = await fetch(versionUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${versionUrl} (${response.status})`);
  }
  const source = await response.text();
  const match = source.match(/APP_VERSION\s*=\s*['\"]([^'\"]+)['\"]/);
  if (!match || typeof match[1] !== 'string' || match[1].length === 0) {
    throw new Error(`Failed to parse APP_VERSION from ${versionUrl}`);
  }
  appVersion = match[1];
};

const parseSave = (raw: string | null): SaveEnvelope | null => {
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw) as Partial<SaveEnvelope>;
  if (parsed.app !== 'airshipone' || parsed.v !== 1) {
    throw new Error('Unsupported save envelope format in localStorage');
  }
  if (!parsed.settings || !parsed.simulation) {
    throw new Error('Invalid save envelope: missing settings or simulation');
  }
  return parsed as SaveEnvelope;
};

const hasSavedGame = (): boolean => parseSave(window.localStorage.getItem(STORAGE_KEY)) !== null;

let settings = defaultSettings();
let simulation = defaultSimulation();
const simulationEventQueue: SimulationEvent[] = [];
const SIM_TICK_HZ = 25;
const SIM_TICK_SECONDS = 1 / SIM_TICK_HZ;
const SIM_MAX_CATCHUP_STEPS = 5;
let simAccumulatorSeconds = 0;

const ELECTRICAL_CONFIG = DEFAULT_ELECTRICAL_CONFIG;

const formatBatteryPercent = (value: number): string => {
  if (value < 1) {
    return `${value.toFixed(2)}%`;
  }
  return `${value.toFixed(1)}%`;
};

const enqueueSimulationEvent = (event: SimulationEvent) => {
  simulationEventQueue.push(event);
};

const getBatteryMenuStatsSnapshot = (): BatteryMenuStats => ({
  ...getElectricalTelemetry(simulation.updatedAt || Date.now()),
  mainBusConnected: simulation.mainBusConnected,
  solarPanelsConnected: simulation.solarPanelsConnected,
  batteryAConnectedToBus: simulation.batteryAConnectedToBus,
  batteryBConnectedToBus: simulation.batteryBConnectedToBus,
  lightsMainOn: simulation.lightsMainOn,
  batteryACharge: simulation.batteryACharge,
  batteryBCharge: simulation.batteryBCharge
});

const serializeBatteryMenuStats = (stats: BatteryMenuStats): string => {
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
    stats.netBatteryCurrentA.toFixed(6)
  ].join('|');
};

let lastBatteryMenuStatsSignature = '';

const enqueueBatteryMenuStatsIfChanged = () => {
  const stats = getBatteryMenuStatsSnapshot();
  const signature = serializeBatteryMenuStats(stats);
  if (signature === lastBatteryMenuStatsSignature) {
    return;
  }
  lastBatteryMenuStatsSignature = signature;
  enqueueSimulationEvent({ type: 'ui/battery-menu-stats', stats });
};

const setMainBusPowered = (powered: boolean) => {
  simulation.mainBusPowered = powered;
  applyModuleLightingState(powered);
};

const syncMainBusPowerState = () => {
  setMainBusPowered(computeMainBusPowered());
};

const drainSimulationEvents = () => {
  while (simulationEventQueue.length > 0) {
    const event = simulationEventQueue.shift();
    if (event) {
      applySimulationEvent(event);
    }
  }
};

const reconcileMainBusPowerEdge = () => {
  const nextMainBusPowered = computeMainBusPowered();
  if (nextMainBusPowered !== simulation.mainBusPowered) {
    enqueueSimulationEvent({ type: 'power/main-bus-changed', powered: nextMainBusPowered });
  }
};

const applySimulationEvent = (event: SimulationEvent) => {
  if (event.type === 'ui/battery-menu-stats') {
    applyBatteryMenuStatsToLiveBindings(event.stats);
    return;
  }

  if (event.type === 'battery/toggle-a-bus') {
    simulation.batteryAConnectedToBus = !simulation.batteryAConnectedToBus;
    enqueueBatteryMenuStatsIfChanged();
    return;
  }
  if (event.type === 'battery/toggle-b-bus') {
    simulation.batteryBConnectedToBus = !simulation.batteryBConnectedToBus;
    enqueueBatteryMenuStatsIfChanged();
    return;
  }
  if (event.type === 'power/toggle-solar-connect') {
    simulation.solarPanelsConnected = !simulation.solarPanelsConnected;
    enqueueBatteryMenuStatsIfChanged();
    return;
  }
  if (event.type === 'power/toggle-main-bus-connect') {
    simulation.mainBusConnected = !simulation.mainBusConnected;
    enqueueBatteryMenuStatsIfChanged();
    return;
  }
  if (event.type === 'battery/toggle-lights-main') {
    simulation.lightsMainOn = !simulation.lightsMainOn;
    enqueueBatteryMenuStatsIfChanged();
    return;
  }
  setMainBusPowered(event.powered);
};

const stepSimulationTick = (nowMs: number) => {
  const utcNowMs = Date.now();
  simulation.tick += 1;
  simulation.heading = (simulation.heading + SIM_TICK_SECONDS * 12) % 360;
  simulation.altitude = 2200 + Math.sin(nowMs * 0.0005) * 120;
  simulation.fuel = Math.max(0, simulation.fuel - SIM_TICK_SECONDS * 0.08);

  const levels = normalizeLevelOrder(ladderLevelOffsets.length > 0 ? ladderLevelOffsets : [0]);
  const hasBatterySupplyModule = levels.some((levelOffset) => {
    return getModuleChainForLevel(levelOffset).some((moduleDoc) => isBatterySupplyModuleId(moduleDoc.id));
  });
  const nextElectricalState = stepElectricalTick(
    {
      batteryACharge: simulation.batteryACharge,
      batteryBCharge: simulation.batteryBCharge,
      batteryAConnectedToBus: simulation.batteryAConnectedToBus,
      batteryBConnectedToBus: simulation.batteryBConnectedToBus,
      solarPanelsConnected: simulation.solarPanelsConnected,
      mainBusConnected: simulation.mainBusConnected,
      lightsMainOn: simulation.lightsMainOn
    },
    {
      tickSeconds: SIM_TICK_SECONDS,
      hasBatterySupplyModule,
      solarEffectiveness: hasBatterySupplyModule ? getSolarChargeEffectiveness(utcNowMs) : 0
    },
    ELECTRICAL_CONFIG
  );

  simulation.batteryACharge = nextElectricalState.batteryACharge;
  simulation.batteryBCharge = nextElectricalState.batteryBCharge;
  simulation.updatedAt = utcNowMs;

  enqueueBatteryMenuStatsIfChanged();
};

const loadLocalState = () => {
  const parsed = parseSave(window.localStorage.getItem(STORAGE_KEY));
  if (!parsed) {
    return;
  }

  settings = {
    ...defaultSettings(),
    ...parsed.settings,
    graphics: {
      ...defaultSettings().graphics,
      ...parsed.settings.graphics
    },
    audio: {
      ...defaultSettings().audio,
      ...parsed.settings.audio
    },
    advanced: {
      ...defaultSettings().advanced,
      ...parsed.settings.advanced
    },
    controls: {
      bindings: cloneControls(parsed.settings.controls?.bindings ?? defaultControls()),
      invertMouseY: parsed.settings.controls?.invertMouseY ?? defaultSettings().controls.invertMouseY
    }
  };

  simulation = {
    ...defaultSimulation(),
    ...parsed.simulation
  };
  syncMainBusPowerState();
};

const getSaveEnvelope = (): SaveEnvelope => ({
  v: 1,
  app: 'airshipone',
  savedAt: new Date().toISOString(),
  version: appVersion,
  settings: {
    ...settings,
    controls: {
      bindings: cloneControls(settings.controls.bindings),
      invertMouseY: settings.controls.invertMouseY
    }
  },
  simulation: {
    ...simulation,
    playerPositionX: playerPosition.x,
    playerPositionY: playerPosition.y,
    playerPositionZ: playerPosition.z,
    playerYaw,
    playerPitch
  }
});

const saveLocalState = () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getSaveEnvelope()));
};

const gameSquare = document.createElement('div');
gameSquare.className = 'game-square';
app.appendChild(gameSquare);

const uiLayer = document.createElement('div');
uiLayer.className = 'ui-layer';
gameSquare.appendChild(uiLayer);

const topBar = document.createElement('header');
topBar.className = 'top-bar ui-panel';

const menuToggleButton = document.createElement('button');
menuToggleButton.className = 'pixel-button top-icon-button';
menuToggleButton.type = 'button';
menuToggleButton.setAttribute('aria-label', 'Toggle Pause Menu');
menuToggleButton.innerHTML =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';
topBar.appendChild(menuToggleButton);

const topBarTitle = document.createElement('h1');
topBarTitle.className = 'top-bar-title';
topBarTitle.textContent = 'Airship One';
topBar.appendChild(topBarTitle);

const themeButton = document.createElement('button');
themeButton.className = 'pixel-button top-icon-button top-theme-button';
themeButton.type = 'button';
themeButton.setAttribute('aria-label', 'Theme mode');
topBar.appendChild(themeButton);

uiLayer.appendChild(topBar);

const importInput = document.createElement('input');
importInput.type = 'file';
importInput.accept = '.json,application/json';
importInput.className = 'menu-hidden-input';
uiLayer.appendChild(importInput);

const menuPanel = document.createElement('section');
menuPanel.className = 'menu-panel ui-panel';
menuPanel.setAttribute('aria-live', 'polite');
menuPanel.setAttribute('aria-label', 'Main Menu');
uiLayer.appendChild(menuPanel);

const menuHeader = document.createElement('header');
menuHeader.className = 'menu-header';
menuPanel.appendChild(menuHeader);

const menuTitle = document.createElement('h2');
menuTitle.className = 'menu-title';
menuHeader.appendChild(menuTitle);

const menuOverview = document.createElement('p');
menuOverview.className = 'menu-overview';
menuHeader.appendChild(menuOverview);

const menuItems = document.createElement('div');
menuItems.className = 'menu-items';
menuPanel.appendChild(menuItems);

const menuActions = document.createElement('div');
menuActions.className = 'menu-actions';
menuPanel.appendChild(menuActions);

const menuToast = document.createElement('div');
menuToast.className = 'menu-toast';
menuToast.setAttribute('role', 'status');
uiLayer.appendChild(menuToast);

const clickReticle = document.createElement('div');
clickReticle.className = 'click-reticle';
clickReticle.dataset.visible = 'false';
uiLayer.appendChild(clickReticle);

const canvasWrap = document.createElement('div');
canvasWrap.className = 'canvas-wrap';
gameSquare.appendChild(canvasWrap);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(320, 320, false);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasWrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111822);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
camera.position.set(0, 2.9, 8.4);
camera.lookAt(0, 1.2, 0);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.set(3, 2, 4);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1536, 1536);
sunLight.shadow.radius = 1.6;
sunLight.shadow.bias = -0.0002;
sunLight.shadow.normalBias = 0.02;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 120;
sunLight.shadow.camera.left = -10;
sunLight.shadow.camera.right = 10;
sunLight.shadow.camera.top = 8;
sunLight.shadow.camera.bottom = -8;
const sunTarget = new THREE.Object3D();
sunTarget.position.set(0, 0, 0);
sunLight.target = sunTarget;
scene.add(sunLight);
scene.add(sunTarget);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeLongitudeDeg = (longitudeDeg: number): number => ((longitudeDeg + 180) % 360 + 360) % 360 - 180;

const getUtcDayOfYear = (date: Date): number => {
  const year = date.getUTCFullYear();
  const startOfYearUtc = Date.UTC(year, 0, 1);
  const startOfTodayUtc = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());
  return Math.floor((startOfTodayUtc - startOfYearUtc) / 86400000) + 1;
};

const calculateSubsolarPoint = (dateUtc: Date): { latitudeDeg: number, longitudeDeg: number } => {
  const utcHours =
    dateUtc.getUTCHours() +
    dateUtc.getUTCMinutes() / 60 +
    dateUtc.getUTCSeconds() / 3600 +
    dateUtc.getUTCMilliseconds() / 3600000;
  const subsolarLongitudeDeg = normalizeLongitudeDeg(-15 * (utcHours - 12) + simulation.planetRotationDeg);

  const dayOfYear = getUtcDayOfYear(dateUtc);
  const seasonalAngleRad =
    ((dayOfYear - 172) * (2 * Math.PI / 365.25)) +
    simulation.planetOrbitalAngleDeg * DEG_TO_RAD;
  const subsolarLatitudeDeg = simulation.planetAxialTiltDeg * Math.cos(seasonalAngleRad);

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
): { elevationDeg: number, azimuthDeg: number } => {
  const obsLatRad = observerLatitudeDeg * DEG_TO_RAD;
  const obsLonRad = observerLongitudeDeg * DEG_TO_RAD;
  const sunLatRad = subsolarLatitudeDeg * DEG_TO_RAD;
  const sunLonRad = subsolarLongitudeDeg * DEG_TO_RAD;

  const deltaLonRad = sunLonRad - obsLonRad;

  const sinElevation =
    Math.sin(obsLatRad) * Math.sin(sunLatRad) +
    Math.cos(obsLatRad) * Math.cos(sunLatRad) * Math.cos(deltaLonRad);
  const elevationDeg = Math.asin(clampNumber(sinElevation, -1, 1)) * RAD_TO_DEG;

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

const updateGlobalLightingFromUtc = (utcMs: number) => {
  const utcNow = new Date(utcMs);
  const observerLatitudeDeg = clampNumber(simulation.playerLatitudeDeg, -90, 90);
  const observerLongitudeDeg = normalizeLongitudeDeg(simulation.playerLongitudeDeg);
  const { latitudeDeg: subsolarLat, longitudeDeg: subsolarLon } = calculateSubsolarPoint(utcNow);
  const { elevationDeg, azimuthDeg } = calculateSunElevationAzimuth(
    observerLatitudeDeg,
    observerLongitudeDeg,
    subsolarLat,
    subsolarLon
  );

  const elevationRad = elevationDeg * DEG_TO_RAD;
  const azimuthRad = azimuthDeg * DEG_TO_RAD;

  const sunDirection = new THREE.Vector3(
    Math.sin(azimuthRad) * Math.cos(elevationRad),
    Math.sin(elevationRad),
    -Math.cos(azimuthRad) * Math.cos(elevationRad)
  ).normalize();

  const interiorCenterX = (interiorMinX + interiorMaxX) * 0.5;
  const interiorCenterZ = (interiorMinZ + interiorMaxZ) * 0.5;
  const shadowTarget = new THREE.Vector3(interiorCenterX, playerPosition.y - playerEyeHeightM + 1.15, interiorCenterZ);
  const distanceScale = 40;
  sunTarget.position.copy(shadowTarget);
  sunLight.position.copy(shadowTarget).addScaledVector(sunDirection, distanceScale);

  const cameraToFloorDistance = Math.max(1, Math.abs(camera.position.y - shadowTarget.y));
  const viewHalfHeightAtFloor = Math.tan((camera.fov * DEG_TO_RAD) / 2) * cameraToFloorDistance;
  const viewHalfWidthAtFloor = viewHalfHeightAtFloor * Math.max(1, camera.aspect);
  const interiorHalfWidth = Math.max(2.5, (interiorMaxX - interiorMinX) * 0.5 + 1.8);
  const interiorHalfDepth = Math.max(4.5, (interiorMaxZ - interiorMinZ) * 0.5 + 2.4);
  const interiorRadius = Math.hypot(interiorHalfWidth, interiorHalfDepth);
  const visibleRadius = Math.hypot(viewHalfWidthAtFloor + 6.0, viewHalfHeightAtFloor + 14.0);
  const shadowRadius = Math.max(interiorRadius, visibleRadius);
  sunLight.shadow.camera.left = -shadowRadius;
  sunLight.shadow.camera.right = shadowRadius;
  sunLight.shadow.camera.top = shadowRadius;
  sunLight.shadow.camera.bottom = -shadowRadius;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = Math.max(180, distanceScale + (shadowRadius * 2.4));
  sunLight.shadow.camera.updateProjectionMatrix();

  const distanceFactor = 1 / Math.max(0.25, simulation.planetDistanceAu) ** 2;
  const sunAboveFactor = clampNumber(Math.sin(Math.max(0, elevationRad)), 0, 1);
  const belowHorizonTaper = elevationDeg >= 0
    ? 1
    : clampNumber(1 - ((-elevationDeg) / 4.5), 0, 1);
  const twilightTail = elevationDeg < 0 ? 0.06 * belowHorizonTaper : 0;
  const directSunFactor = (sunAboveFactor * belowHorizonTaper) + twilightTail;
  sunLight.intensity = distanceFactor * directSunFactor * 2.45;
  ambientLight.intensity = distanceFactor * (0.03 + directSunFactor * 0.31);
  sunLight.castShadow = directSunFactor > 0.015;

  const warmFactor = clampNumber((9 - elevationDeg) / 14, 0, 1);
  sunLight.color.setRGB(1, 1 - warmFactor * 0.28, 1 - warmFactor * 0.58);
  ambientLight.color.setRGB(
    0.60 + directSunFactor * 0.36,
    0.63 + directSunFactor * 0.34,
    0.72 + directSunFactor * 0.24
  );
};

const tileImages = import.meta.glob('../assets/textures/tiles/*.png', {
  eager: true,
  import: 'default'
}) as Record<string, string>;

const tilePathById = new Map<string, string>();
for (const [filePath, url] of Object.entries(tileImages)) {
  const name = filePath.split('/').at(-1);
  if (!name) {
    continue;
  }
  const tileId = name.replace(/\.png$/i, '');
  tilePathById.set(tileId, url);
}

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
let texturesPreloadPromise: Promise<void> | null = null;

const configureTexture = (texture: THREE.Texture) => {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
};

const preloadTileTextures = (): Promise<void> => {
  if (texturesPreloadPromise) {
    return texturesPreloadPromise;
  }

  texturesPreloadPromise = Promise.all(
    Array.from(tilePathById.entries()).map(async ([tileId, texturePath]) => {
      if (textureCache.has(tileId)) {
        return;
      }

      const texture = await textureLoader.loadAsync(texturePath);
      configureTexture(texture);
      textureCache.set(tileId, texture);
    })
  ).then(() => undefined);

  return texturesPreloadPromise;
};

const getTexture = (tileId: string): THREE.Texture | null => {
  const cached = textureCache.get(tileId);
  if (cached) {
    return cached;
  }

  const texturePath = tilePathById.get(tileId);
  if (!texturePath) {
    return null;
  }

  const texture = textureLoader.load(texturePath);
  configureTexture(texture);
  textureCache.set(tileId, texture);
  return texture;
};

const roleColor = (role: string): number => {
  if (role.includes('ceiling-light')) return 0xfff8d6;
  if (role.includes('window')) return 0x9fc8d8;
  if (role.includes('floor')) return 0x7f5f48;
  if (role.includes('ceiling')) return 0xd0c3ae;
  if (role.includes('inner-wall')) return 0x8f887f;
  if (role.includes('outer-wall')) return 0x71767a;
  return 0x8a7e71;
};

const getVector3 = (values: number[], label: string): [number, number, number] => {
  const [x, y, z] = values;
  if (x === undefined || y === undefined || z === undefined) {
    throw new Error(`Invalid module ${label}; expected 3 numeric values`);
  }
  return [x, y, z];
};

const getMaterial = (block: ModuleBlock): THREE.MeshStandardMaterial => {
  let repeatX = 1;
  let repeatY = 1;
  let repeatKey = 'base';
  if (block.material.uvMode === 'repeat' && block.primitive === 'box') {
    const [sizeX, sizeY, sizeZ] = getVector3(block.size, `block size (${block.id})`);
    // Pick repeat pair for the dominant visible face (the one
    // perpendicular to the thinnest axis) so texels stay square.
    //  Thin in X (side walls, window strips):  ±X face → repeat(sizeZ, sizeY)
    //  Thin in Z (bulkheads, front walls):     ±Z face → repeat(sizeX, sizeY)
    //  Thin in Y (floors, desk tops):          ±Y face → repeat(sizeX, sizeZ)
    if (sizeX <= sizeY && sizeX <= sizeZ) {
      repeatX = Math.max(0.01, sizeZ);
      repeatY = Math.max(0.01, sizeY);
    } else if (sizeZ <= sizeX && sizeZ <= sizeY) {
      repeatX = Math.max(0.01, sizeX);
      repeatY = Math.max(0.01, sizeY);
    } else {
      repeatX = Math.max(0.01, sizeX);
      repeatY = Math.max(0.01, sizeZ);
    }
    repeatKey = `${repeatX.toFixed(3)}x${repeatY.toFixed(3)}`;
  }

  const key = `${block.material.tileId}|${block.role}|${repeatKey}`;
  const cached = materialCache.get(key);
  if (cached) {
    return cached;
  }

  const texture = getTexture(block.material.tileId);
  const isWindow = block.role.includes('window');
  const isCeilingLight = block.role.includes('ceiling-light');
  const params: THREE.MeshStandardMaterialParameters = {
    color: roleColor(block.role),
    alphaTest: isWindow ? 0.08 : 0,
    metalness: 0,
    roughness: 1,
    transparent: isWindow,
    opacity: 1,
    depthWrite: !isWindow,
    emissiveIntensity: isCeilingLight ? 1.5 : 0
  };

  if (texture) {
    const texturedMap = repeatKey === 'base'
      ? texture
      : (() => {
        const cloned = texture.clone();
        cloned.repeat.set(repeatX, repeatY);
        return cloned;
      })();

    params.map = texturedMap;
    if (isWindow) {
      params.alphaMap = texturedMap;
    }
  }

  if (isCeilingLight) {
    params.emissive = new THREE.Color(0xfff6b8);
  }

  const material = new THREE.MeshStandardMaterial(params);

  materialCache.set(key, material);
  return material;
};

const createModuleMesh = (moduleDoc: GeneratedModule): THREE.Group => {
  const group = new THREE.Group();
  group.name = moduleDoc.id;

  for (const block of moduleDoc.geometry.blocks) {
    const [centerX, centerY, centerZ] = getVector3(block.center, `block center (${moduleDoc.id}:${block.id})`);
    const geometry = block.primitive === 'box'
      ? (() => {
        const [sizeX, sizeY, sizeZ] = getVector3(block.size, `block size (${moduleDoc.id}:${block.id})`);
        return new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
      })()
      : new THREE.CylinderGeometry(block.radiusTop, block.radiusBottom, block.height, block.radialSegments);
    const material = getMaterial(block);
    const mesh = new THREE.Mesh(geometry, material);
    const isWindow = block.role.includes('window');
    mesh.receiveShadow = !isWindow;
    mesh.castShadow = !isWindow;
    mesh.name = `${moduleDoc.id}:${block.id}`;
    if (block.role === 'furniture-paper-a4') {
      mesh.userData.interactionKind = 'captains-letter-paper';
    }
    if (block.role === 'furniture-battery-control-panel') {
      mesh.userData.interactionKind = 'battery-control-panel';
    }
    if (block.role === 'ceiling-light') {
      mesh.userData.ceilingLightEmitter = true;
      if (material instanceof THREE.MeshStandardMaterial) {
        ceilingLightEmitterMaterials.add(material);
      }
    }
    mesh.position.set(centerX, centerY, centerZ);
    group.add(mesh);

    if (block.role === 'ceiling-light') {
      const light = new THREE.PointLight(0xfff5c2, 1.35, 5.2, 1.1);
      light.position.set(centerX, centerY - 0.06, centerZ);
      light.userData.baseIntensity = 1.35;
      light.castShadow = false;
      group.add(light);
    }
  }

  return group;
};

interface JoinControlTarget {
  object: THREE.Object3D;
  kind:
    | 'insert'
    | 'remove-left'
    | 'remove-right'
    | 'ladder-add-above'
    | 'ladder-add-below'
    | 'ladder-remove-above'
    | 'ladder-remove-below';
  joinIndex: number;
  moduleIndex?: number;
  levelOffset?: number;
}

const createJoinControlSprite = (label: '+' | '-', background: string): THREE.Sprite => {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for join controls');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(8, 8, 80, 80, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(25, 18, 10, 0.9)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#f7efe4';
  ctx.font = '700 56px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 48, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.24, 0.24, 1);
  return sprite;
};

const moduleAssembly = new THREE.Group();
moduleAssembly.name = 'module-assembly';
scene.add(moduleAssembly);

const ceilingLightPoints: THREE.PointLight[] = [];
const ceilingLightEmitterMaterials = new Set<THREE.MeshStandardMaterial>();
const ceilingLightEmitterMeshes: THREE.Mesh[] = [];
let modulePlacements: Array<{ id: string; centerZ: number; lengthM: number; widthM: number }> = [];
let ladderSegmentPlacements: Array<{ moduleIndex: number; centerZ: number; widthM: number; levelOffset: number }> = [];
let worldWalkableVolumes: ModuleVolume[] = [];
let worldBlockedVolumes: ModuleVolume[] = [];
let worldDoorwayVolumes: ModuleVolume[] = [];
let worldClimbVolumes: ModuleVolume[] = [];
let joinControlTargets: JoinControlTarget[] = [];
const joinControlByObjectId = new Map<number, JoinControlTarget>();
let pendingInsertContext: { joinIndex: number; levelOffset: number } | null = null;

const playerEyeHeightM = 1.68;
const playerRadiusM = 0.22;
const blockedVolumeInflationM = Math.max(0, playerRadiusM - 0.08);
const playerMoveSpeedMps = 2.4;
const mouseLookSensitivity = 0.0026;
const playerPosition = new THREE.Vector3(0, playerEyeHeightM, 0);
let playerYaw = 0;
let playerPitch = 0;
const playerLook = new THREE.Vector3();
const playerLookTarget = new THREE.Vector3();
const playerForward = new THREE.Vector3();
const playerRight = new THREE.Vector3();
let interiorMinX = -2;
let interiorMaxX = 2;
let interiorMinZ = -2;
let interiorMaxZ = 2;
const joinControlVisibleDistanceM = 2.1;
const joinControlWorldPos = new THREE.Vector3();
const paperInteractWorldPos = new THREE.Vector3();
const nearestVolumePoint = new THREE.Vector3();
let nearClickableJoinControl = false;
let nearClickableInteraction = false;
const interactDistanceM = 1.7;
let interactableTargets: THREE.Object3D[] = [];
let activeClimbVolume: ModuleVolume | null = null;
let activeClimbOffsetX = 0;
let activeClimbOffsetZ = 0;
const ladderCenterLerpPerSecond = 14;
const ladderClimbSpeedMps = 1.9;
const ladderExitOffsetM = 0.52;
const ladderAttachOffsetM = 0.16;
const ladderVariantIds = new Set([
  'ladder_room_single_mk1',
  'ladder_room_lowest_mk1',
  'ladder_room_middle_mk1',
  'ladder_room_highest_mk1',
  'ladder_room_mk1'
]);
const ladderVariantSingleId = 'ladder_room_single_mk1';
const ladderVariantLowestId = 'ladder_room_lowest_mk1';
const ladderVariantMiddleId = 'ladder_room_middle_mk1';
const ladderVariantHighestId = 'ladder_room_highest_mk1';
const ladderDeckLevelHeightM = 2.6;
let ladderLevelOffsets: number[] = [];
let floorModuleIdsByLevel: Record<string, string[]> = {
  '0': ['captains_cabin_mk1', 'radio_room_mk1']
};

const levelKey = (levelOffset: number): string => `${levelOffset}`;

const normalizeLevelOrder = (offsets: number[]): number[] => {
  return [...new Set(offsets.filter((offset) => Number.isInteger(offset)))].sort((a, b) => a - b);
};

const getTrackedLevelOffsets = (): number[] => {
  return normalizeLevelOrder([0, ...ladderLevelOffsets]);
};

const getVolumeLevelOffset = (volume: ModuleVolume): number | null => {
  const match = volume.id.match(/:L(-?\d+)$/);
  if (!match || !match[1]) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
};

const getContainingVolumeLevelOffset = (point: THREE.Vector3, volumes: ModuleVolume[]): number | null => {
  for (const volume of volumes) {
    if (!containsPointInVolume(point, volume, 0)) {
      continue;
    }
    const levelOffset = getVolumeLevelOffset(volume);
    if (levelOffset !== null) {
      return levelOffset;
    }
  }
  return null;
};

const getContainingWalkableLevelOffset = (point: THREE.Vector3): number | null => {
  return getContainingVolumeLevelOffset(point, [...worldDoorwayVolumes, ...worldWalkableVolumes]);
};

const getActiveLevelOffset = (): number => {
  const levels = getTrackedLevelOffsets();
  if (levels.length <= 1) {
    return levels[0] ?? 0;
  }

  if (activeClimbVolume) {
    return getVolumeLevelOffset(activeClimbVolume) ?? 0;
  }

  const occupiedLevelOffset = getContainingWalkableLevelOffset(playerPosition);
  if (occupiedLevelOffset !== null) {
    return occupiedLevelOffset;
  }

  let best = levels[0] ?? 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const level of levels) {
    const standingEyeY = (level * ladderDeckLevelHeightM) + playerEyeHeightM;
    const distance = Math.abs(playerPosition.y - standingEyeY);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = level;
    }
  }
  return best;
};

const getMiddleModuleIdsForLevel = (levelOffset: number): string[] => {
  const ids = floorModuleIdsByLevel[levelKey(levelOffset)];
  if (!Array.isArray(ids)) {
    throw new Error(`Missing module IDs for level ${levelOffset}`);
  }
  return [...ids];
};

const setMiddleModuleIdsForLevel = (levelOffset: number, ids: string[]) => {
  floorModuleIdsByLevel[levelKey(levelOffset)] = [...ids];
};

const ensureLadderFloorModules = (levelOffset: number) => {
  if (Array.isArray(floorModuleIdsByLevel[levelKey(levelOffset)])) {
    return;
  }
  setMiddleModuleIdsForLevel(levelOffset, [ladderVariantSingleId]);
};

const getModuleChainForLevel = (levelOffset: number): GeneratedModule[] => {
  return buildModuleChainFromIds(getMiddleModuleIdsForLevel(levelOffset));
};

const writeLevelChain = (levelOffset: number, chain: GeneratedModule[]) => {
  const middle = chain
    .filter((moduleDoc) => !isFixedModuleType(moduleDoc.moduleType))
    .map((moduleDoc) => moduleDoc.id);
  setMiddleModuleIdsForLevel(levelOffset, middle);
};

const hydrateFloorModuleIdsByLevel = () => {
  const defaults = defaultSimulation().floorModuleIdsByLevel ?? { '0': ['captains_cabin_mk1', 'radio_room_mk1'] };
  const source = simulation.floorModuleIdsByLevel;

  if (source && typeof source === 'object') {
    const hydrated: Record<string, string[]> = {};
    for (const [key, ids] of Object.entries(source)) {
      if (!Array.isArray(ids)) {
        continue;
      }
      hydrated[key] = ids.filter((id): id is string => typeof id === 'string');
    }
    floorModuleIdsByLevel = Object.keys(hydrated).length > 0 ? hydrated : { ...defaults };
    if (!Array.isArray(floorModuleIdsByLevel['0'])) {
      floorModuleIdsByLevel['0'] = [...(defaults['0'] ?? ['captains_cabin_mk1', 'radio_room_mk1'])];
    }
    return;
  }

  const migratedBaseIds = (simulation.moduleIds ?? [])
    .filter((id) => typeof id === 'string')
    .filter((id) => !isFixedModuleType(createModuleFromTemplateId(id).moduleType));
  floorModuleIdsByLevel = {
    '0': migratedBaseIds.length > 0 ? migratedBaseIds : ['captains_cabin_mk1', 'radio_room_mk1']
  };
};

const computeMainBusPowered = (): boolean => {
  const levels = getTrackedLevelOffsets();
  const hasBatterySupplyModule = levels.some((levelOffset) => {
    return getModuleChainForLevel(levelOffset).some((moduleDoc) => isBatterySupplyModuleId(moduleDoc.id));
  });
  return computeMainBusPoweredForState(
    {
      batteryACharge: simulation.batteryACharge,
      batteryBCharge: simulation.batteryBCharge,
      batteryAConnectedToBus: simulation.batteryAConnectedToBus,
      batteryBConnectedToBus: simulation.batteryBConnectedToBus,
      solarPanelsConnected: simulation.solarPanelsConnected,
      mainBusConnected: simulation.mainBusConnected,
      lightsMainOn: simulation.lightsMainOn
    },
    hasBatterySupplyModule
  );
};

const getSolarChargeEffectiveness = (utcMs: number): number => {
  if (!simulation.solarPanelsConnected) {
    return 0;
  }

  const utcNow = new Date(utcMs);
  const observerLatitudeDeg = clampNumber(simulation.playerLatitudeDeg, -90, 90);
  const observerLongitudeDeg = normalizeLongitudeDeg(simulation.playerLongitudeDeg);
  const { latitudeDeg: subsolarLat, longitudeDeg: subsolarLon } = calculateSubsolarPoint(utcNow);
  const { elevationDeg } = calculateSunElevationAzimuth(
    observerLatitudeDeg,
    observerLongitudeDeg,
    subsolarLat,
    subsolarLon
  );

  const sunFacingFactor = Math.max(0, Math.sin(elevationDeg * DEG_TO_RAD));
  const distanceFactor = 1 / Math.max(0.25, simulation.planetDistanceAu) ** 2;
  return clampNumber(sunFacingFactor * distanceFactor, 0, 1);
};

const getElectricalTelemetry = (utcMs: number) => {
  const levels = getTrackedLevelOffsets();
  const hasBatterySupplyModule = levels.some((levelOffset) => {
    return getModuleChainForLevel(levelOffset).some((moduleDoc) => isBatterySupplyModuleId(moduleDoc.id));
  });
  const solarEffectiveness = hasBatterySupplyModule ? getSolarChargeEffectiveness(utcMs) : 0;
  const telemetry = getElectricalTelemetryForState(
    {
      batteryACharge: simulation.batteryACharge,
      batteryBCharge: simulation.batteryBCharge,
      batteryAConnectedToBus: simulation.batteryAConnectedToBus,
      batteryBConnectedToBus: simulation.batteryBConnectedToBus,
      solarPanelsConnected: simulation.solarPanelsConnected,
      mainBusConnected: simulation.mainBusConnected,
      lightsMainOn: simulation.lightsMainOn
    },
    hasBatterySupplyModule,
    solarEffectiveness,
    ELECTRICAL_CONFIG
  );

  return {
    solarEffectiveness,
    solarChargeCurrentA: telemetry.solarChargeCurrentA,
    loadCurrentA: telemetry.loadCurrentA,
    netBatteryCurrentA: telemetry.netBatteryCurrentA
  };
};

const applyModuleLightingState = (mainBusPowered: boolean) => {
  for (const light of ceilingLightPoints) {
    const baseIntensity = Number(light.userData.baseIntensity ?? 1.35);
    light.intensity = mainBusPowered ? baseIntensity : 0;
    light.castShadow = !mainBusPowered;
  }

  for (const material of ceilingLightEmitterMaterials) {
    material.emissiveIntensity = mainBusPowered ? 1.5 : 0;
  }

  for (const mesh of ceilingLightEmitterMeshes) {
    mesh.castShadow = !mainBusPowered;
    mesh.receiveShadow = true;
  }
};

const rebuildModuleAssembly = () => {
  moduleAssembly.clear();
  modulePlacements = [];
  ladderSegmentPlacements = [];
  worldWalkableVolumes = [];
  worldBlockedVolumes = [];
  worldDoorwayVolumes = [];
  worldClimbVolumes = [];
  joinControlTargets = [];
  interactableTargets = [];
  ceilingLightPoints.length = 0;
  ceilingLightEmitterMeshes.length = 0;
  joinControlByObjectId.clear();

  const levelsToRender = getTrackedLevelOffsets();
  if (levelsToRender.length === 0) {
    applyModuleLightingState(simulation.mainBusPowered);
    return;
  }

  const placementAnchorLevel = getActiveLevelOffset();
  type LevelRenderPlan = {
    levelOffset: number;
    levelY: number;
    levelChain: GeneratedModule[];
    levelTotalLength: number;
    rawLadderCenterZ: number | null;
    zOffset: number;
  };

  const plans: LevelRenderPlan[] = [];

  for (const levelOffset of levelsToRender) {
    const levelChain = getModuleChainForLevel(levelOffset);
    if (levelChain.length === 0) {
      continue;
    }

    const levelTotalLength = levelChain.reduce((sum, moduleDoc) => {
      if (isLadderModuleId(moduleDoc.id)) {
        return sum + createModuleFromTemplateId(getLadderVariantForLevelOffset(levelOffset)).size.lengthM;
      }
      return sum + moduleDoc.size.lengthM;
    }, 0);

    let rawLadderCenterZ: number | null = null;
    let cursorZForRaw = -(levelTotalLength / 2);
    for (const moduleDoc of levelChain) {
      const effectiveModule = isLadderModuleId(moduleDoc.id)
        ? createModuleFromTemplateId(getLadderVariantForLevelOffset(levelOffset))
        : moduleDoc;
      const moduleCenterZ = cursorZForRaw + (effectiveModule.size.lengthM / 2);
      if (rawLadderCenterZ === null && isLadderModuleId(moduleDoc.id)) {
        rawLadderCenterZ = moduleCenterZ;
      }
      cursorZForRaw += effectiveModule.size.lengthM;
    }

    plans.push({
      levelOffset,
      levelY: levelOffset * ladderDeckLevelHeightM,
      levelChain,
      levelTotalLength,
      rawLadderCenterZ,
      zOffset: 0
    });
  }

  const anchorPlan = plans.find((plan) => plan.levelOffset === placementAnchorLevel);
  const ladderAnchorCenterZ = anchorPlan?.rawLadderCenterZ
    ?? plans.find((plan) => plan.rawLadderCenterZ !== null)?.rawLadderCenterZ
    ?? 0;

  let globalMinZ = Number.POSITIVE_INFINITY;
  let globalMaxZ = Number.NEGATIVE_INFINITY;
  let globalMaxWidth = 0;

  for (const plan of plans) {
    if (plan.rawLadderCenterZ !== null) {
      plan.zOffset = ladderAnchorCenterZ - plan.rawLadderCenterZ;
    }
  }

  for (const plan of plans) {
    const { levelOffset, levelY, levelChain, levelTotalLength, zOffset } = plan;
    let cursorZ = -(levelTotalLength / 2) + zOffset;
    const levelPlacements: Array<{ id: string; centerZ: number; lengthM: number; widthM: number }> = [];

    for (let moduleIndex = 0; moduleIndex < levelChain.length; moduleIndex += 1) {
      const moduleDoc = levelChain[moduleIndex];
      if (!moduleDoc) {
        continue;
      }

      const effectiveModule = isLadderModuleId(moduleDoc.id)
        ? createModuleFromTemplateId(getLadderVariantForLevelOffset(levelOffset))
        : moduleDoc;
      const moduleGroup = createModuleMesh(effectiveModule);
      const length = effectiveModule.size.lengthM;
      const centerZ = cursorZ + (length / 2);
      moduleGroup.position.z = centerZ;
      moduleGroup.position.y = levelY;
      cursorZ += length;

      levelPlacements.push({ id: effectiveModule.id, centerZ, lengthM: length, widthM: effectiveModule.size.widthM });
      globalMaxWidth = Math.max(globalMaxWidth, effectiveModule.size.widthM);
      globalMinZ = Math.min(globalMinZ, centerZ - (length / 2));
      globalMaxZ = Math.max(globalMaxZ, centerZ + (length / 2));
      if (levelOffset === placementAnchorLevel) {
        modulePlacements.push({ id: effectiveModule.id, centerZ, lengthM: length, widthM: effectiveModule.size.widthM });
      }

      const toWorldVolume = (volume: ModuleVolume): ModuleVolume => {
        const [vx, vy, vz] = getVector3(volume.center, `volume center (${effectiveModule.id}:${volume.id})`);
        return {
          ...volume,
          id: `${moduleIndex}:${effectiveModule.id}:${volume.id}:L${levelOffset}`,
          center: [vx, vy + levelY, vz + centerZ]
        };
      };

      effectiveModule.volumes.walkable.forEach((volume) => {
        worldWalkableVolumes.push(toWorldVolume(volume));
      });
      effectiveModule.volumes.blocked.forEach((volume) => {
        worldBlockedVolumes.push(toWorldVolume(volume));
      });
      effectiveModule.volumes.doorway.forEach((volume) => {
        worldDoorwayVolumes.push(toWorldVolume(volume));
      });
      effectiveModule.volumes.climb.forEach((volume) => {
        worldClimbVolumes.push(toWorldVolume(volume));
      });

      if (isLadderModuleId(moduleDoc.id)) {
        ladderSegmentPlacements.push({
          moduleIndex,
          centerZ,
          widthM: effectiveModule.size.widthM,
          levelOffset
        });
      }

      moduleAssembly.add(moduleGroup);

      moduleGroup.traverse((child) => {
        if (typeof child.userData.interactionKind === 'string') {
          interactableTargets.push(child);
        }
        if (child.userData.ceilingLightEmitter === true && child instanceof THREE.Mesh) {
          ceilingLightEmitterMeshes.push(child);
        }
        if (child instanceof THREE.PointLight) {
          ceilingLightPoints.push(child);
        }
      });
    }

    for (let joinIndex = 0; joinIndex < levelPlacements.length - 1; joinIndex += 1) {
      const leftPlacement = levelPlacements[joinIndex];
      const rightPlacement = levelPlacements[joinIndex + 1];
      if (!leftPlacement || !rightPlacement) {
        continue;
      }

      const joinZ = leftPlacement.centerZ + (leftPlacement.lengthM / 2);
      const controlHalfWidth = Math.max(leftPlacement.widthM, rightPlacement.widthM) / 2;
      const controlX = -(controlHalfWidth - 0.16);
      const controlY = 1.35 + levelY;

      const addControl = (sprite: THREE.Sprite, kind: JoinControlTarget['kind']) => {
        moduleAssembly.add(sprite);
        const target: JoinControlTarget = { object: sprite, kind, joinIndex, levelOffset };
        joinControlTargets.push(target);
        joinControlByObjectId.set(sprite.id, target);
      };

      const plus = createJoinControlSprite('+', 'rgba(37, 92, 52, 0.94)');
      plus.position.set(controlX, controlY, joinZ);
      addControl(plus, 'insert');

      const leftModule = levelChain[joinIndex];
      if (leftModule && !isFixedModuleType(leftModule.moduleType)) {
        const minusLeft = createJoinControlSprite('-', 'rgba(112, 45, 45, 0.94)');
        minusLeft.position.set(controlX, controlY, joinZ - 0.28);
        addControl(minusLeft, 'remove-left');
      }

      const rightModule = levelChain[joinIndex + 1];
      if (rightModule && !isFixedModuleType(rightModule.moduleType)) {
        const minusRight = createJoinControlSprite('-', 'rgba(112, 45, 45, 0.94)');
        minusRight.position.set(controlX, controlY, joinZ + 0.28);
        addControl(minusRight, 'remove-right');
      }
    }
  }

  const interiorHalfWidth = globalMaxWidth / 2;
  interiorMinX = -(interiorHalfWidth - playerRadiusM - 0.05);
  interiorMaxX = interiorHalfWidth - playerRadiusM - 0.05;
  interiorMinZ = globalMinZ + playerRadiusM + 0.15;
  interiorMaxZ = globalMaxZ - playerRadiusM - 0.15;

  for (const segment of ladderSegmentPlacements) {
    const { moduleIndex, centerZ, levelOffset } = segment;
    const moduleDoc = getModuleChainForLevel(levelOffset)[moduleIndex];
    if (!moduleDoc || !isLadderModuleId(moduleDoc.id)) {
      continue;
    }

    const ladderControlX = 0;
    const ladderCenterY = levelOffset * ladderDeckLevelHeightM;
    const lowerControlY = ladderCenterY + 0.95;
    const upperControlY = ladderCenterY + 1.95;
    const ladderControlZ = centerZ;
    const hasAbove = ladderLevelOffsets.includes(levelOffset + 1);
    const hasBelow = ladderLevelOffsets.includes(levelOffset - 1);

    const addLadderControl = (sprite: THREE.Sprite, kind: JoinControlTarget['kind']) => {
      moduleAssembly.add(sprite);
      const target: JoinControlTarget = { object: sprite, kind, joinIndex: moduleIndex, moduleIndex, levelOffset };
      joinControlTargets.push(target);
      joinControlByObjectId.set(sprite.id, target);
    };

    if (hasBelow) {
      const lowerMinusBelow = createJoinControlSprite('-', 'rgba(112, 45, 45, 0.94)');
      lowerMinusBelow.position.set(ladderControlX, lowerControlY - 0.22, ladderControlZ);
      addLadderControl(lowerMinusBelow, 'ladder-remove-below');
    }

    const lowerPlus = createJoinControlSprite('+', 'rgba(37, 92, 52, 0.94)');
    lowerPlus.position.set(ladderControlX, lowerControlY, ladderControlZ);
    addLadderControl(lowerPlus, 'ladder-add-below');

    if (hasAbove) {
      const lowerMinusAbove = createJoinControlSprite('-', 'rgba(112, 45, 45, 0.94)');
      lowerMinusAbove.position.set(ladderControlX, lowerControlY + 0.22, ladderControlZ);
      addLadderControl(lowerMinusAbove, 'ladder-remove-above');
    }

    if (hasBelow) {
      const upperMinusBelow = createJoinControlSprite('-', 'rgba(112, 45, 45, 0.94)');
      upperMinusBelow.position.set(ladderControlX, upperControlY - 0.22, ladderControlZ);
      addLadderControl(upperMinusBelow, 'ladder-remove-below');
    }

    const upperPlus = createJoinControlSprite('+', 'rgba(37, 92, 52, 0.94)');
    upperPlus.position.set(ladderControlX, upperControlY, ladderControlZ);
    addLadderControl(upperPlus, 'ladder-add-above');

    if (hasAbove) {
      const upperMinusAbove = createJoinControlSprite('-', 'rgba(112, 45, 45, 0.94)');
      upperMinusAbove.position.set(ladderControlX, upperControlY + 0.22, ladderControlZ);
      addLadderControl(upperMinusAbove, 'ladder-remove-above');
    }
  }

  if (
    playerPosition.x < interiorMinX ||
    playerPosition.x > interiorMaxX ||
    playerPosition.z < interiorMinZ ||
    playerPosition.z > interiorMaxZ
  ) {
    const spawnPlacement = modulePlacements[Math.floor((modulePlacements.length - 1) / 2)] ?? modulePlacements[0];
    const spawnEyeY = (placementAnchorLevel * ladderDeckLevelHeightM) + playerEyeHeightM;
    playerPosition.set(0, spawnEyeY, spawnPlacement?.centerZ ?? 0);
  }

  applyModuleLightingState(simulation.mainBusPowered);
};

const getContainingClimbVolume = (point: THREE.Vector3): ModuleVolume | null => {
  for (const volume of worldClimbVolumes) {
    if (containsPointInVolume(point, volume, 0)) {
      return volume;
    }
  }
  return null;
};

const getClimbVolumeLevelOffset = (volume: ModuleVolume): number | null => {
  return getVolumeLevelOffset(volume);
};

const getAdjacentClimbVolume = (volume: ModuleVolume, levelDelta: -1 | 1): ModuleVolume | null => {
  const currentLevel = getClimbVolumeLevelOffset(volume);
  if (currentLevel === null) {
    return null;
  }

  const targetLevel = currentLevel + levelDelta;
  const targetSuffix = `:L${targetLevel}`;
  const baseId = volume.id.replace(/:L-?\d+$/, '');
  const targetId = `${baseId}${targetSuffix}`;
  const exact = worldClimbVolumes.find((candidate) => candidate.id === targetId);
  if (exact) {
    return exact;
  }

  const [sourceX, , sourceZ] = getVector3(volume.center, `climb volume center (${volume.id})`);
  let best: ModuleVolume | null = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const candidate of worldClimbVolumes) {
    if (getClimbVolumeLevelOffset(candidate) !== targetLevel) {
      continue;
    }
    const [candidateX, , candidateZ] = getVector3(candidate.center, `climb volume center (${candidate.id})`);
    const dx = candidateX - sourceX;
    const dz = candidateZ - sourceZ;
    const distanceSq = (dx * dx) + (dz * dz);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = candidate;
    }
  }
  return best;
};

const setActiveClimbVolumeFromApproach = (volume: ModuleVolume, approachPoint: THREE.Vector3) => {
  activeClimbVolume = volume;
  const [cx, , cz] = getVector3(volume.center, `climb volume center (${volume.id})`);
  const [sx, , sz] = getVector3(volume.size, `climb volume size (${volume.id})`);

  const offsetX = approachPoint.x - cx;
  const offsetZ = approachPoint.z - cz;
  if (Math.abs(offsetX) > Math.abs(offsetZ)) {
    activeClimbOffsetX = Math.sign(offsetX || 1) * Math.min(ladderAttachOffsetM, (sx / 2) - 0.03);
    activeClimbOffsetZ = 0;
  } else {
    activeClimbOffsetX = 0;
    activeClimbOffsetZ = Math.sign(offsetZ || 1) * Math.min(ladderAttachOffsetM, (sz / 2) - 0.03);
  }
};

const alignPlayerToClimbVolume = (volume: ModuleVolume, deltaSeconds: number) => {
  const [cx, cy, cz] = getVector3(volume.center, `climb volume center (${volume.id})`);
  const [sx, sy, sz] = getVector3(volume.size, `climb volume size (${volume.id})`);
  const halfY = sy / 2;
  const levelOffset = getClimbVolumeLevelOffset(volume);
  const hasBelow = levelOffset !== null ? ladderLevelOffsets.includes(levelOffset - 1) : false;
  const levelStandingEyeY = ((levelOffset ?? 0) * ladderDeckLevelHeightM) + playerEyeHeightM;
  const minY = Math.max(cy - halfY + 0.05, hasBelow ? -Infinity : levelStandingEyeY);
  const maxY = cy + halfY - 0.05;

  const targetX = cx + clamp(activeClimbOffsetX, -((sx / 2) - 0.03), (sx / 2) - 0.03);
  const targetZ = cz + clamp(activeClimbOffsetZ, -((sz / 2) - 0.03), (sz / 2) - 0.03);

  const blend = Math.min(1, ladderCenterLerpPerSecond * deltaSeconds);
  playerPosition.x += (targetX - playerPosition.x) * blend;
  playerPosition.z += (targetZ - playerPosition.z) * blend;
  playerPosition.y = clamp(playerPosition.y, minY, maxY);
};

const exitActiveClimb = (exitY = playerPosition.y) => {
  if (!activeClimbVolume) {
    return;
  }

  const [cx, , cz] = getVector3(activeClimbVolume.center, `climb volume center (${activeClimbVolume.id})`);
  const [, , sz] = getVector3(activeClimbVolume.size, `climb volume size (${activeClimbVolume.id})`);
  const exitDirection = new THREE.Vector3(playerLook.x, 0, playerLook.z);
  if (exitDirection.lengthSq() < 0.0001) {
    exitDirection.set(0, 0, 1);
  }
  exitDirection.normalize();

  const exitCandidate = new THREE.Vector3(
    cx - (exitDirection.x * ((sz / 2) + ladderExitOffsetM)),
    exitY,
    cz - (exitDirection.z * ((sz / 2) + ladderExitOffsetM))
  );

  if (isOccupiablePoint(exitCandidate)) {
    playerPosition.copy(exitCandidate);
  } else {
    const nearest = findNearestOccupiablePoint(exitCandidate, {
      avoidClimbVolumes: true,
      targetY: exitY,
      yTolerance: 0.45
    });
    if (nearest) {
      playerPosition.copy(nearest);
    } else {
      const fallbackExitCandidate = exitCandidate.clone();
      fallbackExitCandidate.y = exitY;
      const fallbackNearest = findNearestOccupiablePoint(fallbackExitCandidate, {
        avoidClimbVolumes: true,
        targetY: exitY,
        yTolerance: 0.8
      });
      if (fallbackNearest) {
        playerPosition.copy(fallbackNearest);
      }
    }
  }

  activeClimbVolume = null;
};

const getStandingEyeYForClimbVolume = (volume: ModuleVolume): number => {
  const levelOffset = getClimbVolumeLevelOffset(volume);
  return (levelOffset ?? 0) * ladderDeckLevelHeightM + playerEyeHeightM;
};

const ensurePlayerInValidSpace = () => {
  if (activeClimbVolume) {
    const climbStillExists = worldClimbVolumes.some((volume) => volume.id === activeClimbVolume?.id);
    const stillInsideClimb = climbStillExists && containsPointInVolume(playerPosition, activeClimbVolume, 0.08);
    if (!stillInsideClimb) {
      activeClimbVolume = null;
    }
  }

  if (!activeClimbVolume) {
    const containingClimb = getContainingClimbVolume(playerPosition);
    if (containingClimb) {
      setActiveClimbVolumeFromApproach(containingClimb, playerPosition);
      return;
    }

    if (!isOccupiablePoint(playerPosition)) {
      const nearest = findNearestOccupiablePoint(playerPosition);
      if (nearest) {
        playerPosition.copy(nearest);
      } else {
        const spawnPlacement = modulePlacements[Math.floor((modulePlacements.length - 1) / 2)] ?? modulePlacements[0];
        const spawnLevelOffset = getActiveLevelOffset();
        const spawnEyeY = (spawnLevelOffset * ladderDeckLevelHeightM) + playerEyeHeightM;
        playerPosition.set(0, spawnEyeY, spawnPlacement?.centerZ ?? 0);
      }
    }
  }
};

const containsPointInVolume = (point: THREE.Vector3, volume: ModuleVolume, inflateXZ: number): boolean => {
  const [cx, cy, cz] = getVector3(volume.center, `volume center (${volume.id})`);
  const [sx, sy, sz] = getVector3(volume.size, `volume size (${volume.id})`);
  const halfX = (sx / 2) + inflateXZ;
  const halfY = sy / 2;
  const halfZ = (sz / 2) + inflateXZ;

  return (
    point.x >= cx - halfX &&
    point.x <= cx + halfX &&
    point.y >= cy - halfY &&
    point.y <= cy + halfY &&
    point.z >= cz - halfZ &&
    point.z <= cz + halfZ
  );
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const nearestPointInVolume = (point: THREE.Vector3, volume: ModuleVolume): THREE.Vector3 => {
  const [cx, cy, cz] = getVector3(volume.center, `volume center (${volume.id})`);
  const [sx, sy, sz] = getVector3(volume.size, `volume size (${volume.id})`);
  const minX = cx - (sx / 2);
  const maxX = cx + (sx / 2);
  const minY = cy - (sy / 2);
  const maxY = cy + (sy / 2);
  const minZ = cz - (sz / 2);
  const maxZ = cz + (sz / 2);
  nearestVolumePoint.set(
    clamp(point.x, minX, maxX),
    clamp(point.y, minY + 0.02, maxY - 0.02),
    clamp(point.z, minZ, maxZ)
  );
  return nearestVolumePoint;
};

const isOccupiablePoint = (point: THREE.Vector3): boolean => {
  if (
    point.x < interiorMinX ||
    point.x > interiorMaxX ||
    point.z < interiorMinZ ||
    point.z > interiorMaxZ
  ) {
    return false;
  }

  const inDoorway = worldDoorwayVolumes.some((volume) => containsPointInVolume(point, volume, 0));
  const inWalkable = inDoorway || worldWalkableVolumes.some((volume) => containsPointInVolume(point, volume, 0));
  if (!inWalkable) {
    return false;
  }

  const inBlocked = worldBlockedVolumes.some((volume) => containsPointInVolume(point, volume, blockedVolumeInflationM));
  if (inBlocked) {
    return false;
  }

  return true;
};

const findNearestOccupiablePoint = (
  from: THREE.Vector3,
  options?: { avoidClimbVolumes?: boolean; targetY?: number; yTolerance?: number }
): THREE.Vector3 | null => {
  const candidateVolumes = [...worldWalkableVolumes, ...worldDoorwayVolumes];
  let best: THREE.Vector3 | null = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (const volume of candidateVolumes) {
    const candidate = nearestPointInVolume(from, volume).clone();
    if (!isOccupiablePoint(candidate)) {
      continue;
    }
    if (typeof options?.targetY === 'number') {
      const tolerance = options.yTolerance ?? 0.6;
      if (Math.abs(candidate.y - options.targetY) > tolerance) {
        continue;
      }
    }
    if (options?.avoidClimbVolumes && worldClimbVolumes.some((climbVolume) => containsPointInVolume(candidate, climbVolume, 0))) {
      continue;
    }
    const distanceSq = from.distanceToSquared(candidate);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = candidate;
    }
  }

  return best;
};

const placePlayerAtCockpitCenter = () => {
  const cockpitPlacement = modulePlacements.find((placement) => placement.id.startsWith('cockpit_')) ?? modulePlacements[0];
  if (!cockpitPlacement) {
    return;
  }

  const spawnCandidate = new THREE.Vector3(0, playerEyeHeightM, cockpitPlacement.centerZ);
  if (isOccupiablePoint(spawnCandidate)) {
    playerPosition.copy(spawnCandidate);
  } else {
    const nearest = findNearestOccupiablePoint(spawnCandidate);
    if (!nearest) {
      return;
    }
    playerPosition.copy(nearest);
  }

  playerYaw = 0;
  playerPitch = 0;
  simulation.playerPositionX = playerPosition.x;
  simulation.playerPositionY = playerPosition.y;
  simulation.playerPositionZ = playerPosition.z;
  simulation.playerYaw = playerYaw;
  simulation.playerPitch = playerPitch;
  syncPlayerCamera();
};

const updateJoinControlVisibility = () => {
  nearClickableJoinControl = false;
  nearClickableInteraction = false;
  const controlsActive = !menuVisible && !controlsListeningFor;
  const pointerLocked = document.pointerLockElement === renderer.domElement;

  for (const target of joinControlTargets) {
    target.object.getWorldPosition(joinControlWorldPos);
    const distance = joinControlWorldPos.distanceTo(playerPosition);
    const visible = controlsActive && distance <= joinControlVisibleDistanceM;
    target.object.visible = visible;
    if (visible) {
      nearClickableJoinControl = true;
    }
  }

  if (controlsActive) {
    for (const interactTarget of interactableTargets) {
      interactTarget.getWorldPosition(paperInteractWorldPos);
      if (paperInteractWorldPos.distanceTo(playerPosition) <= interactDistanceM) {
        nearClickableInteraction = true;
        break;
      }
    }
  }

  clickReticle.dataset.visible = (nearClickableJoinControl || nearClickableInteraction) && controlsActive && pointerLocked ? 'true' : 'false';
};

const syncPlayerCamera = () => {
  playerLook.set(
    Math.sin(playerYaw) * Math.cos(playerPitch),
    Math.sin(playerPitch),
    Math.cos(playerYaw) * Math.cos(playerPitch)
  );
  camera.position.copy(playerPosition);
  playerLookTarget.copy(playerPosition).add(playerLook);
  camera.lookAt(playerLookTarget);
};

const playerPitchMin = -1.45;
const playerPitchMax = 1.45;

const applyPlayerPoseFromSimulation = () => {
  if (Number.isFinite(simulation.playerPositionX)) {
    playerPosition.x = simulation.playerPositionX;
  }
  if (Number.isFinite(simulation.playerPositionY)) {
    playerPosition.y = simulation.playerPositionY;
  }
  if (Number.isFinite(simulation.playerPositionZ)) {
    playerPosition.z = simulation.playerPositionZ;
  }
  if (Number.isFinite(simulation.playerYaw)) {
    playerYaw = simulation.playerYaw;
  }
  if (Number.isFinite(simulation.playerPitch)) {
    playerPitch = clamp(simulation.playerPitch, playerPitchMin, playerPitchMax);
  }
  syncPlayerCamera();
};

syncPlayerCamera();

let lastAutosaveAt = performance.now();
const menuStack: MenuStackEntry[] = [];
let menuVisible = true;
const liveMenuValueBindings = new Map<LiveValueBindingKey, HTMLElement>();
let controlsListeningFor: ControlsListeningState | null = null;
let lastGamepadState: { buttons: boolean[]; axes: number[] } = { buttons: [], axes: [] };
let lastMenuActionState: ActionState | null = null;
let menuFocusIndex = 0;
const keys: Record<string, boolean> = {};

const showToast = (text: string) => {
  menuToast.textContent = text;
  menuToast.dataset.visible = 'true';
  window.setTimeout(() => {
    menuToast.dataset.visible = 'false';
  }, 1400);
};

const isBatteryControlMenuVisible = (): boolean => {
  const currentMenu = menuStack[menuStack.length - 1];
  return menuVisible && currentMenu?.menuName === 'batteryControlMenu';
};

const getLiveValueText = (key: LiveValueBindingKey, stats: BatteryMenuStats): string => {
  if (key === 'main-bus-connect') return stats.mainBusConnected ? 'Connected' : 'Disconnected';
  if (key === 'solar-connect') return stats.solarPanelsConnected ? 'Connected' : 'Disconnected';
  if (key === 'battery-a-connect') return stats.batteryAConnectedToBus ? 'Connected' : 'Disconnected';
  if (key === 'battery-b-connect') return stats.batteryBConnectedToBus ? 'Connected' : 'Disconnected';
  if (key === 'lights-main') return stats.lightsMainOn ? 'On' : 'Off';
  if (key === 'battery-a-charge') return formatBatteryPercent(stats.batteryACharge);
  if (key === 'battery-b-charge') return formatBatteryPercent(stats.batteryBCharge);
  if (key === 'solar-effectiveness') return `${(stats.solarEffectiveness * 100).toFixed(0)}%`;
  if (key === 'solar-charge-current') {
    return `${stats.solarChargeCurrentA.toFixed(1)} A (${ELECTRICAL_CONFIG.solarArrayNominalVoltageV} V array → ${ELECTRICAL_CONFIG.mainBusNominalVoltageV} V bus)`;
  }
  if (key === 'load-current') return `${stats.loadCurrentA.toFixed(1)} A @ ${ELECTRICAL_CONFIG.mainBusNominalVoltageV} V`;
  const netLabel = stats.netBatteryCurrentA >= 0 ? '+' : '';
  return `${netLabel}${stats.netBatteryCurrentA.toFixed(1)} A`;
};

const applyBatteryMenuStatsToLiveBindings = (stats: BatteryMenuStats) => {
  if (!isBatteryControlMenuVisible()) {
    return;
  }

  liveMenuValueBindings.forEach((element, key) => {
    const nextValue = getLiveValueText(key, stats);
    if (element.textContent !== nextValue) {
      element.textContent = nextValue;
    }
  });
};

const getThemeIconSvg = (mode: ThemeMode, resolvedTheme: ResolvedTheme) => {
  if (mode === 'system') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="9" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14.8 8.2a3 3 0 1 0 0 3.6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>';
  }

  if (resolvedTheme === 'dark') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15.5 3.8a8.3 8.3 0 1 0 4.7 14.8A8 8 0 0 1 15.5 3.8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  }

  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.8 5.8l2.1 2.1M16.1 16.1l2.1 2.1M18.2 5.8l-2.1 2.1M7.9 16.1l-2.1 2.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';
};

const resolveTheme = (mode: ThemeMode): ResolvedTheme => {
  if (mode === 'system') {
    return window.matchMedia(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';
  }
  return mode;
};

const applySceneTheme = () => {
  const surfaceAlt = getComputedStyle(document.documentElement).getPropertyValue('--surface-alt').trim();
  if (surfaceAlt) {
    scene.background = new THREE.Color(surfaceAlt);
  }
};

const updateStatusFromSimulation = () => {
  gameSquare.dataset.running = simulation.running ? 'true' : 'false';
  gameSquare.dataset.lightsMain = simulation.lightsMainOn ? 'on' : 'off';
  gameSquare.dataset.mainBus = simulation.mainBusPowered ? 'on' : 'off';
  gameSquare.dataset.batteryA = simulation.batteryACharge.toFixed(1);
  gameSquare.dataset.batteryB = simulation.batteryBCharge.toFixed(1);
};

const setTheme = (themeMode: ThemeMode) => {
  const resolvedTheme = resolveTheme(themeMode);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = themeMode;
  applySceneTheme();

  themeButton.innerHTML = `<span class="theme-icon">${getThemeIconSvg(themeMode, resolvedTheme)}</span>`;
  themeButton.setAttribute('aria-label', `Theme mode: ${themeMode}`);

  settings.themeMode = themeMode;
  saveLocalState();
  updateStatusFromSimulation();
};

let currentTheme: ThemeMode = settings.themeMode;

const formatBindingName = (binding: ControlBinding): string => {
  if (!binding) return '---';

  if (typeof binding === 'object') {
    if (binding.type === 'button') {
      const btnMap: Record<number, string> = {
        0: 'GP:A',
        1: 'GP:B',
        2: 'GP:X',
        3: 'GP:Y',
        4: 'GP:LB',
        5: 'GP:RB',
        6: 'GP:LT',
        7: 'GP:RT',
        8: 'GP:Back',
        9: 'GP:Start'
      };
      return btnMap[binding.btn] ?? `GP:B${binding.btn}`;
    }
    const dir = binding.dir > 0 ? '+' : '-';
    return `GP:A${binding.axis}${dir}`;
  }

  const keyMap: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Escape: 'Esc',
    Enter: 'Enter',
    Space: 'Space',
    Backspace: 'Backspace',
    Delete: 'Delete'
  };

  if (keyMap[binding]) return keyMap[binding];
  if (binding.startsWith('Key')) return binding.slice(3);
  if (binding.startsWith('Digit')) return binding.slice(5);
  if (binding.startsWith('Numpad')) return `Num${binding.slice(6)}`;
  return binding;
};

const getConnectedGamepad = (): Gamepad | null => {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gamepad of gamepads) {
    if (gamepad) {
      return gamepad;
    }
  }
  return null;
};

const bindingMatchesGamepad = (binding: ControlBinding, gamepad: Gamepad | null): boolean => {
  if (!binding || typeof binding !== 'object' || !gamepad) {
    return false;
  }
  const axisThreshold = 0.5;
  if (binding.type === 'button') {
    return !!gamepad.buttons[binding.btn]?.pressed;
  }
  const value = gamepad.axes[binding.axis] ?? 0;
  return binding.dir < 0 ? value < -axisThreshold : value > axisThreshold;
};

const isActionPressed = (action: ControlAction): boolean => {
  const bindings = settings.controls.bindings[action];
  const gamepad = getConnectedGamepad();

  const checkBinding = (binding: ControlBinding): boolean => {
    if (!binding) return false;
    if (typeof binding === 'string') {
      return !!keys[binding];
    }
    return bindingMatchesGamepad(binding, gamepad);
  };

  return checkBinding(bindings[0]) || checkBinding(bindings[1]);
};

const getMenuActionState = (): ActionState => ({
  left: isActionPressed('left'),
  right: isActionPressed('right'),
  up: isActionPressed('up'),
  down: isActionPressed('down'),
  confirm: isActionPressed('confirm'),
  back: isActionPressed('back'),
  pause: isActionPressed('pause')
});

const getActionEdges = (prevState: ActionState | null, currentState: ActionState): ActionState => ({
  left: !!currentState.left && !(prevState?.left ?? false),
  right: !!currentState.right && !(prevState?.right ?? false),
  up: !!currentState.up && !(prevState?.up ?? false),
  down: !!currentState.down && !(prevState?.down ?? false),
  confirm: !!currentState.confirm && !(prevState?.confirm ?? false),
  back: !!currentState.back && !(prevState?.back ?? false),
  pause: !!currentState.pause && !(prevState?.pause ?? false)
});

const getMenuFocusables = (): HTMLElement[] => {
  if (!menuVisible) {
    return [];
  }

  return Array.from(menuPanel.querySelectorAll<HTMLElement>('button, a')).filter((element) => {
    if (element instanceof HTMLButtonElement && element.disabled) {
      return false;
    }
    return element.offsetParent !== null;
  });
};

const focusMenuIndex = (index: number) => {
  const focusables = getMenuFocusables();
  if (focusables.length === 0) {
    menuFocusIndex = 0;
    return;
  }

  const wrapped = (index + focusables.length) % focusables.length;
  menuFocusIndex = wrapped;
  focusables[wrapped]?.focus();
};

const moveMenuFocus = (delta: number) => {
  focusMenuIndex(menuFocusIndex + delta);
};

const activateFocusedMenuItem = () => {
  const focusables = getMenuFocusables();
  if (focusables.length === 0) {
    return;
  }
  const current = focusables[menuFocusIndex] ?? focusables[0];
  if (current) {
    current.click();
  }
};

const bindingsEqual = (left: ControlBinding, right: ControlBinding): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  if (typeof left === 'string' || typeof right === 'string') return left === right;
  if (left.type !== right.type) return false;
  if (left.type === 'button' && right.type === 'button') return left.btn === right.btn;
  if (left.type === 'axis' && right.type === 'axis') return left.axis === right.axis && left.dir === right.dir;
  return false;
};

const clearConflictingBindings = (action: ControlAction, slot: 0 | 1, binding: ControlBinding) => {
  if (!binding) return;
  CONTROL_ACTIONS.forEach((candidateAction) => {
    const pair = settings.controls.bindings[candidateAction];
    (pair as ControlBinding[]).forEach((candidateBinding, candidateSlot) => {
      if (candidateAction === action && candidateSlot === slot) {
        return;
      }
      if (bindingsEqual(candidateBinding, binding)) {
        pair[candidateSlot as 0 | 1] = null;
      }
    });
  });
};

const setBinding = (action: ControlAction, slot: 0 | 1, binding: ControlBinding) => {
  clearConflictingBindings(action, slot, binding);
  settings.controls.bindings[action][slot] = cloneBinding(binding);
  saveLocalState();
  renderCurrentMenu();
};

const stopListeningForBinding = () => {
  if (!controlsListeningFor) return;
  controlsListeningFor.element.classList.remove('listening');
  if (controlsListeningFor.gamepadPollId !== null) {
    cancelAnimationFrame(controlsListeningFor.gamepadPollId);
  }
  controlsListeningFor = null;
  lastMenuActionState = getMenuActionState();
};

const applyGamepadBinding = (binding: GamepadButtonBinding | GamepadAxisBinding) => {
  if (!controlsListeningFor) return;
  const { action, slot } = controlsListeningFor;
  stopListeningForBinding();
  setBinding(action, slot, binding);
  showToast('Binding updated');
};

const startGamepadListening = () => {
  if (!controlsListeningFor) return;
  const gamepad = getConnectedGamepad();

  if (gamepad) {
    if (!controlsListeningFor.baseline) {
      controlsListeningFor.baseline = {
        buttons: gamepad.buttons.map((button) => button.pressed),
        axes: [...gamepad.axes]
      };
      lastGamepadState = {
        buttons: [...controlsListeningFor.baseline.buttons],
        axes: [...controlsListeningFor.baseline.axes]
      };
      controlsListeningFor.gamepadPollId = requestAnimationFrame(startGamepadListening);
      return;
    }

    for (let index = 0; index < gamepad.buttons.length; index += 1) {
      const pressed = !!gamepad.buttons[index]?.pressed;
      const wasPressed = !!lastGamepadState.buttons[index];
      if (pressed && !wasPressed) {
        applyGamepadBinding({ type: 'button', btn: index });
        return;
      }
    }

    const threshold = 0.65;
    const baselineAxes = controlsListeningFor.baseline.axes;
    for (let index = 0; index < gamepad.axes.length; index += 1) {
      const value = gamepad.axes[index] ?? 0;
      const baselineValue = baselineAxes[index] ?? 0;
      const delta = value - baselineValue;
      if (delta > threshold) {
        applyGamepadBinding({ type: 'axis', axis: index, dir: 1 });
        return;
      }
      if (delta < -threshold) {
        applyGamepadBinding({ type: 'axis', axis: index, dir: -1 });
        return;
      }
    }

    lastGamepadState = {
      buttons: gamepad.buttons.map((button) => button.pressed),
      axes: [...gamepad.axes]
    };
  }

  if (controlsListeningFor) {
    controlsListeningFor.gamepadPollId = requestAnimationFrame(startGamepadListening);
  }
};

const startListeningForBinding = (action: ControlAction, slot: 0 | 1, element: HTMLButtonElement, keyCode: string | null) => {
  stopListeningForBinding();
  controlsListeningFor = {
    action,
    slot,
    element,
    gamepadPollId: null,
    ignoreKeyCode: keyCode,
    ignoreKeyUntil: performance.now() + 250
  };
  element.classList.add('listening');
  element.textContent = '...';
  lastGamepadState = { buttons: [], axes: [] };
  startGamepadListening();
};

const handleBindingKeydown = (event: KeyboardEvent): boolean => {
  if (!controlsListeningFor) return false;
  event.preventDefault();
  event.stopPropagation();

  if (
    controlsListeningFor.ignoreKeyCode &&
    event.code === controlsListeningFor.ignoreKeyCode &&
    performance.now() < controlsListeningFor.ignoreKeyUntil
  ) {
    return true;
  }

  const { action, slot } = controlsListeningFor;
  if (event.code === 'Escape') {
    stopListeningForBinding();
    renderCurrentMenu();
    return true;
  }

  if (event.code === 'Backspace' || event.code === 'Delete') {
    stopListeningForBinding();
    setBinding(action, slot, null);
    showToast('Binding cleared');
    return true;
  }

  stopListeningForBinding();
  setBinding(action, slot, event.code);
  showToast('Binding updated');
  return true;
};

const exportSave = () => {
  const payload = JSON.stringify(getSaveEnvelope(), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `airshipone-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  showToast('Save exported');
};

const applyImportedSave = (raw: string) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    showToast('Invalid JSON');
    return;
  }

  const incoming = parsed as Partial<SaveEnvelope>;
  if (incoming.app !== 'airshipone' || incoming.v !== 1 || !incoming.settings || !incoming.simulation) {
    showToast('Unsupported save file');
    return;
  }

  settings = {
    ...defaultSettings(),
    ...incoming.settings,
    graphics: {
      ...defaultSettings().graphics,
      ...incoming.settings.graphics
    },
    audio: {
      ...defaultSettings().audio,
      ...incoming.settings.audio
    },
    advanced: {
      ...defaultSettings().advanced,
      ...incoming.settings.advanced
    },
    controls: {
      bindings: cloneControls(incoming.settings.controls?.bindings ?? defaultControls()),
      invertMouseY: incoming.settings.controls?.invertMouseY ?? defaultSettings().controls.invertMouseY
    }
  };

  simulation = {
    ...defaultSimulation(),
    ...incoming.simulation
  };
  ladderLevelOffsets = [...(simulation.ladderLevelOffsets ?? [])];
  hydrateFloorModuleIdsByLevel();
  applyPlayerPoseFromSimulation();
  normalizeLadderRoomVariants();
  syncSimulationModuleIds();
  rebuildModuleAssembly();
  syncMainBusPowerState();
  applyPlayerPoseFromSimulation();

  currentTheme = settings.themeMode;
  setTheme(currentTheme);
  saveLocalState();
  renderCurrentMenu();
  updateStatusFromSimulation();
  showToast('Save imported');
};

const importSave = () => {
  importInput.value = '';
  importInput.click();
};

importInput.addEventListener('change', () => {
  const file = importInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      applyImportedSave(reader.result);
    }
  };
  reader.onerror = () => {
    showToast('Import failed');
  };
  reader.readAsText(file);
});

const startNewGame = () => {
  simulation = defaultSimulation();
  ladderLevelOffsets = [...simulation.ladderLevelOffsets];
  hydrateFloorModuleIdsByLevel();
  normalizeLadderRoomVariants();
  rebuildModuleAssembly();
  placePlayerAtCockpitCenter();
  syncMainBusPowerState();
  simulation.running = true;
  simulation.updatedAt = Date.now();
  syncSimulationModuleIds();
  saveLocalState();
  updateStatusFromSimulation();
  menuVisible = false;
  renderCurrentMenu();
  showToast('New game started');
};

const resumeGame = () => {
  const parsed = parseSave(window.localStorage.getItem(STORAGE_KEY));
  if (!parsed) {
    showToast('No saved game');
    return;
  }
  loadLocalState();
  ladderLevelOffsets = [...(simulation.ladderLevelOffsets ?? [])];
  hydrateFloorModuleIdsByLevel();
  applyPlayerPoseFromSimulation();
  normalizeLadderRoomVariants();
  rebuildModuleAssembly();
  syncMainBusPowerState();
  applyPlayerPoseFromSimulation();
  syncSimulationModuleIds();
  currentTheme = settings.themeMode;
  setTheme(currentTheme);
  simulation.running = true;
  simulation.updatedAt = Date.now();
  updateStatusFromSimulation();
  menuVisible = false;
  renderCurrentMenu();
  showToast('Game resumed');
};

const openMenu = (menuName: MenuName) => {
  const menu = MENUS[menuName];
  if (!menu) return;
  if (menu.isRoot) {
    menuStack.length = 0;
  }
  menuStack.push({ menuName });
  menuVisible = true;
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
  renderCurrentMenu();
};

const popMenu = () => {
  if (menuStack.length > 1) {
    menuStack.pop();
  } else {
    menuVisible = false;
  }
  if (menuVisible && document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
  renderCurrentMenu();
};

const closeAllMenus = () => {
  menuStack.length = 0;
  menuVisible = false;
  stopListeningForBinding();
  renderCurrentMenu();
};

const syncSimulationModuleIds = () => {
  const baseLevelIds = getMiddleModuleIdsForLevel(0);
  simulation.moduleIds = buildModuleChainFromIds(baseLevelIds).map((moduleDoc) => moduleDoc.id);
  simulation.ladderLevelOffsets = [...ladderLevelOffsets];
  simulation.floorModuleIdsByLevel = { ...floorModuleIdsByLevel };
};

const isLadderModuleId = (moduleId: string): boolean => ladderVariantIds.has(moduleId);

const normalizeLadderLevelOffsets = (offsets: number[]): number[] => {
  const unique = [...new Set(offsets.filter((offset) => Number.isInteger(offset)))].sort((a, b) => a - b);
  return unique;
};

const getLadderVariantForLevelOffset = (levelOffset: number): string => {
  const hasAbove = ladderLevelOffsets.includes(levelOffset + 1);
  const hasBelow = ladderLevelOffsets.includes(levelOffset - 1);
  if (hasAbove && hasBelow) {
    return ladderVariantMiddleId;
  }
  if (hasAbove) {
    return ladderVariantLowestId;
  }
  if (hasBelow) {
    return ladderVariantHighestId;
  }
  return ladderVariantSingleId;
};

const normalizeLadderRoomVariants = () => {
  ladderLevelOffsets = normalizeLadderLevelOffsets(ladderLevelOffsets);
  const ladderLevels = new Set(ladderLevelOffsets);

  if (!Array.isArray(floorModuleIdsByLevel['0'])) {
    throw new Error('Missing module IDs for level 0');
  }

  for (const levelOffset of ladderLevelOffsets) {
    ensureLadderFloorModules(levelOffset);
  }

  const allLevels = normalizeLevelOrder([
    0,
    ...Object.keys(floorModuleIdsByLevel)
      .map((key) => Number(key))
      .filter((value) => Number.isInteger(value)),
    ...ladderLevelOffsets
  ]);

  for (const levelOffset of allLevels) {
    const ids = getMiddleModuleIdsForLevel(levelOffset);
    const normalized = ids.filter((id) => !isFixedModuleType(createModuleFromTemplateId(id).moduleType));
    const ladderIndices = normalized
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => isLadderModuleId(id))
      .map(({ index }) => index);

    if (ladderLevels.has(levelOffset)) {
      if (ladderIndices.length === 0) {
        normalized.splice(Math.max(0, Math.floor(normalized.length / 2)), 0, ladderVariantSingleId);
      } else {
        const [baseIndex] = ladderIndices;
        if (baseIndex !== undefined) {
          normalized[baseIndex] = ladderVariantSingleId;
          for (let i = ladderIndices.length - 1; i >= 1; i -= 1) {
            const removeIndex = ladderIndices[i];
            if (removeIndex !== undefined) {
              normalized.splice(removeIndex, 1);
            }
          }
        }
      }
    } else if (ladderIndices.length > 0) {
      for (let i = ladderIndices.length - 1; i >= 0; i -= 1) {
        const removeIndex = ladderIndices[i];
        if (removeIndex !== undefined) {
          normalized.splice(removeIndex, 1);
        }
      }
    }

    setMiddleModuleIdsForLevel(levelOffset, normalized);
  }

  const keepLevels = new Set<number>([0, ...ladderLevelOffsets]);
  floorModuleIdsByLevel = Object.fromEntries(
    Object.entries(floorModuleIdsByLevel).filter(([key]) => keepLevels.has(Number(key)))
  );

  if (!Array.isArray(floorModuleIdsByLevel['0'])) {
    floorModuleIdsByLevel['0'] = ['captains_cabin_mk1', 'radio_room_mk1'];
  }
};

const findModuleIndexForZ = (
  z: number,
  placements: Array<{ id: string; centerZ: number; lengthM: number; widthM: number }>
): number | null => {
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index];
    if (!placement) {
      continue;
    }
    const minZ = placement.centerZ - (placement.lengthM / 2);
    const maxZ = placement.centerZ + (placement.lengthM / 2);
    if (z >= minZ && z <= maxZ) {
      return index;
    }
  }

  return null;
};

type TopologyMutation =
  | { kind: 'insert'; index: number }
  | { kind: 'remove'; index: number }
  | { kind: 'ladder-level' }
  | undefined;

const mapModuleIndexAfterTopologyMutation = (oldIndex: number, mutation: TopologyMutation): number | null => {
  if (!mutation) {
    return oldIndex;
  }

  if (mutation.kind === 'insert') {
    return oldIndex >= mutation.index ? oldIndex + 1 : oldIndex;
  }

  if (mutation.kind === 'remove') {
    if (oldIndex === mutation.index) {
      return null;
    }
    return oldIndex > mutation.index ? oldIndex - 1 : oldIndex;
  }

  if (mutation.kind === 'ladder-level') {
    return null;
  }

  return oldIndex;
};

const commitModuleChainTopology = (mutation?: TopologyMutation) => {
  const previousPlacements = modulePlacements.map((placement) => ({ ...placement }));
  const previousPlayerModuleIndex = findModuleIndexForZ(playerPosition.z, previousPlacements);
  const previousPlayerModuleLocalZ = previousPlayerModuleIndex === null
    ? 0
    : playerPosition.z - previousPlacements[previousPlayerModuleIndex]!.centerZ;

  normalizeLadderRoomVariants();
  syncSimulationModuleIds();
  rebuildModuleAssembly();

  if (previousPlayerModuleIndex !== null) {
    const remappedModuleIndex = mapModuleIndexAfterTopologyMutation(previousPlayerModuleIndex, mutation);
    if (remappedModuleIndex !== null) {
      const remappedPlacement = modulePlacements[remappedModuleIndex];
      if (remappedPlacement) {
        playerPosition.z = remappedPlacement.centerZ + previousPlayerModuleLocalZ;
      }
    }
  }

  syncMainBusPowerState();
  ensurePlayerInValidSpace();
  saveLocalState();
};

const removeModuleAtIndex = (index: number, levelOffset: number) => {
  const levelChain = getModuleChainForLevel(levelOffset);
  const target = levelChain[index];
  if (!target || isFixedModuleType(target.moduleType)) {
    return;
  }
  if (isLadderModuleId(target.id)) {
    ladderLevelOffsets = [];
  }
  levelChain.splice(index, 1);
  writeLevelChain(levelOffset, levelChain);
  commitModuleChainTopology({ kind: 'remove', index });
  showToast(`Removed ${target.id}`);
};

const insertModuleAtJoin = (joinIndex: number, templateId: string, levelOffset: number) => {
  const levelChain = getModuleChainForLevel(levelOffset);
  const template = createModuleFromTemplateId(templateId);
  if (isFixedModuleType(template.moduleType)) {
    throw new Error(`Cannot insert fixed module type: ${template.moduleType}`);
  }
  if (isLadderModuleId(template.id) && levelChain.some((moduleDoc) => isLadderModuleId(moduleDoc.id))) {
    showToast('Only one ladder module allowed per level');
    return;
  }
  const insertIndex = joinIndex + 1;
  levelChain.splice(insertIndex, 0, template);
  writeLevelChain(levelOffset, levelChain);
  if (isLadderModuleId(template.id)) {
    ladderLevelOffsets = [0];
  }
  commitModuleChainTopology({ kind: 'insert', index: insertIndex });
  showToast(`Inserted ${templateId}`);
};

const addLadderFloorAbove = (moduleIndex: number, levelOffset: number) => {
  const target = getModuleChainForLevel(levelOffset)[moduleIndex];
  if (!target || !isLadderModuleId(target.id)) {
    return;
  }
  const nextOffset = levelOffset + 1;
  if (!ladderLevelOffsets.includes(nextOffset)) {
    ensureLadderFloorModules(nextOffset);
    ladderLevelOffsets = normalizeLadderLevelOffsets([...ladderLevelOffsets, nextOffset]);
  }
  commitModuleChainTopology({ kind: 'ladder-level' });
  showToast('Added ladder floor above');
};

const addLadderFloorBelow = (moduleIndex: number, levelOffset: number) => {
  const target = getModuleChainForLevel(levelOffset)[moduleIndex];
  if (!target || !isLadderModuleId(target.id)) {
    return;
  }
  const nextOffset = levelOffset - 1;
  if (!ladderLevelOffsets.includes(nextOffset)) {
    ensureLadderFloorModules(nextOffset);
    ladderLevelOffsets = normalizeLadderLevelOffsets([...ladderLevelOffsets, nextOffset]);
  }
  commitModuleChainTopology({ kind: 'ladder-level' });
  showToast('Added ladder floor below');
};

const removeLadderFloorAbove = (moduleIndex: number, levelOffset: number) => {
  const target = getModuleChainForLevel(levelOffset)[moduleIndex];
  if (!target || !isLadderModuleId(target.id)) {
    showToast('No ladder floor above');
    return;
  }
  const targetOffset = levelOffset + 1;
  if (!ladderLevelOffsets.includes(targetOffset)) {
    showToast('No ladder floor above');
    return;
  }
  const nextOffsets = ladderLevelOffsets.filter((offset) => offset <= levelOffset);
  if (nextOffsets.length <= 0) {
    showToast('Cannot remove last ladder floor');
    return;
  }
  const removedCount = ladderLevelOffsets.length - nextOffsets.length;
  if (removedCount <= 0) {
    showToast('No ladder floor above');
    return;
  }
  ladderLevelOffsets = normalizeLadderLevelOffsets(nextOffsets);
  commitModuleChainTopology({ kind: 'ladder-level' });
  showToast(removedCount > 1 ? `Removed ${removedCount} floors above` : 'Removed ladder floor above');
};

const removeLadderFloorBelow = (moduleIndex: number, levelOffset: number) => {
  const target = getModuleChainForLevel(levelOffset)[moduleIndex];
  if (!target || !isLadderModuleId(target.id)) {
    showToast('No ladder floor below');
    return;
  }
  const targetOffset = levelOffset - 1;
  if (!ladderLevelOffsets.includes(targetOffset)) {
    showToast('No ladder floor below');
    return;
  }
  const nextOffsets = ladderLevelOffsets.filter((offset) => offset >= levelOffset);
  if (nextOffsets.length <= 0) {
    showToast('Cannot remove last ladder floor');
    return;
  }
  const removedCount = ladderLevelOffsets.length - nextOffsets.length;
  if (removedCount <= 0) {
    showToast('No ladder floor below');
    return;
  }
  ladderLevelOffsets = normalizeLadderLevelOffsets(nextOffsets);
  commitModuleChainTopology({ kind: 'ladder-level' });
  showToast(removedCount > 1 ? `Removed ${removedCount} floors below` : 'Removed ladder floor below');
};

const buildInsertModuleItems = (): MenuItem[] => {
  if (!pendingInsertContext) {
    return [
      {
        type: 'text',
        label: 'Insert',
        value: 'Select a + join point first.'
      }
    ];
  }

  const insertLevel = pendingInsertContext.levelOffset;
  const ladderAlreadyPresent = getModuleChainForLevel(insertLevel).some((moduleDoc) => isLadderModuleId(moduleDoc.id));

  return getInsertableModuleChoices().map((choice) => ({
    type: 'action',
    label: isLadderModuleId(choice.id) && ladderAlreadyPresent
      ? `${choice.label} (Already placed)`
      : choice.label,
    behavior: 'action',
    disabled: isLadderModuleId(choice.id) && ladderAlreadyPresent,
    onSelect: () => {
      const context = pendingInsertContext;
      if (!context) {
        return;
      }
      insertModuleAtJoin(context.joinIndex, choice.id, context.levelOffset);
      pendingInsertContext = null;
      closeAllMenus();
    }
  }));
};

const joinControlRaycaster = new THREE.Raycaster();
const joinControlNdc = new THREE.Vector2();

const setInteractionRayFromEvent = (event: MouseEvent) => {
  const isPointerLocked = document.pointerLockElement === renderer.domElement;
  if (isPointerLocked) {
    joinControlNdc.set(0, 0);
  } else {
    const rect = renderer.domElement.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    joinControlNdc.set((relX * 2) - 1, -(relY * 2) + 1);
  }

  joinControlRaycaster.setFromCamera(joinControlNdc, camera);
};

const pickJoinControl = (event: MouseEvent): JoinControlTarget | null => {
  setInteractionRayFromEvent(event);
  const visibleControls = joinControlTargets
    .filter((target) => target.object.visible)
    .map((target) => target.object);
  const hits = joinControlRaycaster.intersectObjects(visibleControls, false);
  for (const hit of hits) {
    let object: THREE.Object3D | null = hit.object;
    while (object) {
      const target = joinControlByObjectId.get(object.id);
      if (target) {
        return target;
      }
      object = object.parent;
    }
  }

  return null;
};

const pickInteractableTarget = (event: MouseEvent): THREE.Object3D | null => {
  setInteractionRayFromEvent(event);
  const nearbyTargets = interactableTargets.filter((interactTarget) => {
    interactTarget.getWorldPosition(paperInteractWorldPos);
    return paperInteractWorldPos.distanceTo(playerPosition) <= interactDistanceM;
  });

  if (nearbyTargets.length === 0) {
    return null;
  }

  const hits = joinControlRaycaster.intersectObjects(nearbyTargets, false);
  return hits[0]?.object ?? null;
};

interface ModuleInteractionHandler {
  readonly kind: string;
  handleSelect: () => void;
}

const moduleInteractionHandlers: ModuleInteractionHandler[] = [
  {
    kind: 'captains-letter-paper',
    handleSelect: () => {
      openMenu('captainsLetterMenu');
      showToast('Reading letter');
    }
  },
  {
    kind: 'battery-control-panel',
    handleSelect: () => {
      openMenu('batteryControlMenu');
      showToast('Battery controls');
    }
  }
];

const activateInteractableTarget = (target: THREE.Object3D): boolean => {
  const interactionKind = target.userData.interactionKind;
  if (typeof interactionKind !== 'string') {
    return false;
  }

  const handler = moduleInteractionHandlers.find((candidate) => candidate.kind === interactionKind);
  if (!handler) {
    return false;
  }

  handler.handleSelect();
  return true;
};

renderer.domElement.addEventListener('click', (event) => {
  if (menuVisible || controlsListeningFor) {
    return;
  }

  if (document.pointerLockElement !== renderer.domElement) {
    void renderer.domElement.requestPointerLock();
    return;
  }

  const target = pickJoinControl(event);
  if (target) {
    if (target.kind === 'insert') {
      pendingInsertContext = { joinIndex: target.joinIndex, levelOffset: target.levelOffset ?? 0 };
      openMenu('insertModuleMenu');
      return;
    }
    if (target.kind === 'remove-left') {
      removeModuleAtIndex(target.joinIndex, target.levelOffset ?? 0);
      return;
    }
    if (target.kind === 'ladder-add-above') {
      const moduleIndex = target.moduleIndex ?? target.joinIndex;
      addLadderFloorAbove(moduleIndex, target.levelOffset ?? 0);
      return;
    }
    if (target.kind === 'ladder-add-below') {
      const moduleIndex = target.moduleIndex ?? target.joinIndex;
      addLadderFloorBelow(moduleIndex, target.levelOffset ?? 0);
      return;
    }
    if (target.kind === 'ladder-remove-above') {
      const moduleIndex = target.moduleIndex ?? target.joinIndex;
      removeLadderFloorAbove(moduleIndex, target.levelOffset ?? 0);
      return;
    }
    if (target.kind === 'ladder-remove-below') {
      const moduleIndex = target.moduleIndex ?? target.joinIndex;
      removeLadderFloorBelow(moduleIndex, target.levelOffset ?? 0);
      return;
    }
    removeModuleAtIndex(target.joinIndex + 1, target.levelOffset ?? 0);
    return;
  }

  const interactTarget = pickInteractableTarget(event);
  if (interactTarget && activateInteractableTarget(interactTarget)) {
    return;
  }
});

window.addEventListener('mousemove', (event) => {
  if (menuVisible || document.pointerLockElement !== renderer.domElement) {
    return;
  }

  playerYaw -= event.movementX * mouseLookSensitivity;
  const pitchDirection = settings.controls.invertMouseY ? 1 : -1;
  playerPitch += event.movementY * mouseLookSensitivity * pitchDirection;
  playerPitch = clamp(playerPitch, playerPitchMin, playerPitchMax);
  syncPlayerCamera();
});

const applyBehavior = (behavior: MenuBehavior, target?: MenuName, onSelect?: () => void) => {
  if (onSelect) {
    onSelect();
  }
  if (behavior === 'submenu' && target) {
    openMenu(target);
    return;
  }
  if (behavior === 'back') {
    popMenu();
    return;
  }
  if (behavior === 'close') {
    closeAllMenus();
    return;
  }
  if (behavior === 'keep-open') {
    drainSimulationEvents();
    reconcileMainBusPowerEdge();
    drainSimulationEvents();
    updateStatusFromSimulation();
    if (isBatteryControlMenuVisible()) {
      applyBatteryMenuStatsToLiveBindings(getBatteryMenuStatsSnapshot());
      return;
    }
    renderCurrentMenu();
  }
};

const renderSettingItem = (item: SettingMenuItem) => {
  const row = document.createElement('div');
  row.className = 'menu-setting-row';

  const label = document.createElement('div');
  label.className = 'menu-setting-label ui-label';
  label.textContent = item.label;

  const value = document.createElement('div');
  value.className = 'menu-setting-value ui-value';
  value.textContent = item.value;
  if (item.liveValueKey) {
    liveMenuValueBindings.set(item.liveValueKey, value);
  }

  const actions = document.createElement('div');
  actions.className = 'menu-setting-actions';

  item.actions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pixel-button menu-btn-small';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      applyBehavior(action.behavior, undefined, action.onSelect);
    });
    actions.appendChild(button);
  });

  row.append(label, value, actions);
  return row;
};

const renderControlItem = (item: ControlMenuItem) => {
  const row = document.createElement('div');
  row.className = 'menu-setting-row menu-control-row';

  const label = document.createElement('div');
  label.className = 'menu-setting-label ui-label';
  label.textContent = item.label;

  const slots = document.createElement('div');
  slots.className = 'menu-control-slots';

  const makeSlotButton = (slot: 0 | 1, value: ControlBinding) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pixel-button menu-btn-small menu-control-btn';
    button.textContent = formatBindingName(value);
    button.addEventListener('click', () => {
      startListeningForBinding(item.action, slot, button, null);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        startListeningForBinding(item.action, slot, button, event.code);
      }
    });
    return button;
  };

  const primary = makeSlotButton(0, item.primary);
  const secondary = makeSlotButton(1, item.secondary);
  slots.append(primary, secondary);

  row.append(label, slots);
  return row;
};

const renderTextItem = (item: TextMenuItem) => {
  const row = document.createElement('div');
  row.className = 'menu-setting-row';

  const label = document.createElement('div');
  label.className = 'menu-setting-label ui-label';
  label.textContent = item.label;

  if (item.href) {
    const link = document.createElement('a');
    link.href = item.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'menu-link ui-value';
    link.textContent = item.value;
    row.append(label, link);
  } else {
    const value = document.createElement('div');
    value.className = 'menu-setting-value ui-value';
    value.textContent = item.value;
    if (item.liveValueKey) {
      liveMenuValueBindings.set(item.liveValueKey, value);
    }
    row.append(label, value);
  }

  return row;
};

const renderImageLinkItem = (item: ImageLinkMenuItem) => {
  const row = document.createElement('div');
  row.className = 'menu-setting-row menu-image-row';

  const label = document.createElement('div');
  label.className = 'menu-setting-label ui-label';
  label.textContent = item.label;

  const link = document.createElement('a');
  link.href = item.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'menu-image-link';

  const image = document.createElement('img');
  image.src = item.src;
  image.alt = item.alt;
  image.className = 'menu-image';
  link.appendChild(image);

  row.append(label, link);
  return row;
};

const renderLetterItem = (item: LetterMenuItem) => {
  const letter = document.createElement('article');
  letter.className = 'menu-letter';

  const header = document.createElement('header');
  header.className = 'menu-letter-header';

  const from = document.createElement('div');
  from.className = 'menu-letter-meta ui-value';
  from.textContent = `From: ${item.from}`;

  const to = document.createElement('div');
  to.className = 'menu-letter-meta ui-value';
  to.textContent = `To: ${item.to}`;

  const subject = document.createElement('div');
  subject.className = 'menu-letter-meta ui-value';
  subject.textContent = `Subject: ${item.subject}`;

  const dateUtc = document.createElement('div');
  dateUtc.className = 'menu-letter-meta ui-value';
  dateUtc.textContent = item.dateUtc;

  header.append(from, to, subject, dateUtc);

  const body = document.createElement('div');
  body.className = 'menu-letter-body';
  item.paragraphs.forEach((paragraphText) => {
    const paragraph = document.createElement('p');
    paragraph.className = 'menu-letter-paragraph';
    paragraph.textContent = paragraphText;
    body.appendChild(paragraph);
  });

  letter.append(header, body);
  return letter;
};

const renderCurrentMenu = () => {
  menuPanel.dataset.visible = menuVisible ? 'true' : 'false';
  menuToggleButton.setAttribute('aria-expanded', menuVisible ? 'true' : 'false');

  if (!menuVisible) {
    liveMenuValueBindings.clear();
    stopListeningForBinding();
    menuFocusIndex = 0;
    return;
  }

  if (menuStack.length === 0) {
    menuStack.push({ menuName: 'mainMenu' });
  }

  const current = menuStack[menuStack.length - 1];
  if (!current) {
    return;
  }

  const definition = MENUS[current.menuName];
  const items = definition.itemBuilder ? definition.itemBuilder() : [];

  menuTitle.textContent = definition.title;
  menuOverview.textContent = definition.overview;
  menuItems.innerHTML = '';
  menuActions.innerHTML = '';
  liveMenuValueBindings.clear();

  items.forEach((item) => {
    if (item.type === 'divider') {
      const divider = document.createElement('hr');
      divider.className = 'menu-divider';
      menuItems.appendChild(divider);
      return;
    }

    if (item.type === 'action') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pixel-button menu-item-btn${item.danger ? ' danger' : ''}`;
      button.textContent = item.value ? `${item.label}: ${item.value}` : item.label;
      button.disabled = !!item.disabled;
      button.addEventListener('click', () => {
        applyBehavior(item.behavior, item.target, item.onSelect);
      });
      menuItems.appendChild(button);
      return;
    }

    if (item.type === 'setting') {
      menuItems.appendChild(renderSettingItem(item));
      return;
    }

    if (item.type === 'control') {
      menuItems.appendChild(renderControlItem(item));
      return;
    }

    if (item.type === 'text') {
      menuItems.appendChild(renderTextItem(item));
      return;
    }

    if (item.type === 'letter') {
      menuItems.appendChild(renderLetterItem(item));
      return;
    }

    menuItems.appendChild(renderImageLinkItem(item));
  });

  (definition.actions ?? []).forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pixel-button menu-action-btn${action.danger ? ' danger' : ''}`;
    button.textContent = action.label;
    button.addEventListener('click', () => {
      applyBehavior(action.behavior, action.target, action.onSelect);
    });
    menuActions.appendChild(button);
  });

  focusMenuIndex(menuFocusIndex);

  if (current.menuName === 'batteryControlMenu') {
    applyBatteryMenuStatsToLiveBindings(getBatteryMenuStatsSnapshot());
  }
};

const adjustNumber = (value: number, delta: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value + delta));
};

const toggleMute = () => {
  settings.audio.muted = !settings.audio.muted;
  saveLocalState();
};

const cycleQuality = () => {
  const order: Quality[] = ['low', 'medium', 'high'];
  const currentIndex = order.indexOf(settings.graphics.quality);
  const next = order[(currentIndex + 1) % order.length] ?? 'medium';
  settings.graphics.quality = next;
  saveLocalState();
};

const buildMainMenuItems = (): MenuItem[] => [
  {
    type: 'action',
    label: 'New Game',
    behavior: 'action',
    onSelect: startNewGame
  },
  {
    type: 'action',
    label: 'Resume Game',
    behavior: 'action',
    disabled: !hasSavedGame(),
    onSelect: resumeGame
  },
  {
    type: 'action',
    label: 'Export Game',
    behavior: 'action',
    onSelect: exportSave
  },
  {
    type: 'action',
    label: 'Import Game',
    behavior: 'action',
    onSelect: importSave
  },
  {
    type: 'action',
    label: 'Settings',
    behavior: 'submenu',
    target: 'settingsMenu'
  },
  {
    type: 'action',
    label: 'About',
    behavior: 'submenu',
    target: 'aboutMenu'
  }
];

const buildSettingsItems = (): MenuItem[] => [
  {
    type: 'action',
    label: 'Graphics',
    behavior: 'submenu',
    target: 'graphicsMenu'
  },
  {
    type: 'action',
    label: 'Audio',
    behavior: 'submenu',
    target: 'audioMenu'
  },
  {
    type: 'action',
    label: 'Controls',
    behavior: 'submenu',
    target: 'controlsMenu'
  },
  {
    type: 'action',
    label: 'Advanced',
    behavior: 'submenu',
    target: 'advancedMenu'
  }
];

const buildGraphicsItems = (): MenuItem[] => [
  {
    type: 'setting',
    label: 'Theme',
    value: settings.themeMode,
    actions: [
      {
        label: 'Cycle',
        behavior: 'keep-open',
        onSelect: () => {
          const index = modeCycle.indexOf(currentTheme);
          currentTheme = modeCycle[(index + 1) % modeCycle.length] ?? 'system';
          setTheme(currentTheme);
        }
      }
    ]
  },
  {
    type: 'setting',
    label: 'Quality',
    value: settings.graphics.quality,
    actions: [
      {
        label: 'Cycle',
        behavior: 'keep-open',
        onSelect: cycleQuality
      }
    ]
  },
  {
    type: 'setting',
    label: 'Pixel Scale',
    value: String(settings.graphics.pixelScale),
    actions: [
      {
        label: '-',
        behavior: 'keep-open',
        onSelect: () => {
          settings.graphics.pixelScale = adjustNumber(settings.graphics.pixelScale, -1, 1, 4);
          saveLocalState();
        }
      },
      {
        label: '+',
        behavior: 'keep-open',
        onSelect: () => {
          settings.graphics.pixelScale = adjustNumber(settings.graphics.pixelScale, 1, 1, 4);
          saveLocalState();
        }
      }
    ]
  },
  {
    type: 'setting',
    label: 'Scanlines',
    value: settings.graphics.showScanlines ? 'On' : 'Off',
    actions: [
      {
        label: 'Toggle',
        behavior: 'keep-open',
        onSelect: () => {
          settings.graphics.showScanlines = !settings.graphics.showScanlines;
          saveLocalState();
        }
      }
    ]
  }
];

const buildAudioItems = (): MenuItem[] => [
  {
    type: 'setting',
    label: 'Master Volume',
    value: `${settings.audio.masterVolume}%`,
    actions: [
      {
        label: '-',
        behavior: 'keep-open',
        onSelect: () => {
          settings.audio.masterVolume = adjustNumber(settings.audio.masterVolume, -5, 0, 100);
          saveLocalState();
        }
      },
      {
        label: '+',
        behavior: 'keep-open',
        onSelect: () => {
          settings.audio.masterVolume = adjustNumber(settings.audio.masterVolume, 5, 0, 100);
          saveLocalState();
        }
      }
    ]
  },
  {
    type: 'setting',
    label: 'UI Volume',
    value: `${settings.audio.uiVolume}%`,
    actions: [
      {
        label: '-',
        behavior: 'keep-open',
        onSelect: () => {
          settings.audio.uiVolume = adjustNumber(settings.audio.uiVolume, -5, 0, 100);
          saveLocalState();
        }
      },
      {
        label: '+',
        behavior: 'keep-open',
        onSelect: () => {
          settings.audio.uiVolume = adjustNumber(settings.audio.uiVolume, 5, 0, 100);
          saveLocalState();
        }
      }
    ]
  },
  {
    type: 'setting',
    label: 'Muted',
    value: settings.audio.muted ? 'Yes' : 'No',
    actions: [
      {
        label: 'Toggle',
        behavior: 'keep-open',
        onSelect: toggleMute
      }
    ]
  }
];

const buildControlsItems = (): MenuItem[] => {
  const items: MenuItem[] = [
    {
      type: 'setting',
      label: 'Invert Mouse Y',
      value: settings.controls.invertMouseY ? 'On' : 'Off',
      actions: [
        {
          label: 'Toggle',
          behavior: 'keep-open',
          onSelect: () => {
            settings.controls.invertMouseY = !settings.controls.invertMouseY;
            saveLocalState();
          }
        }
      ]
    },
    {
      type: 'divider'
    },
    {
      type: 'text',
      label: 'Rebind',
      value: 'Click a slot, then press key or move gamepad input. Del/Backspace clears.'
    },
    {
      type: 'divider'
    }
  ];

  CONTROL_ACTIONS.forEach((action) => {
    const pair = settings.controls.bindings[action];
    items.push({
      type: 'control',
      action,
      label: CONTROL_LABELS[action],
      primary: pair[0],
      secondary: pair[1]
    });
  });

  items.push({
    type: 'divider'
  });

  items.push({
    type: 'action',
    label: 'Reset Controls',
    behavior: 'keep-open',
    onSelect: () => {
      settings.controls.bindings = defaultControls();
      saveLocalState();
      stopListeningForBinding();
      showToast('Controls reset');
    }
  });

  return items;
};

const buildAdvancedItems = (): MenuItem[] => [
  {
    type: 'setting',
    label: 'Autosave (sec)',
    value: `${settings.advanced.autosaveSeconds}`,
    actions: [
      {
        label: '-',
        behavior: 'keep-open',
        onSelect: () => {
          settings.advanced.autosaveSeconds = adjustNumber(settings.advanced.autosaveSeconds, -1, 2, 60);
          saveLocalState();
        }
      },
      {
        label: '+',
        behavior: 'keep-open',
        onSelect: () => {
          settings.advanced.autosaveSeconds = adjustNumber(settings.advanced.autosaveSeconds, 1, 2, 60);
          saveLocalState();
        }
      }
    ]
  },
  {
    type: 'setting',
    label: 'Diagnostics',
    value: settings.advanced.diagnostics ? 'On' : 'Off',
    actions: [
      {
        label: 'Toggle',
        behavior: 'keep-open',
        onSelect: () => {
          settings.advanced.diagnostics = !settings.advanced.diagnostics;
          saveLocalState();
        }
      }
    ]
  }
];

const buildAboutItems = (): MenuItem[] => [
  {
    type: 'text',
    label: 'Title',
    value: 'Airship One'
  },
  {
    type: 'text',
    label: 'Version',
    value: appVersion
  },
  {
    type: 'text',
    label: 'Developer',
    value: 'Timeless Prototype'
  },
  {
    type: 'text',
    label: 'Authors',
    value: 'Timeless Prototype, GPT-5.3-Codex'
  },
  {
    type: 'image-link',
    label: 'Support',
    src: `${import.meta.env.BASE_URL}assets/bmac/default-yellow.png`,
    href: 'https://buymeacoffee.com/timelessp',
    alt: 'Buy Me A Coffee'
  }
];

const buildCaptainsLetterItems = (): MenuItem[] => [
  {
    type: 'letter',
    from: 'Chief Engineer Mirelle Kade',
    to: 'Captain',
    subject: 'Stormline routing and trim guidance',
    dateUtc: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    paragraphs: [
      'Stormline reports are true. Crosswind shears are rising along the northern route.',
      'I tightened the aft stabilizer rigging, but avoid hard turns after dusk until we re-balance ballast.',
      'If we must press on, keep her nose five degrees high and trim slow. She will answer kindly.'
    ]
  }
];

const buildBatteryControlItems = (): MenuItem[] => {
  const telemetry = getElectricalTelemetry(simulation.updatedAt || Date.now());

  return [
  {
    type: 'setting',
    label: 'Main Bus',
    value: simulation.mainBusConnected ? 'Connected' : 'Disconnected',
    liveValueKey: 'main-bus-connect',
    actions: [
      {
        label: 'Toggle',
        behavior: 'keep-open',
        onSelect: () => {
          enqueueSimulationEvent({ type: 'power/toggle-main-bus-connect' });
        }
      }
    ]
  },
  {
    type: 'setting',
    label: 'Solar Panels → Charge Bus',
    value: simulation.solarPanelsConnected ? 'Connected' : 'Disconnected',
    liveValueKey: 'solar-connect',
    actions: [
      {
        label: 'Toggle',
        behavior: 'keep-open',
        onSelect: () => {
          enqueueSimulationEvent({ type: 'power/toggle-solar-connect' });
        }
      }
    ]
  },
  {
    type: 'divider'
  },
  {
    type: 'setting',
    label: 'Battery A → Bus',
    value: simulation.batteryAConnectedToBus ? 'Connected' : 'Disconnected',
    liveValueKey: 'battery-a-connect',
    actions: [
      {
        label: 'Toggle',
        behavior: 'keep-open',
        onSelect: () => {
          enqueueSimulationEvent({ type: 'battery/toggle-a-bus' });
        }
      }
    ]
  },
  {
    type: 'setting',
    label: 'Battery B → Bus',
    value: simulation.batteryBConnectedToBus ? 'Connected' : 'Disconnected',
    liveValueKey: 'battery-b-connect',
    actions: [
      {
        label: 'Toggle',
        behavior: 'keep-open',
        onSelect: () => {
          enqueueSimulationEvent({ type: 'battery/toggle-b-bus' });
        }
      }
    ]
  },
  {
    type: 'setting',
    label: 'Lights Main',
    value: simulation.lightsMainOn ? 'On' : 'Off',
    liveValueKey: 'lights-main',
    actions: [
      {
        label: 'Toggle',
        behavior: 'keep-open',
        onSelect: () => {
          enqueueSimulationEvent({ type: 'battery/toggle-lights-main' });
        }
      }
    ]
  },
  {
    type: 'divider'
  },
  {
    type: 'text',
    label: 'Battery A',
    value: formatBatteryPercent(simulation.batteryACharge),
    liveValueKey: 'battery-a-charge'
  },
  {
    type: 'text',
    label: 'Battery B',
    value: formatBatteryPercent(simulation.batteryBCharge),
    liveValueKey: 'battery-b-charge'
  },
  {
    type: 'text',
    label: 'Solar Effectiveness',
    value: `${(telemetry.solarEffectiveness * 100).toFixed(0)}%`,
    liveValueKey: 'solar-effectiveness'
  },
  {
    type: 'text',
    label: 'Solar Charge',
    value: `${telemetry.solarChargeCurrentA.toFixed(1)} A (${ELECTRICAL_CONFIG.solarArrayNominalVoltageV} V array → ${ELECTRICAL_CONFIG.mainBusNominalVoltageV} V bus)`,
    liveValueKey: 'solar-charge-current'
  },
  {
    type: 'text',
    label: 'Active Load',
    value: `${telemetry.loadCurrentA.toFixed(1)} A @ ${ELECTRICAL_CONFIG.mainBusNominalVoltageV} V`,
    liveValueKey: 'load-current'
  },
  {
    type: 'text',
    label: 'Net Battery Current',
    value: `${telemetry.netBatteryCurrentA >= 0 ? '+' : ''}${telemetry.netBatteryCurrentA.toFixed(1)} A`,
    liveValueKey: 'net-battery-current'
  }
];
};

const MENUS: Record<MenuName, MenuDefinition> = {
  mainMenu: {
    isRoot: true,
    title: 'Main Menu',
    overview: 'Start, resume, and manage local save data.',
    itemBuilder: buildMainMenuItems,
    actions: [
      {
        label: 'Close',
        behavior: 'close'
      }
    ]
  },
  settingsMenu: {
    isRoot: false,
    title: 'Settings',
    overview: 'Configure graphics, audio, controls, and advanced options.',
    itemBuilder: buildSettingsItems,
    actions: [
      {
        label: 'Back',
        behavior: 'back'
      }
    ]
  },
  graphicsMenu: {
    isRoot: false,
    title: 'Graphics',
    overview: 'Visual display configuration.',
    itemBuilder: buildGraphicsItems,
    actions: [
      {
        label: 'Back',
        behavior: 'back'
      }
    ]
  },
  audioMenu: {
    isRoot: false,
    title: 'Audio',
    overview: 'Master and interface audio levels.',
    itemBuilder: buildAudioItems,
    actions: [
      {
        label: 'Back',
        behavior: 'back'
      }
    ]
  },
  controlsMenu: {
    isRoot: false,
    title: 'Controls',
    overview: 'Dual keyboard/gamepad bindings with HID capture.',
    itemBuilder: buildControlsItems,
    actions: [
      {
        label: 'Back',
        behavior: 'back'
      }
    ]
  },
  advancedMenu: {
    isRoot: false,
    title: 'Advanced',
    overview: 'Autosave cadence and diagnostics toggle.',
    itemBuilder: buildAdvancedItems,
    actions: [
      {
        label: 'Back',
        behavior: 'back'
      }
    ]
  },
  aboutMenu: {
    isRoot: false,
    title: 'About',
    overview: 'Project metadata and credits.',
    itemBuilder: buildAboutItems,
    actions: [
      {
        label: 'Back',
        behavior: 'back'
      }
    ]
  },
  insertModuleMenu: {
    isRoot: false,
    title: 'Insert Module',
    overview: 'Choose a module to insert at selected join.',
    itemBuilder: buildInsertModuleItems,
    actions: [
      {
        label: 'Back',
        behavior: 'back'
      }
    ]
  },
  captainsLetterMenu: {
    isRoot: true,
    title: "Captain's Letter",
    overview: 'A folded note left on your desk.',
    itemBuilder: buildCaptainsLetterItems,
    actions: [
      {
        label: 'Close',
        behavior: 'close'
      }
    ]
  },
  batteryControlMenu: {
    isRoot: true,
    title: 'Battery Control Panel',
    overview: 'Bus tie controls, lights switch, and live battery state.',
    itemBuilder: buildBatteryControlItems,
    actions: [
      {
        label: 'Close',
        behavior: 'close'
      }
    ]
  }
};

themeButton.addEventListener('click', () => {
  const modeIndex = modeCycle.indexOf(currentTheme);
  const nextMode = modeCycle[(modeIndex + 1) % modeCycle.length] ?? 'system';
  currentTheme = nextMode;
  setTheme(currentTheme);
  renderCurrentMenu();
});

window.matchMedia(SYSTEM_DARK_QUERY).addEventListener('change', () => {
  if (currentTheme === 'system') {
    setTheme(currentTheme);
    renderCurrentMenu();
  }
});

window.addEventListener('keydown', (event) => {
  keys[event.code] = true;

  if (handleBindingKeydown(event)) {
    return;
  }

  if (event.key === 'Escape' && menuVisible) {
    event.preventDefault();
    popMenu();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

menuToggleButton.addEventListener('click', () => {
  if (menuVisible) {
    closeAllMenus();
  } else {
    openMenu('mainMenu');
  }
});

const updatePixelScale = () => {
  const side = Math.max(1, Math.floor(Math.min(gameSquare.clientWidth, gameSquare.clientHeight)));
  const pixelScale = Math.max(1, Math.floor(side / 320));
  const rootFontPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const rowRem = side / 24 / rootFontPx;
  const textRem = Math.max(0.875, Math.min(1.5, rowRem * 0.92));
  gameSquare.style.setProperty('--u', `${(pixelScale * settings.graphics.pixelScale) / rootFontPx}rem`);
  gameSquare.style.setProperty('--row', `${rowRem}rem`);
  gameSquare.style.setProperty('--text-size', `${textRem}rem`);
};

const resizeObserver = new ResizeObserver(() => {
  updatePixelScale();
});
resizeObserver.observe(gameSquare);
window.addEventListener('resize', updatePixelScale);

let lastTime = performance.now();
const loop = (now: number) => {
  const delta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  const menuActionState = getMenuActionState();
  const menuActionEdges = getActionEdges(lastMenuActionState, menuActionState);

  if (!controlsListeningFor) {
    if (!menuVisible && menuActionEdges.pause) {
      openMenu('mainMenu');
    } else if (menuVisible) {
      if (menuActionEdges.pause) {
        closeAllMenus();
      } else {
        const backwardEdge = menuActionEdges.up || menuActionEdges.left;
        const forwardEdge = menuActionEdges.down || menuActionEdges.right;
        if (backwardEdge) {
          moveMenuFocus(-1);
        }
        if (forwardEdge) {
          moveMenuFocus(1);
        }
        if (menuActionEdges.confirm) {
          activateFocusedMenuItem();
        }
        if (menuActionEdges.back) {
          popMenu();
        }
      }
    }
  }

  drainSimulationEvents();

  if (simulation.running) {
    simAccumulatorSeconds = Math.min(
      simAccumulatorSeconds + delta,
      SIM_TICK_SECONDS * SIM_MAX_CATCHUP_STEPS
    );

    let stepsTaken = 0;
    while (simAccumulatorSeconds >= SIM_TICK_SECONDS && stepsTaken < SIM_MAX_CATCHUP_STEPS) {
      stepSimulationTick(now);
      simAccumulatorSeconds -= SIM_TICK_SECONDS;
      stepsTaken += 1;
    }
  } else {
    simAccumulatorSeconds = 0;
  }

  reconcileMainBusPowerEdge();
  drainSimulationEvents();

  updateStatusFromSimulation();

  ensurePlayerInValidSpace();

  if (!menuVisible && !controlsListeningFor) {
    const forwardInput = (isActionPressed('up') ? 1 : 0) - (isActionPressed('down') ? 1 : 0);
    const strafeInput = (isActionPressed('left') ? 1 : 0) - (isActionPressed('right') ? 1 : 0);

    if (activeClimbVolume) {
      alignPlayerToClimbVolume(activeClimbVolume, delta);

      const detachRequested = menuActionEdges.back || menuActionEdges.down;
      if (detachRequested) {
        exitActiveClimb(getStandingEyeYForClimbVolume(activeClimbVolume));
      }

      const climbInput = isActionPressed('up') ? 1 : 0;
      if (!detachRequested && climbInput !== 0) {
        const climbDirection = Math.abs(playerLook.y) < 0.08 ? 1 : Math.sign(playerLook.y || 1) as -1 | 1;
        playerPosition.y += climbDirection * ladderClimbSpeedMps * delta;

        const [currentCenterY, currentSizeY] = (() => {
          const [, cy] = getVector3(activeClimbVolume.center, `climb volume center (${activeClimbVolume.id})`);
          const [, sy] = getVector3(activeClimbVolume.size, `climb volume size (${activeClimbVolume.id})`);
          return [cy, sy] as const;
        })();
        const currentMinY = currentCenterY - (currentSizeY / 2);
        const currentMaxY = currentCenterY + (currentSizeY / 2);

        if (climbDirection > 0 && playerPosition.y >= currentMaxY - 0.12) {
          const above = getAdjacentClimbVolume(activeClimbVolume, 1);
          if (above) {
            activeClimbVolume = above;
            const [, aboveCenterY] = getVector3(above.center, `climb volume center (${above.id})`);
            const [, aboveSizeY] = getVector3(above.size, `climb volume size (${above.id})`);
            const aboveMinY = aboveCenterY - (aboveSizeY / 2);
            playerPosition.y = Math.max(playerPosition.y, aboveMinY + 0.1);
          } else {
            playerPosition.y = Math.min(playerPosition.y, currentMaxY - 0.04);
          }
        }

        if (climbDirection < 0 && playerPosition.y <= currentMinY + 0.12) {
          const below = getAdjacentClimbVolume(activeClimbVolume, -1);
          if (below) {
            activeClimbVolume = below;
            const [, belowCenterY] = getVector3(below.center, `climb volume center (${below.id})`);
            const [, belowSizeY] = getVector3(below.size, `climb volume size (${below.id})`);
            const belowMaxY = belowCenterY + (belowSizeY / 2);
            playerPosition.y = Math.min(playerPosition.y, belowMaxY - 0.1);
          } else {
            playerPosition.y = Math.max(playerPosition.y, currentMinY + 0.04);
          }
        }
      }

      if (activeClimbVolume) {
        alignPlayerToClimbVolume(activeClimbVolume, delta);
      }
    } else if (forwardInput !== 0 || strafeInput !== 0) {
      playerForward.set(Math.sin(playerYaw), 0, Math.cos(playerYaw));
      playerRight.set(Math.cos(playerYaw), 0, -Math.sin(playerYaw));

      const movement = new THREE.Vector3();
      movement.addScaledVector(playerForward, forwardInput);
      movement.addScaledVector(playerRight, strafeInput);
      if (movement.lengthSq() > 0) {
        movement.normalize().multiplyScalar(playerMoveSpeedMps * delta);
        const candidate = playerPosition.clone().add(movement);
        if (isOccupiablePoint(candidate)) {
          playerPosition.copy(candidate);
        } else {
          const slideX = playerPosition.clone();
          slideX.x = candidate.x;
          if (isOccupiablePoint(slideX)) {
            playerPosition.copy(slideX);
          }

          const slideZ = playerPosition.clone();
          slideZ.z = candidate.z;
          if (isOccupiablePoint(slideZ)) {
            playerPosition.copy(slideZ);
          }
        }
      }
    }
  }

  updateJoinControlVisibility();

  syncPlayerCamera();
  updateGlobalLightingFromUtc(Date.now());

  if (settings.graphics.quality === 'low') {
    renderer.setPixelRatio(1);
  } else if (settings.graphics.quality === 'medium') {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  } else {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  const autosaveEveryMs = settings.advanced.autosaveSeconds * 1000;
  if (now - lastAutosaveAt >= autosaveEveryMs) {
    saveLocalState();
    lastAutosaveAt = now;
  }

  renderer.render(scene, camera);
  lastMenuActionState = menuActionState;
  requestAnimationFrame(loop);
};

const bootstrap = async () => {
  loadLocalState();
  ladderLevelOffsets = [...(simulation.ladderLevelOffsets ?? [])];
  hydrateFloorModuleIdsByLevel();
  await preloadTileTextures();
  applyPlayerPoseFromSimulation();
  normalizeLadderRoomVariants();
  rebuildModuleAssembly();
  syncMainBusPowerState();
  applyPlayerPoseFromSimulation();
  syncSimulationModuleIds();
  currentTheme = settings.themeMode;
  setTheme(currentTheme);
  updatePixelScale();
  updateStatusFromSimulation();
  openMenu('mainMenu');
  await loadVersion();
  renderCurrentMenu();
  requestAnimationFrame(loop);
  registerServiceWorker();
};

void bootstrap();
