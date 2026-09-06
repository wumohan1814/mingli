export function buildPromptSection(title, content) {
    const normalized = content.trim();
    return normalized ? `【${title}】\n${normalized}` : '';
}
export function joinPromptSections(sections) {
    return sections
        .map((section) => section?.trim())
        .filter((section) => Boolean(section))
        .join('\n\n');
}
export function buildPromptDocument(user, system = '') {
    const normalizedUser = user.trim();
    const normalizedSystem = system.trim();
    return {
        system: normalizedSystem,
        user: normalizedUser,
        text: [normalizedSystem, normalizedUser].filter(Boolean).join('\n\n'),
    };
}
export function formatStringList(values, fallback = '未记录') {
    return values?.length ? values.join('、') : fallback;
}
export function formatEvidencePromptText(data) {
    if (!data || typeof data !== 'object')
        return '';
    const evidence = data.evidenceAnalysis;
    return typeof evidence?.promptText === 'string' ? evidence.promptText.trim() : '';
}
