import type { RandomTrace } from './random';
export { MINGYU_CORE_VERSION, MINGYU_SCHEMA_VERSION } from './version';
export type CoreDiagnosticLevel = 'info' | 'warning' | 'error';
export type CoreErrorCategory = 'validation' | 'boundary' | 'unsupported' | 'dependency' | 'calculation' | 'serialization';
export interface CoreDiagnostic<TCode extends string = string> {
    code: TCode;
    level: CoreDiagnosticLevel;
    message: string;
    field?: string;
    recoverable?: boolean;
    details?: Record<string, string | number | boolean | null>;
}
export interface CoreResultMeta {
    engineVersion: string;
    schemaVersion: string;
    algorithm: string;
    model?: string;
    calculatedAt: string;
    inputHash: string;
    resultId: string;
    random?: RandomTrace;
    diagnostics?: CoreDiagnostic[];
}
export interface CoreResultMetaInput {
    algorithm: string;
    input: unknown;
    model?: string;
    calculatedAt?: Date | string | number;
    random?: RandomTrace;
    diagnostics?: CoreDiagnostic[];
}
export interface MingyuCoreErrorJSON<TCode extends string = string> {
    name: string;
    code: TCode;
    category: CoreErrorCategory;
    message: string;
    field?: string;
    recoverable: boolean;
    diagnostics: CoreDiagnostic<TCode>[];
    context?: Record<string, unknown>;
}
export type CoreExecutionResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: MingyuCoreErrorJSON;
};
export interface NormalizeCoreErrorOptions {
    code?: string;
    category?: CoreErrorCategory;
    message?: string;
    field?: string;
    recoverable?: boolean;
    context?: Record<string, unknown>;
}
export declare class MingyuCoreError<TCode extends string = string> extends Error {
    readonly code: TCode;
    readonly category: CoreErrorCategory;
    readonly recoverable: boolean;
    readonly field?: string;
    readonly diagnostics: CoreDiagnostic<TCode>[];
    readonly context?: Record<string, unknown>;
    constructor(options: {
        code: TCode;
        category: CoreErrorCategory;
        message: string;
        field?: string;
        recoverable?: boolean;
        diagnostics?: CoreDiagnostic<TCode>[];
        context?: Record<string, unknown>;
        cause?: unknown;
    });
    toJSON(): MingyuCoreErrorJSON<TCode>;
}
/** 把任意运行时异常转换为可识别、可序列化的核心错误。 */
export declare function normalizeCoreError(error: unknown, options?: NormalizeCoreErrorOptions): MingyuCoreError;
/** 安全执行同步能力，失败时返回可直接 JSON 序列化的错误对象。 */
export declare function executeSafelySync<T>(operation: () => T): CoreExecutionResult<T>;
/** 安全执行同步或异步能力，统一返回可判别联合类型。 */
export declare function executeSafely<T>(operation: () => T | Promise<T>): Promise<CoreExecutionResult<T>>;
/** 将输入转换为键顺序稳定、浏览器与服务端一致的 JSON 文本。 */
export declare function stableStringify(value: unknown): string;
/** FNV-1a 64 位散列，适合作为缓存键和结果身份，不用于安全签名。 */
export declare function hashStableValue(value: unknown): string;
/** 生成可缓存、可比较、可安全存储的统一结果身份。 */
export declare function createResultMeta(options: CoreResultMetaInput): CoreResultMeta;
export declare function attachResultMeta<T extends object>(result: T, options: CoreResultMetaInput): T & {
    meta: CoreResultMeta;
};
/** 输出稳定 JSON，可直接用于缓存、历史记录、分享或跨端快照比较。 */
export declare function serializeCoreResult(value: unknown): string;
/** 统一结果协议的简短公共名称。 */
export declare const serializeResult: typeof serializeCoreResult;
