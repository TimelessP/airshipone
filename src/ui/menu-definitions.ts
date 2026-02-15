import type { ElectricalConfig } from '../sim/electrical';
import type { BatteryLiveValueKey, BatteryMenuStats } from './battery-menu';

export type MenuName =
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

export type MenuBehavior = 'submenu' | 'back' | 'close' | 'keep-open' | 'action';

export type MenuControlAction = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back' | 'pause';

export interface MenuGamepadButtonBinding {
  type: 'button';
  btn: number;
}

export interface MenuGamepadAxisBinding {
  type: 'axis';
  axis: number;
  dir: -1 | 1;
}

export type MenuControlBinding = string | MenuGamepadButtonBinding | MenuGamepadAxisBinding | null;

export interface MenuStackEntry {
  menuName: MenuName;
}

export interface MenuDefinition {
  isRoot: boolean;
  title: string;
  overview: string;
  itemBuilder?: () => MenuItem[];
  actions?: MenuAction[];
}

export interface MenuAction {
  label: string;
  behavior: Exclude<MenuBehavior, 'action'>;
  target?: MenuName;
  onSelect?: () => void;
  danger?: boolean;
}

export interface ActionMenuItem {
  type: 'action';
  label: string;
  behavior: MenuBehavior;
  target?: MenuName;
  value?: string;
  disabled?: boolean;
  onSelect?: () => void;
  danger?: boolean;
}

export interface SettingAction {
  label: string;
  behavior: 'keep-open';
  onSelect: () => void;
}

export interface SettingMenuItem {
  type: 'setting';
  label: string;
  value: string;
  liveValueKey?: BatteryLiveValueKey;
  actions: SettingAction[];
}

export interface ControlMenuItem {
  type: 'control';
  action: MenuControlAction;
  label: string;
  primary: MenuControlBinding;
  secondary: MenuControlBinding;
}

export interface TextMenuItem {
  type: 'text';
  label: string;
  value: string;
  liveValueKey?: BatteryLiveValueKey;
  href?: string;
}

export interface ImageLinkMenuItem {
  type: 'image-link';
  label: string;
  src: string;
  href: string;
  alt: string;
}

export interface LetterMenuItem {
  type: 'letter';
  from: string;
  to: string;
  subject: string;
  dateUtc: string;
  paragraphs: string[];
}

export interface DividerMenuItem {
  type: 'divider';
}

export type MenuItem =
  | ActionMenuItem
  | SettingMenuItem
  | ControlMenuItem
  | TextMenuItem
  | ImageLinkMenuItem
  | LetterMenuItem
  | DividerMenuItem;

export interface MenuSettings {
  themeMode: 'system' | 'light' | 'dark';
  graphics: {
    pixelScale: number;
    showScanlines: boolean;
    quality: 'low' | 'medium' | 'high';
  };
  audio: {
    masterVolume: number;
    uiVolume: number;
    muted: boolean;
  };
  controls: {
    bindings: Record<MenuControlAction, [MenuControlBinding, MenuControlBinding]>;
    invertMouseY: boolean;
  };
  advanced: {
    autosaveSeconds: number;
    diagnostics: boolean;
  };
}

export interface MenuSimulationState {
  batteryACharge: number;
  batteryBCharge: number;
  batteryAConnectedToBus: boolean;
  batteryBConnectedToBus: boolean;
  solarPanelsConnected: boolean;
  mainBusConnected: boolean;
  lightsMainOn: boolean;
  updatedAt: number;
}

