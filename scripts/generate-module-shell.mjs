#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TILE_DIR = path.join(ROOT, 'assets', 'textures', 'tiles');
const OUTPUT_DIR = path.join(ROOT, 'src', 'content', 'modules');

const DEFAULTS = {
  id: 'captains_cabin_mk1',
  category: 'interior-module',
  moduleType: 'room',
  lengthU: 1,
  unitLengthM: 3.2,
  heightM: 2.6,
  clearHeightM: 2.3,
  wallOuterM: 0.1,
  wallInnerM: 0.1,
  corridorWidthM: 1.0,
  corridorDoorWidthM: 0.9,
  roomWidthM: 2.4,
  roomLengthM: 3.0,
  floorThicknessM: 0.08,
  ceilingThicknessM: 0.08,
  output: ''
};

const MODULE_TYPES = new Set(['room', 'open', 'cockpit', 'cargo']);

const round = (value) => Math.round(value * 1000) / 1000;

const asNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseArgs = (argv) => {
  const parsed = { ...DEFAULTS };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token || !token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      continue;
    }
    index += 1;

    switch (key) {
      case 'id':
        parsed.id = next;
        break;
      case 'module-type':
        parsed.moduleType = next;
        break;
      case 'length-u':
        parsed.lengthU = asNumber(next, parsed.lengthU);
        break;
      case 'unit-length-m':
        parsed.unitLengthM = asNumber(next, parsed.unitLengthM);
        break;
      case 'height-m':
        parsed.heightM = asNumber(next, parsed.heightM);
        break;
      case 'clear-height-m':
        parsed.clearHeightM = asNumber(next, parsed.clearHeightM);
        break;
      case 'wall-outer-m':
        parsed.wallOuterM = asNumber(next, parsed.wallOuterM);
        break;
      case 'wall-inner-m':
        parsed.wallInnerM = asNumber(next, parsed.wallInnerM);
        break;
      case 'corridor-width-m':
        parsed.corridorWidthM = asNumber(next, parsed.corridorWidthM);
        break;
      case 'corridor-door-width-m':
        parsed.corridorDoorWidthM = asNumber(next, parsed.corridorDoorWidthM);
        break;
      case 'room-width-m':
        parsed.roomWidthM = asNumber(next, parsed.roomWidthM);
        break;
      case 'room-length-m':
        parsed.roomLengthM = asNumber(next, parsed.roomLengthM);
        break;
      case 'output':
        parsed.output = next;
        break;
      default:
        break;
    }
  }

  return parsed;
};

const applyModuleTypeProfile = (params) => {
  if (!MODULE_TYPES.has(params.moduleType)) {
    throw new Error(`Unsupported module type: ${params.moduleType}. Use one of: room, open, cockpit, cargo`);
  }

  if (params.moduleType === 'cockpit') {
    return {
      ...params,
      category: 'fixed-module',
      roomWidthM: 2.6
    };
  }

  if (params.moduleType === 'cargo') {
    return {
      ...params,
      category: 'fixed-module',
      roomWidthM: 2.6
    };
  }

  if (params.moduleType === 'open') {
    return {
      ...params,
      roomWidthM: 2.6
    };
  }

  return params;
};

const tileIdFromFile = (file) => file.replace(/\.png$/i, '');

const findTile = (tileIds, preferred, fallback) => {
  for (const pref of preferred) {
    const found = tileIds.find((tileId) => tileId.includes(pref));
    if (found) {
      return found;
    }
  }
  const fallbackFound = tileIds.find((tileId) => tileId.includes(fallback));
  if (fallbackFound) {
    return fallbackFound;
  }
  const first = tileIds[0];
  if (!first) {
    throw new Error('No PNG tiles found in assets/textures/tiles');
  }
  return first;
};

