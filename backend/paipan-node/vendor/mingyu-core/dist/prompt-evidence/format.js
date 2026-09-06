const LEVEL_ORDER = {
    主证: 0,
    辅证: 1,
    反证: 2,
    限制: 3,
    应期: 4,
};
function isEvidenceLevel(value) {
    return typeof value === 'string' && Object.hasOwn(LEVEL_ORDER, value);
}
function assertEvidenceLevel(value) {
    if (!isEvidenceLevel(value)) {
        throw new Error(`证据等级无效：${String(value)}`);
    }
}
function cleanOptionalText(value, label) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new Error(`${label}必须是文本。`);
    }
    return value.trim().replace(/\s+/g, ' ');
}
function cleanTags(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw new Error('证据标签必须是文本数组。');
    }
    return value
        .map((tag) => cleanOptionalText(tag, '证据标签'))
        .filter((tag) => Boolean(tag));
}
function normalizePromptEvidenceItem(item) {
    if (!item || typeof item !== 'object') {
        throw new Error('证据条目必须是对象。');
    }
    assertEvidenceLevel(item.level);
    return {
        ...item,
        level: item.level,
        title: cleanOptionalText(item.title, '证据标题') ?? '',
        detail: cleanOptionalText(item.detail, '证据详情'),
        source: cleanOptionalText(item.source, '证据来源'),
        tags: cleanTags(item.tags),
    };
}
function buildEvidenceKey(item) {
    return [item.level, item.title, item.detail, item.source]
        .map((value) => cleanOptionalText(value, '证据内容') ?? '')
        .join('|');
}
export function normalizePromptEvidenceItems(items) {
    if (!Array.isArray(items)) {
        throw new Error('证据条目必须是数组。');
    }
    const seen = new Set();
    return items
        .map(normalizePromptEvidenceItem)
        .filter((item) => item.title)
        .sort((left, right) => LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level])
        .filter((item) => {
        const key = buildEvidenceKey(item);
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
export function formatPromptEvidenceItem(item) {
    const segments = [
        `【${item.level}】${item.title}`,
        item.detail,
        item.source ? `来源：${item.source}` : '',
        item.tags?.length ? `标签：${item.tags.join('、')}` : '',
    ].filter(Boolean);
    return segments.join('｜');
}
export function formatPromptEvidenceBundle(bundle) {
    const lines = normalizePromptEvidenceItems(bundle.items).map(formatPromptEvidenceItem);
    if (lines.length > 0) {
        return lines;
    }
    const emptyText = cleanOptionalText(bundle.emptyText, '空证据占位文本');
    return emptyText ? [emptyText] : [];
}
