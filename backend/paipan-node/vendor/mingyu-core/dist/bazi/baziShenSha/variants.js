export const DEFAULT_SHENSHA_VARIANT_CONFIG = {
    referenceProfile: 'wenzhen',
    kongWangBasis: 'day-and-year',
    yangRenMode: 'include-yin-ren',
    tongZiScope: 'day-hour',
};
const CLASSICAL_SHENSHA_VARIANT_CONFIG = {
    referenceProfile: 'classical',
    kongWangBasis: 'day',
    yangRenMode: 'yang-stems-only',
    tongZiScope: 'day-hour',
};
export function resolveShenShaVariantConfig(variants) {
    const defaults = variants?.referenceProfile === 'classical'
        ? CLASSICAL_SHENSHA_VARIANT_CONFIG
        : DEFAULT_SHENSHA_VARIANT_CONFIG;
    return {
        ...defaults,
        ...variants,
    };
}
