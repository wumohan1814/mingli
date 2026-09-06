import { NAYIN_MAP } from './baziMappingsData.js';
import { assertGanZhiPair } from './baziUtils.js';
export function analyzeNayinProfile(pillars) {
    const pillarNames = ['year', 'month', 'day', 'hour'];
    if (pillars.length !== pillarNames.length) {
        throw new Error(`四柱数量无效：${pillars.length}`);
    }
    const items = pillars.map((p, idx) => {
        assertGanZhiPair(p.gan, p.zhi, `${pillarNames[idx]}柱`);
        const gz = p.gan + p.zhi;
        const na = NAYIN_MAP[gz];
        if (!na) {
            throw new Error(`${pillarNames[idx]}柱纳音数据缺失：${gz}`);
        }
        const lastChar = na.slice(-1);
        const elements = { 金: '金', 木: '木', 水: '水', 火: '火', 土: '土' };
        const element = elements[lastChar];
        if (!element) {
            throw new Error(`${pillarNames[idx]}柱纳音五行缺失：${na}`);
        }
        return { pillar: pillarNames[idx], ganZhi: gz, nayin: na, element };
    });
    return { items, summary: items.map((i) => i.nayin).join(' / ') };
}
