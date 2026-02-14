import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/intel-one-mono/latin-400.css';
import '@fontsource/intel-one-mono/latin-700.css';
import '@fontsource/patrick-hand/latin-400.css';
import * as THREE from 'three';
import './styles.css';
import { registerServiceWorker } from './pwa/register-sw';
import cockpitModule from './content/modules/cockpit_mk1.module.json';
import captainsCabinModule from './content/modules/captains_cabin_mk1.module.json';
import radioRoomModule from './content/modules/radio_room_mk1.module.json';
import cargoModule from './content/modules/cargo_mk1.module.json';
import emptyRoomModule from './content/modules/empty_room_mk1.module.json';

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
  | 'insertModuleMenu';
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
  updatedAt: number;
  moduleIds: string[];
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
  href?: string;
}

interface ImageLinkMenuItem {
  type: 'image-link';
  label: string;
  src: string;
  href: string;
  alt: string;
}

interface DividerMenuItem {
  type: 'divider';
}

type MenuItem = ActionMenuItem | SettingMenuItem | ControlMenuItem | TextMenuItem | ImageLinkMenuItem | DividerMenuItem;

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

interface ModuleBlockMaterial {
  tileId: string;
  uvMode: 'repeat';
  worldScaleM: number[];
}

interface ModuleBoxBlock {
  id: string;
  primitive: 'box';
  role: string;
  center: number[];
  size: number[];
  material: ModuleBlockMaterial;
}

interface ModuleCylinderBlock {
  id: string;
  primitive: 'cylinder';
  role: string;
  center: number[];
  radiusTop: number;
  radiusBottom: number;
  height: number;
  radialSegments: number;
  material: ModuleBlockMaterial;
}

type ModuleBlock = ModuleBoxBlock | ModuleCylinderBlock;

interface ModuleVolume {
  id: string;
  shape: 'box';
  kind: 'walkable' | 'blocked' | 'climb' | 'headBump' | 'doorway';
  center: number[];
  size: number[];
}

interface ModuleVolumeSet {
  walkable: ModuleVolume[];
  blocked: ModuleVolume[];
  climb: ModuleVolume[];
  headBump: ModuleVolume[];
  doorway: ModuleVolume[];
}

interface GeneratedModule {
  id: string;
  moduleType: string;
  size: {
    lengthM: number;
    widthM: number;
    heightM: number;
  };
  geometry: {
    blocks: ModuleBlock[];
  };
  volumes: ModuleVolumeSet;
}

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
  updatedAt: Date.now(),
  moduleIds: ['cockpit_mk1', 'captains_cabin_mk1', 'radio_room_mk1', 'cargo_mk1']
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
  const versionUrl = new URL(`${import.meta.env.BASE_URL}version.js`, window.location.origin).toString();
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
    ...simulation
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
canvasWrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111822);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
camera.position.set(0, 2.9, 8.4);
camera.lookAt(0, 1.2, 0);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 2, 4);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

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
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
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
  const key = `${block.material.tileId}|${block.role}`;
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
    metalness: isWindow ? 0.15 : 0.05,
    roughness: isWindow ? 0.25 : 0.85,
    transparent: isWindow,
    opacity: 1,
    depthWrite: !isWindow,
    emissiveIntensity: isCeilingLight ? 1.5 : 0
  };

  if (texture) {
    params.map = texture;
    if (isWindow) {
      params.alphaMap = texture;
    }
  }

  if (isCeilingLight) {
    params.emissive = new THREE.Color(0xfff6b8);
  }

  const material = new THREE.MeshStandardMaterial(params);

  if (texture && block.material.uvMode === 'repeat' && block.primitive === 'box') {
    const [sizeX, , sizeZ] = getVector3(block.size, `block size (${block.id})`);
    const repeatX = Math.max(1, sizeX);
    const repeatY = Math.max(1, sizeZ);
    texture.repeat.set(repeatX, repeatY);
  }

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
    mesh.name = `${moduleDoc.id}:${block.id}`;
    mesh.position.set(centerX, centerY, centerZ);
    group.add(mesh);

    if (block.role === 'ceiling-light') {
      const light = new THREE.PointLight(0xfff5c2, 0.62, 3.8, 2);
      light.position.set(centerX, centerY - 0.06, centerZ);
      light.castShadow = false;
      group.add(light);
    }
  }

  return group;
};

const cloneModuleDoc = (moduleDoc: GeneratedModule): GeneratedModule => {
  return JSON.parse(JSON.stringify(moduleDoc)) as GeneratedModule;
};

