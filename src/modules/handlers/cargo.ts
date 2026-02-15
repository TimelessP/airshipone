import cargoModule from '../../content/modules/cargo_mk1.module.json';
import type { ModuleTemplateHandler } from '../handler-types';
import type { GeneratedModule } from '../types';

export const cargoHandler: ModuleTemplateHandler = {
  id: 'cargo_mk1',
  label: 'Cargo',
  fixed: true,
  template: cargoModule as GeneratedModule
};
