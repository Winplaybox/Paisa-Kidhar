/* The Digital Shagun Card artwork. Pure SVG (title, names and blessing are SVG text too), so the very same drawing is shown on screen
   and exported to PNG — crisp at any size, no image assets. Animations live in CardStage, not here. */
import { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import { Background, Divider, H, Motif, W } from '@/cards/art';
import { paletteFor, templateById, type CardLang, type Occasion, type TemplateId } from '@/cards/catalog';
import { blessingWord, cardTitle, defaultBlessing, formatCardDate, fromDefault, wrapText } from '@/cards/copy';

export type CardSpec = {
  template: TemplateId; occasion: Occasion; palette: number; lang: CardLang;
  recipient: string; date?: string | null; blessing?: string | null; from?: string | null;
};
export type CardHandle = { exportPngBase64: (pixelWidth?: number) => Promise<string> };

const SERIF = Platform.OS === 'web' ? "Georgia, 'Noto Serif', 'Times New Roman', serif" : 'serif';

export const ShagunCardView = forwardRef<CardHandle, { spec: CardSpec; width?: number }>(function ShagunCardView({ spec, width = 340 }, ref) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const svgRef = useRef<{ toDataURL?: (cb: (b64: string) => void, o?: { width: number; height: number }) => void } | null>(null);
  const domId = `card-${uid}`;
  const tpl = templateById(spec.template);
  const p = paletteFor(spec.template, spec.palette);
  const latin = spec.lang === 'en';
  const k = latin ? 0.5 : 0.62; // average glyph width / font size

  const title = cardTitle(spec.occasion, spec.lang);
  const titleSize = title.length > 22 ? 24 : title.length > 14 ? 30 : 36;
  const titleLines = wrapText(title, Math.floor(284 / (titleSize * k)), 2);
  const nameLines = wrapText(spec.recipient.trim(), Math.floor(290 / (22 * k)), 2);
  const date = formatCardDate(spec.date, spec.lang);
  const text = (spec.blessing?.trim() || defaultBlessing(spec.occasion, spec.lang));
  const fs = text.length <= 90 ? 16 : text.length <= 150 ? 14.5 : text.length <= 210 ? 13 : 12;
  const lh = fs * 1.42;
  const maxLines = Math.floor(118 / lh);
  const bless = wrapText(text, Math.floor(272 / (fs * k)), maxLines);
  const fromName = spec.from?.trim() || fromDefault(spec.lang);

  const titleY = 150 - (titleLines.length - 1) * 18;
  const divY = 168 + (titleLines.length - 1) * 4;
  const nameY = divY + 36;
  const afterName = nameY + (nameLines.length - 1) * 26;
  const dateY = afterName + 26;
  const blessStart = (date ? dateY : afterName) + 34;
  const fromY = Math.max(blessStart + bless.length * lh + 14, 412);

  useImperativeHandle(ref, () => ({
    exportPngBase64: (pixelWidth = 1080) => new Promise<string>((resolve, reject) => {
      const px = pixelWidth; const py = Math.round((pixelWidth * H) / W);
      if (Platform.OS !== 'web') {
        if (!svgRef.current?.toDataURL) { reject(new Error('Card is not ready yet.')); return; }
        svgRef.current.toDataURL((b64) => resolve(b64), { width: px, height: py });
        return;
      }
      try {
        const node = document.getElementById(domId)?.querySelector('svg');
        if (!node) throw new Error('Card is not ready yet.');
        const clone = node.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', String(px)); clone.setAttribute('height', String(py));
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = px; c.height = py;
          c.getContext('2d')!.drawImage(img, 0, 0, px, py);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/png').split(',')[1]);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not render the card image.')); };
        img.src = url;
      } catch (e) { reject(e as Error); }
    }),
  }), [domId]);

  const h = Math.round((width * H) / W);
  const common = { fill: p.ink, textAnchor: 'middle' as const, fontFamily: SERIF };
  return (
    <View nativeID={domId} style={{ width, height: h, borderRadius: Math.round(width * 0.055), overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 6 }}
      accessible accessibilityRole="image"
      accessibilityLabel={`${title}. ${spec.recipient}. ${text}. ${fromName}`}>
      <Svg ref={svgRef as never} width={width} height={h} viewBox={`0 0 ${W} ${H}`}>
        <Background p={p} uid={uid} />
        <Motif motif={tpl.motif} p={p} />
        {titleLines.map((l, i) => (
          <SvgText key={`t${i}`} x={180} y={titleY + i * (titleSize * 1.12)} fontSize={titleSize} fontWeight="600" fontStyle={latin ? 'italic' : 'normal'} {...common}>{l}</SvgText>
        ))}
        <Divider y={divY} p={p} />
        {nameLines.map((l, i) => (
          <SvgText key={`n${i}`} x={180} y={nameY + i * 26} fontSize={22} fontWeight="700" {...common}>{l}</SvgText>
        ))}
        {date ? <SvgText x={180} y={dateY} fontSize={13} {...common} opacity={0.85}>{date}</SvgText> : null}
        {bless.map((l, i) => (
          <SvgText key={`b${i}`} x={180} y={blessStart + i * lh} fontSize={fs} fontStyle={latin ? 'italic' : 'normal'} {...common}>{l}</SvgText>
        ))}
        <SvgText x={180} y={fromY} fontSize={11} {...common} fill={p.accent} opacity={0.95}>{blessingWord(spec.lang)}</SvgText>
        <SvgText x={180} y={fromY + 22} fontSize={19} fontWeight="700" {...common}>{fromName.length > 34 ? `${fromName.slice(0, 33)}…` : fromName}</SvgText>
      </Svg>
    </View>
  );
});

/** Build a spec from what the API returns for a paid card. */
export function specFromCard(c: { design?: string; occasion?: string; palette?: number; lang?: string; recipient?: string | null; partner_one?: string; partner_two?: string;
  wedding_date?: string | null; message?: string | null; from?: string | null }): CardSpec {
  const tpl = templateById(c.design ?? 'marigold');
  const lang = (['en', 'hi', 'gu', 'mr'] as const).find((l) => l === c.lang) ?? 'en';
  const occasion = (c.occasion as Occasion) ?? tpl.occasion;
  return {
    template: tpl.id, occasion, palette: c.palette ?? 0, lang,
    recipient: c.recipient || [c.partner_one, c.partner_two].filter(Boolean).join(' & '), date: c.wedding_date, blessing: c.message, from: c.from,
  };
}
