import type { ModuleTemplateHandler } from './handler-types';
import { moduleHandlers } from './handlers';
import type { GeneratedModule } from './types';

const cloneModuleDoc = (moduleDoc: GeneratedModule): GeneratedModule => {
  return JSON.parse(JSON.stringify(moduleDoc)) as GeneratedModule;
};

const handlerById = new Map<string, ModuleTemplateHandler>(moduleHandlers.map((handler) => [handler.id, handler]));
const ladderCanonicalHandler = handlerById.get('ladder_room_single_mk1');
if (ladderCanonicalHandler) {
  handlerById.set('ladder_room_mk1', ladderCanonicalHandler);
}

const fixedHandlers = moduleHandlers.filter((handler) => handler.fixed);
const cockpitFixedHandler = fixedHandlers.find((handler) => handler.template.moduleType === 'cockpit');
const cargoFixedHandler = fixedHandlers.find((handler) => handler.template.moduleType === 'cargo');

if (!cockpitFixedHandler || !cargoFixedHandler) {
  throw new Error('Missing required fixed module handlers (cockpit/cargo)');
}

const fixedModuleTypes = new Set(fixedHandlers.map((handler) => handler.template.moduleType));

export const isFixedModuleType = (moduleType: string): boolean => fixedModuleTypes.has(moduleType);

export const isBatterySupplyModuleId = (moduleId: string): boolean => {
  return handlerById.get(moduleId)?.providesBatterySupply === true;
};

export const buildModuleChainFromIds = (ids: string[]): GeneratedModule[] => {
  const middle: GeneratedModule[] = [];
  for (const id of ids) {
    const handler = handlerById.get(id);
    if (!handler || handler.fixed) {
      continue;
    }
    middle.push(cloneModuleDoc(handler.template));
  }

  return [cloneModuleDoc(cockpitFixedHandler.template), ...middle, cloneModuleDoc(cargoFixedHandler.template)];
};

export const getInsertableModuleChoices = (): Array<{ id: string; label: string }> => {
  return moduleHandlers
    .filter((handler) => !handler.fixed && handler.insertable !== false)
    .map((handler) => ({ id: handler.id, label: handler.label }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const createModuleFromTemplateId = (templateId: string): GeneratedModule => {
  const handler = handlerById.get(templateId);
  if (!handler) {
    throw new Error(`Unknown module template: ${templateId}`);
  }
  return cloneModuleDoc(handler.template);
};
