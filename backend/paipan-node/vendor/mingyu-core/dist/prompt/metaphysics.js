import { formatPromptCurrentTime } from './current-time.js';
import { buildPromptDocument, buildPromptSection, joinPromptSections } from './sections.js';
import { buildPromptGuidance, buildPromptTask } from './guidance.js';
import { buildPromptSchoolSection } from './schools.js';
export const METAPHYSICS_PROMPT_METHODS = [
    'bazhai',
    'residential',
    'zodiac',
    'taiyi',
    'qizheng',
    'xuankong',
];
/**
 * 将已经由算法生成的元学排盘正文包装成可直接交给在线 AI 的完整任务书。
 * 排盘算法和应用层的输入表单保持分离，调用方只需传入算法返回的正文。
 */
export function buildMetaphysicsPromptDocument(basePrompt, question, options) {
    const normalizedBase = basePrompt.trim();
    const baseSection = normalizedBase.startsWith('【')
        ? normalizedBase
        : buildPromptSection('排盘资料', normalizedBase);
    const sections = [
        buildPromptGuidance(options.method),
        buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
        baseSection,
        options.measurement ? buildPromptSection('测量换算', options.measurement) : '',
        buildPromptSchoolSection(options.method, options.schools),
        buildPromptSection('任务', buildPromptTask(question?.trim() ? '请结合以上资料回答【问题】。' : '请结合以上资料完成解读。', options.method)),
        question?.trim() ? buildPromptSection('问题', question) : '',
    ];
    return buildPromptDocument(joinPromptSections(sections));
}
export function buildMetaphysicsPrompt(basePrompt, question, options) {
    return buildMetaphysicsPromptDocument(basePrompt, question, options).text;
}
