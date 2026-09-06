import { normalizeStarName } from './palace-lookup.js';
export const MUTAGEN_ORDER = ['禄', '权', '科', '忌'];
export function mapScopeMutagenMap(stars, astrolabe, dynamicPalaceNames = []) {
    return stars.slice(0, 4).map((star, index) => {
        let palace;
        try {
            palace = astrolabe.star(star).palace();
        }
        catch {
            throw new Error(`iztro 未能定位${star}的本命落宫。`);
        }
        return {
            mutagen: MUTAGEN_ORDER[index],
            star,
            palace_index: palace?.index,
            palace_name: palace?.name,
            dynamic_palace_name: palace?.index === undefined ? undefined : dynamicPalaceNames[palace.index],
        };
    });
}
export function mapStarFact(star, activeScopeMutagenMap, options = {}) {
    const normalizedStarName = normalizeStarName(star.name);
    const activeScopeMutagen = activeScopeMutagenMap.find((item) => normalizeStarName(item.star) === normalizedStarName)?.mutagen;
    const rawMutagen = star.mutagen || undefined;
    const isHoroscopeStar = options.isHoroscopeStar ?? star.scope !== 'origin';
    return {
        name: star.name,
        kind: star.type,
        scope: star.scope,
        brightness: star.brightness || undefined,
        birth_mutagen: isHoroscopeStar ? undefined : rawMutagen,
        horoscope_mutagen: isHoroscopeStar ? rawMutagen : undefined,
        active_scope_mutagen: activeScopeMutagen,
    };
}
