import type { HistoricalTimezoneEvidence } from './historical-timezone';
export declare const ASTRONOMY_FACT_MODEL: {
    readonly provider: "caelus";
    readonly version: "0.24.1";
    readonly coordinate: "地心回归黄道日期坐标";
    readonly recommendedYearRange: readonly [1800, 2200];
    readonly validation: {
        readonly provider: "NASA/JPL Horizons";
        readonly ephemeris: "DE441";
        readonly referenceEpoch: "2000-01-01T12:00:00.000Z";
        readonly quantity: "Observer ecliptic longitude and latitude of date (QUANTITIES=31)";
        readonly sourceUrl: "https://ssd-api.jpl.nasa.gov/doc/horizons.html";
        readonly longitudeToleranceDegrees: 0.02;
        readonly latitudeToleranceDegrees: 0.002;
    };
    readonly limitation: "本结果是可复算的现代天文位置事实，不是观测站实测值，也不证明任何命理、占星、吉凶或现实事件。";
};
export interface AstronomicalFactInput {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second?: number;
    /** 固定 UTC 偏移；与 IANA 同时提供时只用于回拨消歧和一致性核验。 */
    timezone?: number;
    /** IANA 历史时区，例如 Asia/Shanghai。 */
    timeZoneId?: string;
    latitude?: number;
    longitude?: number;
}
export interface AstronomicalBodyFact {
    name: 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';
    longitudeDegrees: number;
    latitudeDegrees: number;
    distance: number;
    distanceUnit: 'AU';
    longitudeSpeedDegreesPerDay: number;
    isRetrograde: boolean;
}
export interface AstronomicalFacts {
    localDateTime: string;
    utcDateTime: string;
    timezone: number;
    timeZoneId?: string;
    timezoneEvidence?: HistoricalTimezoneEvidence;
    julianDateUtc: number;
    coordinate: typeof ASTRONOMY_FACT_MODEL.coordinate;
    bodies: AstronomicalBodyFact[];
    moonPhase: {
        elongationDegrees: number;
        illuminationFraction: number;
        waxing: boolean;
    };
    model: typeof ASTRONOMY_FACT_MODEL;
}
export declare function queryAstronomicalFacts(input: AstronomicalFactInput): AstronomicalFacts;
