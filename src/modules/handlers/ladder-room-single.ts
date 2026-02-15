import ladderRoomSingleModule from '../../content/modules/ladder_room_single_mk1.module.json';
import type { ModuleTemplateHandler } from '../handler-types';
import type { GeneratedModule } from '../types';

export const ladderRoomSingleHandler: ModuleTemplateHandler = {
  id: 'ladder_room_single_mk1',
  label: 'Ladder Room',
  fixed: false,
  insertable: true,
  template: ladderRoomSingleModule as GeneratedModule
};
