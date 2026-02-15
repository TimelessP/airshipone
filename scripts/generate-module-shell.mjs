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
  interiorProfile: 'auto',
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
const INTERIOR_PROFILES = new Set([
  'auto',
  'none',
  'captains-cabin',
  'battery-room',
  'ladder-room-none',
  'ladder-room-floor-hole',
  'ladder-room-ceiling-hole',
  'ladder-room-through'
]);

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
      case 'interior-profile':
        parsed.interiorProfile = next;
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

  if (!INTERIOR_PROFILES.has(params.interiorProfile)) {
    throw new Error('Unsupported interior profile: '
      + `${params.interiorProfile}. Use one of: auto, none, captains-cabin, battery-room, `
      + 'ladder-room-none, ladder-room-floor-hole, ladder-room-ceiling-hole, ladder-room-through');
  }

  const roomOnlyProfiles = new Set([
    'captains-cabin',
    'battery-room',
    'ladder-room-none',
    'ladder-room-floor-hole',
    'ladder-room-ceiling-hole',
    'ladder-room-through'
  ]);

  if (roomOnlyProfiles.has(params.interiorProfile) && params.moduleType !== 'room') {
    throw new Error(`Interior profile ${params.interiorProfile} requires --module-type room`);
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

const requireTile = (tileIds, expected) => {
  const found = tileIds.find((tileId) => tileId === expected);
  if (!found) {
    throw new Error(`Required tile not found: ${expected}.png in assets/textures/tiles`);
  }
  return found;
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
    trim: findTile(tileIds, ['brass', 'oak', 'walnut'], 'paper'),
    controlPanelFront: findTile(tileIds, ['electrical-control-panel-front'], 'brass'),
    wood: findTile(tileIds, ['oak', 'walnut'], 'paper'),
    leather: requireTile(tileIds, 'leather-brown-256x256px'),
    paper: findTile(tileIds, ['paper-bright', 'paper'], 'paper')
  };
};

const resolveInteriorProfile = (params) => {
  if (params.interiorProfile !== 'auto') {
    return params.interiorProfile;
  }

  if (params.id === 'captains_cabin_mk1') {
    return 'captains-cabin';
  }

  if (params.id === 'battery_room_mk1') {
    return 'battery-room';
  }

  if (params.id === 'ladder_room_single_mk1') {
    return 'ladder-room-none';
  }

  if (params.id === 'ladder_room_lowest_mk1') {
    return 'ladder-room-ceiling-hole';
  }

  if (params.id === 'ladder_room_middle_mk1') {
    return 'ladder-room-through';
  }

  if (params.id === 'ladder_room_highest_mk1') {
    return 'ladder-room-floor-hole';
  }

  return 'none';
};

