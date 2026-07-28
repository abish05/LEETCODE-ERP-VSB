import { writeFileSync } from "node:fs";

const RED = "#E2231A";
const YEL = "#FFDD00";

const W = 700, H = 700;
const CX = 350, CY = 310;

const R_OUTER = 300;   // yellow disc
const R_RING = 274;    // inner red hairline on the yellow band
const R_WHITE = 216;   // white inner disc
const R_TEETH = 168;   // gear tooth tip
const R_GEAR = 150;    // gear body
const R_HUB = 112;     // white hub inside the gear

// Polar → cartesian. `a` in degrees, measured counter-clockwise from +x, y-up.
const pt = (r, a) => [
  +(CX + r * Math.cos((a * Math.PI) / 180)).toFixed(2),
  +(CY - r * Math.sin((a * Math.PI) / 180)).toFixed(2),
];

/** Arc path between two angles. dir 1 = visually clockwise (sweep-flag 1). */
function arc(r, a0, a1, dir) {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  const span = dir === 1 ? (a0 - a1 + 360) % 360 : (a1 - a0 + 360) % 360;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${span > 180 ? 1 : 0} ${dir} ${x1} ${y1}`;
}

// ── Gear teeth ────────────────────────────────────────────────────────
const TEETH = 12;
let teeth = "";
for (let i = 0; i < TEETH; i++) {
  const c = (360 / TEETH) * i;
  const half = 11; // angular half-width of a tooth, degrees
  const p = [
    pt(R_GEAR - 6, c - half - 3),
    pt(R_TEETH, c - half + 2),
    pt(R_TEETH, c + half - 2),
    pt(R_GEAR - 6, c + half + 3),
  ];
  teeth += `<path d="M ${p[0]} L ${p[1]} L ${p[2]} L ${p[3]} Z"/>`;
}

// ── Laurel wreath on the lower yellow band ────────────────────────────
const LEAF_R = 257;
let wreath = "";
for (const side of [-1, 1]) {
  for (let i = 0; i < 6; i++) {
    const a = 270 + side * (10 + i * 9.2); // fan out from bottom-centre
    const [x, y] = pt(LEAF_R, a);
    // Leaf points outward-along the band, tilted away from centre.
    const rot = -(a - 270) * side * 0 + (270 - a) + (side === 1 ? -118 : -62);
    wreath += `<g transform="translate(${x} ${y}) rotate(${rot.toFixed(1)}) scale(${(1 - i * 0.045).toFixed(3)})"><path d="M 0 0 C 9 -15 30 -19 41 -9 C 31 6 10 9 0 0 Z" fill="${YEL}" stroke="${RED}" stroke-width="4.5" stroke-linejoin="round"/></g>`;
  }
}
// Stem running under the leaves.
const stemL = arc(LEAF_R - 16, 208, 268, 0);
const stemR = arc(LEAF_R - 16, 272, 332, 0);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="vsbTitle">
  <title id="vsbTitle">V.S.B. College of Engineering Technical Campus, Coimbatore</title>

  <defs>
    <path id="vsbArcTop" d="${arc(248, 196, -16, 1)}"/>
        <g id="vsbDiya">
      <path d="M -24 10 C -24 -4 24 -4 24 10 C 24 21 -24 21 -24 10 Z" fill="${YEL}" stroke="${RED}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M -33 21 L 33 21" stroke="${RED}" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M 0 -6 C -10 -17 -6 -32 0 -39 C 6 -32 10 -17 0 -6 Z" fill="${YEL}" stroke="${RED}" stroke-width="4.5" stroke-linejoin="round"/>
    </g>
  </defs>

  <!-- Seal body -->
  <circle cx="${CX}" cy="${CY}" r="${R_OUTER}" fill="${YEL}"/>
  <circle cx="${CX}" cy="${CY}" r="${R_OUTER}" fill="none" stroke="${RED}" stroke-width="9"/>
  <circle cx="${CX}" cy="${CY}" r="${R_RING}" fill="none" stroke="${RED}" stroke-width="6"/>
  <circle cx="${CX}" cy="${CY}" r="${R_WHITE}" fill="#FFFFFF"/>

  <!-- College name, curved across the top of the band -->
  <text fill="${RED}" font-family="'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif" font-weight="900" font-size="29" letter-spacing="0.4">
    <textPath href="#vsbArcTop" startOffset="50%" text-anchor="middle">V.S.B.COLLEGE OF ENGINEERING TECHNICAL CAMPUS</textPath>
  </text>

  <!-- Gear -->
  <g fill="${RED}">${teeth}</g>
  <circle cx="${CX}" cy="${CY}" r="${R_GEAR}" fill="${RED}"/>
  <circle cx="${CX}" cy="${CY}" r="${R_HUB}" fill="#FFFFFF"/>

  <!-- Three-sector divider -->
  <g stroke="${RED}" stroke-width="5.5" stroke-linecap="round">
    <line x1="${CX}" y1="${CY}" x2="${pt(R_HUB, 90)[0]}" y2="${pt(R_HUB, 90)[1]}"/>
    <line x1="${CX}" y1="${CY}" x2="${pt(R_HUB, -30)[0]}" y2="${pt(R_HUB, -30)[1]}"/>
    <line x1="${CX}" y1="${CY}" x2="${pt(R_HUB, 210)[0]}" y2="${pt(R_HUB, 210)[1]}"/>
  </g>

  <!-- Computer — upper-left sector -->
  <g transform="translate(${CX - 56} ${CY - 44}) scale(0.62)" fill="none" stroke="${RED}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
    <rect x="-46" y="-52" width="92" height="66" rx="6"/>
    <rect x="-31" y="-39" width="62" height="40" rx="3"/>
    <path d="M -13 14 L -13 28 L 13 28 L 13 14"/>
    <rect x="-58" y="28" width="116" height="26" rx="5"/>
    <g stroke-width="7"><path d="M -46 36 L -32 36 M -22 36 L -8 36 M 2 36 L 16 36 M 26 36 L 40 36 M -46 46 L -32 46 M -22 46 L -8 46 M 2 46 L 16 46 M 26 46 L 40 46"/></g>
  </g>

  <!-- Transmission tower and instructor — upper-right sector -->
  <g transform="translate(${CX + 42} ${CY - 50}) scale(0.64)" fill="none" stroke="${RED}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">
    <path d="M -36 62 L -15 -40 L 15 -40 L 36 62"/>
    <path d="M -30 32 L 30 32 M -23 2 L 23 2 M -19 -20 L 19 -20"/>
    <path d="M -30 32 L 23 2 M 30 32 L -23 2 M -23 2 L 19 -20 M 23 2 L -19 -20"/>
    <path d="M -19 -20 L 0 -40 L 19 -20"/>
    <path d="M 0 -40 L 0 -58"/>
    <circle cx="-2" cy="-72" r="11"/>
    <path d="M -2 -61 L -2 -46"/>
    <path d="M -2 -56 L 38 -84"/>
  </g>

  <!-- Satellite dish — lower sector -->
  <g transform="translate(${CX} ${CY + 78}) scale(0.66)" fill="none" stroke="${RED}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">
    <ellipse cx="0" cy="-34" rx="54" ry="35" transform="rotate(-28 0 -34)"/>
    <path d="M 0 -34 L 24 -55" stroke-width="7"/>
    <circle cx="28" cy="-59" r="7" fill="${RED}"/>
    <path d="M -10 -8 L -10 22 M -10 22 L -36 40 L 16 40 L -10 22 Z"/>
    <path d="M -50 54 L 50 54" stroke-width="10"/>
  </g>

  <!-- City -->
  <text x="${CX}" y="${CY + 178}" fill="${RED}" font-family="'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif" font-weight="900" font-size="27" text-anchor="middle">Coimbatore - 642109</text>

  <!-- Laurel wreath -->
  <g fill="none" stroke="${RED}" stroke-width="5" stroke-linecap="round"><path d="${stemL}"/><path d="${stemR}"/></g>
  ${wreath}

  <!-- Lamps -->
  <g transform="translate(${pt(236, 212)[0]} ${pt(236, 212)[1]})"><use href="#vsbDiya"/></g>
  <g transform="translate(${pt(236, -32)[0]} ${pt(236, -32)[1]})"><use href="#vsbDiya"/></g>

  <!-- Motto ribbon -->
  <g>
    <path d="M 6 586 L 82 586 L 60 622 L 82 658 L 6 658 Z" fill="${YEL}" stroke="${RED}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M 694 586 L 618 586 L 640 622 L 618 658 L 694 658 Z" fill="${YEL}" stroke="${RED}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M 64 582 C 230 556 470 556 636 582 L 636 658 C 470 632 230 632 64 658 Z" fill="${YEL}" stroke="${RED}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M 68 612 l 8 -14 l 8 14 l 15 2 l -11 11 l 3 15 l -15 -8 l -15 8 l 3 -15 l -11 -11 Z" fill="${RED}"/>
    <path d="M 612 612 l 8 -14 l 8 14 l 15 2 l -11 11 l 3 15 l -15 -8 l -15 8 l 3 -15 l -11 -11 Z" fill="${RED}"/>
    <text x="350" y="630" fill="${RED}" font-family="'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif" font-weight="900" font-size="26" text-anchor="middle">HARD WORK IS KEY TO SUCCESS</text>
  </g>
</svg>
`;

writeFileSync(process.argv[2], svg);
console.log("wrote", process.argv[2], svg.length, "bytes");
