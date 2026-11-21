/* Card artwork, drawn in code (react-native-svg) on a 360×540 canvas: crisp at any size, tiny, exportable to PNG.
   Text-safe zone is y≈110–465; motifs keep their detail to the edges. */
import { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import type { Motif, Palette } from './catalog';

export const W = 360;
export const H = 540;

function Flower({ cx, cy, r, n = 8, fill, center, op = 1 }: { cx: number; cy: number; r: number; n?: number; fill: string; center: string; op?: number }) {
  return (
    <G opacity={op}>
      {Array.from({ length: n }).map((_, i) => (
        <Ellipse key={i} cx={cx} cy={cy - r * 0.6} rx={r * 0.34} ry={r * 0.6} fill={fill} transform={`rotate(${(i * 360) / n} ${cx} ${cy})`} />
      ))}
      <Circle cx={cx} cy={cy} r={r * 0.3} fill={center} />
    </G>
  );
}
function Leaf({ x, y, s = 1, rot = 0, fill }: { x: number; y: number; s?: number; rot?: number; fill: string }) {
  return <Ellipse cx={x} cy={y} rx={5 * s} ry={13 * s} fill={fill} opacity={0.85} transform={`rotate(${rot} ${x} ${y})`} />;
}
function Spark({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  const a = 8 * s; const b = 1.8 * s;
  return <Path d={`M${x} ${y - a} L${x + b} ${y - b} L${x + a} ${y} L${x + b} ${y + b} L${x} ${y + a} L${x - b} ${y + b} L${x - a} ${y} L${x - b} ${y - b} Z`} fill={fill} />;
}
function Heart({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return <Path d={`M${x} ${y + 10 * s} C${x - 22 * s} ${y - 6 * s} ${x - 10 * s} ${y - 20 * s} ${x} ${y - 8 * s} C${x + 10 * s} ${y - 20 * s} ${x + 22 * s} ${y - 6 * s} ${x} ${y + 10 * s} Z`} fill={fill} />;
}
function Garland({ pts, r, a, b, c }: { pts: [number, number][]; r: number; a: string; b: string; c: string }) {
  return <G>{pts.map(([x, y], i) => <Flower key={i} cx={x} cy={y} r={r} fill={i % 2 ? a : b} center={c} />)}</G>;
}
const curve = (n: number, f: (t: number) => [number, number]) => Array.from({ length: n }, (_, i) => f(i / (n - 1)));

export function Background({ p, uid }: { p: Palette; uid: string }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`bg${uid}`} x1="0" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={p.bg[0]} /><Stop offset="1" stopColor={p.bg[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} fill={`url(#bg${uid})`} />
    </>
  );
}

function Border({ p, dashed = true }: { p: Palette; dashed?: boolean }) {
  return <Rect x={12} y={12} width={W - 24} height={H - 24} rx={18} fill="none" stroke={p.accent} strokeWidth={1.4} strokeDasharray={dashed ? '2 6' : undefined} opacity={0.8} />;
}

function Marigold({ p }: { p: Palette }) {
  const top = curve(8, (t) => [30 + t * 300, 34 + Math.sin(t * Math.PI) * 26]);
  const l = curve(6, (t) => [22, 70 + t * 110]); const r = curve(6, (t) => [338, 70 + t * 110]);
  return (
    <G>
      <Border p={p} />
      <Garland pts={top} r={15} a="#F59E0B" b="#FB923C" c="#B45309" />
      <Garland pts={l} r={10} a="#FBBF24" b="#F97316" c="#B45309" />
      <Garland pts={r} r={10} a="#FBBF24" b="#F97316" c="#B45309" />
      {[60, 120, 180, 240, 300].map((x) => <Path key={x} d={`M${x} 50 L${x} ${70 + (x % 40)}`} stroke={p.accent} strokeWidth={1} opacity={0.5} />)}
      {[[30, 505], [330, 505]].map(([x, y], i) => <Flower key={i} cx={x} cy={y} r={28} n={10} fill={i ? '#F97316' : '#F59E0B'} center="#B45309" />)}
      <Garland pts={curve(6, (t) => [75 + t * 210, 505 - Math.sin(t * Math.PI) * 18])} r={11} a="#FBBF24" b="#FB923C" c="#B45309" />
      {[[60, 470], [300, 470], [18, 440], [342, 440]].map(([x, y], i) => <Leaf key={i} x={x} y={y} rot={i % 2 ? 40 : -40} fill="#65A30D" />)}
    </G>
  );
}

function Rose({ x, y, r, c1, c2 }: { x: number; y: number; r: number; c1: string; c2: string }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={c1} />
      <Circle cx={x + r * 0.06} cy={y} r={r * 0.72} fill={c2} opacity={0.85} />
      <Circle cx={x - r * 0.08} cy={y + r * 0.04} r={r * 0.46} fill={c1} />
      <Path d={`M${x - r * 0.3} ${y} Q${x} ${y - r * 0.4} ${x + r * 0.3} ${y} Q${x} ${y + r * 0.2} ${x - r * 0.3} ${y}`} fill={c2} />
    </G>
  );
}
function Roses({ p }: { p: Palette }) {
  const spots: [number, number, number][] = [[40, 44, 30], [110, 22, 18], [22, 120, 18], [322, 496, 32], [250, 520, 20], [340, 424, 18], [320, 40, 20], [38, 500, 22]];
  return (
    <G>
      <Border p={p} dashed={false} />
      {spots.map(([x, y], i) => <Leaf key={`l${i}`} x={x + 20} y={y + 14} s={1.3} rot={i * 50} fill="#4D7C0F" />)}
      {spots.map(([x, y, r], i) => <Rose key={i} x={x} y={y} r={r} c1={i % 2 ? p.accent : p.soft} c2={i % 2 ? p.soft : p.accent} />)}
      <Spark x={300} y={100} fill={p.accent} /><Spark x={60} y={470} s={0.8} fill={p.accent} />
    </G>
  );
}

function Arch({ p }: { p: Palette }) {
  return (
    <G>
      <Border p={p} dashed={false} />
      <Path d="M36 150 L36 84 Q36 60 60 50 Q180 -14 300 50 Q324 60 324 84 L324 150" fill="none" stroke={p.accent} strokeWidth={3} />
      <Path d="M46 150 L46 88 Q46 70 66 62 Q180 8 294 62 Q314 70 314 88 L314 150" fill="none" stroke={p.accent} strokeWidth={1} opacity={0.7} />
      {[90, 180, 270].map((x, i) => (
        <G key={x}>
          <Line x1={x} y1={i === 1 ? 26 : 56} x2={x} y2={i === 1 ? 54 : 84} stroke={p.accent} strokeWidth={1.2} />
          <Rect x={x - 9} y={i === 1 ? 54 : 84} width={18} height={26} rx={4} fill={p.accent} opacity={0.9} />
          <Circle cx={x} cy={i === 1 ? 67 : 97} r={5} fill="#FFF3C4" />
        </G>
      ))}
      <G transform="translate(0 40)">
      <Path d="M0 540 L0 500 L40 500 L40 484 Q40 466 56 466 Q72 466 72 484 L72 500 L130 500 L130 478 Q130 440 180 432 Q230 440 230 478 L230 500 L288 500 L288 484 Q288 466 304 466 Q320 466 320 484 L320 500 L360 500 L360 540 Z" fill={p.accent} opacity={0.85} />
      <Rect x={176} y={410} width={8} height={24} fill={p.accent} />
      <Circle cx={180} cy={406} r={5} fill={p.accent} />
      {[88, 180, 272].map((x) => <Rect key={x} x={x - 6} y={508} width={12} height={24} rx={6} fill="#FFF3C4" opacity={0.85} />)}
      </G>
      {[[40, 190], [320, 190], [28, 250], [332, 250]].map(([x, y], i) => <Spark key={i} x={x} y={y} s={0.9} fill={p.accent} />)}
    </G>
  );
}

function Mehendi({ p }: { p: Palette }) {
  const vine = (sx: number, flip: number) => {
    const pts = curve(7, (t) => [sx + Math.sin(t * 7) * 10 * flip, 60 + t * 330]);
    return <G>{pts.map(([x, y], i) => <G key={i}><Leaf x={x + 12 * flip} y={y} s={1.2} rot={flip * 60} fill={p.soft} /><Leaf x={x - 8 * flip} y={y + 16} s={1} rot={-flip * 50} fill={p.accent} /></G>)}</G>;
  };
  return (
    <G>
      <Border p={p} />
      {vine(26, 1)}{vine(334, -1)}
      <G transform="translate(70 470)">
        {Array.from({ length: 12 }).map((_, i) => <Ellipse key={i} cx={0} cy={-30} rx={7} ry={18} fill={i % 2 ? p.accent : p.soft} transform={`rotate(${i * 30})`} />)}
        <Circle r={16} fill={p.accent} /><Circle r={8} fill={p.bg[0]} /><Circle r={36} fill="none" stroke={p.accent} strokeWidth={1.2} />
      </G>
      <G transform="translate(300 76)">
        {Array.from({ length: 10 }).map((_, i) => <Ellipse key={i} cx={0} cy={-22} rx={5.5} ry={14} fill={i % 2 ? p.accent : p.soft} transform={`rotate(${i * 36})`} />)}
        <Circle r={11} fill={p.accent} />
      </G>
      <Path d="M110 506 Q180 482 250 506" fill="none" stroke={p.accent} strokeWidth={1.5} strokeDasharray="1 5" strokeLinecap="round" />
    </G>
  );
}

function Lily({ x, y, s = 1, rot = 0, fill, line }: { x: number; y: number; s?: number; rot?: number; fill: string; line: string }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {Array.from({ length: 6 }).map((_, i) => <Path key={i} d="M0 0 Q12 -22 0 -46 Q-12 -22 0 0 Z" fill={fill} stroke={line} strokeWidth={1} transform={`rotate(${i * 60})`} />)}
      <Circle r={4} fill={line} />
      {Array.from({ length: 5 }).map((_, i) => <Line key={i} x1={0} y1={0} x2={0} y2={-16} stroke={line} strokeWidth={1.2} transform={`rotate(${i * 72 + 20})`} />)}
    </G>
  );
}
function Lilies({ p }: { p: Palette }) {
  return (
    <G>
      <Border p={p} dashed={false} />
      {[[16, 30, 40], [60, 14, 80], [10, 90, -20], [340, 510, 20], [296, 528, 60], [350, 450, 100]].map(([x, y, r], i) => <Leaf key={i} x={x} y={y} s={2} rot={r} fill="#8AA672" />)}
      <Lily x={52} y={62} s={1.1} fill="#FFFFFF" line={p.accent} /><Lily x={112} y={30} s={0.7} rot={25} fill="#FFFFFF" line={p.accent} />
      <Lily x={310} y={488} s={1.1} rot={30} fill="#FFFFFF" line={p.accent} /><Lily x={250} y={520} s={0.7} rot={-20} fill="#FFFFFF" line={p.accent} />
      {[[300, 50], [60, 500], [335, 130]].map(([x, y], i) => <Spark key={i} x={x} y={y} fill={p.accent} />)}
    </G>
  );
}

