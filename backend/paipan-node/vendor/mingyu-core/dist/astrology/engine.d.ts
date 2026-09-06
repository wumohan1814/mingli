/**
 * 西方占星底层适配层。
 *
 * 业务模块只依赖这里的稳定接口，不直接绑定第三方星历库。当前天文位置、宫位与
 * 基础相位由 Caelus 提供；四小行星使用随 mingyu-core 固定版本发布的 Caelus/JPL
 * Chebyshev 数据包，避免浏览器与 Node 运行时采用不同数据源。
 */
import { Engine, type BodyId } from 'caelus';
export declare const ASTROLOGY_ENGINE_MODEL: {
    readonly provider: "caelus";
    readonly version: "0.24.1";
    readonly coordinate: "地心回归黄道日期坐标";
    readonly asteroidDataRevision: "caelus dd3461d209b674b1f9b5b3e7a43be86aa6cfaed5";
};
export declare const astrologyEngine: Engine;
export declare enum AspectType {
    Conjunction = "conjunction",
    Sextile = "sextile",
    Square = "square",
    Trine = "trine",
    Opposition = "opposition",
    SemiSextile = "semi-sextile",
    SemiSquare = "semi-square",
    Quintile = "quintile",
    Sesquiquadrate = "sesquiquadrate",
    Biquintile = "biquintile",
    Quincunx = "quincunx",
    Septile = "septile",
    Novile = "novile",
    Decile = "decile"
}
export declare enum CelestialBody {
    Sun = "Sun",
    Moon = "Moon",
    Mercury = "Mercury",
    Venus = "Venus",
    Mars = "Mars",
    Jupiter = "Jupiter",
    Saturn = "Saturn",
    Uranus = "Uranus",
    Neptune = "Neptune",
    Pluto = "Pluto",
    NorthNode = "North Node"
}
export declare const DEFAULT_ORBS: Record<AspectType, number>;
export interface BirthData {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second?: number;
    timezone: number;
    latitude?: number;
    longitude?: number;
}
export interface ChartPlanet {
    name: string;
    longitude: number;
    latitude: number;
    distance: number;
    longitudeSpeed: number;
    isRetrograde: boolean;
    sign: number;
    signName: string;
    degree: number;
    minute: number;
    second: number;
    formatted: string;
    house: number;
}
export interface AspectBody {
    name: string;
    longitude: number;
    longitudeSpeed?: number;
}
export interface Aspect {
    body1: string;
    body2: string;
    type: AspectType;
    symbol: string;
    angle: number;
    separation: number;
    deviation: number;
    orb: number;
    strength: number;
    isApplying: boolean | null;
    isOutOfSign: boolean;
}
export interface NatalPoint {
    name: string;
    longitude: number;
    type: 'luminary' | 'planet' | 'angle';
    house?: number;
}
export interface Transit {
    transitingBodyEnum: CelestialBody;
    transitingBody: string;
    natalPoint: string;
    aspectType: AspectType;
    symbol: string;
    deviation: number;
    strength: number;
    phase: 'applying' | 'exact' | 'separating';
    isRetrograde: boolean;
}
export interface AspectPattern {
    type: string;
    bodies: string[];
    name: string;
}
export declare function toJulianDate(input: BirthData): number;
export declare const time: {
    readonly toJulianDate: typeof toJulianDate;
};
export declare function calculateAspects(bodies: AspectBody[], options?: {
    orbs?: Partial<Record<AspectType, number>>;
    minimumStrength?: number;
}): {
    aspects: Aspect[];
};
export declare function calculateChart(input: BirthData, options?: {
    houseSystem?: 'placidus';
    includeAsteroids?: boolean;
    includeChiron?: boolean;
    includeLilith?: boolean | 'true';
    includeNodes?: boolean | 'true';
    includeLots?: boolean;
    aspectTypes?: AspectType[];
    minimumAspectStrength?: number;
}): {
    planets: ChartPlanet[];
    nodes: ChartPlanet[];
    lilith: ChartPlanet[];
    lots: ChartPlanet[];
    angles: {
        ascendant: {
            longitude: number;
            sign: number;
            signName: "Aries" | "Taurus" | "Gemini" | "Cancer" | "Leo" | "Virgo" | "Libra" | "Scorpio" | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";
            degree: number;
            minute: number;
            second: number;
            formatted: string;
            name: string;
        };
        midheaven: {
            longitude: number;
            sign: number;
            signName: "Aries" | "Taurus" | "Gemini" | "Cancer" | "Leo" | "Virgo" | "Libra" | "Scorpio" | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";
            degree: number;
            minute: number;
            second: number;
            formatted: string;
            name: string;
        };
        descendant: {
            longitude: number;
            sign: number;
            signName: "Aries" | "Taurus" | "Gemini" | "Cancer" | "Leo" | "Virgo" | "Libra" | "Scorpio" | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";
            degree: number;
            minute: number;
            second: number;
            formatted: string;
            name: string;
        };
        imumCoeli: {
            longitude: number;
            sign: number;
            signName: "Aries" | "Taurus" | "Gemini" | "Cancer" | "Leo" | "Virgo" | "Libra" | "Scorpio" | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";
            degree: number;
            minute: number;
            second: number;
            formatted: string;
            name: string;
        };
    };
    houses: {
        cusps: {
            longitude: number;
            sign: number;
            signName: "Aries" | "Taurus" | "Gemini" | "Cancer" | "Leo" | "Virgo" | "Libra" | "Scorpio" | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";
            degree: number;
            minute: number;
            second: number;
            formatted: string;
            house: number;
        }[];
    };
    aspects: {
        all: Aspect[];
    };
    summary: {
        retrograde: string[];
        patterns: string[];
        elements: {
            fire: string[];
            earth: string[];
            air: string[];
            water: string[];
        };
        modalities: {
            cardinal: string[];
            fixed: string[];
            mutable: string[];
        };
    };
    options: {
        aspectTypes: AspectType[];
        aspectOrbs: Record<AspectType, number>;
        minimumAspectStrength: number;
        includePatterns: boolean;
    };
    calculated: {
        julianDate: number;
        utcDateTime: {
            year: number;
            month: number;
            day: number;
            hour: number;
            minute: number;
            second: number;
        };
    };
};
export declare function calculatePlanets(input: BirthData, options?: {
    houseSystem?: 'placidus';
    includeAsteroids?: boolean;
    includeChiron?: boolean;
    includeLilith?: boolean;
    includeLots?: boolean;
    includeNodes?: boolean;
}): ChartPlanet[];
export declare function getSunPosition(jd: number): {
    longitude: number;
    latitude: number;
    distance: number;
};
export declare function getMoonPosition(jd: number): {
    longitude: number;
    latitude: number;
    distance: number;
};
export declare function calculateTransits(natalPoints: NatalPoint[], jd: number, options: {
    aspectTypes: AspectType[];
    transitingBodies: CelestialBody[];
    minimumStrength?: number;
    includeOutOfSign?: boolean;
}): {
    transits: Transit[];
};
export declare function bodyName(body: BodyId): string;
export declare const JULIAN_DATE_UNIX_EPOCH = 2440587.5;
export declare function julianDateToUnix(jd: number): number;
export declare function unixToJulianDate(timestamp: number): number;
export declare function getApparentPosition(bodyId: string, jd: number): {
    longitude: number;
    latitude: number;
    speed: number;
    retrograde: boolean;
};
export type SolarEclipseEvent = {
    julianDate: number;
    type: 'total' | 'annular' | 'hybrid' | 'partial';
};
export type LunarEclipseEvent = {
    julianDate: number;
    type: 'total' | 'partial' | 'penumbral';
};
export declare function findSolarEclipses(jdStart: number, jdEnd: number): SolarEclipseEvent[];
export declare function findLunarEclipses(jdStart: number, jdEnd: number): LunarEclipseEvent[];
