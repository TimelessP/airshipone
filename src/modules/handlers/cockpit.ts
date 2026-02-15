import cockpitModule from '../../content/modules/cockpit_mk1.module.json';
import type { ModuleTemplateHandler } from '../handler-types';
import type { GeneratedModule } from '../types';

export const cockpitHandler: ModuleTemplateHandler = {
  id: 'cockpit_mk1',
  label: 'Cockpit',
  fixed: true,
  template: cockpitModule as GeneratedModule
};
