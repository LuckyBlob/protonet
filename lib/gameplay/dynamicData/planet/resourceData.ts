import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as MathHelp from "@/lib/helper/mathHelp";

export function setResourceQuantity(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, value: number): void
{
    ThingHelpers.setSpecificThingValue(null, planetData, CoreType.DataContext.ResourceQuantity, resourceType, value);
}

export function setResourceQuantities(planetData: CoreType.PlanetData, resourceQuantities: Map<GameType.ResourceType, number>): void
{
    for (const [resourceType, resourceQuantity] of resourceQuantities)
    {
        setResourceQuantity(planetData, resourceType, resourceQuantity);
    }
}

export function getResourceQuantity(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType): number
{
    const resourceQuantities: Map<GameType.ResourceType, number> = ThingHelpers.getThingValues(null, planetData, CoreType.DataContext.ResourceQuantity) as Map<GameType.ResourceType, number>;
    return Math.floor(resourceQuantities.get(resourceType) ?? 0);
}

export function getResourceQuantities(planetData: CoreType.PlanetData): Map<GameType.ResourceType, number>
{
    const resourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const resourceType of StaticData.RESOURCE_INFOS.keys())
    {
        resourceQuantities.set(resourceType, getResourceQuantity(planetData, resourceType));
    }

    return resourceQuantities;
}

export function hasResourceQuantities(planetData: CoreType.PlanetData, resourceQuantities: Map<GameType.ResourceType, number>): boolean
{
    return MathHelp.hasQuantities(resourceQuantities, (type: GameType.ResourceType): number | undefined => { return getResourceQuantity(planetData, type) });
}

export function subtractPlanetResources(planetData: CoreType.PlanetData, resourceQuantities: Map<GameType.ResourceType, number>): Map<GameType.ResourceType, number>
{
    return MathHelp.subtractQuantities(resourceQuantities,
                                      (type: GameType.ResourceType): number | undefined => { return getResourceQuantity(planetData, type) },
                                      (type: GameType.ResourceType, value: number): void => { setResourceQuantity(planetData, type, value) });
}

export function subtractPlanetResource(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, amountToSubtract: number): number
{
    return MathHelp.subtractQuantity(resourceType, amountToSubtract,
                                    (type: GameType.ResourceType): number | undefined => { return getResourceQuantity(planetData, type) },
                                    (type: GameType.ResourceType, value: number): void => { setResourceQuantity(planetData, type, value) });
}

export function addPlanetResources(planetData: CoreType.PlanetData, resourceQuantities: Map<GameType.ResourceType, number>): Map<GameType.ResourceType, number>
{
    return MathHelp.addQuantities(resourceQuantities,
                                 (type: GameType.ResourceType): number | undefined => { return getResourceQuantity(planetData, type) },
                                 (type: GameType.ResourceType, value: number): void => { setResourceQuantity(planetData, type, value) });
}

export function addPlanetResource(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, amountToSubtract: number): number
{
    return MathHelp.addQuantity(resourceType, amountToSubtract,
                               (type: GameType.ResourceType): number | undefined => { return getResourceQuantity(planetData, type) },
                               (type: GameType.ResourceType, value: number): void => { setResourceQuantity(planetData, type, value) });
}

export function computeCollectedResources(availableResourceQuantities: Map<GameType.ResourceType, number>, availableSpace: number): Map<GameType.ResourceType, number>
{
	const collectedResourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

	const remainingResourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>(availableResourceQuantities);
	let remainingSpace: number = availableSpace;

	while (remainingSpace > 0)
	{
		let totalRemaining: number = 0;
		for (const quantity of remainingResourceQuantities.values())
		{
			totalRemaining += quantity;
		}

		if (totalRemaining <= 0)
		{
			break;
		}

		const spaceToFill: number = Math.min(remainingSpace, totalRemaining);
		let collectedThisPass: number = 0;
		let depletedAny: boolean = false;

		for (const [resourceType, resourceQuantity] of remainingResourceQuantities)
		{
			const proportionalAmount: number = Math.floor((resourceQuantity / totalRemaining) * spaceToFill);
			const actualAmount: number = Math.min(proportionalAmount, resourceQuantity);

			if (actualAmount <= 0)
			{
				continue;
			}

			const previousCollected: number = collectedResourceQuantities.get(resourceType) ?? 0;
			collectedResourceQuantities.set(resourceType, previousCollected + actualAmount);
			remainingResourceQuantities.set(resourceType, resourceQuantity - actualAmount);
			collectedThisPass += actualAmount;

			if (resourceQuantity - actualAmount === 0)
			{
				depletedAny = true;
			}
		}

		remainingSpace -= collectedThisPass;

		if (collectedThisPass === 0)
		{
			break;
		}

		if (depletedAny === false)
		{
			break;
		}
	}

	return collectedResourceQuantities;
}
