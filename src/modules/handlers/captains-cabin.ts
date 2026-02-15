import captainsCabinModule from '../../content/modules/captains_cabin_mk1.module.json';
import type { ModuleTemplateHandler } from '../handler-types';
import type { GeneratedModule } from '../types';

export const captainsCabinHandler: ModuleTemplateHandler = {
  id: 'captains_cabin_mk1',
  label: "Captain's Cabin",
  fixed: false,
  template: captainsCabinModule as GeneratedModule
};
