import { type BirthChartBundle, type BirthChartBundleOptions } from '../birth';
import { type CompatibilityBundle, type CompatibilityBundleOptions } from '../compatibility';
import { type BaziZiweiCombinedReading, type BaziZiweiCombinedReadingOptions } from '../synthesis';
import { type DivinationRequest, type DivinationSession } from '../divination/session';
import { type MingyuCapabilities, type SystemCapability, type SystemCapabilityId } from '../capabilities';
import { type BirthProfile, type NormalizedBirthProfile } from '../profile';
import { type AstronomicalTimeEvidence, type AstronomicalTimeInput, type MoonPhaseEvidence, type SolarIlluminationEvidence, type SolarIlluminationInput, type SolarTermEvidence, type TrueSolarBirthTimeInput, type TrueSolarBirthTimeResult } from '../calendar';
import { type BaZhaiDoorDegreeInput, type BaZhaiDoorDegreeResult, type BaZhaiInput, type BaZhaiResult } from '../ba_zhai';
import { type ZodiacYearFortune, type ZodiacYearFortuneInput } from '../zodiac';
import { type TaiyiInput, type TaiyiResult } from '../taiyi';
import { type QizhengInput, type QizhengResult } from '../qi_zheng';
import { type XuanKongInput, type XuanKongResult } from '../xuan_kong';
import { type ResidentialFengshuiInput, type ResidentialFengshuiResult } from '../residential_fengshui';
import { type CoreExecutionResult } from '../shared/result';
import { type InstantChartRequest, type InstantChartResponse, type InstantChartType } from '../instant';
export interface MingyuClientDefaults {
    birth?: BirthChartBundleOptions;
    compatibility?: CompatibilityBundleOptions;
    synthesis?: BaziZiweiCombinedReadingOptions;
}
export interface MingyuClientOptions {
    /** 为每次调用提供可被调用参数覆盖的默认设置。 */
    defaults?: MingyuClientDefaults;
}
export interface MingyuSafeClient {
    instant<T extends InstantChartType>(request: InstantChartRequest<T>): Promise<CoreExecutionResult<InstantChartResponse<T>>>;
    birth(profile: BirthProfile, options?: BirthChartBundleOptions): Promise<CoreExecutionResult<BirthChartBundle>>;
    compatibility(primary: BirthProfile, partner: BirthProfile, options?: CompatibilityBundleOptions): Promise<CoreExecutionResult<CompatibilityBundle>>;
    baziZiwei(profile: BirthProfile, options?: BaziZiweiCombinedReadingOptions): Promise<CoreExecutionResult<BaziZiweiCombinedReading>>;
    divination(request: DivinationRequest): CoreExecutionResult<DivinationSession>;
    normalizeBirth(profile: BirthProfile): CoreExecutionResult<NormalizedBirthProfile>;
    trueSolarBirth(input: TrueSolarBirthTimeInput): CoreExecutionResult<TrueSolarBirthTimeResult>;
    astronomicalTime(input: AstronomicalTimeInput): CoreExecutionResult<AstronomicalTimeEvidence>;
    moonPhase(utcDateTime: Date | string | number): CoreExecutionResult<MoonPhaseEvidence>;
    solarTerm(year: number, index: number): CoreExecutionResult<SolarTermEvidence>;
    solarTerms(year: number): CoreExecutionResult<SolarTermEvidence[]>;
    solarIllumination(input: SolarIlluminationInput): CoreExecutionResult<SolarIlluminationEvidence>;
    bazhai(input: BaZhaiInput): CoreExecutionResult<BaZhaiResult>;
    bazhaiByDoorDegree(input: BaZhaiDoorDegreeInput): CoreExecutionResult<BaZhaiDoorDegreeResult>;
    zodiac(input: ZodiacYearFortuneInput): CoreExecutionResult<ZodiacYearFortune>;
    taiyi(input: TaiyiInput): CoreExecutionResult<TaiyiResult>;
    qizheng(input: QizhengInput): CoreExecutionResult<QizhengResult>;
    xuankong(input: XuanKongInput): CoreExecutionResult<XuanKongResult>;
    residentialFengshui(input: ResidentialFengshuiInput): CoreExecutionResult<ResidentialFengshuiResult>;
    capabilities(): CoreExecutionResult<MingyuCapabilities>;
    capability(id: SystemCapabilityId): CoreExecutionResult<SystemCapability>;
    serialize(value: unknown): CoreExecutionResult<string>;
}
export interface MingyuClient {
    /** 按调用当刻生成不绑定个人性别的即时盘。 */
    instant<T extends InstantChartType>(request: InstantChartRequest<T>): Promise<InstantChartResponse<T>>;
    birth(profile: BirthProfile, options?: BirthChartBundleOptions): Promise<BirthChartBundle>;
    compatibility(primary: BirthProfile, partner: BirthProfile, options?: CompatibilityBundleOptions): Promise<CompatibilityBundle>;
    /** 从一份出生档案生成八字、紫微与逐主题合参资料。 */
    baziZiwei(profile: BirthProfile, options?: BaziZiweiCombinedReadingOptions): Promise<BaziZiweiCombinedReading>;
    divination(request: DivinationRequest): DivinationSession;
    /** 校验并统一公历/农历、传统时辰、精准时分与真太阳时口径。 */
    normalizeBirth(profile: BirthProfile): NormalizedBirthProfile;
    trueSolarBirth(input: TrueSolarBirthTimeInput): TrueSolarBirthTimeResult;
    astronomicalTime(input: AstronomicalTimeInput): AstronomicalTimeEvidence;
    moonPhase(utcDateTime: Date | string | number): MoonPhaseEvidence;
    solarTerm(year: number, index: number): SolarTermEvidence;
    /** 按公历年份返回该年 24 个节气交接证据。 */
    solarTerms(year: number): SolarTermEvidence[];
    solarIllumination(input: SolarIlluminationInput): SolarIlluminationEvidence;
    bazhai(input: BaZhaiInput): BaZhaiResult;
    bazhaiByDoorDegree(input: BaZhaiDoorDegreeInput): BaZhaiDoorDegreeResult;
    zodiac(input: ZodiacYearFortuneInput): ZodiacYearFortune;
    taiyi(input: TaiyiInput): TaiyiResult;
    qizheng(input: QizhengInput): QizhengResult;
    xuankong(input: XuanKongInput): XuanKongResult;
    residentialFengshui(input: ResidentialFengshuiInput): ResidentialFengshuiResult;
    capabilities(): MingyuCapabilities;
    /** 查询单项能力；未知 ID 会抛出结构化校验错误。 */
    capability(id: SystemCapabilityId): SystemCapability;
    serialize(value: unknown): string;
    /** 与普通方法参数一致，但失败时返回结构化错误而不是抛出异常。 */
    readonly safe: MingyuSafeClient;
}
/**
 * 创建统一高层客户端。
 *
 * 普通方法适合希望使用异常流程的 TypeScript/JavaScript 项目；safe 方法适合
 * API、表单、工作流和跨进程调用，返回值可以直接序列化。
 */
export declare function createMingyuClient(options?: MingyuClientOptions): MingyuClient;