const addCaptainsCabinFurnishings = ({ blocks, blocked, params, tiles, roomMinX, roomMaxX, moduleLengthM }) => {
  const roomFrontZ = -((moduleLengthM / 2) - params.wallOuterM);
  const roomRearZ = (moduleLengthM / 2) - params.wallOuterM;
  const floorTopY = params.floorThicknessM;

  const addFurniture = ({ id, role, center, size, tileId, addBlocked = true }) => {
    blocks.push(makeBox(id, role, center, size, tileId));
    if (addBlocked) {
      blocked.push(makeVolumeBox(`blocked_${id}`, 'blocked', center, size));
    }
  };

  addFurniture({
    id: 'furn_bed_frame',
    role: 'furniture-bed-frame',
    center: [0, floorTopY + 0.2, roomRearZ - 0.51],
    size: [2.02, 0.4, 1.02],
    tileId: tiles.wood
  });

  addFurniture({
    id: 'furn_bed_mattress',
    role: 'furniture-bed-mattress',
    center: [0, floorTopY + 0.49, roomRearZ - 0.51],
    size: [1.94, 0.18, 0.96],
    tileId: tiles.paper
  });

  const deskWidth = 1.1;
  const sideWallGap = 0.06;
  const deskHalfWidth = deskWidth / 2;
  const unitToDeskGap = sideWallGap;
  const unitOuterRightX = roomMaxX - sideWallGap;
  const unitInnerRightX = deskHalfWidth + unitToDeskGap;
  const unitWidthX = unitOuterRightX - unitInnerRightX;
  const unitCenterRightX = (unitOuterRightX + unitInnerRightX) / 2;
  const unitOuterLeftX = roomMinX + sideWallGap;
  const unitInnerLeftX = -(deskHalfWidth + unitToDeskGap);
  const unitCenterLeftX = (unitOuterLeftX + unitInnerLeftX) / 2;
  const frontFurnitureZ = roomFrontZ + 0.26;

  addFurniture({
    id: 'furn_locker',
    role: 'furniture-locker',
    center: [unitCenterRightX, floorTopY + 0.95, frontFurnitureZ],
    size: [unitWidthX, 1.9, 0.5],
    tileId: tiles.wood
  });

  const shelfUnitCenterX = unitCenterLeftX;
  const shelfUnitCenterY = floorTopY + 0.95;
  const shelfUnitCenterZ = frontFurnitureZ;
  const shelfUnitHeight = 1.9;
  const shelfUnitDepth = 0.42;
  const shelfBoardThickness = 0.03;
  const shelfHalfWidth = unitWidthX / 2;
  const shelfHalfDepth = shelfUnitDepth / 2;
  const shelfBottomY = floorTopY;
  const shelfTopY = floorTopY + shelfUnitHeight;
  const shelfInnerWidth = Math.max(0.2, unitWidthX - (2 * shelfBoardThickness));
  const shelfInnerDepth = Math.max(0.12, shelfUnitDepth - shelfBoardThickness);

  addFurniture({
    id: 'furn_bookshelf_side_left',
    role: 'furniture-bookshelf-side',
    center: [shelfUnitCenterX - shelfHalfWidth + (shelfBoardThickness / 2), shelfUnitCenterY, shelfUnitCenterZ],
    size: [shelfBoardThickness, shelfUnitHeight, shelfUnitDepth],
    tileId: tiles.wood
  });

  addFurniture({
    id: 'furn_bookshelf_side_right',
    role: 'furniture-bookshelf-side',
    center: [shelfUnitCenterX + shelfHalfWidth - (shelfBoardThickness / 2), shelfUnitCenterY, shelfUnitCenterZ],
    size: [shelfBoardThickness, shelfUnitHeight, shelfUnitDepth],
    tileId: tiles.wood
  });

  addFurniture({
    id: 'furn_bookshelf_rear',
    role: 'furniture-bookshelf-rear',
    center: [shelfUnitCenterX, shelfUnitCenterY, shelfUnitCenterZ - shelfHalfDepth + (shelfBoardThickness / 2)],
    size: [shelfInnerWidth, shelfUnitHeight, shelfBoardThickness],
    tileId: tiles.wood
  });

  const shelfCount = 5;
  const shelfCentersY = [];
  const shelfStartY = shelfBottomY + (shelfBoardThickness / 2);
  const shelfEndY = shelfTopY - (shelfBoardThickness / 2);

  for (let shelfIndex = 0; shelfIndex < shelfCount; shelfIndex += 1) {
    const t = shelfCount === 1 ? 0 : shelfIndex / (shelfCount - 1);
    const shelfY = shelfStartY + ((shelfEndY - shelfStartY) * t);
    shelfCentersY.push(shelfY);
    addFurniture({
      id: `furn_bookshelf_shelf_${shelfIndex + 1}`,
      role: 'furniture-bookshelf-shelf',
      center: [shelfUnitCenterX, shelfY, shelfUnitCenterZ + (shelfBoardThickness / 2)],
      size: [shelfInnerWidth, shelfBoardThickness, shelfInnerDepth],
      tileId: tiles.wood
    });
  }

  let bookIndex = 0;
  const booksPerRow = 6;
  const booksUsableWidth = Math.max(0.2, shelfInnerWidth - 0.04);
  const bookSlotWidth = booksUsableWidth / booksPerRow;
  const bookWidth = Math.max(0.03, Math.min(0.065, bookSlotWidth * 0.78));
  const bookDepth = Math.max(0.18, shelfInnerDepth - 0.1);

  for (let rowIndex = 0; rowIndex < shelfCentersY.length - 1; rowIndex += 1) {
    const lowerShelf = shelfCentersY[rowIndex];
    const upperShelf = shelfCentersY[rowIndex + 1];
    const compartmentBottomY = lowerShelf + (shelfBoardThickness / 2);
    const compartmentTopY = upperShelf - (shelfBoardThickness / 2);
    const bookHeight = Math.max(0.16, compartmentTopY - compartmentBottomY - 0.02);
    const bookCenterY = compartmentBottomY + (bookHeight / 2);

    for (let colIndex = 0; colIndex < booksPerRow; colIndex += 1) {
      bookIndex += 1;
      const bookCenterX =
        shelfUnitCenterX - (booksUsableWidth / 2) + (bookSlotWidth * (colIndex + 0.5));
      addFurniture({
        id: `furn_books_leather_${bookIndex}`,
        role: 'furniture-books-leather',
        center: [bookCenterX, bookCenterY, shelfUnitCenterZ + 0.02],
        size: [bookWidth, bookHeight, bookDepth],
        tileId: tiles.leather
      });
    }
  }

  addFurniture({
    id: 'furn_desk',
    role: 'furniture-desk',
    center: [0, floorTopY + 0.38, roomFrontZ + 0.36],
    size: [deskWidth, 0.76, 0.56],
    tileId: tiles.wood
  });

  const chairSeatCenterZ = roomFrontZ + 0.86;
  const chairSeatWidth = 0.44;
  const chairSeatHeight = 0.44;
  const chairSeatDepth = 0.44;
  const chairBackWidth = chairSeatWidth;
  const chairBackHeight = 0.44;
  const chairBackDepth = 0.08;

  addFurniture({
    id: 'furn_chair_seat',
    role: 'furniture-chair-seat',
    center: [0, floorTopY + (chairSeatHeight / 2), chairSeatCenterZ],
    size: [chairSeatWidth, chairSeatHeight, chairSeatDepth],
    tileId: tiles.wood
  });

  addFurniture({
    id: 'furn_chair_back',
    role: 'furniture-chair-back',
    center: [
      0,
      floorTopY + chairSeatHeight + (chairBackHeight / 2),
      chairSeatCenterZ + (chairSeatDepth / 2) - (chairBackDepth / 2)
    ],
    size: [chairBackWidth, chairBackHeight, chairBackDepth],
    tileId: tiles.wood
  });

  addFurniture({
    id: 'furn_a4_paper',
    role: 'furniture-paper-a4',
    center: [0.18, floorTopY + 0.77, roomFrontZ + 0.33],
    size: [0.21, 0.01, 0.297],
    tileId: tiles.paper,
    addBlocked: false
  });
};