function Feather({ x, y, rot, s = 1, p }: { x: number; y: number; rot: number; s?: number; p: Palette }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <Path d="M0 0 Q6 -60 0 -130" stroke={p.accent} strokeWidth={2.4} fill="none" />
      {Array.from({ length: 9 }).map((_, i) => <Line key={i} x1={0} y1={-18 - i * 8} x2={i % 2 ? 16 : -16} y2={-26 - i * 8} stroke={p.soft} strokeWidth={1.4} opacity={0.8} />)}
      <Ellipse cx={0} cy={-142} rx={20} ry={28} fill="#0E7490" /><Ellipse cx={0} cy={-142} rx={14} ry={21} fill="#2BB3A3" />
      <Ellipse cx={0} cy={-142} rx={9} ry={14} fill="#1D4ED8" /><Ellipse cx={0} cy={-142} rx={4} ry={7} fill={p.accent} />
    </G>
  );
}
function Peacock({ p }: { p: Palette }) {
  return (
    <G>
      <Border p={p} dashed={false} />
      <Feather x={310} y={520} rot={-18} p={p} /><Feather x={282} y={528} rot={-28} s={0.62} p={p} /><Feather x={338} y={520} rot={4} s={0.85} p={p} />
      <Feather x={50} y={20} rot={160} s={0.8} p={p} /><Feather x={20} y={30} rot={185} s={0.65} p={p} />
      {[[40, 440], [320, 90], [180, 500]].map(([x, y], i) => <Spark key={i} x={x} y={y} s={0.9} fill={p.accent} />)}
    </G>
  );
}