export interface CreateMenuDefinitionsDeps {
  hasSavedGame: () => boolean;
  startNewGame: () => void;
  resumeGame: () => void;
  exportSave: () => void;
  importSave: () => void;
  getSettings: () => MenuSettings;
  getCurrentTheme: () => 'system' | 'light' | 'dark';
  modeCycle: readonly ('system' | 'light' | 'dark')[];
  setTheme: (mode: 'system' | 'light' | 'dark') => void;
  cycleQuality: () => void;
  adjustNumber: (value: number, delta: number, min: number, max: number) => number;
  saveLocalState: () => void;
  toggleMute: () => void;
  controlActions: readonly MenuControlAction[];
  controlLabels: Record<MenuControlAction, string>;
  defaultControls: () => Record<MenuControlAction, [MenuControlBinding, MenuControlBinding]>;
  stopListeningForBinding: () => void;
  showToast: (text: string) => void;
  getAppVersion: () => string;
  baseUrl: string;
  getElectricalTelemetry: (utcMs: number) => {
    solarEffectiveness: number;
    solarChargeCurrentA: number;
    loadCurrentA: number;
    netBatteryCurrentA: number;
  };
  getSimulation: () => MenuSimulationState;
  enqueueSimulationEvent: (event:
    | { type: 'battery/toggle-a-bus' }
    | { type: 'battery/toggle-b-bus' }
    | { type: 'power/toggle-solar-connect' }
    | { type: 'power/toggle-main-bus-connect' }
    | { type: 'battery/toggle-lights-main' }) => void;
  formatBatteryPercent: (value: number) => string;
  getBatteryMenuStatsSnapshot: () => BatteryMenuStats;
  electricalConfig: ElectricalConfig;
  buildInsertModuleItems: () => MenuItem[];
}

