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

export function calculateTotalQuantityMap<K>(map: Map<K, number>): number
{
    let total: number = 0;
    for (const [key, quantity] of map)
    {
        total += quantity;
    }

    return total;
}

export function hasQuantities<K>(testQuantities: Map<K, number>, values: (type: K) => number | undefined): boolean
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

export function subtractQuantities<K>(quantities: Map<K, number> , get: (type: K) => number | undefined, set: (type: K, value: number) => void): Map<K, number>
{
    return modifyQuantities("-", quantities, get, set);
}

export function subtractQuantity<K>(type: K, quantity: number, get: (type: K) => number | undefined, set: (type: K, value: number) => void): number
{
    return modifyQuantity("-", type, quantity, get, set);
}

export function addQuantities<K>(quantities: Map<K, number> , get: (type: K) => number | undefined, set: (type: K, value: number) => void): Map<K, number>
{
    return modifyQuantities("+", quantities, get, set);
}

export function addQuantitiesTogether<K>(quantities1: Map<K, number>, quantities2: Map<K, number>): Map<K, number>
{
    const addedQuantities: Map<K, number> = new Map<K, number>(quantities1);

    for (const [type, qty] of quantities2)
    {
        const currentQty: number = addedQuantities.get(type) ?? 0;
        addedQuantities.set(type, currentQty + qty);
    }

    return addedQuantities;
}

export function addQuantity<K>(type: K, quantity: number, get: (type: K) => number | undefined, set: (type: K, value: number) => void): number
{
    return modifyQuantity("+", type, quantity, get, set);
}

export function modifyQuantities<K>(op: string, quantities: Map<K, number> , get: (type: K) => number | undefined, set: (type: K, value: number) => void): Map<K, number>
{
    const remainingQuantities: Map<K, number> = new Map<K, number>();

    for (const [type, quantity] of quantities)
    {
        remainingQuantities.set(type, modifyQuantity(op, type, quantity, get, set));
    }

    return remainingQuantities;
}

function modifyQuantity<K>(op: string, type: K, quantity: number, get: (type: K) => number | undefined, set: (type: K, value: number) => void): number
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