function Rings({ p }: { p: Palette }) {
  return (
    <G>
      <Border p={p} dashed={false} />
      <Circle cx={160} cy={490} r={26} fill="none" stroke={p.accent} strokeWidth={5} />
      <Circle cx={198} cy={490} r={26} fill="none" stroke={p.accent} strokeWidth={5} opacity={0.85} />
      <Polygon points="198,455 206,464 198,473 190,464" fill="#FFFFFF" stroke={p.accent} strokeWidth={1.5} />
      {[[36, 40, 22], [320, 38, 18], [34, 505, 18], [330, 500, 22]].map(([x, y, r], i) => <Flower key={i} cx={x} cy={y} r={r} n={6} fill={p.soft} center={p.accent} />)}
      {[[80, 110], [290, 120], [60, 440], [300, 450]].map(([x, y], i) => <Spark key={i} x={x} y={y} s={0.8} fill={p.accent} />)}
      <Heart x={180} y={90} s={1} fill={p.accent} />
    </G>
  );
}

function Moon({ p }: { p: Palette }) {
  const stars = [[60, 40], [120, 70], [300, 50], [330, 120], [40, 150], [250, 30], [200, 100], [320, 200], [30, 240]];
  return (
    <G>
      <Border p={p} />
      <Path d="M270 40 A34 34 0 1 0 270 108 A27 27 0 1 1 270 40 Z" fill={p.accent} opacity={0.95} />
      {stars.map(([x, y], i) => <Spark key={i} x={x} y={y} s={0.6 + (i % 3) * 0.3} fill={i % 2 ? '#FFFFFF' : p.accent} />)}
      <Heart x={180} y={496} s={1.4} fill={p.soft} />
      <Path d="M40 520 Q110 498 180 520 T320 520" fill="none" stroke={p.accent} strokeWidth={1.4} opacity={0.7} />
      <Path d="M20 530 Q100 510 180 530 T340 530" fill="none" stroke={p.accent} strokeWidth={1} opacity={0.5} />
    </G>
  );
}

