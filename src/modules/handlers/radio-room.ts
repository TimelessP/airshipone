import radioRoomModule from '../../content/modules/radio_room_mk1.module.json';
import type { ModuleTemplateHandler } from '../handler-types';
import type { GeneratedModule } from '../types';

export const radioRoomHandler: ModuleTemplateHandler = {
  id: 'radio_room_mk1',
  label: 'Radio Room',
  fixed: false,
  template: radioRoomModule as GeneratedModule
};
