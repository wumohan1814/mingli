import { CHINA_BIRTH_PLACE_TREE_DATA } from './china-data.js';
function normalizeKey(value) {
    return value.trim().toLocaleLowerCase();
}
function normalizeSearchKey(value) {
    return normalizeKey(value).replace(/[\s·-]+/g, '');
}
function pathNode(path) {
    return path.district ?? path.city ?? path.province;
}
function pathLevel(path) {
    return path.district ? 'district' : path.city ? 'city' : 'province';
}
function pathDisplayName(path) {
    const node = pathNode(path);
    return 'displayName' in node && typeof node.displayName === 'string'
        ? node.displayName
        : path.province.label;
}
const PROVINCE_APPROXIMATE_LATITUDE_BY_ID_PREFIX = {
    '11': 39.9042,
    '12': 39.3434,
    '13': 38.0428,
    '14': 37.8706,
    '15': 40.8175,
    '21': 41.8057,
    '22': 43.8171,
    '23': 45.8038,
    '31': 31.2304,
    '32': 32.0603,
    '33': 30.2741,
    '34': 31.8206,
    '35': 26.0745,
    '36': 28.682,
    '37': 36.6512,
    '41': 34.7466,
    '42': 30.5928,
    '43': 28.2282,
    '44': 23.1291,
    '45': 22.817,
    '46': 20.044,
    '50': 29.563,
    '51': 30.5728,
    '52': 26.647,
    '53': 25.0389,
    '54': 29.652,
    '61': 34.3416,
    '62': 36.0611,
    '63': 36.6171,
    '64': 38.4872,
    '65': 43.8256,
    '71': 23.6978,
    '81': 22.3193,
    '82': 22.1987,
};
/**
 * 返回省级近似纬度，仅用于缺少行政中心纬度时的兼容回退。
 * 精确星盘计算仍应优先使用真实出生地坐标。
 */