const loadTileAssignments = async () => {
  const entries = await fs.readdir(TILE_DIR, { withFileTypes: true });
  const tileIds = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => tileIdFromFile(entry.name));

  if (tileIds.length === 0) {
    throw new Error('No source textures were found. Add PNG files to assets/textures/tiles');
  }

  return {
    floor: findTile(tileIds, ['red-carpet', 'oak', 'walnut'], 'leather'),
    wall: findTile(tileIds, ['paper', 'brass', 'oak'], 'walnut'),
    innerWall: findTile(tileIds, ['paper', 'oak', 'walnut'], 'brass'),
    ceiling: findTile(tileIds, ['paper-bright', 'paper', 'oak'], 'walnut'),
    window: findTile(tileIds, ['glass-pane'], 'paper'),
    trim: findTile(tileIds, ['brass', 'oak', 'walnut'], 'paper')
  };
};

const makeBox = (id, role, center, size, tileId) => ({
  id,
  primitive: 'box',
  role,
  center: center.map(round),
  size: size.map(round),
  material: {
    tileId,
    uvMode: 'repeat',
    worldScaleM: [1, 1]
  }
});

const makeCylinder = (id, role, center, radius, height, tileId) => ({
  id,
  primitive: 'cylinder',
  role,
  center: center.map(round),
  radiusTop: round(radius),
  radiusBottom: round(radius),
  height: round(height),
  radialSegments: 18,
  material: {
    tileId,
    uvMode: 'repeat',
    worldScaleM: [1, 1]
  }
});

const makeVolumeBox = (id, kind, center, size) => ({
  id,
  shape: 'box',
  kind,
  center: center.map(round),
  size: size.map(round)
});