const moduleTemplateCatalog: Record<string, GeneratedModule> = {
  cockpit_mk1: cockpitModule as GeneratedModule,
  captains_cabin_mk1: captainsCabinModule as GeneratedModule,
  radio_room_mk1: radioRoomModule as GeneratedModule,
  cargo_mk1: cargoModule as GeneratedModule,
  empty_room_mk1: emptyRoomModule as GeneratedModule
};

const isFixedModuleType = (moduleType: string): boolean => {
  return moduleType === 'cockpit' || moduleType === 'cargo';
};

const buildModuleChainFromIds = (ids: string[]): GeneratedModule[] => {
  const cockpitTemplate = moduleTemplateCatalog.cockpit_mk1;
  const cargoTemplate = moduleTemplateCatalog.cargo_mk1;
  if (!cockpitTemplate || !cargoTemplate) {
    throw new Error('Missing required fixed module templates (cockpit/cargo)');
  }

  const middle: GeneratedModule[] = [];
  ids.forEach((id) => {
    const template = moduleTemplateCatalog[id];
    if (!template) {
      return;
    }
    if (template.moduleType === 'cockpit' || template.moduleType === 'cargo') {
      return;
    }
    middle.push(cloneModuleDoc(template));
  });

  return [
    cloneModuleDoc(cockpitTemplate),
    ...middle,
    cloneModuleDoc(cargoTemplate)
  ];
};

