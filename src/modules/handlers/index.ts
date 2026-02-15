import type { ModuleTemplateHandler } from '../handler-types';
import { batteryRoomHandler } from './battery-room';
import { captainsCabinHandler } from './captains-cabin';
import { cargoHandler } from './cargo';
import { cockpitHandler } from './cockpit';
import { emptyRoomHandler } from './empty-room';
import { ladderRoomHighestHandler } from './ladder-room-highest';
import { ladderRoomLowestHandler } from './ladder-room-lowest';
import { ladderRoomMiddleHandler } from './ladder-room-middle';
import { ladderRoomSingleHandler } from './ladder-room-single';
import { radioRoomHandler } from './radio-room';

export const moduleHandlers: ModuleTemplateHandler[] = [
  cockpitHandler,
  captainsCabinHandler,
  radioRoomHandler,
  batteryRoomHandler,
  ladderRoomSingleHandler,
  ladderRoomLowestHandler,
  ladderRoomMiddleHandler,
  ladderRoomHighestHandler,
  emptyRoomHandler,
  cargoHandler
];
