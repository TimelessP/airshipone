import emptyRoomModule from '../../content/modules/empty_room_mk1.module.json';
import type { ModuleTemplateHandler } from '../handler-types';
import type { GeneratedModule } from '../types';

export const emptyRoomHandler: ModuleTemplateHandler = {
  id: 'empty_room_mk1',
  label: 'Empty Room',
  fixed: false,
  template: emptyRoomModule as GeneratedModule
};
