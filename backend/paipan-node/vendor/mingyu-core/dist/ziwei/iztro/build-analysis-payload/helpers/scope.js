export const VALID_SCOPE_TYPES = [
    'origin',
    'decadal',
    'yearly',
    'monthly',
    'daily',
    'hourly',
    'age',
];
export function assertScopeType(value) {
    if (typeof value !== 'string' || !VALID_SCOPE_TYPES.includes(value)) {
        throw new Error('紫微分析范围必须是 origin、decadal、yearly、monthly、daily、hourly 或 age。');
    }
}
export function mapScopeLabel(scope) {
    assertScopeType(scope);
    switch (scope) {
        case 'origin':
            return '本命';
        case 'decadal':
            return '大限';
        case 'yearly':
            return '流年';
        case 'monthly':
            return '流月';
        case 'daily':
            return '流日';
        case 'hourly':
            return '流时';
        case 'age':
            return '小限';
    }
}
export function resolveScopeLabel(currentScope, currentScopeItem) {
    if (currentScope !== 'origin' && currentScopeItem?.name) {
        return currentScopeItem.name;
    }
    return mapScopeLabel(currentScope);
}
export function getCurrentScopeItem(horoscope, currentScope) {
    assertScopeType(currentScope);
    switch (currentScope) {
        case 'decadal':
            return horoscope.decadal;
        case 'yearly':
            return horoscope.yearly;
        case 'monthly':
            return horoscope.monthly;
        case 'daily':
            return horoscope.daily;
        case 'hourly':
            return horoscope.hourly;
        case 'age':
            return horoscope.age;
        case 'origin':
            return undefined;
    }
}
