const SHI_ZHU_REGEX = /时柱为([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])/;
const SHI_ZHI_REGEX = /时支见([子丑寅卯辰巳午未申酉戌亥])/;
const RI_ZHI_REGEX = /日支见([子丑寅卯辰巳午未申酉戌亥])/;
const RI_ZHU_REGEX = /日柱为([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])/;
export const shiZhuMatcher = ({ condition, pillars }) => {
    const match = condition.match(SHI_ZHU_REGEX);
    if (!match)
        return null;
    return pillars.hour.gan === match[1] && pillars.hour.zhi === match[2];
};
export const shiZhiMatcher = ({ condition, pillars }) => {
    const match = condition.match(SHI_ZHI_REGEX);
    if (!match)
        return null;
    return pillars.hour.zhi === match[1];
};
export const riZhiMatcher = ({ condition, pillars }) => {
    const match = condition.match(RI_ZHI_REGEX);
    if (!match)
        return null;
    return pillars.day.zhi === match[1];
};
export const riZhuMatcher = ({ condition, pillars }) => {
    const match = condition.match(RI_ZHU_REGEX);
    if (!match)
        return null;
    return pillars.day.gan === match[1] && pillars.day.zhi === match[2];
};
