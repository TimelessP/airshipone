import ladderRoomLowestModule from '../../content/modules/ladder_room_lowest_mk1.module.json';
import type { ModuleTemplateHandler } from '../handler-types';
import type { GeneratedModule } from '../types';

export const ladderRoomLowestHandler: ModuleTemplateHandler = {
  id: 'ladder_room_lowest_mk1',
  label: 'Ladder Room (Lowest)',
  fixed: false,
  insertable: false,
  template: ladderRoomLowestModule as GeneratedModule
};