export const createMenuDefinitions = (deps: CreateMenuDefinitionsDeps): Record<MenuName, MenuDefinition> => {
  const buildMainMenuItems = (): MenuItem[] => [
    {
      type: 'action',
      label: 'New Game',
      behavior: 'action',
      onSelect: deps.startNewGame
    },
    {
      type: 'action',
      label: 'Resume Game',
      behavior: 'action',
      disabled: !deps.hasSavedGame(),
      onSelect: deps.resumeGame
    },
    {
      type: 'action',
      label: 'Export Game',
      behavior: 'action',
      onSelect: deps.exportSave
    },
    {
      type: 'action',
      label: 'Import Game',
      behavior: 'action',
      onSelect: deps.importSave
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

  const buildGraphicsItems = (): MenuItem[] => {
    const settings = deps.getSettings();
    return [
    {
      type: 'setting',
      label: 'Theme',
      value: settings.themeMode,
      actions: [
        {
          label: 'Cycle',
          behavior: 'keep-open',
          onSelect: () => {
            const index = deps.modeCycle.indexOf(deps.getCurrentTheme());
            const nextTheme = deps.modeCycle[(index + 1) % deps.modeCycle.length] ?? 'system';
            deps.setTheme(nextTheme);
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
          onSelect: deps.cycleQuality
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
            const mutableSettings = deps.getSettings();
            mutableSettings.graphics.pixelScale = deps.adjustNumber(mutableSettings.graphics.pixelScale, -1, 1, 4);
            deps.saveLocalState();
          }
        },
        {
          label: '+',
          behavior: 'keep-open',
          onSelect: () => {
            const mutableSettings = deps.getSettings();
            mutableSettings.graphics.pixelScale = deps.adjustNumber(mutableSettings.graphics.pixelScale, 1, 1, 4);
            deps.saveLocalState();
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
            const mutableSettings = deps.getSettings();
            mutableSettings.graphics.showScanlines = !mutableSettings.graphics.showScanlines;
            deps.saveLocalState();
          }
        }
      ]
    }
    ];
  };

  const buildAudioItems = (): MenuItem[] => {
    const settings = deps.getSettings();
    return [
    {
      type: 'setting',
      label: 'Master Volume',
      value: `${settings.audio.masterVolume}%`,
      actions: [
        {
          label: '-',
          behavior: 'keep-open',
          onSelect: () => {
            const mutableSettings = deps.getSettings();
            mutableSettings.audio.masterVolume = deps.adjustNumber(mutableSettings.audio.masterVolume, -5, 0, 100);
            deps.saveLocalState();
          }
        },
        {
          label: '+',
          behavior: 'keep-open',
          onSelect: () => {
            const mutableSettings = deps.getSettings();
            mutableSettings.audio.masterVolume = deps.adjustNumber(mutableSettings.audio.masterVolume, 5, 0, 100);
            deps.saveLocalState();
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
            const mutableSettings = deps.getSettings();
            mutableSettings.audio.uiVolume = deps.adjustNumber(mutableSettings.audio.uiVolume, -5, 0, 100);
            deps.saveLocalState();
          }
        },
        {
          label: '+',
          behavior: 'keep-open',
          onSelect: () => {
            const mutableSettings = deps.getSettings();
            mutableSettings.audio.uiVolume = deps.adjustNumber(mutableSettings.audio.uiVolume, 5, 0, 100);
            deps.saveLocalState();
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
          onSelect: deps.toggleMute
        }
      ]
    }
    ];
  };

  const buildControlsItems = (): MenuItem[] => {
    const settings = deps.getSettings();
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
              const mutableSettings = deps.getSettings();
              mutableSettings.controls.invertMouseY = !mutableSettings.controls.invertMouseY;
              deps.saveLocalState();
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

    deps.controlActions.forEach((action) => {
      const pair = settings.controls.bindings[action];
      items.push({
        type: 'control',
        action,
        label: deps.controlLabels[action],
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
        deps.getSettings().controls.bindings = deps.defaultControls();
        deps.saveLocalState();
        deps.stopListeningForBinding();
        deps.showToast('Controls reset');
      }
    });

    return items;
  };

  const buildAdvancedItems = (): MenuItem[] => {
    const settings = deps.getSettings();
    return [
    {
      type: 'setting',
      label: 'Autosave (sec)',
      value: `${settings.advanced.autosaveSeconds}`,
      actions: [
        {
          label: '-',
          behavior: 'keep-open',
          onSelect: () => {
            const mutableSettings = deps.getSettings();
            mutableSettings.advanced.autosaveSeconds = deps.adjustNumber(mutableSettings.advanced.autosaveSeconds, -1, 2, 60);
            deps.saveLocalState();
          }
        },
        {
          label: '+',
          behavior: 'keep-open',
          onSelect: () => {
            const mutableSettings = deps.getSettings();
            mutableSettings.advanced.autosaveSeconds = deps.adjustNumber(mutableSettings.advanced.autosaveSeconds, 1, 2, 60);
            deps.saveLocalState();
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
            const mutableSettings = deps.getSettings();
            mutableSettings.advanced.diagnostics = !mutableSettings.advanced.diagnostics;
            deps.saveLocalState();
          }
        }
      ]
    }
    ];
  };

  const buildAboutItems = (): MenuItem[] => [
    {
      type: 'text',
      label: 'Title',
      value: 'Airship One'
    },
    {
      type: 'text',
      label: 'Version',
      value: deps.getAppVersion()
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
      src: `${deps.baseUrl}assets/bmac/default-yellow.png`,
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
    const simulation = deps.getSimulation();
    const telemetry = deps.getElectricalTelemetry(simulation.updatedAt || Date.now());

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
              deps.enqueueSimulationEvent({ type: 'power/toggle-main-bus-connect' });
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
              deps.enqueueSimulationEvent({ type: 'power/toggle-solar-connect' });
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
              deps.enqueueSimulationEvent({ type: 'battery/toggle-a-bus' });
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
              deps.enqueueSimulationEvent({ type: 'battery/toggle-b-bus' });
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
              deps.enqueueSimulationEvent({ type: 'battery/toggle-lights-main' });
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
        value: deps.formatBatteryPercent(simulation.batteryACharge),
        liveValueKey: 'battery-a-charge'
      },
      {
        type: 'text',
        label: 'Battery B',
        value: deps.formatBatteryPercent(simulation.batteryBCharge),
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
        value: `${telemetry.solarChargeCurrentA.toFixed(1)} A (${deps.electricalConfig.solarArrayNominalVoltageV} V array → ${deps.electricalConfig.mainBusNominalVoltageV} V bus)`,
        liveValueKey: 'solar-charge-current'
      },
      {
        type: 'text',
        label: 'Active Load',
        value: `${telemetry.loadCurrentA.toFixed(1)} A @ ${deps.electricalConfig.mainBusNominalVoltageV} V`,
        liveValueKey: 'load-current'
      },
      {
        type: 'text',
        label: 'Net Battery Current',
        value: `${telemetry.netBatteryCurrentA >= 0 ? '+' : ''}${telemetry.netBatteryCurrentA.toFixed(1)} A`,
        liveValueKey: 'net-battery-current'
      },
      {
        type: 'text',
        label: 'Estimated Runtime',
        value: deps.getBatteryMenuStatsSnapshot().batteryRuntimeEstimate,
        liveValueKey: 'battery-runtime'
      }
    ];
  };

  return {
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
      itemBuilder: deps.buildInsertModuleItems,
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
};
