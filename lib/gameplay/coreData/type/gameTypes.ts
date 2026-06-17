import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";

//#region Resource
export const ResourceType =
{
    Metal: 1,
    Crystal: 2,
    Deuterium: 3,
} as const;
export type ResourceType = typeof ResourceType[keyof typeof ResourceType];
export type ResourceInfo =
{
	displayName: string;
}
//#endregion

//#region Buildings
export const BuildingType =
{
    MetalMine: 1,
    CrystalGrower: 2,
    DeuteriumSynthesizer: 3,
	SolarPlant: 4,
	MetalStorage: 5,
	CrystalContainement: 6,
	DeuteriumTank: 7,
    Shipyard: 8,
    RoboticFactory: 9,
    ResearchLab: 10,
} as const;
export type BuildingType = typeof BuildingType[keyof typeof BuildingType];
export type BuildingStats =
{
	displayName: string,
	requirements?: RequirementType.Requirement[];
	costFunctionType?: BuildingCostFunctionType;
	costStats?: BuildingCostStats;
	productionFunctionType?: ProductionFunctionType;
	productionStats?: Map<ResourceType, ProductionStats>;
	planetValueProductionFormulasType?: BuildingPlanetValueProductionFormulasType;
	planetValueStats?: PlanetValueStats;
};

export const BuildingCostFunctionType =
{
    SimpleExponential: 1,
} as const;
export type BuildingCostFunctionType = typeof BuildingCostFunctionType[keyof typeof BuildingCostFunctionType];
export type BuildingCostStats = 
{
	baseCostExponent: number;
	baseCost: Map<ResourceType, number>;
}

export const ProductionFunctionType =
{
    SimpleProductionBuilding: 1,
} as const;
export type ProductionFunctionType = typeof ProductionFunctionType[keyof typeof ProductionFunctionType];
export type ProductionStats =
{
    minProductionPerHour: number;
    productionFactor: number;
	exponentBase: number,
};

export const BuildingPlanetValueProductionFormulasType =
{
    SimpleExponential: 1,
    FlooredNaturalExponential: 2,
} as const;
export type BuildingPlanetValueProductionFormulasType = typeof BuildingPlanetValueProductionFormulasType[keyof typeof BuildingPlanetValueProductionFormulasType];
export type PlanetValueStats =
{
	basePlanetValueFactor: Map<PlanetValueType, number>;
	basePlanetValueExponent?: number;
	naturalExponentialFactor?: number;
	naturalExponentialExponentFactor?: number;
};
//#endregion

//#region PlanetValue
export const PlanetValueType =
{
    Energy: 1,
    MetalStorage: 2,
    CrystalStorage: 3,
    DeuteriumStorage: 4,
} as const;
export type PlanetValueType = typeof PlanetValueType[keyof typeof PlanetValueType];
export type PlanetValueInfo =
{
	displayName: string;
	showInTopBar: boolean;
	ratioImpactsResourceProduction?: boolean,
	associatedResource?: ResourceType;
	limitsResourceMax?: boolean;
}
//#endregion 

//#region Ships
export const ShipType =
{
    SmallTransport: 1,
    LargeTransport: 2,
    ColonyShip: 3,
} as const;
export type ShipType = typeof ShipType[keyof typeof ShipType];
export type ShipStats =
{
	displayName: string;
	requirements?: RequirementType.Requirement[];
	costMap: Map<ResourceType, number>;
	maxHealth: number;
	speed: number;
	space: number;
	baseFuelConsumption?: Map<ResourceType, number>;
};
//#endregion

//#region Fleet Actions
export const FleetActionType =
{
    Station: 1,
    Collect: 2,
    Colonize: 3,
} as const;
export type FleetActionType = typeof FleetActionType[keyof typeof FleetActionType];
export type FleetActionInfo =
{
	displayName: string;
	requirements?: RequirementType.Requirement[];
};
//#endregion

//#region Planet
export type SlotSizeRange =
{
	min: number;
	max: number;
};
export type PlanetAddress =
{
    galaxy: number,
    system: number,
    slot: number
}
//#endregion

//#region Researchs
export const ResearchType =
{
    ImpulseDrive: 1,
} as const;
export type ResearchType = typeof ResearchType[keyof typeof ResearchType];
export type ResearchInfo =
{
	displayName: string,
	requirements?: RequirementType.Requirement[];
	costFunctionType?: ResearchCostFunctionType;
	costStats?: ResearchCostStats;
};

export const ResearchCostFunctionType =
{
    SimpleExponential: 1,
} as const;
export type ResearchCostFunctionType = typeof ResearchCostFunctionType[keyof typeof ResearchCostFunctionType];
export type ResearchCostStats = 
{
	baseCostExponent: number;
	baseCost: Map<ResourceType, number>;
	freePlanetValueRequirements?: Map<PlanetValueType, number>;
}
//#endregion