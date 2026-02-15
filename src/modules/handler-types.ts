import type { GeneratedModule } from './types';

export interface ModuleTemplateHandler {
  id: string;
  label: string;
  fixed: boolean;
  insertable?: boolean;
  providesBatterySupply?: boolean;
  template: GeneratedModule;
}