const buildGeometryAndVolumes = (params, tiles) => {
  const hasInnerRoomPartitions = params.moduleType === 'room';
  const frontCorridorOpen = params.moduleType !== 'cockpit';
  const rearCorridorOpen = params.moduleType !== 'cargo';
  const moduleLengthM = params.lengthU * params.unitLengthM;

  const moduleWidthM = hasInnerRoomPartitions
    ? (2 * params.wallOuterM) + (2 * params.corridorWidthM) + (2 * params.wallInnerM) + params.roomWidthM
    : (2 * params.wallOuterM) + (2 * params.corridorWidthM) + params.roomWidthM;

  const halfW = moduleWidthM / 2;
  const halfL = moduleLengthM / 2;

  const yFloor = params.floorThicknessM / 2;
  const yCeiling = params.heightM - (params.ceilingThicknessM / 2);

  const outerInteriorLeft = -halfW + params.wallOuterM;
  const outerInteriorRight = halfW - params.wallOuterM;

  const leftCorridorMinX = outerInteriorLeft;
  const leftCorridorMaxX = leftCorridorMinX + params.corridorWidthM;
  const rightCorridorMaxX = outerInteriorRight;
  const rightCorridorMinX = rightCorridorMaxX - params.corridorWidthM;

  const roomMinX = hasInnerRoomPartitions ? leftCorridorMaxX + params.wallInnerM : leftCorridorMaxX;
  const roomMaxX = hasInnerRoomPartitions ? rightCorridorMinX - params.wallInnerM : rightCorridorMinX;
  const bulkheadCenterX = (roomMinX + roomMaxX) / 2;
  const bulkheadWidth = Math.max(0.3, roomMaxX - roomMinX);
  const bulkheadFrontCenterX = frontCorridorOpen ? bulkheadCenterX : 0;
  const bulkheadRearCenterX = rearCorridorOpen ? bulkheadCenterX : 0;
  const bulkheadFrontWidth = frontCorridorOpen ? bulkheadWidth : moduleWidthM;
  const bulkheadRearWidth = rearCorridorOpen ? bulkheadWidth : moduleWidthM;
  const frontWallZ = -(halfL - (params.wallOuterM / 2));
  const rearWallZ = halfL - (params.wallOuterM / 2);

  const blocks = [];
  const walkable = [];
  const blocked = [];
  const doorway = [];
  const headBump = [];

  const windowSillHeight = 1.0;
  const windowTopHeight = 2.0;
  const windowHeight = Math.max(0.4, windowTopHeight - windowSillHeight);
  const windowCenterY = windowSillHeight + (windowHeight / 2);
  const windowEndMargin = 0.16;
  const windowOpeningLength = Math.max(0.4, moduleLengthM - (2 * params.wallOuterM) - (2 * windowEndMargin));
  const sidePillarLength = Math.max(0.12, (moduleLengthM - windowOpeningLength) / 2);
  const sidePillarOffsetZ = (windowOpeningLength / 2) + (sidePillarLength / 2);
  const wallUpperHeight = Math.max(0.2, params.heightM - windowTopHeight);
  const paneDepth = Math.max(0.02, params.wallOuterM * 0.35);
  const paneHeight = Math.max(0.3, windowHeight - 0.06);
  const paneLength = Math.max(0.3, windowOpeningLength - 0.08);
  const paneCenterY = windowSillHeight + (paneHeight / 2);
  const ceilingLightRadius = 0.24;
  const ceilingLightHeight = 0.1;
  const ceilingLightY = params.heightM - params.ceilingThicknessM - (ceilingLightHeight / 2) - 0.03;
  const leftWallCenterX = -(halfW - (params.wallOuterM / 2));
  const rightWallCenterX = halfW - (params.wallOuterM / 2);
  const leftPaneCenterX = (-halfW + params.wallOuterM) - (paneDepth / 2);
  const rightPaneCenterX = (halfW - params.wallOuterM) + (paneDepth / 2);

  const cockpitFrontWindowWidth = Math.max(0.9, Math.min(moduleWidthM - 0.5, 1.6));
  const cockpitFrontPillarWidth = Math.max(0.12, (moduleWidthM - cockpitFrontWindowWidth) / 2);
  const cockpitFrontPillarCenterX = (cockpitFrontWindowWidth / 2) + (cockpitFrontPillarWidth / 2);
  const cockpitFrontPaneWidth = Math.max(0.7, cockpitFrontWindowWidth - 0.08);
  const cockpitFrontPaneCenterZ = frontWallZ - (params.wallOuterM / 2) + (paneDepth / 2);

  blocks.push(
    makeBox('floor', 'floor', [0, yFloor, 0], [moduleWidthM, params.floorThicknessM, moduleLengthM], tiles.floor),
    makeBox('ceiling', 'ceiling', [0, yCeiling, 0], [moduleWidthM, params.ceilingThicknessM, moduleLengthM], tiles.ceiling),
    makeBox('wall_outer_left_lower', 'outer-wall', [leftWallCenterX, windowSillHeight / 2, 0], [params.wallOuterM, windowSillHeight, windowOpeningLength], tiles.wall),
    makeBox('wall_outer_left_upper', 'outer-wall', [leftWallCenterX, windowTopHeight + (wallUpperHeight / 2), 0], [params.wallOuterM, wallUpperHeight, windowOpeningLength], tiles.wall),
    makeBox('wall_outer_left_front_pillar', 'outer-wall', [leftWallCenterX, params.heightM / 2, -sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength], tiles.wall),
    makeBox('wall_outer_left_rear_pillar', 'outer-wall', [leftWallCenterX, params.heightM / 2, sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength], tiles.wall),
    makeBox('wall_outer_right_lower', 'outer-wall', [rightWallCenterX, windowSillHeight / 2, 0], [params.wallOuterM, windowSillHeight, windowOpeningLength], tiles.wall),
    makeBox('wall_outer_right_upper', 'outer-wall', [rightWallCenterX, windowTopHeight + (wallUpperHeight / 2), 0], [params.wallOuterM, wallUpperHeight, windowOpeningLength], tiles.wall),
    makeBox('wall_outer_right_front_pillar', 'outer-wall', [rightWallCenterX, params.heightM / 2, -sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength], tiles.wall),
    makeBox('wall_outer_right_rear_pillar', 'outer-wall', [rightWallCenterX, params.heightM / 2, sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength], tiles.wall),
    makeBox('wall_rear', 'bulkhead-rear', [bulkheadRearCenterX, params.heightM / 2, rearWallZ], [bulkheadRearWidth, params.heightM, params.wallOuterM], tiles.wall),
    makeCylinder('ceiling_light_center', 'ceiling-light', [0, ceilingLightY, 0], ceilingLightRadius, ceilingLightHeight, tiles.trim)
  );

  if (params.moduleType === 'cockpit') {
    blocks.push(
      makeBox('wall_front_lower', 'bulkhead-front', [0, windowSillHeight / 2, frontWallZ], [cockpitFrontWindowWidth, windowSillHeight, params.wallOuterM], tiles.wall),
      makeBox('wall_front_upper', 'bulkhead-front', [0, windowTopHeight + (wallUpperHeight / 2), frontWallZ], [cockpitFrontWindowWidth, wallUpperHeight, params.wallOuterM], tiles.wall),
      makeBox('wall_front_left_pillar', 'bulkhead-front', [-cockpitFrontPillarCenterX, params.heightM / 2, frontWallZ], [cockpitFrontPillarWidth, params.heightM, params.wallOuterM], tiles.wall),
      makeBox('wall_front_right_pillar', 'bulkhead-front', [cockpitFrontPillarCenterX, params.heightM / 2, frontWallZ], [cockpitFrontPillarWidth, params.heightM, params.wallOuterM], tiles.wall),
      makeBox('window_front', 'front-window-strip', [0, paneCenterY, cockpitFrontPaneCenterZ], [cockpitFrontPaneWidth, paneHeight, paneDepth], tiles.window)
    );
  } else {
    blocks.push(
      makeBox('wall_front', 'bulkhead-front', [bulkheadFrontCenterX, params.heightM / 2, frontWallZ], [bulkheadFrontWidth, params.heightM, params.wallOuterM], tiles.wall)
    );
  }

  blocks.push(
    makeBox(
      'window_strip_left',
      'corridor-window-strip',
      [leftPaneCenterX, paneCenterY, 0],
      [paneDepth, paneHeight, paneLength],
      tiles.window
    ),
    makeBox(
      'window_strip_right',
      'corridor-window-strip',
      [rightPaneCenterX, paneCenterY, 0],
      [paneDepth, paneHeight, paneLength],
      tiles.window
    )
  );

  blocked.push(
    makeVolumeBox(
      'blocked_window_strip_left',
      'blocked',
      [leftPaneCenterX, paneCenterY, 0],
      [paneDepth, paneHeight, paneLength]
    ),
    makeVolumeBox(
      'blocked_window_strip_right',
      'blocked',
      [rightPaneCenterX, paneCenterY, 0],
      [paneDepth, paneHeight, paneLength]
    )
  );

  if (hasInnerRoomPartitions) {
    const doorGap = params.corridorDoorWidthM;
    const segmentLength = (moduleLengthM - doorGap) / 2;
    const doorLintelHeight = Math.max(params.clearHeightM - 0.2, 1.9);
    const lintelHeight = params.heightM - doorLintelHeight;
    const innerLeftX = leftCorridorMaxX + (params.wallInnerM / 2);
    const innerRightX = rightCorridorMinX - (params.wallInnerM / 2);

    blocks.push(
      makeBox('wall_inner_left_front', 'inner-wall', [innerLeftX, params.heightM / 2, -((doorGap / 2) + (segmentLength / 2))], [params.wallInnerM, params.heightM, segmentLength], tiles.innerWall),
      makeBox('wall_inner_left_rear', 'inner-wall', [innerLeftX, params.heightM / 2, (doorGap / 2) + (segmentLength / 2)], [params.wallInnerM, params.heightM, segmentLength], tiles.innerWall),
      makeBox('wall_inner_left_lintel', 'inner-wall-lintel', [innerLeftX, doorLintelHeight + (lintelHeight / 2), 0], [params.wallInnerM, lintelHeight, doorGap], tiles.trim),
      makeBox('wall_inner_right_front', 'inner-wall', [innerRightX, params.heightM / 2, -((doorGap / 2) + (segmentLength / 2))], [params.wallInnerM, params.heightM, segmentLength], tiles.innerWall),
      makeBox('wall_inner_right_rear', 'inner-wall', [innerRightX, params.heightM / 2, (doorGap / 2) + (segmentLength / 2)], [params.wallInnerM, params.heightM, segmentLength], tiles.innerWall),
      makeBox('wall_inner_right_lintel', 'inner-wall-lintel', [innerRightX, doorLintelHeight + (lintelHeight / 2), 0], [params.wallInnerM, lintelHeight, doorGap], tiles.trim)
    );

    blocked.push(
      makeVolumeBox('blocked_inner_left_front', 'blocked', [innerLeftX, params.heightM / 2, -((doorGap / 2) + (segmentLength / 2))], [params.wallInnerM, params.heightM, segmentLength]),
      makeVolumeBox('blocked_inner_left_rear', 'blocked', [innerLeftX, params.heightM / 2, (doorGap / 2) + (segmentLength / 2)], [params.wallInnerM, params.heightM, segmentLength]),
      makeVolumeBox('blocked_inner_left_lintel', 'blocked', [innerLeftX, doorLintelHeight + (lintelHeight / 2), 0], [params.wallInnerM, lintelHeight, doorGap]),
      makeVolumeBox('blocked_inner_right_front', 'blocked', [innerRightX, params.heightM / 2, -((doorGap / 2) + (segmentLength / 2))], [params.wallInnerM, params.heightM, segmentLength]),
      makeVolumeBox('blocked_inner_right_rear', 'blocked', [innerRightX, params.heightM / 2, (doorGap / 2) + (segmentLength / 2)], [params.wallInnerM, params.heightM, segmentLength]),
      makeVolumeBox('blocked_inner_right_lintel', 'blocked', [innerRightX, doorLintelHeight + (lintelHeight / 2), 0], [params.wallInnerM, lintelHeight, doorGap])
    );

    doorway.push(
      makeVolumeBox('doorway_room_left', 'doorway', [leftCorridorMaxX + (params.wallInnerM / 2), params.clearHeightM / 2, 0], [params.wallInnerM + 0.04, params.clearHeightM, doorGap]),
      makeVolumeBox('doorway_room_right', 'doorway', [rightCorridorMinX - (params.wallInnerM / 2), params.clearHeightM / 2, 0], [params.wallInnerM + 0.04, params.clearHeightM, doorGap])
    );
  }

  walkable.push(
    makeVolumeBox('walk_corridor_left', 'walkable', [((leftCorridorMinX + leftCorridorMaxX) / 2), params.clearHeightM / 2, 0], [params.corridorWidthM, params.clearHeightM, moduleLengthM - (2 * params.wallOuterM)]),
    makeVolumeBox('walk_corridor_right', 'walkable', [((rightCorridorMinX + rightCorridorMaxX) / 2), params.clearHeightM / 2, 0], [params.corridorWidthM, params.clearHeightM, moduleLengthM - (2 * params.wallOuterM)]),
    makeVolumeBox('walk_room', 'walkable', [((roomMinX + roomMaxX) / 2), params.clearHeightM / 2, 0], [Math.max(roomMaxX - roomMinX, 0.2), params.clearHeightM, moduleLengthM - (2 * params.wallOuterM)])
  );

  blocked.push(
    makeVolumeBox('blocked_outer_left_lower', 'blocked', [leftWallCenterX, windowSillHeight / 2, 0], [params.wallOuterM, windowSillHeight, windowOpeningLength]),
    makeVolumeBox('blocked_outer_left_upper', 'blocked', [leftWallCenterX, windowTopHeight + (wallUpperHeight / 2), 0], [params.wallOuterM, wallUpperHeight, windowOpeningLength]),
    makeVolumeBox('blocked_outer_left_front_pillar', 'blocked', [leftWallCenterX, params.heightM / 2, -sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength]),
    makeVolumeBox('blocked_outer_left_rear_pillar', 'blocked', [leftWallCenterX, params.heightM / 2, sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength]),
    makeVolumeBox('blocked_outer_right_lower', 'blocked', [rightWallCenterX, windowSillHeight / 2, 0], [params.wallOuterM, windowSillHeight, windowOpeningLength]),
    makeVolumeBox('blocked_outer_right_upper', 'blocked', [rightWallCenterX, windowTopHeight + (wallUpperHeight / 2), 0], [params.wallOuterM, wallUpperHeight, windowOpeningLength]),
    makeVolumeBox('blocked_outer_right_front_pillar', 'blocked', [rightWallCenterX, params.heightM / 2, -sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength]),
    makeVolumeBox('blocked_outer_right_rear_pillar', 'blocked', [rightWallCenterX, params.heightM / 2, sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength]),
    makeVolumeBox('blocked_rear', 'blocked', [bulkheadRearCenterX, params.heightM / 2, rearWallZ], [bulkheadRearWidth, params.heightM, params.wallOuterM])
  );

  if (params.moduleType === 'cockpit') {
    blocked.push(
      makeVolumeBox('blocked_front_lower', 'blocked', [0, windowSillHeight / 2, frontWallZ], [cockpitFrontWindowWidth, windowSillHeight, params.wallOuterM]),
      makeVolumeBox('blocked_front_upper', 'blocked', [0, windowTopHeight + (wallUpperHeight / 2), frontWallZ], [cockpitFrontWindowWidth, wallUpperHeight, params.wallOuterM]),
      makeVolumeBox('blocked_front_left_pillar', 'blocked', [-cockpitFrontPillarCenterX, params.heightM / 2, frontWallZ], [cockpitFrontPillarWidth, params.heightM, params.wallOuterM]),
      makeVolumeBox('blocked_front_right_pillar', 'blocked', [cockpitFrontPillarCenterX, params.heightM / 2, frontWallZ], [cockpitFrontPillarWidth, params.heightM, params.wallOuterM]),
      makeVolumeBox('blocked_front_window_pane', 'blocked', [0, paneCenterY, cockpitFrontPaneCenterZ], [cockpitFrontPaneWidth, paneHeight, paneDepth])
    );
  } else {
    blocked.push(
      makeVolumeBox('blocked_front', 'blocked', [bulkheadFrontCenterX, params.heightM / 2, frontWallZ], [bulkheadFrontWidth, params.heightM, params.wallOuterM])
    );
  }

  if (frontCorridorOpen) {
    doorway.push(
      makeVolumeBox('doorway_front_left', 'doorway', [((leftCorridorMinX + leftCorridorMaxX) / 2), params.clearHeightM / 2, frontWallZ], [params.corridorDoorWidthM, params.clearHeightM, params.wallOuterM + 0.04]),
      makeVolumeBox('doorway_front_right', 'doorway', [((rightCorridorMinX + rightCorridorMaxX) / 2), params.clearHeightM / 2, frontWallZ], [params.corridorDoorWidthM, params.clearHeightM, params.wallOuterM + 0.04])
    );
  }

  if (rearCorridorOpen) {
    doorway.push(
      makeVolumeBox('doorway_rear_left', 'doorway', [((leftCorridorMinX + leftCorridorMaxX) / 2), params.clearHeightM / 2, rearWallZ], [params.corridorDoorWidthM, params.clearHeightM, params.wallOuterM + 0.04]),
      makeVolumeBox('doorway_rear_right', 'doorway', [((rightCorridorMinX + rightCorridorMaxX) / 2), params.clearHeightM / 2, rearWallZ], [params.corridorDoorWidthM, params.clearHeightM, params.wallOuterM + 0.04])
    );
  }

  headBump.push(
    makeVolumeBox('headbump_ceiling', 'headBump', [0, params.clearHeightM + ((params.heightM - params.clearHeightM) / 2), 0], [moduleWidthM - (2 * params.wallOuterM), params.heightM - params.clearHeightM, moduleLengthM - (2 * params.wallOuterM)])
  );

  return {
    moduleWidthM,
    moduleLengthM,
    blocks,
    volumes: {
      walkable,
      blocked,
      climb: [],
      headBump,
      doorway
    }
  };
};

