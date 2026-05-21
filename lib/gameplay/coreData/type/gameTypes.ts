
export const BUILDING_1: number = 1; // prod resource 1
export const BUILDING_2: number = 2; // prod resource 1
export const BUILDING_3: number = 3; // shipyard
export const SHIPYARD_BUILDING_TYPE: number = BUILDING_3;
export const BUILDING_4: number = 4; // Robotic factory
export const ROBOTIC_FACTORY_TYPE: number = BUILDING_4;

export const RESOURCE_1: number = 1;
export const RESOURCE_2: number = 2;

export const SHIP_1: number = 1; // small transport
export const SHIP_2: number = 2; // large transport

export const BUILDING_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [BUILDING_1, "Iron Mine"],
    [BUILDING_2, "Crystal Mine"],
    [SHIPYARD_BUILDING_TYPE, "Shipyard"],
    [ROBOTIC_FACTORY_TYPE, "Robotics Factory"],
]);

export const RESOURCE_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [RESOURCE_1, "Iron"],
    [RESOURCE_2, "Crystal"],
]);

export const SHIP_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [SHIP_1, "Small Transport"],
    [SHIP_2, "Large Transport"],
]);