function Balloon({ x, y, c, s = 1 }: { x: number; y: number; c: string; s?: number }) {
  return (
    <G>
      <Path d={`M${x} ${y + 30 * s} Q${x - 6} ${y + 60 * s} ${x + 3} ${y + 90 * s}`} stroke="#9CA3AF" strokeWidth={1} fill="none" />
      <Ellipse cx={x} cy={y} rx={22 * s} ry={28 * s} fill={c} />
      <Ellipse cx={x - 7 * s} cy={y - 9 * s} rx={5 * s} ry={8 * s} fill="#FFFFFF" opacity={0.4} />
      <Polygon points={`${x},${y + 28 * s} ${x - 4 * s},${y + 36 * s} ${x + 4 * s},${y + 36 * s}`} fill={c} />
    </G>
  );
}
function Balloons({ p }: { p: Palette }) {
  const cols = ['#F472B6', '#60A5FA', '#FBBF24', '#34D399', '#A78BFA'];
  return (
    <G>
      <Border p={p} />
      <Balloon x={44} y={50} c={cols[0]} /><Balloon x={84} y={34} c={cols[1]} s={0.85} /><Balloon x={22} y={106} c={cols[2]} s={0.8} />
      <Balloon x={316} y={50} c={cols[3]} /><Balloon x={276} y={34} c={cols[4]} s={0.85} /><Balloon x={338} y={106} c={cols[0]} s={0.8} />
      {Array.from({ length: 22 }).map((_, i) => <Rect key={i} x={(i * 47) % 330 + 14} y={((i * 83) % 70) + 150 + (i % 3) * 120} width={5} height={9} rx={1.5} fill={cols[i % 5]} opacity={0.75} transform={`rotate(${i * 37} ${(i * 47) % 330 + 14} ${((i * 83) % 70) + 150})`} />)}
      <Rect x={130} y={486} width={100} height={34} rx={6} fill="#F9A8D4" /><Rect x={130} y={486} width={100} height={11} rx={5} fill="#FFFFFF" />
      <Rect x={146} y={462} width={68} height={26} rx={5} fill="#FBCFE8" /><Rect x={146} y={462} width={68} height={9} rx={4} fill="#FFFFFF" />
      {[162, 180, 198].map((x) => <G key={x}><Rect x={x - 1.5} y={444} width={3} height={18} fill="#60A5FA" /><Ellipse cx={x} cy={440} rx={3} ry={5} fill="#FBBF24" /></G>)}
    </G>
  );
}

