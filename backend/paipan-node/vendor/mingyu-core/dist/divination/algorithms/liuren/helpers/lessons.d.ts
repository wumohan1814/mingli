import type { LiurenLesson, LiurenPlateItem } from '../../../../types/divination';
export interface ResolveTransmissionContext {
    dayStem: string;
    dayBranch: string;
    dayStemResidence: string;
    hourStem?: string;
    hourBranch?: string;
    heavenlyPlate: LiurenPlateItem[];
}
export interface InitialTransmissionResult {
    initial: string;
    rule: string;
    tag: string;
    branches?: string[];
}
export declare function buildLessonNote(relation: string, xunKong: string[], upper: string, lower: string): string;
export declare function buildFourLessons(args: {
    heavenlyPlate: LiurenPlateItem[];
    dayStem: string;
    dayBranch: string;
    dayStemResidence: string;
    xunKong: string[];
}): {
    name: "四课" | "一课" | "二课" | "三课";
    upper: string;
    lower: string;
    god: string;
    relation: string;
    note: string;
}[];
export declare function resolveInitialTransmission(lessons: LiurenLesson[], context: ResolveTransmissionContext): InitialTransmissionResult;
