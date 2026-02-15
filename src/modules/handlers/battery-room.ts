import batteryRoomModule from '../../content/modules/battery_room_mk1.module.json';
import type { ModuleTemplateHandler } from '../handler-types';
import type { GeneratedModule } from '../types';

export const batteryRoomHandler: ModuleTemplateHandler = {
  id: 'battery_room_mk1',
  label: 'Battery Room',
  fixed: false,
  providesBatterySupply: true,
  template: batteryRoomModule as GeneratedModule
};