function House({ p }: { p: Palette }) {
  return (
    <G>
      <Border p={p} dashed={false} />
      {curve(6, (t) => [30 + t * 60, 22]).map(([x, y], i) => <G key={i}><Line x1={x} y1={0} x2={x} y2={y + i * 8} stroke="#65A30D" strokeWidth={1.5} /><Leaf x={x} y={y + i * 8 + 8} s={1.2} fill="#84CC16" /></G>)}
      {curve(6, (t) => [270 + t * 60, 22]).map(([x, y], i) => <G key={i}><Line x1={x} y1={0} x2={x} y2={y + i * 8} stroke="#65A30D" strokeWidth={1.5} /><Leaf x={x} y={y + i * 8 + 8} s={1.2} fill="#84CC16" /></G>)}
      <G transform="translate(0 16)"><Ellipse cx={180} cy={535} rx={190} ry={34} fill="#86B84A" />
      <Rect x={136} y={474} width={88} height={56} fill="#FFF3D6" stroke={p.accent} strokeWidth={1.5} />
      <Polygon points="126,476 180,436 234,476" fill="#C2410C" /><Rect x={202} y={440} width={10} height={22} fill="#9A3412" />
      <Rect x={170} y={496} width={20} height={34} rx={3} fill="#92400E" /><Circle cx={186} cy={514} r={1.6} fill="#FDE68A" />
      <Rect x={144} y={488} width={16} height={14} rx={2} fill="#FDE68A" /><Rect x={200} y={488} width={16} height={14} rx={2} fill="#FDE68A" />
      {[[70, 500], [290, 500]].map(([x, y]) => <G key={x}><Rect x={x - 3} y={y} width={6} height={26} fill="#78350F" /><Circle cx={x} cy={y - 6} r={20} fill="#4D7C0F" /><Circle cx={x - 8} cy={y} r={13} fill="#65A30D" /></G>)}
      </G>
      <Spark x={300} y={110} fill={p.accent} /><Spark x={60} y={130} s={0.8} fill={p.accent} />
    </G>
  );
}

function Diya({ p }: { p: Palette }) {
  return (
    <G>
      <Border p={p} />
      <Path d="M20 40 Q180 110 340 40" fill="none" stroke={p.accent} strokeWidth={1.5} />
      {curve(9, (t) => [20 + t * 320, 40 + Math.sin(t * Math.PI) * 42]).map(([x, y], i) => <G key={i}><Circle cx={x} cy={y + 6} r={9} fill={p.accent} opacity={0.22} /><Circle cx={x} cy={y + 6} r={4.5} fill={i % 2 ? '#FDE68A' : p.accent} /></G>)}
      {[[200, 500, 1], [110, 506, 0.72], [250, 506, 0.72]].map(([x, y, s], i) => (
        <G key={i}>
          <Path d={`M${x - 34 * s} ${y} Q${x} ${y + 40 * s} ${x + 34 * s} ${y} Z`} fill="#B45309" /><Rect x={x - 36 * s} y={y - 5 * s} width={72 * s} height={7 * s} rx={3} fill="#D97706" />
          <Ellipse cx={x} cy={y - 20 * s} rx={8 * s} ry={16 * s} fill="#F97316" /><Ellipse cx={x} cy={y - 17 * s} rx={4 * s} ry={9 * s} fill="#FEF08A" />
        </G>
      ))}
      {Array.from({ length: 12 }).map((_, i) => { const a = (i / 12) * Math.PI * 2; return <Circle key={i} cx={64 + Math.cos(a) * 26} cy={470 + Math.sin(a) * 26} r={3} fill={i % 2 ? p.accent : p.soft} />; })}
      {Array.from({ length: 12 }).map((_, i) => { const a = (i / 12) * Math.PI * 2; return <Line key={i} x1={300} y1={120} x2={300 + Math.cos(a) * 24} y2={120 + Math.sin(a) * 24} stroke={i % 2 ? p.accent : p.soft} strokeWidth={2} strokeLinecap="round" />; })}
    </G>
  );
}