const addBatteryRoomFurnishings = ({ blocks, blocked, params, tiles, moduleLengthM }) => {
  const roomFrontZ = -((moduleLengthM / 2) - params.wallOuterM);
  const roomRearZ = (moduleLengthM / 2) - params.wallOuterM;
  const floorTopY = params.floorThicknessM;

  const addFurniture = ({ id, role, center, size, tileId, addBlocked = true }) => {
    blocks.push(makeBox(id, role, center, size, tileId));
    if (addBlocked) {
      blocked.push(makeVolumeBox(`blocked_${id}`, 'blocked', center, size));
    }
  };

  const batteryDepth = 0.72;
  const batteryWidth = 0.86;
  const batteryHeight = 1.15;
  const batteryCenterZ = roomFrontZ + (batteryDepth / 2) + 0.12;

  addFurniture({
    id: 'furn_battery_box_a',
    role: 'furniture-battery-box-a',
    center: [-0.58, floorTopY + (batteryHeight / 2), batteryCenterZ],
    size: [batteryWidth, batteryHeight, batteryDepth],
    tileId: tiles.trim
  });

  addFurniture({
    id: 'furn_battery_box_b',
    role: 'furniture-battery-box-b',
    center: [0.58, floorTopY + (batteryHeight / 2), batteryCenterZ],
    size: [batteryWidth, batteryHeight, batteryDepth],
    tileId: tiles.trim
  });

  addFurniture({
    id: 'furn_battery_control_panel',
    role: 'furniture-battery-control-panel',
    center: [0, 1.45, roomRearZ - 0.12],
    size: [0.92, 0.92, 0.18],
    tileId: tiles.controlPanelFront,
    addBlocked: false
  });
};

