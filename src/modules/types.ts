export interface ModuleBlockMaterial {
  tileId: string;
  uvMode: 'repeat';
  worldScaleM: number[];
}

export interface ModuleBoxBlock {
  id: string;
  primitive: 'box';
  role: string;
  center: number[];
  size: number[];
  material: ModuleBlockMaterial;
}

export interface ModuleCylinderBlock {
  id: string;
  primitive: 'cylinder';
  role: string;
  center: number[];
  radiusTop: number;
  radiusBottom: number;
  height: number;
  radialSegments: number;
  material: ModuleBlockMaterial;
}

export type ModuleBlock = ModuleBoxBlock | ModuleCylinderBlock;

export interface ModuleVolume {
  id: string;
  shape: 'box';
  kind: 'walkable' | 'blocked' | 'climb' | 'headBump' | 'doorway';
  center: number[];
  size: number[];
}

export interface ModuleVolumeSet {
  walkable: ModuleVolume[];
  blocked: ModuleVolume[];
  climb: ModuleVolume[];
  headBump: ModuleVolume[];
  doorway: ModuleVolume[];
}

export interface GeneratedModule {
  id: string;
  moduleType: string;
  size: {
    lengthM: number;
    widthM: number;
    heightM: number;
  };
  geometry: {
    blocks: ModuleBlock[];
  };
  volumes: ModuleVolumeSet;
}
