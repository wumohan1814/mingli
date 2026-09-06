export function isFortuneModalParentOptionActive(row, draftScope) {
    if (row === 'year') {
        return draftScope === 'dayun';
    }
    if (row === 'month') {
        return draftScope === 'year';
    }
    return draftScope === 'month';
}
export function isFortuneModalDetailOptionActive(row, draftScope) {
    if (row === 'dayun') {
        return draftScope !== 'natal' && draftScope !== 'full';
    }
    if (row === 'year') {
        return draftScope === 'year' || draftScope === 'month' || draftScope === 'day';
    }
    if (row === 'month') {
        return draftScope === 'month' || draftScope === 'day';
    }
    return draftScope === 'day';
}
