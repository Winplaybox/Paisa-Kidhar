/* Digital Shagun Card catalogue: occasions, templates, colour palettes. Keep ids in sync with apps/api/app/domain.py. */
import type { AnimName } from '@/design-system/Anim';

export type CardLang = 'en' | 'hi' | 'gu' | 'mr';
export const CARD_LANGS: { code: CardLang; label: string; native: string; locale: string }[] = [
  { code: 'en', label: 'English', native: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', locale: 'hi-IN' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', locale: 'gu-IN' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', locale: 'mr-IN' },
];

export const OCCASIONS = ['wedding', 'engagement', 'anniversary', 'birthday', 'baby-shower', 'housewarming', 'festival', 'congratulations'] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const TEMPLATE_IDS = ['marigold', 'rose', 'royal', 'mehendi', 'ivory', 'peacock', 'engagement', 'anniversary', 'birthday',
  'housewarming', 'diwali', 'baby-shower', 'celestial', 'minimal'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type Motif = 'marigold' | 'roses' | 'arch' | 'mehendi' | 'lilies' | 'peacock' | 'rings' | 'moon' | 'balloons' | 'house' | 'diya' | 'baby' | 'stars' | 'frame';
export type Palette = { bg: [string, string]; ink: string; accent: string; soft: string; dark?: boolean };

export type Template = {
  id: TemplateId; occasion: Occasion; motif: Motif; base: Palette;
  /** decorative Lottie overlays that loop softly over the card */
  fx: AnimName[];
};

export const TEMPLATES: Template[] = [
  { id: 'marigold', occasion: 'wedding', motif: 'marigold', fx: ['petals'], base: { bg: ['#FFF6E0', '#FDE3A7'], ink: '#5B2A00', accent: '#E07A00', soft: '#F5B94A' } },
  { id: 'rose', occasion: 'wedding', motif: 'roses', fx: ['petals'], base: { bg: ['#FFF1F6', '#FBCFE0'], ink: '#5A0F2E', accent: '#9D174D', soft: '#F472B6' } },
  { id: 'royal', occasion: 'wedding', motif: 'arch', fx: ['sparkles'], base: { bg: ['#1B1244', '#3A2A7A'], ink: '#FFF4DB', accent: '#F5B94A', soft: '#C084FC', dark: true } },
  { id: 'mehendi', occasion: 'wedding', motif: 'mehendi', fx: ['sparkles'], base: { bg: ['#F4F9EE', '#CFE5C0'], ink: '#1F3A12', accent: '#3F6E1F', soft: '#8DBA5A' } },
  { id: 'ivory', occasion: 'wedding', motif: 'lilies', fx: ['petals'], base: { bg: ['#FFFDF8', '#F3EBDD'], ink: '#4A3A24', accent: '#A07C3A', soft: '#E4D2AE' } },
  { id: 'peacock', occasion: 'wedding', motif: 'peacock', fx: ['sparkles'], base: { bg: ['#06384A', '#0B5E6B'], ink: '#FFF4DB', accent: '#F5C96A', soft: '#2BB3A3', dark: true } },
  { id: 'engagement', occasion: 'engagement', motif: 'rings', fx: ['hearts'], base: { bg: ['#FFF4F4', '#FBD8D8'], ink: '#6B1D2A', accent: '#C2415D', soft: '#F6A5B4' } },
  { id: 'anniversary', occasion: 'anniversary', motif: 'moon', fx: ['hearts'], base: { bg: ['#141B3F', '#2B2766'], ink: '#FFF1D6', accent: '#F5B94A', soft: '#F472B6', dark: true } },
  { id: 'birthday', occasion: 'birthday', motif: 'balloons', fx: ['balloons'], base: { bg: ['#FFF7E8', '#FFD9EA'], ink: '#6B1239', accent: '#DB2777', soft: '#60A5FA' } },
  { id: 'housewarming', occasion: 'housewarming', motif: 'house', fx: ['sparkles'], base: { bg: ['#FFFBEA', '#E3F1D2'], ink: '#35431F', accent: '#B45309', soft: '#8DBA5A' } },
  { id: 'diwali', occasion: 'festival', motif: 'diya', fx: ['sparkles', 'diya'], base: { bg: ['#3A0B2E', '#7A1F3D'], ink: '#FFF1D0', accent: '#FBBF24', soft: '#F97316', dark: true } },
  { id: 'baby-shower', occasion: 'baby-shower', motif: 'baby', fx: ['balloons'], base: { bg: ['#FFF7FB', '#DDEBFF'], ink: '#4B2A5E', accent: '#8B5CF6', soft: '#F9A8D4' } },
  { id: 'celestial', occasion: 'congratulations', motif: 'stars', fx: ['sparkles'], base: { bg: ['#0F1235', '#2A1B5E'], ink: '#FFF4DB', accent: '#FCD34D', soft: '#A78BFA', dark: true } },
  { id: 'minimal', occasion: 'congratulations', motif: 'frame', fx: ['sparkles'], base: { bg: ['#FFFFFF', '#F4F1EA'], ink: '#222222', accent: '#B8892B', soft: '#D9C9A3' } },
];

/** Palette 0 = the template's own look; 1–3 are shared colour themes applied to any template. */
const SHARED: Palette[] = [
  { bg: ['#FFF1F4', '#FBCFD8'], ink: '#5A1030', accent: '#BE185D', soft: '#F9A8C9' },
  { bg: ['#EEF8F1', '#BFE3CC'], ink: '#12402A', accent: '#15803D', soft: '#6EC08E' },
  { bg: ['#171A3A', '#2D2A63'], ink: '#FFF4DB', accent: '#F5B94A', soft: '#8B7CF6', dark: true },
];
export const PALETTE_COUNT = 4;

export const templateById = (id: string): Template => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
export const paletteFor = (id: string, idx: number): Palette => (idx > 0 && idx < PALETTE_COUNT ? SHARED[idx - 1] : templateById(id).base);
export const isTemplateId = (v: unknown): v is TemplateId => typeof v === 'string' && (TEMPLATE_IDS as readonly string[]).includes(v);
export const isOccasion = (v: unknown): v is Occasion => typeof v === 'string' && (OCCASIONS as readonly string[]).includes(v);
export const isCardLang = (v: unknown): v is CardLang => v === 'en' || v === 'hi' || v === 'gu' || v === 'mr';

export type L4 = Record<CardLang, string>;
export const pick = (l: L4, lang: CardLang) => l[lang] ?? l.en;

export const OCCASION_LABEL: Record<Occasion, L4> = {
  wedding: { en: 'Wedding', hi: 'विवाह', gu: 'લગ્ન', mr: 'विवाह' },
  engagement: { en: 'Engagement', hi: 'सगाई', gu: 'સગાઈ', mr: 'साखरपुडा' },
  anniversary: { en: 'Anniversary', hi: 'सालगिरह', gu: 'લગ્નતિથિ', mr: 'वाढदिवस (लग्न)' },
  birthday: { en: 'Birthday', hi: 'जन्मदिन', gu: 'જન્મદિવસ', mr: 'वाढदिवस' },
  'baby-shower': { en: 'Baby Shower', hi: 'गोद भराई', gu: 'સીમંત', mr: 'डोहाळे जेवण' },
  housewarming: { en: 'Housewarming', hi: 'गृह प्रवेश', gu: 'ગૃહપ્રવેશ', mr: 'गृहप्रवेश' },
  festival: { en: 'Festival', hi: 'त्योहार', gu: 'તહેવાર', mr: 'सण' },
  congratulations: { en: 'Congratulations', hi: 'बधाई', gu: 'અભિનંદન', mr: 'अभिनंदन' },
};
export const OCCASION_ICON: Record<Occasion, string> = {
  wedding: 'heart', engagement: 'diamond-outline', anniversary: 'infinite', birthday: 'balloon-outline', 'baby-shower': 'happy-outline',
  housewarming: 'home-outline', festival: 'flame-outline', congratulations: 'trophy-outline',
};
export const TEMPLATE_LABEL: Record<TemplateId, L4> = {
  marigold: { en: 'Marigold Wedding', hi: 'गेंदा विवाह', gu: 'ગલગોટા લગ્ન', mr: 'झेंडू विवाह' },
  rose: { en: 'Rose Romance', hi: 'गुलाबी रोमांस', gu: 'ગુલાબી રોમાન્સ', mr: 'गुलाबी रोमान्स' },
  royal: { en: 'Royal Heritage', hi: 'शाही विरासत', gu: 'શાહી વારસો', mr: 'शाही वारसा' },
  mehendi: { en: 'Mehendi Vibes', hi: 'मेहंदी रंग', gu: 'મહેંદી રંગ', mr: 'मेंदी रंग' },
  ivory: { en: 'Ivory Elegance', hi: 'आइवरी एलिगेंस', gu: 'આઇવરી એલિગન્સ', mr: 'आयव्हरी एलिगन्स' },
  peacock: { en: 'Peacock Royale', hi: 'मोर रॉयल', gu: 'મોર રોયલ', mr: 'मोर रॉयल' },
  engagement: { en: 'Engagement Rings', hi: 'सगाई की अंगूठियां', gu: 'સગાઈની વીંટી', mr: 'साखरपुड्याच्या अंगठ्या' },
  anniversary: { en: 'Moonlit Love', hi: 'चांदनी प्रेम', gu: 'ચાંદની પ્રેમ', mr: 'चांदणं प्रेम' },
  birthday: { en: 'Birthday Party', hi: 'बर्थडे पार्टी', gu: 'બર્થડે પાર્ટી', mr: 'वाढदिवस पार्टी' },
  housewarming: { en: 'Sweet Home', hi: 'स्वीट होम', gu: 'સ્વીટ હોમ', mr: 'स्वीट होम' },
  diwali: { en: 'Diwali Lights', hi: 'दिवाली की रोशनी', gu: 'દિવાળીનો પ્રકાશ', mr: 'दिवाळीचा प्रकाश' },
  'baby-shower': { en: 'Little Blessing', hi: 'नन्हा आशीर्वाद', gu: 'નાનો આશીર્વાદ', mr: 'छोटा आशीर्वाद' },
  celestial: { en: 'Celestial Gold', hi: 'सुनहरा आसमान', gu: 'સોનેરી આકાશ', mr: 'सोनेरी आकाश' },
  minimal: { en: 'Minimal Gold', hi: 'मिनिमल गोल्ड', gu: 'મિનિમલ ગોલ્ડ', mr: 'मिनिमल गोल्ड' },
};
export const PALETTE_LABEL: L4[] = [
  { en: 'Original', hi: 'मूल', gu: 'મૂળ', mr: 'मूळ' },
  { en: 'Blush', hi: 'गुलाबी', gu: 'ગુલાબી', mr: 'गुलाबी' },
  { en: 'Emerald', hi: 'हरा', gu: 'લીલો', mr: 'हिरवा' },
  { en: 'Midnight', hi: 'रात्रि', gu: 'રાત્રિ', mr: 'रात्र' },
];