function Baby({ p }: { p: Palette }) {
  const cloud = (x: number, y: number, s: number) => <G opacity={0.9}><Circle cx={x} cy={y} r={14 * s} fill="#FFFFFF" /><Circle cx={x + 16 * s} cy={y - 6 * s} r={18 * s} fill="#FFFFFF" /><Circle cx={x + 36 * s} cy={y} r={14 * s} fill="#FFFFFF" /><Rect x={x} y={y} width={36 * s} height={14 * s} fill="#FFFFFF" /></G>;
  return (
    <G>
      <Border p={p} />
      {cloud(40, 60, 1)}{cloud(250, 40, 0.9)}{cloud(220, 118, 0.6)}
      {[[120, 40], [190, 80], [320, 100], [30, 130]].map(([x, y], i) => <Spark key={i} x={x} y={y} s={0.8} fill={i % 2 ? '#FBBF24' : p.accent} />)}
      <Balloon x={60} y={470} c="#F9A8D4" s={0.7} /><Balloon x={100} y={486} c="#93C5FD" s={0.6} /><Balloon x={300} y={470} c="#C4B5FD" s={0.7} /><Balloon x={260} y={486} c="#FDE68A" s={0.6} />
      <Path d="M20 524 Q180 540 340 524" fill="none" stroke={p.accent} strokeWidth={1.2} />
      {curve(9, (t) => [30 + t * 300, 524 + Math.sin(t * Math.PI) * 5]).map(([x, y], i) => <Polygon key={i} points={`${x - 8},${y} ${x + 8},${y} ${x},${y + 14}`} fill={['#F9A8D4', '#93C5FD', '#FDE68A'][i % 3]} />)}
      <Heart x={180} y={486} s={1.1} fill={p.soft} />
    </G>
  );
}

function Stars({ p }: { p: Palette }) {
  return (
    <G>
      <Border p={p} />
      {Array.from({ length: 14 }).map((_, i) => { const a = (i / 14) * Math.PI; return <Line key={i} x1={180} y1={0} x2={180 + Math.cos(a) * 240} y2={Math.sin(a) * 240} stroke={p.accent} strokeWidth={0.8} opacity={0.18} />; })}
      <Path d="M190 34 A30 30 0 1 0 190 94 A24 24 0 1 1 190 34 Z" fill={p.accent} />
      {[[50, 50], [310, 60], [70, 130], [300, 140], [40, 220], [330, 230], [100, 480], [260, 490], [30, 400], [335, 420]].map(([x, y], i) => <Spark key={i} x={x} y={y} s={0.6 + (i % 3) * 0.35} fill={i % 2 ? '#FFFFFF' : p.accent} />)}
      <Path d="M60 506 Q180 470 300 506" fill="none" stroke={p.accent} strokeWidth={1.6} />
      <Path d="M80 516 Q180 486 280 516" fill="none" stroke={p.soft} strokeWidth={1} opacity={0.8} />
    </G>
  );
}

function Frame({ p }: { p: Palette }) {
  const c = (x: number, y: number, sx: number, sy: number) => <Path d={`M${x} ${y + 30 * sy} L${x} ${y} L${x + 30 * sx} ${y}`} fill="none" stroke={p.accent} strokeWidth={2.2} />;
  return (
    <G>
      <Rect x={14} y={14} width={W - 28} height={H - 28} fill="none" stroke={p.accent} strokeWidth={1} />
      <Rect x={22} y={22} width={W - 44} height={H - 44} fill="none" stroke={p.accent} strokeWidth={0.6} opacity={0.6} />
      {c(10, 10, 1, 1)}{c(350, 10, -1, 1)}{c(10, 530, 1, -1)}{c(350, 530, -1, -1)}
      <Circle cx={180} cy={300} r={120} fill="none" stroke={p.soft} strokeWidth={1} opacity={0.5} />
      <Polygon points="180,484 188,492 180,500 172,492" fill={p.accent} /><Line x1={120} y1={492} x2={166} y2={492} stroke={p.accent} strokeWidth={1} /><Line x1={194} y1={492} x2={240} y2={492} stroke={p.accent} strokeWidth={1} />
      <Polygon points="180,40 188,48 180,56 172,48" fill={p.accent} />
    </G>
  );
}

const MOTIFS: Record<Motif, (p: { p: Palette }) => React.JSX.Element> = {
  marigold: Marigold, roses: Roses, arch: Arch, mehendi: Mehendi, lilies: Lilies, peacock: Peacock, rings: Rings, moon: Moon,
  balloons: Balloons, house: House, diya: Diya, baby: Baby, stars: Stars, frame: Frame,
};
export function Motif({ motif, p }: { motif: Motif; p: Palette }) {
  const C = MOTIFS[motif];
  return <C p={p} />;
}

/** Small ornament divider (line – heart – line). */
export function Divider({ y, p }: { y: number; p: Palette }) {
  return (
    <G>
      <Line x1={110} y1={y} x2={166} y2={y} stroke={p.accent} strokeWidth={1} opacity={0.7} />
      <Line x1={194} y1={y} x2={250} y2={y} stroke={p.accent} strokeWidth={1} opacity={0.7} />
      <Heart x={180} y={y - 1} s={0.5} fill={p.accent} />
    </G>
  );
}