export function resolveBirthPlaceApproximateLatitude(regionId, fallback = 35) {
    return PROVINCE_APPROXIMATE_LATITUDE_BY_ID_PREFIX[regionId.slice(0, 2)] ?? fallback;
}
function findBirthPlaceApproximateLatitude(regionId) {
    return PROVINCE_APPROXIMATE_LATITUDE_BY_ID_PREFIX[regionId.slice(0, 2)];
}
function resolvePath(path) {
    const node = pathNode(path);
    const hasAdministrativeLatitude = node.latitude !== undefined;
    const approximateLatitude = hasAdministrativeLatitude
        ? undefined
        : findBirthPlaceApproximateLatitude(node.id);
    const latitude = node.latitude ?? approximateLatitude;
    return {
        regionId: node.id,
        level: pathLevel(path),
        label: node.label,
        displayName: pathDisplayName(path),
        pinyin: node.pinyin,
        longitude: node.longitude,
        ...(latitude !== undefined ? { latitude } : {}),
        timezone: 8,
        ...(latitude !== undefined
            ? {
                coordinateAccuracy: hasAdministrativeLatitude
                    ? 'administrative-center'
                    : 'province-approximation',
            }
            : {}),
        path,
    };
}
function searchScore(entry, query) {
    const [id, label, displayName, pinyin] = entry.terms;
    if (id === query)
        return 0;
    if (displayName === query)
        return 1;
    if (label === query)
        return 2;
    if (pinyin === query)
        return 3;
    if (displayName.startsWith(query))
        return 4;
    if (label.startsWith(query))
        return 5;
    if (pinyin.startsWith(query))
        return 6;
    if (displayName.includes(query))
        return 7;
    if (label.includes(query))
        return 8;
    if (pinyin.includes(query))
        return 9;
    if (id.startsWith(query))
        return 10;
    return null;
}
/** 从任意省市区树创建地点索引。 */
export function createBirthPlaceIndex(tree) {
    const regionPathById = new Map();
    const pathByDisplayName = new Map();
    const searchEntries = [];
    const registerDisplayName = (value, path) => {
        const key = normalizeKey(value);
        const existing = pathByDisplayName.get(key);
        if (existing === undefined) {
            pathByDisplayName.set(key, path);
            return;
        }
        if (existing && pathNode(existing).id === pathNode(path).id)
            return;
        pathByDisplayName.set(key, null);
    };
    const register = (path) => {
        const node = pathNode(path);
        const displayName = pathDisplayName(path);
        const idKey = normalizeKey(node.id);
        regionPathById.set(idKey, path);
        registerDisplayName(displayName, path);
        registerDisplayName(node.label, path);
        searchEntries.push({
            path,
            level: pathLevel(path),
            id: node.id,
            label: node.label,
            displayName,
            pinyin: node.pinyin,
            terms: [node.id, node.label, displayName, node.pinyin ?? ''].map(normalizeSearchKey),
        });
    };
    for (const province of tree) {
        register({ province });
        for (const city of province.cities) {
            register({ province, city });
            for (const district of city.districts)
                register({ province, city, district });
        }
    }
    const findPath = (value) => regionPathById.get(normalizeKey(value)) ?? pathByDisplayName.get(normalizeKey(value)) ?? null;
    return {
        getProvinceOptions: () => tree,
        getCityOptions: (provinceId) => tree.find((province) => normalizeKey(province.id) === normalizeKey(provinceId))?.cities ?? [],
        getDistrictOptions: (cityId) => {
            for (const province of tree) {
                const city = province.cities.find((item) => normalizeKey(item.id) === normalizeKey(cityId));
                if (city)
                    return city.districts;
            }
            return [];
        },
        findByRegionId: (regionId) => regionPathById.get(normalizeKey(regionId)) ?? null,
        findByDisplayName: (displayName) => pathByDisplayName.get(normalizeKey(displayName)) ?? null,
        search: (query, options = {}) => {
            const normalizedQuery = normalizeSearchKey(query);
            if (!normalizedQuery)
                return [];
            const limit = Math.min(Math.max(Math.trunc(options.limit ?? 20), 1), 100);
            const levels = options.levels?.length ? new Set(options.levels) : null;
            return searchEntries
                .map((entry) => ({ entry, score: searchScore(entry, normalizedQuery) }))
                .filter((item) => item.score !== null && (!levels || levels.has(item.entry.level)))
                .sort((left, right) => left.score - right.score ||
                right.entry.id.length - left.entry.id.length ||
                left.entry.displayName.localeCompare(right.entry.displayName, 'zh-CN'))
                .slice(0, limit)
                .map(({ entry }) => resolvePath(entry.path));
        },
        resolve: (regionIdOrDisplayName) => {
            const path = findPath(regionIdOrDisplayName);
            return path ? resolvePath(path) : null;
        },
        resolveLongitude: (regionIdOrDisplayName) => {
            const path = findPath(regionIdOrDisplayName);
            return path ? pathNode(path).longitude : null;
        },
    };
}
/** 中国省、市、区出生地点树。 */
export const chinaBirthPlaceTree = CHINA_BIRTH_PLACE_TREE_DATA;
/** 预先构建的中国地点索引。 */
export const chinaBirthPlaceIndex = createBirthPlaceIndex(chinaBirthPlaceTree);
export function getBirthPlaceProvinceOptions() {
    return chinaBirthPlaceIndex.getProvinceOptions();
}
export function getBirthPlaceCityOptions(provinceId) {
    return chinaBirthPlaceIndex.getCityOptions(provinceId);
}
export function getBirthPlaceDistrictOptions(cityId) {
    return chinaBirthPlaceIndex.getDistrictOptions(cityId);
}
export function findBirthPlaceByRegionId(regionId) {
    return chinaBirthPlaceIndex.findByRegionId(regionId);
}
export function findBirthPlaceByDisplayName(displayName) {
    return chinaBirthPlaceIndex.findByDisplayName(displayName);
}
/** 按名称、完整路径、拼音或行政区代码搜索，重名地点会分别返回。 */
export function searchBirthPlaces(query, options) {
    return chinaBirthPlaceIndex.search(query, options);
}
/** 将行政区代码或完整地点名称解析成排盘可用坐标。 */
export function resolveBirthPlace(regionIdOrDisplayName) {
    return chinaBirthPlaceIndex.resolve(regionIdOrDisplayName);
}
export function resolveBirthPlaceLongitude(regionIdOrDisplayName) {
    return chinaBirthPlaceIndex.resolveLongitude(regionIdOrDisplayName);
}
/** 确认查询结果包含区县节点，便于表单从通用路径收窄类型。 */
export function isDistrictBirthPlacePath(path) {
    return Boolean(path?.city && path.district);
}
