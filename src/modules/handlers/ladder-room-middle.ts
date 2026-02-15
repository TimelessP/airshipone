import ladderRoomMiddleModule from '../../content/modules/ladder_room_middle_mk1.module.json';
import type { ModuleTemplateHandler } from '../handler-types';
import type { GeneratedModule } from '../types';

export const ladderRoomMiddleHandler: ModuleTemplateHandler = {
  id: 'ladder_room_middle_mk1',
  label: 'Ladder Room (Middle)',
  fixed: false,
  insertable: false,
  template: ladderRoomMiddleModule as GeneratedModule
};
