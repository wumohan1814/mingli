import type { DivinationMethodId } from '../divination/config';
import type { LenormandSpreadType, LiuyaoTemplateType, LiurenTemplateType, TarotSpreadType } from '../types/divination';
export interface DivinationInspirationSelection {
    method: DivinationMethodId;
    liuyaoTemplate: LiuyaoTemplateType;
    liurenTemplate: LiurenTemplateType;
    tarotSpread: TarotSpreadType;
    lenormandSpread: LenormandSpreadType;
}
export interface DivinationInspirationDraft extends DivinationInspirationSelection {
    question: string;
    questionSource?: 'custom' | 'inspiration';
}
export type DivinationInspirationTabId = 'spread' | 'special' | 'ganqing' | 'shiye' | 'caifu' | 'renji' | 'rensheng';
export type DivinationInspirationTab = {
    id: Exclude<DivinationInspirationTabId, 'spread' | 'special'>;
    label: string;
};
export type DivinationInspirationSection = {
    heading: string;
    questions: string[];
};
export declare const DIVINATION_INSPIRATION_TABS: DivinationInspirationTab[];
export declare const DIVINATION_INSPIRATION_CONTENT: Record<DivinationInspirationTab['id'], DivinationInspirationSection[]>;
export declare const JINKOUJUE_SPECIAL_INSPIRATION_CONTENT: DivinationInspirationSection[];
export declare const XIAOLIUREN_SPECIAL_INSPIRATION_CONTENT: DivinationInspirationSection[];
export declare const MEIHUA_SPECIAL_INSPIRATION_CONTENT: DivinationInspirationSection[];
export declare const QIMEN_SPECIAL_INSPIRATION_CONTENT: DivinationInspirationSection[];
export declare const LIUYAO_TEMPLATE_INSPIRATION_CONTENT: Record<Exclude<DivinationInspirationDraft['liuyaoTemplate'], 'general'>, DivinationInspirationSection[]>;
export declare const LIUREN_TEMPLATE_INSPIRATION_CONTENT: Record<Exclude<DivinationInspirationDraft['liurenTemplate'], 'general'>, DivinationInspirationSection[]>;
export declare const LENORMAND_SPREAD_INSPIRATION_CONTENT: Record<DivinationInspirationDraft['lenormandSpread'], DivinationInspirationSection[]>;
export declare const TAROT_SPREAD_INSPIRATION_QUESTIONS: Partial<Record<DivinationInspirationDraft['tarotSpread'], string[]>>;
export type DivinationSpecialInspiration = {
    label: string;
    sections: DivinationInspirationSection[];
};
type DivinationInspiredDraftPatch = Pick<DivinationInspirationDraft, 'question' | 'questionSource' | 'liuyaoTemplate' | 'liurenTemplate' | 'tarotSpread' | 'lenormandSpread'>;
export declare function getDivinationSpecialInspiration(draft: Pick<DivinationInspirationDraft, 'method' | 'liuyaoTemplate' | 'liurenTemplate' | 'lenormandSpread'>): DivinationSpecialInspiration | null;
export declare function getDefaultDivinationInspirationTab(draft: Pick<DivinationInspirationDraft, 'method' | 'liuyaoTemplate' | 'liurenTemplate' | 'lenormandSpread'>): DivinationInspirationTabId;
export declare function isDivinationInspirationTabVisible(tabId: DivinationInspirationTabId, draft: DivinationInspirationDraft): boolean;
export declare function getDivinationInspirationSections(_draft: Pick<DivinationInspirationDraft, 'method' | 'tarotSpread' | 'liuyaoTemplate' | 'liurenTemplate' | 'lenormandSpread'>, tabId: DivinationInspirationTabId): DivinationInspirationSection[];
export declare function resolveDivinationInspiredDraftPatch(current: DivinationInspirationDraft, question: string): DivinationInspiredDraftPatch;
export {};