const isLadderProfile = (profile) => profile.startsWith('ladder-room-');

const getLadderProfileOpenings = (profile) => {
  return {
    floorHole: profile === 'ladder-room-floor-hole' || profile === 'ladder-room-through',
    ceilingHole: profile === 'ladder-room-ceiling-hole' || profile === 'ladder-room-through'
  };
};

const addHorizontalPanelWithOptionalCenterHole = ({
  blocks,
  idPrefix,
  role,
  tileId,
  yCenter,
  thickness,
  moduleWidthM,
  moduleLengthM,
  holeWidth,
  holeLength,
  hasHole
}) => {
  if (!hasHole) {
    blocks.push(makeBox(idPrefix, role, [0, yCenter, 0], [moduleWidthM, thickness, moduleLengthM], tileId));
    return;
  }

  const sideWidth = Math.max(0.12, (moduleWidthM - holeWidth) / 2);
  const frontBackLength = Math.max(0.12, (moduleLengthM - holeLength) / 2);
  const sideCenterX = (holeWidth / 2) + (sideWidth / 2);
  const frontBackCenterZ = (holeLength / 2) + (frontBackLength / 2);

  blocks.push(
    makeBox(`${idPrefix}_left`, role, [-sideCenterX, yCenter, 0], [sideWidth, thickness, moduleLengthM], tileId),
    makeBox(`${idPrefix}_right`, role, [sideCenterX, yCenter, 0], [sideWidth, thickness, moduleLengthM], tileId),
    makeBox(`${idPrefix}_front`, role, [0, yCenter, -frontBackCenterZ], [holeWidth, thickness, frontBackLength], tileId),
    makeBox(`${idPrefix}_rear`, role, [0, yCenter, frontBackCenterZ], [holeWidth, thickness, frontBackLength], tileId)
  );
};

