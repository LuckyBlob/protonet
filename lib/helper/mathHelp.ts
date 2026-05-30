export function getEarliestByRequestedAt<T>(items: T[], getRequestedAt: (item: T) => number): T | null
{
    let earliest: T | null = null;
    let currentTimeToBeat: number = Number.MAX_SAFE_INTEGER;

    for (const item of items)
    {
        const requestedAt: number = getRequestedAt(item);

        if (earliest === null || currentTimeToBeat > requestedAt)
        {
            currentTimeToBeat = requestedAt;
            earliest = item;
        }
    }

    return earliest;
}

export function calculateTotalQuantityMap(map: Map<number, number>): number
{
    let total: number = 0;
    for (const [key, quantity] of map)
    {
        total += quantity;
    }

    return total;
}

export function hasQuantities(testQuantities: Map<number, number>, values: (type: number) => number | undefined): boolean
{
    for (const [type, quantity] of testQuantities)
    {
        const currentResourceQuantity: number | undefined = values(type); 
        if (currentResourceQuantity === undefined)
        {
            return false;
        }

        if (currentResourceQuantity < quantity)
        {
            return false;
        }
    }

    return true;
}

export function subtractQuantities(quantities: Map<number, number> , get: (type: number) => number | undefined, set: (type: number, value: number) => void): Map<number, number>
{
    return modifyQuantities("-", quantities, get, set);
}

export function subtractQuantity(type: number, quantity: number, get: (type: number) => number | undefined, set: (type: number, value: number) => void): number
{
    return modifyQuantity("-", type, quantity, get, set);
}

export function addQuantities(quantities: Map<number, number> , get: (type: number) => number | undefined, set: (type: number, value: number) => void): Map<number, number>
{
    return modifyQuantities("+", quantities, get, set);
}

export function addQuantitiesTogether(quantities1: Map<number, number>, quantities2: Map<number, number>): Map<number, number>
{
    const addedQuantities = new Map<number, number>(quantities1);

    for (const [type, qty] of quantities2)
    {
        const currentQty = addedQuantities.get(type) ?? 0;
        addedQuantities.set(type, currentQty + qty);
    }

    return addedQuantities;
}

export function addQuantity(type: number, quantity: number, get: (type: number) => number | undefined, set: (type: number, value: number) => void): number
{
    return modifyQuantity("+", type, quantity, get, set);
}

export function modifyQuantities(op: string, quantities: Map<number, number> , get: (type: number) => number | undefined, set: (type: number, value: number) => void): Map<number, number>
{
    const remainingQuantities: Map<number, number> = new Map<number, number>();

    for (const [type, quantity] of quantities)
    {
        remainingQuantities.set(type, modifyQuantity(op, type, quantity, get, set));
    }

    return remainingQuantities;
}

function modifyQuantity(op: string, type: number, quantity: number, get: (type: number) => number | undefined, set: (type: number, value: number) => void): number
{
    const currentResourceQuantity: number | undefined = get(type); 
    if (currentResourceQuantity === undefined)
    {
        throw new Error(`⚠️: Substracting non existing specific thing!`); 
    }

    let newValue: number = currentResourceQuantity;
    switch (op)
    {
        case "+":
        {
            newValue = currentResourceQuantity + quantity;
            break;
        }
        case "-":
        {
            newValue = currentResourceQuantity - quantity;
            break;
        }
        default:
            throw new Error(`⚠️: quantity modification operator unknown: ${op}`); 
    }
    
    if (newValue < 0)
    {
        throw new Error(`⚠️: Substracting too much specific thing!`); 
    }

    set(type, newValue);
    return newValue;
}