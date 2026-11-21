/* Text printed ON the card, in the card's own language (independent of the app language). */
import { CARD_LANGS, pick, type CardLang, type L4, type Occasion } from './catalog';

export const CARD_TITLE: Record<Occasion, L4> = {
  wedding: { en: 'Shubh Vivah', hi: 'शुभ विवाह', gu: 'શુભ વિવાહ', mr: 'शुभ विवाह' },
  engagement: { en: 'Engagement Blessings', hi: 'सगाई की शुभकामनाएं', gu: 'સગાઈની શુભેચ્છાઓ', mr: 'साखरपुड्याच्या शुभेच्छा' },
  anniversary: { en: 'Happy Anniversary', hi: 'शादी की सालगिरह मुबारक', gu: 'લગ્નતિથિની શુભેચ્છાઓ', mr: 'लग्नाच्या वाढदिवसाच्या शुभेच्छा' },
  birthday: { en: 'Happy Birthday', hi: 'जन्मदिन मुबारक', gu: 'જન્મદિવસની શુભેચ્છાઓ', mr: 'वाढदिवसाच्या शुभेच्छा' },
  'baby-shower': { en: 'Baby Shower Blessings', hi: 'गोद भराई की शुभकामनाएं', gu: 'સીમંતની શુભેચ્છાઓ', mr: 'डोहाळे जेवणाच्या शुभेच्छा' },
  housewarming: { en: 'Griha Pravesh', hi: 'गृह प्रवेश', gu: 'ગૃહપ્રવેશ', mr: 'गृहप्रवेश' },
  festival: { en: 'Happy Diwali', hi: 'शुभ दीपावली', gu: 'શુભ દિવાળી', mr: 'शुभ दीपावली' },
  congratulations: { en: 'Congratulations', hi: 'हार्दिक बधाई', gu: 'હાર્દિક અભિનંદન', mr: 'हार्दिक अभिनंदन' },
};

export const CARD_BLESSING: Record<Occasion, L4> = {
  wedding: {
    en: 'Wishing you a lifetime of love, laughter and adventures together.',
    hi: 'आपका वैवाहिक जीवन प्रेम, हँसी और खुशियों से भरा रहे।',
    gu: 'તમારું લગ્નજીવન પ્રેમ, હાસ્ય અને ખુશીઓથી ભરેલું રહે.',
    mr: 'तुमचे वैवाहिक जीवन प्रेम, हास्य आणि आनंदाने भरलेले असो.',
  },
  engagement: {
    en: 'May this beautiful beginning lead to a lifetime of happiness together.',
    hi: 'यह सुंदर शुरुआत जीवन भर की खुशियों का रास्ता बने।',
    gu: 'આ સુંદર શરૂઆત જીવનભરની ખુશીઓ તરફ દોરી જાય.',
    mr: 'ही सुंदर सुरुवात आयुष्यभराच्या आनंदाकडे घेऊन जावो.',
  },
  anniversary: {
    en: 'May your love continue to grow stronger with each passing year.',
    hi: 'आपका प्यार हर बीतते साल के साथ और गहरा होता जाए।',
    gu: 'તમારો પ્રેમ દર વર્ષે વધુ ગાઢ બનતો રહે.',
    mr: 'तुमचे प्रेम प्रत्येक वर्षी अधिक घट्ट होत राहो.',
  },
  birthday: {
    en: 'Wishing you health, happiness and success always.',
    hi: 'आपको सदा स्वास्थ्य, खुशी और सफलता मिले।',
    gu: 'તમને હંમેશાં સ્વાસ્થ્ય, ખુશી અને સફળતા મળે.',
    mr: 'तुम्हाला सदैव आरोग्य, आनंद आणि यश लाभो.',
  },
  'baby-shower': {
    en: 'May this new chapter bring immense joy, love and a bundle of happiness.',
    hi: 'यह नया अध्याय अपार खुशियां और प्यार लेकर आए।',
    gu: 'આ નવો અધ્યાય અપાર ખુશીઓ અને પ્રેમ લઈને આવે.',
    mr: 'हा नवा अध्याय अपार आनंद आणि प्रेम घेऊन येवो.',
  },
  housewarming: {
    en: 'May your new home be filled with peace, prosperity and happiness.',
    hi: 'आपका नया घर शांति, समृद्धि और खुशियों से भरा रहे।',
    gu: 'તમારું નવું ઘર શાંતિ, સમૃદ્ધિ અને ખુશીઓથી ભરેલું રહે.',
    mr: 'तुमचे नवीन घर शांती, समृद्धी आणि आनंदाने भरलेले असो.',
  },
  festival: {
    en: 'Wishing you and your family a Diwali filled with light, joy and prosperity.',
    hi: 'आपको और आपके परिवार को दीपावली की ढेर सारी शुभकामनाएं।',
    gu: 'તમને અને તમારા પરિવારને દિવાળીની ખૂબ ખૂબ શુભેચ્છાઓ.',
    mr: 'तुम्हाला आणि तुमच्या कुटुंबाला दिवाळीच्या हार्दिक शुभेच्छा.',
  },
  congratulations: {
    en: 'Heartfelt congratulations — may success and joy follow you everywhere.',
    hi: 'दिल से बधाई — सफलता और खुशी आपके साथ रहे।',
    gu: 'દિલથી અભિનંદન — સફળતા અને ખુશી હંમેશાં તમારી સાથે રહે.',
    mr: 'मनापासून अभिनंदन — यश आणि आनंद सदैव तुमच्यासोबत राहो.',
  },
};

const BLESSING_WORD: L4 = { en: 'with love & blessings', hi: 'प्यार और आशीर्वाद सहित', gu: 'પ્રેમ અને આશીર્વાદ સહિત', mr: 'प्रेम आणि आशीर्वादांसह' };
const FROM_DEFAULT: L4 = { en: 'A well-wisher', hi: 'एक शुभचिंतक', gu: 'એક શુભેચ્છક', mr: 'एक हितचिंतक' };
export const blessingWord = (l: CardLang) => pick(BLESSING_WORD, l);
export const fromDefault = (l: CardLang) => pick(FROM_DEFAULT, l);
export const defaultBlessing = (o: Occasion, l: CardLang) => pick(CARD_BLESSING[o], l);
export const cardTitle = (o: Occasion, l: CardLang) => pick(CARD_TITLE[o], l);

export function formatCardDate(iso: string | null | undefined, lang: CardLang): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const locale = CARD_LANGS.find((x) => x.code === lang)?.locale ?? 'en-IN';
  try { return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d.toDateString(); }
}

/** Greedy word wrap by estimated width (SVG text doesn't wrap). Falls back to hard splitting for long words/scripts without spaces. */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const raw of para.split(/\s+/).filter(Boolean)) {
      let word = raw;
      while (word.length > maxChars) { if (line) { out.push(line); line = ''; } out.push(word.slice(0, maxChars)); word = word.slice(maxChars); }
      if (!line) line = word;
      else if ((line + ' ' + word).length <= maxChars) line += ' ' + word;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
    if (!para.trim()) out.push('');
  }
  if (out.length > maxLines) { const cut = out.slice(0, maxLines); cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S{0,3}$/, '') + '…'; return cut; }
  return out;
}
