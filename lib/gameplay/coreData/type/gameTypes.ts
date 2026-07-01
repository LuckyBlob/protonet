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
	canGoToDebrisField: boolean;
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
    Terraformer: 13,
    LunarBase: 14,
    MissileSilo: 15,
    SensorPhalanx: 16,
    JumpGate: 17,
    RepairDock: 18,
} as const;
export type BuildingType = typeof BuildingType[keyof typeof BuildingType];
export type BuildingStats =
{
	displayName: string,
	upgradeRequirements?: RequirementType.Requirement[];
	deconstructRequirements?: RequirementType.Requirement[];
	buildableZones: PlanetZone[];
	canDeconstruct?: boolean;
	costFunctionType?: BuildingCostFunctionType;
	costStats?: BuildingCostStats;
	productionFunctionType?: ProductionFunctionType;
	productionStats?: Map<ResourceType, ProductionStats>;
	planetValueStats?: PlanetValueStat[];
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
    TemperatureScaledProductionBuilding: 2,
} as const;
export type ProductionFunctionType = typeof ProductionFunctionType[keyof typeof ProductionFunctionType];
export type ProductionStats =
{
    minProductionPerHour?: number;
    productionFactor: number;
	exponentBase: number,
};

export const PlanetValueProductionFormulasType =
{
    SimpleExponential: 1,
    FlooredNaturalExponential: 2,
    ResearchScaledExponential: 3,
    LinearPerLevel: 4,
    TemperatureScaled: 5,
    FixedPerUnit: 6,
    SimpleExponentialBuildingEnergyThrottled: 7,
    ResearchScaledExponentialBuildingEnergyThrottled: 8,
} as const;
export type PlanetValueProductionFormulasType = typeof PlanetValueProductionFormulasType[keyof typeof PlanetValueProductionFormulasType];
export type PlanetValueStat =
{
	planetValueProductionFormulasType: PlanetValueProductionFormulasType;
	planetValueType: PlanetValueType;
	basePlanetValueFactor: number;
	basePlanetValueExponent?: number;
	naturalExponentialFactor?: number;
	naturalExponentialExponentFactor?: number;
	researchScalingResearchType?: ResearchType;
	researchScalingBaseFactor?: number;
	researchScalingPerLevelFactor?: number;
	temperatureOffset?: number;
	temperatureDivider?: number;
};
//#endregion

//#region PlanetValue
export const PlanetValueType =
{
    Energy: 1,
    MetalStorage: 2,
    CrystalStorage: 3,
    DeuteriumStorage: 4,
    Size: 6,
    Temperature: 7,
    MissileSpace: 8,
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
export const PlayerValueProductionFormulasType =
{
    ProportionalOneToOne: 1,
} as const;
export type PlayerValueProductionFormulasType = typeof PlayerValueProductionFormulasType[keyof typeof PlayerValueProductionFormulasType];
export type PlayerValueStat =
{
	playerValueProductionFormulasType: PlayerValueProductionFormulasType;
	playerValueType: PlayerValueType;
	basePlayerValueFactor: number;
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

//#region Units
export const UnitType =
{
    SmallTransport: 1,
    LargeTransport: 2,
    ColonyShip: 3,
    Recycler: 4,
    EspionageProbe: 5,
    RocketLauncher: 6,
    SolarSatellite: 7,
    InterplanetaryMissile: 8,
    InterceptorMissile: 9,
} as const;
export type UnitType = typeof UnitType[keyof typeof UnitType];

export const UnitCategory =
{
    Ship: 1,
    Defense: 2,
    Satellite: 3,
    Missile: 4,
} as const;
export type UnitCategory = typeof UnitCategory[keyof typeof UnitCategory];
export type UnitCategoryInfo =
{
	displayName: string;
}
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
export const SpeedFunctionType =
{
    EngineDrive: 1,
    Missile: 2,
} as const;
export type SpeedFunctionType = typeof SpeedFunctionType[keyof typeof SpeedFunctionType];
export const RangeFunctionType =
{
    Missile: 1,
} as const;
export type RangeFunctionType = typeof RangeFunctionType[keyof typeof RangeFunctionType];
export type SpeedStats =
{
	engineTechData?: EngineTechData<number>[];
	speedFunctionType: SpeedFunctionType;
	rangeFunctionType?: RangeFunctionType;
}
export const UnitConstructionQueueType =
{
    Shipyard: 1,
    MissileSilo: 2,
} as const;
export type UnitConstructionQueueType = typeof UnitConstructionQueueType[keyof typeof UnitConstructionQueueType];

export type UnitStats =
{
	displayName: string;
	category: UnitCategory;
	queueType?: UnitConstructionQueueType;
	requirements?: RequirementType.Requirement[];
	costMap: Map<ResourceType, number>;
	maxHealth: number;
	shieldPower: number;
	weaponPower: number;
	repairChance?: number;
	participatesInCombat?: boolean;
	rapidFire?: Map<UnitType, number>;
	speed?: SpeedStats;
	space?: number;
	baseFuelConsumption?: EngineTechData<Map<ResourceType, number>>[];
	canTargetDebrisField?: boolean;
	canGenerateDebris?: boolean;
	canBeRepairedAtRepairDock?: boolean;
	canSpy?: boolean;
	canLaunchAsMissile?: boolean;
	planetValueStats?: PlanetValueStat[];
};
//#endregion

//#region Fleet Actions
export const FleetActionType =
{
    Station: 1,
    Collect: 2,
    Colonize: 3,
    Recycle: 4,
    Espionage: 5,
    Transport: 6,
    MissileLaunch: 7,
    Attack: 8,
} as const;
export type FleetActionType = typeof FleetActionType[keyof typeof FleetActionType];
export const FleetActionCategory =
{
    Ship: 1,
    Missile: 2,
} as const;
export type FleetActionCategory = typeof FleetActionCategory[keyof typeof FleetActionCategory];
export type FleetActionInfo =
{
	displayName: string;
	category: FleetActionCategory;
	requirements?: RequirementType.Requirement[];
	returnsToOrigin?: boolean;
	canBeScanned?: boolean;
	canBeRecalled?: boolean;
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
	canBeSpied: boolean;
	canBeAttacked: boolean;
}

export type SlotSizeRange =
{
	min: number;
	max: number;
};
export type SlotTemperatureRange =
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
    EspionageTech: 6,
    WeaponTech: 7,
    ShieldingTech: 8,
    ArmourTech: 9,
} as const;
export type ResearchType = typeof ResearchType[keyof typeof ResearchType];
export type ResearchInfo =
{
	displayName: string,
	requirements?: RequirementType.Requirement[];
	costFunctionType?: ResearchCostFunctionType;
	costStats?: ResearchCostStats;
	playerValueStats?: PlayerValueStat[];
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