const toTextureBindings = (blocks) => blocks.map((block) => ({
  mesh: block.id,
  materialSlot: 'albedo',
  tileId: block.material.tileId,
  uvMode: block.material.uvMode,
  worldScaleM: block.material.worldScaleM,
  rotationDeg: 0,
  mirrorX: false
}));

const buildModuleDoc = (params, generated, tiles) => ({
  ...(params.moduleType === 'cockpit' || params.moduleType === 'cargo'
    ? {
      endCaps: {
        frontClosed: params.moduleType === 'cockpit',
        rearClosed: params.moduleType === 'cargo'
      }
    }
    : {}),
  schema: 'airshipone.module.v1',
  id: params.id,
  category: params.category,
  moduleType: params.moduleType,
  size: {
    lengthU: round(params.lengthU),
    unitLengthM: round(params.unitLengthM),
    lengthM: round(generated.moduleLengthM),
    widthM: round(generated.moduleWidthM),
    heightM: round(params.heightM),
    clearHeightM: round(params.clearHeightM)
  },
  sizing: {
    wallOuterM: round(params.wallOuterM),
    wallInnerM: round(params.wallInnerM),
    corridorWidthM: round(params.corridorWidthM),
    corridorDoorWidthM: round(params.corridorDoorWidthM),
    roomWidthM: round(params.roomWidthM),
    roomLengthM: round(params.roomLengthM)
  },
  connectors: {
    front: {
      type: params.moduleType === 'cockpit' ? 'sealed' : 'corridor-lanes',
      lanes: params.moduleType === 'cockpit'
        ? []
        : [
          { laneId: 'left', widthM: round(params.corridorDoorWidthM), heightM: round(params.clearHeightM) },
          { laneId: 'right', widthM: round(params.corridorDoorWidthM), heightM: round(params.clearHeightM) }
        ]
    },
    rear: {
      type: params.moduleType === 'cargo' ? 'sealed' : 'corridor-lanes',
      lanes: params.moduleType === 'cargo'
        ? []
        : [
          { laneId: 'left', widthM: round(params.corridorDoorWidthM), heightM: round(params.clearHeightM) },
          { laneId: 'right', widthM: round(params.corridorDoorWidthM), heightM: round(params.clearHeightM) }
        ]
    }
  },
  anchors: {
    insertButtonFrontLeft: { position: [-1.4, 1.35, -((generated.moduleLengthM / 2) - 0.2)] },
    insertButtonFrontRight: { position: [1.4, 1.35, -((generated.moduleLengthM / 2) - 0.2)] },
    insertButtonRearLeft: { position: [-1.4, 1.35, (generated.moduleLengthM / 2) - 0.2] },
    insertButtonRearRight: { position: [1.4, 1.35, (generated.moduleLengthM / 2) - 0.2] },
    removeButton: { position: [0.0, 1.35, 0.0] }
  },
  constraints: {
    removable: !(params.moduleType === 'cockpit' || params.moduleType === 'cargo')
  },
  geometry: {
    primitiveSet: 'block-shell-v1',
    blocks: generated.blocks
  },
  volumes: generated.volumes,
  textureBindings: toTextureBindings(generated.blocks),
  texturePalette: tiles,
  tags: ['generated-shell', 'corridor-left-right', params.moduleType]
});