interface JoinControlTarget {
  object: THREE.Object3D;
  kind: 'insert' | 'remove-left' | 'remove-right';
  joinIndex: number;
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

let moduleChain: GeneratedModule[] = buildModuleChainFromIds(defaultSimulation().moduleIds);
let modulePlacements: Array<{ id: string; centerZ: number; lengthM: number; widthM: number }> = [];
let worldWalkableVolumes: ModuleVolume[] = [];
let worldBlockedVolumes: ModuleVolume[] = [];
let worldDoorwayVolumes: ModuleVolume[] = [];
let joinControlTargets: JoinControlTarget[] = [];
const joinControlByObjectId = new Map<number, JoinControlTarget>();
let pendingInsertJoinIndex: number | null = null;
let totalLength = 0;

const playerEyeHeightM = 1.68;
const playerRadiusM = 0.22;
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
const nearestVolumePoint = new THREE.Vector3();
let nearClickableJoinControl = false;

const rebuildModuleAssembly = () => {
  moduleAssembly.clear();
  modulePlacements = [];
  worldWalkableVolumes = [];
  worldBlockedVolumes = [];
  worldDoorwayVolumes = [];
  joinControlTargets = [];
  joinControlByObjectId.clear();

  totalLength = moduleChain.reduce((sum, moduleDoc) => sum + moduleDoc.size.lengthM, 0);
  let cursorZ = -(totalLength / 2);
  for (const moduleDoc of moduleChain) {
    const moduleGroup = createModuleMesh(moduleDoc);
    const length = moduleDoc.size.lengthM;
    const centerZ = cursorZ + (length / 2);
    moduleGroup.position.z = centerZ;
    cursorZ += length;
    modulePlacements.push({ id: moduleDoc.id, centerZ, lengthM: length, widthM: moduleDoc.size.widthM });

    const toWorldVolume = (volume: ModuleVolume): ModuleVolume => {
      const [vx, vy, vz] = getVector3(volume.center, `volume center (${moduleDoc.id}:${volume.id})`);
      return {
        ...volume,
        center: [vx, vy, vz + centerZ]
      };
    };

    moduleDoc.volumes.walkable.forEach((volume) => {
      worldWalkableVolumes.push(toWorldVolume(volume));
    });
    moduleDoc.volumes.blocked.forEach((volume) => {
      worldBlockedVolumes.push(toWorldVolume(volume));
    });
    moduleDoc.volumes.doorway.forEach((volume) => {
      worldDoorwayVolumes.push(toWorldVolume(volume));
    });

    moduleAssembly.add(moduleGroup);
  }

  const interiorHalfWidth = Math.max(...modulePlacements.map((placement) => placement.widthM)) / 2;
  interiorMinX = -(interiorHalfWidth - playerRadiusM - 0.05);
  interiorMaxX = interiorHalfWidth - playerRadiusM - 0.05;
  interiorMinZ = -(totalLength / 2) + playerRadiusM + 0.15;
  interiorMaxZ = (totalLength / 2) - playerRadiusM - 0.15;

  for (let joinIndex = 0; joinIndex < modulePlacements.length - 1; joinIndex += 1) {
    const leftPlacement = modulePlacements[joinIndex];
    const rightPlacement = modulePlacements[joinIndex + 1];
    if (!leftPlacement || !rightPlacement) {
      continue;
    }
    const joinZ = leftPlacement.centerZ + (leftPlacement.lengthM / 2);
    const controlHalfWidth = Math.max(leftPlacement.widthM, rightPlacement.widthM) / 2;
    const controlX = -(controlHalfWidth - 0.16);
    const controlY = 1.35;

    const addControl = (sprite: THREE.Sprite, kind: JoinControlTarget['kind']) => {
      moduleAssembly.add(sprite);
      const target: JoinControlTarget = { object: sprite, kind, joinIndex };
      joinControlTargets.push(target);
      joinControlByObjectId.set(sprite.id, target);
    };

    const plus = createJoinControlSprite('+', 'rgba(37, 92, 52, 0.94)');
    plus.position.set(controlX, controlY, joinZ);
    addControl(plus, 'insert');

    const leftModule = moduleChain[joinIndex];
    if (leftModule && !isFixedModuleType(leftModule.moduleType)) {
      const minusLeft = createJoinControlSprite('-', 'rgba(112, 45, 45, 0.94)');
      minusLeft.position.set(controlX, controlY, joinZ - 0.28);
      addControl(minusLeft, 'remove-left');
    }

    const rightModule = moduleChain[joinIndex + 1];
    if (rightModule && !isFixedModuleType(rightModule.moduleType)) {
      const minusRight = createJoinControlSprite('-', 'rgba(112, 45, 45, 0.94)');
      minusRight.position.set(controlX, controlY, joinZ + 0.28);
      addControl(minusRight, 'remove-right');
    }
  }

  if (
    playerPosition.x < interiorMinX ||
    playerPosition.x > interiorMaxX ||
    playerPosition.z < interiorMinZ ||
    playerPosition.z > interiorMaxZ
  ) {
    const spawnPlacement = modulePlacements[Math.floor((modulePlacements.length - 1) / 2)] ?? modulePlacements[0];
    playerPosition.set(0, playerEyeHeightM, spawnPlacement?.centerZ ?? 0);
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
    clamp(playerEyeHeightM, minY + 0.02, maxY - 0.02),
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

  const inBlocked = worldBlockedVolumes.some((volume) => containsPointInVolume(point, volume, playerRadiusM));
  if (inBlocked && !inDoorway) {
    return false;
  }

  return true;
};

const findNearestOccupiablePoint = (from: THREE.Vector3): THREE.Vector3 | null => {
  const candidateVolumes = [...worldWalkableVolumes, ...worldDoorwayVolumes];
  let best: THREE.Vector3 | null = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (const volume of candidateVolumes) {
    const candidate = nearestPointInVolume(from, volume).clone();
    if (!isOccupiablePoint(candidate)) {
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

const updateJoinControlVisibility = () => {
  nearClickableJoinControl = false;
  const controlsActive = !menuVisible && !controlsListeningFor;

  for (const target of joinControlTargets) {
    target.object.getWorldPosition(joinControlWorldPos);
    const distance = joinControlWorldPos.distanceTo(playerPosition);
    const visible = controlsActive && distance <= joinControlVisibleDistanceM;
    target.object.visible = visible;
    if (visible) {
      nearClickableJoinControl = true;
    }
  }

  clickReticle.dataset.visible = nearClickableJoinControl && controlsActive ? 'true' : 'false';
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

syncPlayerCamera();

let lastAutosaveAt = performance.now();
const menuStack: MenuStackEntry[] = [];
let menuVisible = true;
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
  moduleChain = buildModuleChainFromIds(simulation.moduleIds);
  syncSimulationModuleIds();
  rebuildModuleAssembly();

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
  moduleChain = buildModuleChainFromIds(simulation.moduleIds);
  rebuildModuleAssembly();
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
  moduleChain = buildModuleChainFromIds(simulation.moduleIds);
  rebuildModuleAssembly();
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

const insertableModuleChoices: Array<{ id: string; label: string }> = [
  { id: 'empty_room_mk1', label: 'Empty Room' },
  { id: 'captains_cabin_mk1', label: "Captain's Cabin" },
  { id: 'radio_room_mk1', label: 'Radio Room' }
];

const syncSimulationModuleIds = () => {
  simulation.moduleIds = moduleChain.map((moduleDoc) => moduleDoc.id);
};

const removeModuleAtIndex = (index: number) => {
  const target = moduleChain[index];
  if (!target || isFixedModuleType(target.moduleType)) {
    return;
  }
  moduleChain.splice(index, 1);
  syncSimulationModuleIds();
  rebuildModuleAssembly();
  saveLocalState();
  showToast(`Removed ${target.id}`);
};

const insertModuleAtJoin = (joinIndex: number, templateId: string) => {
  const template = moduleTemplateCatalog[templateId];
  if (!template) {
    throw new Error(`Unknown module template: ${templateId}`);
  }
  const insertIndex = joinIndex + 1;
  moduleChain.splice(insertIndex, 0, cloneModuleDoc(template));
  syncSimulationModuleIds();
  rebuildModuleAssembly();
  saveLocalState();
  showToast(`Inserted ${templateId}`);
};

const buildInsertModuleItems = (): MenuItem[] => {
  if (pendingInsertJoinIndex === null) {
    return [
      {
        type: 'text',
        label: 'Insert',
        value: 'Select a + join point first.'
      }
    ];
  }

  return insertableModuleChoices.map((choice) => ({
    type: 'action',
    label: choice.label,
    behavior: 'action',
    onSelect: () => {
      const joinIndex = pendingInsertJoinIndex;
      if (joinIndex === null) {
        return;
      }
      insertModuleAtJoin(joinIndex, choice.id);
      pendingInsertJoinIndex = null;
      closeAllMenus();
    }
  }));
};

const joinControlRaycaster = new THREE.Raycaster();
const joinControlNdc = new THREE.Vector2();

const pickJoinControl = (event: MouseEvent): JoinControlTarget | null => {
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

renderer.domElement.addEventListener('click', (event) => {
  if (menuVisible || controlsListeningFor) {
    return;
  }

  const target = pickJoinControl(event);
  if (target) {
    if (target.kind === 'insert') {
      pendingInsertJoinIndex = target.joinIndex;
      openMenu('insertModuleMenu');
      return;
    }
    if (target.kind === 'remove-left') {
      removeModuleAtIndex(target.joinIndex);
      return;
    }
    removeModuleAtIndex(target.joinIndex + 1);
    return;
  }

  if (document.pointerLockElement !== renderer.domElement) {
    void renderer.domElement.requestPointerLock();
  }
});

window.addEventListener('mousemove', (event) => {
  if (menuVisible || document.pointerLockElement !== renderer.domElement) {
    return;
  }

  playerYaw -= event.movementX * mouseLookSensitivity;
  const pitchDirection = settings.controls.invertMouseY ? 1 : -1;
  playerPitch += event.movementY * mouseLookSensitivity * pitchDirection;
  playerPitch = Math.max(-1.45, Math.min(1.45, playerPitch));
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

const renderCurrentMenu = () => {
  menuPanel.dataset.visible = menuVisible ? 'true' : 'false';
  menuToggleButton.setAttribute('aria-expanded', menuVisible ? 'true' : 'false');

  if (!menuVisible) {
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
    src: '/assets/bmac/default-yellow.png',
    href: 'https://buymeacoffee.com/timelessp',
    alt: 'Buy Me A Coffee'
  }
];

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
  const delta = Math.min(0.05, (now - lastTime) / 1000);
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

  if (simulation.running) {
    simulation.tick += 1;
    simulation.heading = (simulation.heading + delta * 12) % 360;
    simulation.altitude = 2200 + Math.sin(now * 0.0005) * 120;
    simulation.fuel = Math.max(0, simulation.fuel - delta * 0.08);
    simulation.updatedAt = Date.now();
    updateStatusFromSimulation();
  }

  if (!isOccupiablePoint(playerPosition)) {
    const nearest = findNearestOccupiablePoint(playerPosition);
    if (nearest) {
      playerPosition.copy(nearest);
    }
  }

  if (!menuVisible && !controlsListeningFor) {
    const forwardInput = (isActionPressed('up') ? 1 : 0) - (isActionPressed('down') ? 1 : 0);
    const strafeInput = (isActionPressed('left') ? 1 : 0) - (isActionPressed('right') ? 1 : 0);

    if (forwardInput !== 0 || strafeInput !== 0) {
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
  moduleChain = buildModuleChainFromIds(simulation.moduleIds);
  rebuildModuleAssembly();
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
