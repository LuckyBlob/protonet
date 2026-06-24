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
    NaniteFactory: 11,
    FusionReactor: 12,
} as const;
export type BuildingType = typeof BuildingType[keyof typeof BuildingType];
export type BuildingStats =
{
	displayName: string,
	requirements?: RequirementType.Requirement[];
	buildableZones: PlanetZone[];
	costFunctionType?: BuildingCostFunctionType;
	costStats?: BuildingCostStats;
	productionFunctionType?: ProductionFunctionType;
	productionStats?: Map<ResourceType, ProductionStats>;
	planetValueStats?: PlanetValueStats[];
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
    minProductionPerHour?: number;
    productionFactor: number;
	exponentBase: number,
};

export const BuildingPlanetValueProductionFormulasType =
{
    SimpleExponential: 1,
    FlooredNaturalExponential: 2,
    // factor * level * (researchScalingBaseFactor + researchScalingPerLevelFactor * researchLevel)^level.
    // The Fusion Reactor's energy output, scaled by the player's researchScalingResearchType level.
    ResearchScaledExponential: 3,
} as const;
export type BuildingPlanetValueProductionFormulasType = typeof BuildingPlanetValueProductionFormulasType[keyof typeof BuildingPlanetValueProductionFormulasType];
export type PlanetValueStats =
{
	planetValueProductionFormulasType: BuildingPlanetValueProductionFormulasType;
	basePlanetValueFactor: Map<PlanetValueType, number>;
	basePlanetValueExponent?: number;
	naturalExponentialFactor?: number;
	naturalExponentialExponentFactor?: number;
	researchScalingResearchType?: ResearchType;
	researchScalingBaseFactor?: number;
	researchScalingPerLevelFactor?: number;
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

//#region PlayerValue
export const PlayerValueType =
{
    FleetSlots: 5,
} as const;
export type PlayerValueType = typeof PlayerValueType[keyof typeof PlayerValueType];
export type PlayerValueInfo =
{
	displayName: string;
	limitFleets?: boolean;
}
export type PlayerValueStats =
{
	playerValueProductionFormulasType: ResearchPlayerValueProductionFormulasType;
	basePlayerValueFactor: Map<PlayerValueType, number>;
}
//#endregion

//#region CalculatedValue
// The combined value-type vocabulary, mirroring DataContext = PlanetDataContext + PlayerDataContext.
// PlanetValueType and PlayerValueType are numbered in disjoint ranges so the union stays discriminable.
export const CalculatedValueType =
{
    ...PlanetValueType,
    ...PlayerValueType,
} as const;
export type CalculatedValueType = typeof CalculatedValueType[keyof typeof CalculatedValueType];
//#endregion

//#region Ships
export const ShipType =
{
    SmallTransport: 1,
    LargeTransport: 2,
    ColonyShip: 3,
    Recycler: 4,
} as const;
export type ShipType = typeof ShipType[keyof typeof ShipType];
export type EngineTech =
	| typeof ResearchType.CombustionDrive
	| typeof ResearchType.ImpulseDrive
	| typeof ResearchType.HyperspaceDrive;
export type EngineTechData<TValue> =
{
	engineTech: EngineTech,
	researchLevel: number,
	value: TValue,
}
export type ShipStats =
{
	displayName: string;
	requirements?: RequirementType.Requirement[];
	costMap: Map<ResourceType, number>;
	maxHealth: number;
	speed: EngineTechData<number>[];
	space: number;
	baseFuelConsumption?: EngineTechData<Map<ResourceType, number>>[];
	canTargetDebrisField?: boolean;
};
//#endregion

//#region Fleet Actions
export const FleetActionType =
{
    Station: 1,
    Collect: 2,
    Colonize: 3,
    Recycle: 4,
} as const;
export type FleetActionType = typeof FleetActionType[keyof typeof FleetActionType];
export type FleetActionInfo =
{
	displayName: string;
	requirements?: RequirementType.Requirement[];
};
//#endregion

//#region Planet
export const PlanetZone =
{
    Planet: 1,
    Moon: 2,
    DebrisField: 3,
} as const;
export type PlanetZone = typeof PlanetZone[keyof typeof PlanetZone];
export type PlanetZoneInfo =
{
	displayName: string;
	isSelectable: boolean;
	canProduceResources: boolean;
}

export type SlotSizeRange =
{
	min: number;
	max: number;
};
export type PlanetAddress =
{
    galaxy: number,
    system: number,
    slot: number,
    zone: PlanetZone
}
//#endregion

//#region Researchs
export const ResearchType =
{
    EnergyTech: 1,
    CombustionDrive: 2,
    ImpulseDrive: 3,
    HyperspaceDrive: 4,
    ComputerTech: 5,
} as const;
export type ResearchType = typeof ResearchType[keyof typeof ResearchType];
export type ResearchInfo =
{
	displayName: string,
	requirements?: RequirementType.Requirement[];
	costFunctionType?: ResearchCostFunctionType;
	costStats?: ResearchCostStats;
	playerValueStats?: PlayerValueStats[];
};

export const ResearchPlayerValueProductionFormulasType =
{
    ProportionalOneToOne: 1,
} as const;
export type ResearchPlayerValueProductionFormulasType = typeof ResearchPlayerValueProductionFormulasType[keyof typeof ResearchPlayerValueProductionFormulasType];

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