const addLadderRoomFurnishings = ({
  blocks,
  climb,
  params,
  tiles,
  moduleLengthM,
  interiorProfile
}) => {
  const floorTopY = params.floorThicknessM;
  const ceilingBottomY = params.heightM - params.ceilingThicknessM;
  const shaftWidth = 0.78;
  const shaftLength = 0.78;
  const ladderRailOffset = 0.14;
  const railRadius = 0.02;
  const ladderRailOverlapM = 0.24;
  const climbOverlapM = 0.44;

  const openings = getLadderProfileOpenings(interiorProfile);
  const railBottomY = openings.floorHole ? -ladderRailOverlapM : floorTopY;
  const railTopY = openings.ceilingHole ? (params.heightM + ladderRailOverlapM) : (ceilingBottomY - 0.06);
  const railHeight = Math.max(1.7, railTopY - railBottomY);
  const railCenterY = railBottomY + (railHeight / 2);

  const climbBottomY = openings.floorHole ? -climbOverlapM : 0;
  const climbTopY = openings.ceilingHole ? (params.heightM + climbOverlapM) : params.clearHeightM;
  const climbHeight = Math.max(1.7, climbTopY - climbBottomY);
  const climbCenterY = climbBottomY + (climbHeight / 2);
  addHorizontalPanelWithOptionalCenterHole({
    blocks,
    idPrefix: 'floor',
    role: 'floor',
    tileId: tiles.floor,
    yCenter: params.floorThicknessM / 2,
    thickness: params.floorThicknessM,
    moduleWidthM: (2 * params.wallOuterM) + (2 * params.corridorWidthM) + (2 * params.wallInnerM) + params.roomWidthM,
    moduleLengthM,
    holeWidth: shaftWidth,
    holeLength: shaftLength,
    hasHole: openings.floorHole
  });

  addHorizontalPanelWithOptionalCenterHole({
    blocks,
    idPrefix: 'ceiling',
    role: 'ceiling',
    tileId: tiles.ceiling,
    yCenter: params.heightM - (params.ceilingThicknessM / 2),
    thickness: params.ceilingThicknessM,
    moduleWidthM: (2 * params.wallOuterM) + (2 * params.corridorWidthM) + (2 * params.wallInnerM) + params.roomWidthM,
    moduleLengthM,
    holeWidth: shaftWidth,
    holeLength: shaftLength,
    hasHole: openings.ceilingHole
  });

  blocks.push(
    makeCylinder('furn_ladder_rail_left', 'furniture-ladder-rail', [-ladderRailOffset, railCenterY, 0], railRadius, railHeight, tiles.trim),
    makeCylinder('furn_ladder_rail_right', 'furniture-ladder-rail', [ladderRailOffset, railCenterY, 0], railRadius, railHeight, tiles.trim)
  );

  const rungCount = 10;
  for (let rungIndex = 0; rungIndex < rungCount; rungIndex += 1) {
    const rungY = (railBottomY + 0.16) + ((railHeight - 0.28) * (rungIndex / Math.max(1, rungCount - 1)));
    blocks.push(makeBox(`furn_ladder_rung_${rungIndex + 1}`, 'furniture-ladder-rung', [0, rungY, 0], [0.36, 0.03, 0.06], tiles.trim));
  }

  climb.push(
    makeVolumeBox('climb_ladder_column', 'climb', [0, climbCenterY, 0], [shaftWidth, climbHeight, shaftLength])
  );
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
  const interiorProfile = resolveInteriorProfile(params);
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
  const climb = [];

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
  const ceilingLightCenterX = isLadderProfile(interiorProfile)
    ? roomMaxX - 0.28
    : 0;
  const leftWallCenterX = -(halfW - (params.wallOuterM / 2));
  const rightWallCenterX = halfW - (params.wallOuterM / 2);
  const leftPaneCenterX = (-halfW + params.wallOuterM) - (paneDepth / 2);
  const rightPaneCenterX = (halfW - params.wallOuterM) + (paneDepth / 2);

  const cockpitFrontWindowWidth = Math.max(0.9, Math.min(moduleWidthM - 0.5, 1.6));
  const cockpitFrontPillarWidth = Math.max(0.12, (moduleWidthM - cockpitFrontWindowWidth) / 2);
  const cockpitFrontPillarCenterX = (cockpitFrontWindowWidth / 2) + (cockpitFrontPillarWidth / 2);
  const cockpitFrontPaneWidth = Math.max(0.7, cockpitFrontWindowWidth - 0.08);
  const cockpitFrontPaneCenterZ = frontWallZ - (params.wallOuterM / 2) + (paneDepth / 2);

  if (!isLadderProfile(interiorProfile)) {
    blocks.push(
      makeBox('floor', 'floor', [0, yFloor, 0], [moduleWidthM, params.floorThicknessM, moduleLengthM], tiles.floor),
      makeBox('ceiling', 'ceiling', [0, yCeiling, 0], [moduleWidthM, params.ceilingThicknessM, moduleLengthM], tiles.ceiling)
    );
  }

  blocks.push(
    makeBox('wall_outer_left_lower', 'outer-wall', [leftWallCenterX, windowSillHeight / 2, 0], [params.wallOuterM, windowSillHeight, windowOpeningLength], tiles.wall),
    makeBox('wall_outer_left_upper', 'outer-wall', [leftWallCenterX, windowTopHeight + (wallUpperHeight / 2), 0], [params.wallOuterM, wallUpperHeight, windowOpeningLength], tiles.wall),
    makeBox('wall_outer_left_front_pillar', 'outer-wall', [leftWallCenterX, params.heightM / 2, -sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength], tiles.wall),
    makeBox('wall_outer_left_rear_pillar', 'outer-wall', [leftWallCenterX, params.heightM / 2, sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength], tiles.wall),
    makeBox('wall_outer_right_lower', 'outer-wall', [rightWallCenterX, windowSillHeight / 2, 0], [params.wallOuterM, windowSillHeight, windowOpeningLength], tiles.wall),
    makeBox('wall_outer_right_upper', 'outer-wall', [rightWallCenterX, windowTopHeight + (wallUpperHeight / 2), 0], [params.wallOuterM, wallUpperHeight, windowOpeningLength], tiles.wall),
    makeBox('wall_outer_right_front_pillar', 'outer-wall', [rightWallCenterX, params.heightM / 2, -sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength], tiles.wall),
    makeBox('wall_outer_right_rear_pillar', 'outer-wall', [rightWallCenterX, params.heightM / 2, sidePillarOffsetZ], [params.wallOuterM, params.heightM, sidePillarLength], tiles.wall),
    makeBox('wall_rear', 'bulkhead-rear', [bulkheadRearCenterX, params.heightM / 2, rearWallZ], [bulkheadRearWidth, params.heightM, params.wallOuterM], tiles.wall),
    makeCylinder('ceiling_light_center', 'ceiling-light', [ceilingLightCenterX, ceilingLightY, 0], ceilingLightRadius, ceilingLightHeight, tiles.trim)
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
    const doorGapVolume = Math.min(moduleLengthM - 0.2, doorGap + 0.16);
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
      makeVolumeBox('doorway_room_left', 'doorway', [leftCorridorMaxX + (params.wallInnerM / 2), params.clearHeightM / 2, 0], [params.wallInnerM + 0.01, params.clearHeightM, doorGapVolume]),
      makeVolumeBox('doorway_room_right', 'doorway', [rightCorridorMinX - (params.wallInnerM / 2), params.clearHeightM / 2, 0], [params.wallInnerM + 0.01, params.clearHeightM, doorGapVolume])
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
      makeVolumeBox('doorway_front_left', 'doorway', [((leftCorridorMinX + leftCorridorMaxX) / 2), params.clearHeightM / 2, frontWallZ], [params.corridorWidthM, params.clearHeightM, params.wallOuterM + 0.01]),
      makeVolumeBox('doorway_front_right', 'doorway', [((rightCorridorMinX + rightCorridorMaxX) / 2), params.clearHeightM / 2, frontWallZ], [params.corridorWidthM, params.clearHeightM, params.wallOuterM + 0.01])
    );
  }

  if (rearCorridorOpen) {
    doorway.push(
      makeVolumeBox('doorway_rear_left', 'doorway', [((leftCorridorMinX + leftCorridorMaxX) / 2), params.clearHeightM / 2, rearWallZ], [params.corridorWidthM, params.clearHeightM, params.wallOuterM + 0.01]),
      makeVolumeBox('doorway_rear_right', 'doorway', [((rightCorridorMinX + rightCorridorMaxX) / 2), params.clearHeightM / 2, rearWallZ], [params.corridorWidthM, params.clearHeightM, params.wallOuterM + 0.01])
    );
  }

  headBump.push(
    makeVolumeBox('headbump_ceiling', 'headBump', [0, params.clearHeightM + ((params.heightM - params.clearHeightM) / 2), 0], [moduleWidthM - (2 * params.wallOuterM), params.heightM - params.clearHeightM, moduleLengthM - (2 * params.wallOuterM)])
  );

  if (interiorProfile === 'captains-cabin') {
    addCaptainsCabinFurnishings({
      blocks,
      blocked,
      params,
      tiles,
      roomMinX,
      roomMaxX,
      moduleLengthM
    });
  }

  if (interiorProfile === 'battery-room') {
    addBatteryRoomFurnishings({
      blocks,
      blocked,
      params,
      tiles,
      moduleLengthM
    });
  }

  if (isLadderProfile(interiorProfile)) {
    addLadderRoomFurnishings({
      blocks,
      climb,
      params,
      tiles,
      moduleLengthM,
      interiorProfile
    });
  }

  return {
    moduleWidthM,
    moduleLengthM,
    blocks,
    volumes: {
      walkable,
      blocked,
      climb,
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
  console.log('  --interior-profile <auto|none|captains-cabin|battery-room|ladder-room-none|ladder-room-floor-hole|ladder-room-ceiling-hole|ladder-room-through>');
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