const printUsage = () => {
  console.log('Usage: node scripts/generate-module-shell.mjs [options]');
  console.log('');
  console.log('Options:');
  console.log('  --id <moduleId>');
  console.log('  --module-type <room|open|cockpit|cargo>');
  console.log('  --length-u <number>');
  console.log('  --room-width-m <number>');
  console.log('  --room-length-m <number>');
  console.log('  --corridor-width-m <number>');
  console.log('  --output <path/to/file.module.json>');
};

const main = async () => {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    return;
  }

  const params = parseArgs(argv);
  const profiledParams = applyModuleTypeProfile(params);
  const tiles = await loadTileAssignments();
  const generated = buildGeometryAndVolumes(profiledParams, tiles);
  const document = buildModuleDoc(profiledParams, generated, tiles);

  const outputPath = profiledParams.output
    ? path.resolve(ROOT, profiledParams.output)
    : path.join(OUTPUT_DIR, `${profiledParams.id}.module.json`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  console.log(`Generated module shell: ${path.relative(ROOT, outputPath)}`);
  console.log(`Module size: ${round(generated.moduleWidthM)}m x ${round(generated.moduleLengthM)}m x ${round(profiledParams.heightM)}m`);
  console.log(`Tiles used: ${Object.values(tiles).join(', ')}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
