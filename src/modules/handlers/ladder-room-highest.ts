import ladderRoomHighestModule from '../../content/modules/ladder_room_highest_mk1.module.json';
import type { ModuleTemplateHandler } from '../handler-types';
import type { GeneratedModule } from '../types';

export const ladderRoomHighestHandler: ModuleTemplateHandler = {
  id: 'ladder_room_highest_mk1',
  label: 'Ladder Room (Highest)',
  fixed: false,
  insertable: false,
  template: ladderRoomHighestModule as GeneratedModule
};
