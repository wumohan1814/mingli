export function formatScalarValue(value) {
    if (value === undefined || value === null || value === '')
        return '';
    if (Array.isArray(value)) {
        if (value.length === 0)
            return '';
        if (value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
            return value.join('、');
        }
    }
    if (typeof value === 'boolean')
        return value ? '是' : '否';
    return String(value);
}
export function formatKeyValueBlock(record) {
    return Object.entries(record)
        .map(([key, value]) => {
        const body = formatScalarValue(value);
        return body ? `${key}：${body}` : '';
    })
        .filter(Boolean)
        .join('\n');
}
export function formatObjectList(items) {
    if (items.length === 0)
        return '';
    return items.map((item) => formatKeyValueBlock(item)).join('\n\n');
}
