import { SSGW_SIGNS } from '../ssgw-data/index.js';
import { getDivinationTime } from '../../calendar/timeManager.js';
import { createRandomContext, randomInt } from '../../shared/random.js';
import { attachResultMeta } from '../../shared/result.js';
/**
 * @file 灵签抽签算法（神算鬼谋）
 * @description 从签文中随机抽取一条作为占卜结果，配合签诗、典故进行解读。
 * @传统依据 当前三山国王签谱资料；不同庙本的签序、题名和字句可能存在差异。
 * @注意 此文件实现的是**随机抽签求签**功能，并非大六壬「金口诀」算法。
 *        金口诀（大六壬金口诀）的完整排盘与断课由其他模块实现。
 *        本文件名沿用历史命名，功能定位为灵签/神签抽签系统。
 */
const ssgwSigns = SSGW_SIGNS.map((sign) => ({
    number: sign.id,
    title: sign.title,
    poem: sign.qianwen,
    story: sign.story,
    details: sign.details,
}));
export function drawRandomSign(customDateOrOptions, options) {
    const customDate = customDateOrOptions instanceof Date ? customDateOrOptions : undefined;
    const randomOptions = customDateOrOptions instanceof Date ? options : (customDateOrOptions ?? options);
    const { ganzhi, timestamp } = getDivinationTime(customDate);
    const context = createRandomContext(randomOptions);
    const randomIndex = randomInt(ssgwSigns.length, context.random);
    const sign = ssgwSigns[randomIndex];
    return attachResultMeta({
        ...sign,
        timestamp,
        ganzhi,
        draw: {
            method: 'random',
            poolSize: ssgwSigns.length,
            selectedIndex: randomIndex,
            selectedNumber: sign.number,
        },
    }, {
        algorithm: 'ssgw.draw',
        input: { timestamp },
        calculatedAt: timestamp,
        random: context.getTrace(),
    });
}
/** 按用户已取得的签号查出签文，不模拟抽签或掷筊。 */
export function resolveSignByNumber(number, customDate) {
    if (!Number.isInteger(number) || number < 1 || number > ssgwSigns.length) {
        throw new Error(`签号需为1至${ssgwSigns.length}的整数`);
    }
    const sign = ssgwSigns.find((item) => item.number === number);
    if (!sign) {
        throw new Error(`未找到第${number}签`);
    }
    const { ganzhi, timestamp } = getDivinationTime(customDate);
    return attachResultMeta({
        ...sign,
        timestamp,
        ganzhi,
        draw: {
            method: 'manual',
            poolSize: ssgwSigns.length,
            selectedIndex: null,
            selectedNumber: sign.number,
        },
    }, {
        algorithm: 'ssgw.resolve.manual',
        input: { number, timestamp },
        calculatedAt: timestamp,
    });
}
