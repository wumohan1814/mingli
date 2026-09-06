import { calculateBirthChartBundle, } from '../birth/index.js';
import { calculateCompatibilityBundle, } from '../compatibility/index.js';
import { calculateBaziZiweiCombinedReading, } from '../synthesis/index.js';
import { generateDivinationSession, } from '../divination/session.js';
import { getCapabilities, requireSystemCapability, } from '../capabilities/index.js';
import { normalizeBirthProfile } from '../profile/index.js';
import { buildAstronomicalTimeEvidence, calculateMoonPhaseEvidence, calculateSolarIlluminationEvidence, calculateSolarTermEvidence, calculateSolarTermsForYear, resolveTrueSolarBirthTime, } from '../calendar/index.js';
import { analyzeBaZhai, analyzeBaZhaiByDoorDegree, } from '../ba_zhai/index.js';
import { calculateZodiacYearFortune, } from '../zodiac/index.js';
import { generateTaiyi } from '../taiyi/index.js';
import { generateQizheng } from '../qi_zheng/index.js';
import { generateXuanKong } from '../xuan_kong/index.js';
import { generateResidentialFengshui, } from '../residential_fengshui/index.js';
import { executeSafely, executeSafelySync, serializeCoreResult, } from '../shared/result.js';
import { calculateInstantChart, } from '../instant/index.js';
function normalizeUtcTimestamp(value) {
    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    if (!Number.isFinite(timestamp))
        throw new TypeError('UTC 时刻必须是有效日期或时间戳。');
    return timestamp;
}
function mergeBirthOptions(defaults, options) {
    return {
        ...defaults,
        ...options,
        ziwei: { ...defaults?.ziwei, ...options?.ziwei },
    };
}
function mergeCompatibilityOptions(defaults, options) {
    return {
        ...defaults,
        ...options,
        bazi: { ...defaults?.bazi, ...options?.bazi },
        ziwei: { ...defaults?.ziwei, ...options?.ziwei },
        astrolabe: { ...defaults?.astrolabe, ...options?.astrolabe },
        chart: {
            ...defaults?.chart,
            ...options?.chart,
            ziwei: { ...defaults?.chart?.ziwei, ...options?.chart?.ziwei },
        },
    };
}
function mergeSynthesisOptions(defaults, options) {
    return {
        ...defaults,
        ...options,
        ziwei: { ...defaults?.ziwei, ...options?.ziwei },
        prompt: { ...defaults?.prompt, ...options?.prompt },
    };
}
/**
 * 创建统一高层客户端。
 *
 * 普通方法适合希望使用异常流程的 TypeScript/JavaScript 项目；safe 方法适合
 * API、表单、工作流和跨进程调用，返回值可以直接序列化。
 */
export function createMingyuClient(options = {}) {
    const instant = (request) => calculateInstantChart(request);
    const birth = (profile, callOptions) => calculateBirthChartBundle(profile, mergeBirthOptions(options.defaults?.birth, callOptions));
    const compatibility = (primary, partner, callOptions) => calculateCompatibilityBundle(primary, partner, mergeCompatibilityOptions(options.defaults?.compatibility, callOptions));
    const baziZiwei = (profile, callOptions) => calculateBaziZiweiCombinedReading(profile, mergeSynthesisOptions(options.defaults?.synthesis, callOptions));
    const divination = (request) => generateDivinationSession(request);
    const normalizeBirth = (profile) => normalizeBirthProfile(profile);
    const trueSolarBirth = (input) => resolveTrueSolarBirthTime(input);
    const astronomicalTime = (input) => buildAstronomicalTimeEvidence(input);
    const moonPhase = (utcDateTime) => calculateMoonPhaseEvidence(normalizeUtcTimestamp(utcDateTime));
    const solarTerm = (year, index) => calculateSolarTermEvidence(year, index);
    const solarTerms = (year) => calculateSolarTermsForYear(year);
    const solarIllumination = (input) => calculateSolarIlluminationEvidence(input);
    const bazhai = (input) => analyzeBaZhai(input);
    const bazhaiByDoorDegree = (input) => analyzeBaZhaiByDoorDegree(input);
    const zodiac = (input) => calculateZodiacYearFortune(input);
    const taiyi = (input) => generateTaiyi(input);
    const qizheng = (input) => generateQizheng(input);
    const xuankong = (input) => generateXuanKong(input);
    const residentialFengshui = (input) => generateResidentialFengshui(input);
    const capabilities = () => getCapabilities();
    const capability = (id) => requireSystemCapability(id);
    const serialize = (value) => serializeCoreResult(value);
    return {
        instant,
        birth,
        compatibility,
        baziZiwei,
        divination,
        normalizeBirth,
        trueSolarBirth,
        astronomicalTime,
        moonPhase,
        solarTerm,
        solarTerms,
        solarIllumination,
        bazhai,
        bazhaiByDoorDegree,
        zodiac,
        taiyi,
        qizheng,
        xuankong,
        residentialFengshui,
        capabilities,
        capability,
        serialize,
        safe: {
            instant: (request) => executeSafely(() => instant(request)),
            birth: (profile, callOptions) => executeSafely(() => birth(profile, callOptions)),
            compatibility: (primary, partner, callOptions) => executeSafely(() => compatibility(primary, partner, callOptions)),
            baziZiwei: (profile, callOptions) => executeSafely(() => baziZiwei(profile, callOptions)),
            divination: (request) => executeSafelySync(() => divination(request)),
            normalizeBirth: (profile) => executeSafelySync(() => normalizeBirth(profile)),
            trueSolarBirth: (input) => executeSafelySync(() => trueSolarBirth(input)),
            astronomicalTime: (input) => executeSafelySync(() => astronomicalTime(input)),
            moonPhase: (utcDateTime) => executeSafelySync(() => moonPhase(utcDateTime)),
            solarTerm: (year, index) => executeSafelySync(() => solarTerm(year, index)),
            solarTerms: (year) => executeSafelySync(() => solarTerms(year)),
            solarIllumination: (input) => executeSafelySync(() => solarIllumination(input)),
            bazhai: (input) => executeSafelySync(() => bazhai(input)),
            bazhaiByDoorDegree: (input) => executeSafelySync(() => bazhaiByDoorDegree(input)),
            zodiac: (input) => executeSafelySync(() => zodiac(input)),
            taiyi: (input) => executeSafelySync(() => taiyi(input)),
            qizheng: (input) => executeSafelySync(() => qizheng(input)),
            xuankong: (input) => executeSafelySync(() => xuankong(input)),
            residentialFengshui: (input) => executeSafelySync(() => residentialFengshui(input)),
            capabilities: () => executeSafelySync(capabilities),
            capability: (id) => executeSafelySync(() => capability(id)),
            serialize: (value) => executeSafelySync(() => serialize(value)),
        },
    };
}
