'use strict';

/* The hours theme's plate: a pixel-art landscape under the sky over Paris at the true hour. A
   castle on a rock above a lake, mountains, a forest edge; in front, a knight resting at a bonfire
   and a wizard who holds the menu (the .tabs box is placed over his hat through --wiz-x/--wiz-y).
   Loaded by script.js with the theme: window.Hours.start({ plate, sky, reduceMotion }), then
   update() once a minute.

   The scene is generated once per size (seeded: every visit sees the same place) as seven planes
   of palette indices, sky to foreground, each a little wider than the screen; the pointer slides
   them by amounts that grow with nearness (parallax), the meadow sheared from the hill's rate at
   its top to the foreground's at the bottom so the path never breaks. The palette follows the
   sun's altitude (keyframes below, interpolated), so the same pixels pass from noon to night.
   Fine detail is kept for the near planes and thins out with distance, as in landscape painting.
   Per frame, on top: stars, sun, moon, clouds, birds, a dragon now and then, the castle's life
   (windows, pennants, torches, sentries, chimney smoke), the lake's reflection, butterflies or
   fireflies, the characters, the fire (smoothed cellular automaton), embers, wind in the tall
   grass, firelight. */

(function () {
  const FPS_MS = 83; // ~12 frames a second: pixel fire looks right at that rate
  const deg = Math.PI / 180;
  const PARALLAX = 7; // scene px the nearest plane moves, pointer at an edge
  const MARGIN = 9; // each plane overhangs the screen by this much on both sides

  // planes, back to front, and their parallax rates (GROUND is sheared: see groundOff)
  const L = { SKY: 0, FAR: 1, NEAR: 2, TREES: 3, MID: 4, GROUND: 5, FG: 6 };
  const RATE = [0, 0.1, 0.2, 0.3, 0.45, 0.45, 1.15];
  const GROUND_END = 0.9; // the meadow's rate at the bottom edge
  const CLEAR = 255; // transparent in a plane

  /* ---- palette -------------------------------------------------------- */

  // [name, daylight colour, aerial-perspective depth (0 near, 1 = the horizon's colour)]
  const SURFACES = [
    ['CLOUD', '#f6f9fb', 0], ['CLOUD_SH', '#bfd3e3', 0],
    ['MT_FAR', '#8aa0b6', 0.5], ['MT_FAR_SH', '#667c96', 0.5], ['SNOW', '#f2f6fa', 0.35], ['SNOW_SH', '#b4c4d6', 0.35],
    ['MT_NEAR', '#5f8486', 0.3], ['MT_NEAR_SH', '#46656c', 0.3],
    ['TREES_FAR', '#3d6a58', 0.25], ['TREES_FAR_SH', '#2c5446', 0.25],
    ['HILL', '#5a9a4e', 0.1], ['HILL_SH', '#3c7444', 0.1], ['HILL_HI', '#7db55e', 0.1],
    ['ROCK_HI', '#c2b8a4', 0.1], ['ROCK', '#968c7c', 0.1], ['ROCK_SH', '#6a6258', 0.1], ['ROCK_DK', '#443e38', 0.1],
    ['WALL_HI', '#e2cfb6', 0.1], ['WALL', '#bba28c', 0.1], ['WALL_SH', '#8c7666', 0.1], ['WALL_DK', '#5a4a46', 0.1],
    ['ROOF_HI', '#cc5c58', 0.1], ['ROOF', '#a3404a', 0.1], ['ROOF_SH', '#702c3a', 0.1],
    ['SLATE_HI', '#7e90b8', 0.1], ['SLATE', '#55618a', 0.1], ['SLATE_SH', '#3a4262', 0.1],
    ['DOME_HI', '#8fd0b8', 0.1], ['DOME', '#5aa08a', 0.1], ['DOME_SH', '#3a6e62', 0.1],
    ['TIMBER_HI', '#b0885a', 0.1], ['TIMBER', '#7e5a38', 0.1], ['TIMBER_SH', '#553a24', 0.1],
    ['WIN_DARK', '#2e2836', 0.1], ['WIN_LIT', '#2e2836', 0.1],
    ['BANNER', '#b82a2a', 0.1], ['BANNER_SH', '#7a1a22', 0.1], ['BANNER_GOLD', '#e8b840', 0.1],
    ['IVY', '#4f8a3e', 0.1], ['IVY_SH', '#36622e', 0.1],
    ['FLAG', '#c8302a', 0.1], ['FLAG2', '#2f50b0', 0.1], ['FLAG3', '#e8b840', 0.1],
    ['GUARD', '#3a3a50', 0.1], ['GUARD_HI', '#8a3030', 0.1],
    ['WATER', '#3c6a8a', 0], ['WATER_HI', '#6a9ab0', 0], ['MUD', '#5a4a3a', 0], ['REED', '#6a8a3a', 0], ['REED_SH', '#45602a', 0],
    ['PATH_HI', '#e2c39a', 0.02], ['PATH', '#cfa77e', 0.02], ['PATH_SH', '#a5805e', 0.02],
    ['PINE', '#2f6650', 0.06], ['PINE_SH', '#1f4a3e', 0.06], ['PINE_HI', '#46845e', 0.06],
    ['BUSH', '#3f7a3a', 0], ['BUSH_SH', '#2c5a2c', 0], ['BUSH_HI', '#5e9a48', 0],
    ['GRASS', '#467a3e', 0], ['GRASS_SH', '#335f34', 0], ['GRASS_HI', '#629548', 0], ['GRASS_LT', '#86b856', 0],
    ['FL_RED', '#e04848', 0], ['FL_YEL', '#f2d24a', 0], ['FL_WHITE', '#f4f0e8', 0], ['FL_BLUE', '#7a96f0', 0],
    ['FL_VIOLET', '#a070d0', 0],
    ['MOSS', '#6a9a3a', 0], ['MOSS_HI', '#9ac050', 0],
    ['CAP', '#d03a30', 0], ['CAP_SH', '#8a2228', 0], ['CAP_BR', '#9a6a3e', 0], ['STEM', '#f0e6d0', 0],
    ['FERN', '#4e8c3a', 0], ['FERN_SH', '#33602a', 0],
    ['DIRT', '#7a5c44', 0], ['DIRT_SH', '#5a4232', 0],
    ['STONE_HI', '#b4b2b8', 0], ['STONE', '#8c8a90', 0], ['STONE_SH', '#5e5c68', 0],
    ['BLADE', '#d0d4dc', 0], ['BLADE_SH', '#828896', 0], ['HILT', '#6a4a2a', 0],
    ['FG_PINE_HI', '#2a4e40', 0], ['FG_PINE', '#1c3b33', 0], ['FG_PINE_SH', '#122a26', 0],
    ['OUTLINE', '#16121c', 0], ['CREAM', '#fff6dc', 0],
    // heraldic tinctures (_tools/arms.txt letters O A G B V S)
    ['T_OR', '#e8b840', 0], ['T_ARGENT', '#f0f0f0', 0], ['T_GULES', '#c0302a', 0], ['T_AZURE', '#2f50b0', 0],
    ['T_VERT', '#2f7a3a', 0], ['T_SABLE', '#1e1e26', 0],
    ['T_PRUNE', '#63003c', 0], ['T_BORDEAUX', '#8a1538', 0], ['T_NAVY', '#1d2a57', 0], ['T_BRIGHT', '#2a6fd0', 0],
    ['FURROW', '#9a7048', 0.08], ['FURROW_SH', '#74523a', 0.08], ['WHEAT', '#e2c050', 0.08], ['WHEAT_SH', '#b8962e', 0.08],
    ['SNOWFIELD', '#e8eef4', 0.08], ['BLOSSOM', '#f4b8c8', 0], ['LEAF', '#d07a2a', 0], ['LEAF2', '#e8b03a', 0],
    // the countryside: broadleaf trees through the seasons, vines, thatch, willow, water lilies
    ['OAK_HI', '#74b04e', 0.06], ['OAK', '#4f8c3c', 0.06], ['OAK_SH', '#356a32', 0.06],
    ['RUST_HI', '#eaa040', 0.06], ['RUST', '#c86a2a', 0.06], ['RUST_SH', '#8e4626', 0.06],
    ['BARK', '#5e4838', 0.06], ['BIRCH', '#e8e4d8', 0.06],
    ['VINE', '#5f8e36', 0.1], ['VINE_AUT', '#b85a2a', 0.1], ['GRAPE', '#5a2c5e', 0.1],
    ['THATCH', '#c9a252', 0.1], ['THATCH_SH', '#97752f', 0.1],
    ['WILLOW_HI', '#b0cc66', 0], ['WILLOW', '#7ea44c', 0], ['WILLOW_SH', '#577c3a', 0],
    ['LILY', '#4f8c3e', 0], ['LILY_FL', '#f6c4d4', 0],
    // inside the castle
    ['PLASTER_HI', '#e2d6b8', 0], ['PLASTER', '#cdbf9e', 0], ['PLASTER_SH', '#ad9e7e', 0],
    ['LIME_HI', '#ece8dc', 0], ['LIME', '#d8d2c2', 0], ['LIME_SH', '#b8b0a0', 0],
    ['BRICK_HI', '#a85a40', 0], ['BRICK', '#8a4632', 0], ['BRICK_SH', '#6a3426', 0],
    ['CORK', '#d0a46a', 0], ['CORK_SH', '#9a7046', 0], ['SLATEB', '#2b312d', 0], ['SLATEB_HI', '#3a423c', 0],
  ];
  // sprite materials: letter -> [name, highlight, mid, shadow]; _tools/icons.py shades the icons
  // with the same rule and colours
  const MATS = {
    a: ['ARM', '#e8ecf2', '#a9b1be', '#666e80'], r: ['CLOTH', '#d04a3a', '#a02a2a', '#681826'],
    d: ['CLOAK', '#565c78', '#363a52', '#202234'], w: ['WOOD', '#a8743e', '#7e5230', '#553620'],
    g: ['GOLD', '#f6d77a', '#d8a838', '#9a6a1e'], h: ['LEATHER', '#8a5a3a', '#6a4028', '#462a1a'],
    u: ['ROBE', '#5a7ee0', '#2f50b0', '#1c2f72'], p: ['HAT', '#7a6a8a', '#58486a', '#3a2e4a'],
    f: ['SKIN', '#f0c8a0', '#d89c74', '#a8704e'], e: ['BEARD', '#ffffff', '#dcd8d0', '#a29e98'],
    x: ['DRAKE', '#f0604a', '#c8302a', '#82202a'], z: ['WING', '#6a90f0', '#3058c0', '#1e3478'],
    n: ['RAVEN', '#6a6a90', '#3a3a58', '#22223a'], b: ['BLACKFUR', '#4a4a5e', '#2c2c38', '#18181f'],
    q: ['WHITEFUR', '#ffffff', '#e6e2da', '#b6b0a6'], t: ['TABBY', '#d8a868', '#a87a48', '#6e4a2a'],
  };
  const ALIAS = { l: 'a', m: 'a', v: 'u', o: 'h' }; // same material, separate part: the seam is shaded
  const FLAT = { k: 'OUTLINE', '*': 'ORB', y: 'GOLD_HI', c: 'CREAM', E: 'EYE' };
  const EMISSIVE = { ORB: '#c8fbff', EYE: '#dcf05a' }; // cats' eyes shine, in any light

  // sky stops come first: stars, sun, moon and clouds draw only on those indices
  const N_SKY = 5;
  const NAMES = ['SKY0', 'SKY1', 'SKY2', 'SKY3', 'SKY4', ...SURFACES.map((s) => s[0])];
  Object.values(MATS).forEach(([n]) => NAMES.push(`${n}_HI`, n, `${n}_SH`));
  NAMES.push(...Object.keys(EMISSIVE));
  const I = Object.fromEntries(NAMES.map((n, i) => [n, i]));
  const DAYLIGHT = NAMES.map(() => '#000000'); // each index's own colour, before any light
  SURFACES.forEach(([n, h]) => { DAYLIGHT[I[n]] = n === 'WIN_LIT' ? '#ffb048' : h; });
  Object.values(MATS).forEach(([n, hi, mid, sh]) => { DAYLIGHT[I[`${n}_HI`]] = hi; DAYLIGHT[I[n]] = mid; DAYLIGHT[I[`${n}_SH`]] = sh; });
  Object.entries(EMISSIVE).forEach(([n, h]) => { DAYLIGHT[I[n]] = h; });
  const FAR = I.MT_NEAR_SH; // firelight skips the sky, the clouds and the mountains
  const CASTLE = new Set(['WALL_HI', 'WALL', 'WALL_SH', 'WALL_DK', 'ROOF_HI', 'ROOF', 'ROOF_SH', 'SLATE_HI', 'SLATE',
    'SLATE_SH', 'DOME_HI', 'DOME', 'DOME_SH', 'TIMBER_HI', 'TIMBER', 'TIMBER_SH', 'BANNER', 'BANNER_SH', 'BANNER_GOLD',
    'IVY', 'IVY_SH', 'WIN_DARK', 'WIN_LIT'].map((n) => I[n]));

  // [sun altitude (deg), sky stops top -> horizon, ambient light (multiplies daylight), fog]
  const KEYS = [
    [-14, ['#0b1024', '#0f1830', '#14223e', '#1b3048', '#24405a'], [0.3, 0.38, 0.6], 0.5],
    [-7, ['#121838', '#1c2650', '#2a3a66', '#3e4f7a', '#5c6a8c'], [0.4, 0.42, 0.66], 0.8],
    [-2, ['#22244a', '#3a2d5c', '#5e3058', '#93404a', '#d36a42'], [0.68, 0.46, 0.56], 1],
    [5, ['#3a6ab0', '#5e8cc8', '#9cb4d4', '#e8c09a', '#f7d79c'], [1.04, 0.9, 0.74], 1],
    [18, ['#2f7fd8', '#4a9be8', '#6fb5f0', '#a0d0f4', '#d2ebf8'], [1, 1, 1], 1],
  ];

  // fire levels, 0 empty
  const FIRE = ['', '#4a1610', '#7a2418', '#b8341e', '#e85a24', '#f88a2e', '#fbbf45', '#fff0a8'];
  const FIRE_MAX = FIRE.length - 1;

  /* ---- sprites: silhouettes in material letters, shaded and outlined by shadeSprite ---- */

  const KNIGHT = `
............rr..............
...........rrr..............
..........aaaaa.............
.........aaaaaaa............
.........aaaaaaaa...........
.........aaaaakkkk..........
.........aaaaaaaaa..........
.........aaaaaakaka.........
..........aaaaaaaa..........
...........kkkkkk...........
.......ddddrrllllrr.........
......ddddrrlllllrrr........
......dddrrrlllllrrrr.......
.....ddddrrrrlllllrrr.......
.....ddddrrrrrlllllrr.......
.....ddddrrrrrrllllllll.....
.....ddddrrrgrrrlllllllll...
.....ddddrrgggrrr..llllllhh.
....dddddrrrgrrrr....mmmhhh.
....ddddgggggggmmmmmmmmmmm..
....ddddmmmmmmmmmmmmmmmmmm..
...wwwwwwwwwwwwwwww...mmmm..
...wwwwwwwwwwwwwwww...mmmm..
...wwwwwwwwwwwwwwww...mmmm..
....wwwwwwwwwwwwww....mmmm..
......................mmmm..
......................mmmmm.
......................mmmmmmm`;
  const KNIGHT_HEAD = 11; // rows (outline included) above the shoulders: they sink as he breathes

  const WIZARD = `
....p..............
....pp.........*...
....ppp.......***..
...pppp........*...
...ppypp.......w...
...pppppp......w...
..ppppppp......w...
..pppppppp.....w...
ppppppppppppp..w...
...ffffff......w...
...ffffkf......w...
...eefffff.....w...
..eeeeeeee....fw...
..eeeeeeeevvvvvw...
.uueeeeeeevvvv.w...
.uuueeeeeevv...w...
.uuuueeeeeu....w...
.uuuuueeeuu....w...
.uuuuuueeuu....w...
.uuuuuuuuuu....w...
.uuuugggguu....w...
.uuuuuuuuuu....w...
uuuuyuuuuuu....w...
uuuuuuuuuuuu...w...
uuuuuuuuuuuu...w...
uuuuuuuuuyuu...w...
uuuuuuuuuuuuu..w...
uuuuuuuuuuuuu..w...
.uuuuuuuuuuuu..w...
..hhh....hhh...w...`;
  const ORB = [16, 3]; // the staff's orb in the shaded wizard

  // the countryside's animals (h brown, b black, t fawn, q white, a grey, k outline, g gold)
  const HORSE = [`
.........................................
..............hhhhhhhhhhhhhhhhhhh........
.............hhhhhhhhhhhhhhhhhhhhhh..bb..
............bhhhhhhhhhhhhhhhhhhhhhhh.bb..
...........bhhhhhhhhhhhhhhhhhhhhhhhh.bb..
..........bhhhhhhhhhhhhhhhhhhhhhhhhh.bb..
.........bhhhhhhhhhhhhhhhhhhhhhhhhhh.bb..
........bhhhhhhhhhhhhhhhhhhhhhhhhhhhhbb..
.......bhhhhhhhhhhhhhhhhhhhhhhhhhhhhh.bb.
......bhhhhhh.hhhhhhhhhhhhhhhhhhhhhhh.bb.
.....bbhhhhhh.hhhhhhhhhhhhhhhhhhhhhhh.bb.
.....bhhhhhh...hhhhhhhhhhhhhhhhhhhhhh.bb.
....hhhhhhh.....oo.oo.........hhhhhh..bb.
...hhhhhhhh.....oo.oo..........hhhhh..bb.
..bhhhhhhh......oo.oo..........hhhhh...bb
.bhhhhhhh.......oo.oo..........oohoo...bb
..hhhhhhh.......oo.oo..........oo.oo...bb
.hhhhhhh........oo.oo..........oo.oo...bb
.hhhhh..........oo.oo..........oo.oo...bb
.hhhkh..........oo.oo..........oo.oo.....
.hhhhh..........oo.oo..........oo.oo.....
hhhhhh..........oo.oo..........oo.oo.....
hhhhh...........oo.oo..........oo.oo.....
hhhhh...........oo.oo..........oo.oo.....
.hhhh...........oo.oo..........oo.oo.....
.hhhh...........oo.oo..........oo.oo.....
................oo.oo..........oo.oo.....
................kk.kk..........kk.kk.....
.........................................`,
`
.........................................
..............hhhhhhhhhhhhhhhhhhh........
.............hhhhhhhhhhhhhhhhhhhhhh..bb..
............bhhhhhhhhhhhhhhhhhhhhhhh.bb..
...........bhhhhhhhhhhhhhhhhhhhhhhhh.bb..
..........bhhhhhhhhhhhhhhhhhhhhhhhhh.bb..
.........bhhhhhhhhhhhhhhhhhhhhhhhhhh.bb..
........bhhhhhhhhhhhhhhhhhhhhhhhhhhhhbb..
.......bhhhhhhhhhhhhhhhhhhhhhhhhhhhhh.bb.
......bhhhhhh.hhhhhhhhhhhhhhhhhhhhhhh..bb
.....bbhhhhhh.hhhhhhhhhhhhhhhhhhhhhhh..bb
.....bhhhhhh...hhhhhhhhhhhhhhhhhhhhhh..bb
....hhhhhhh.....oo.oo.........hhhhhh...bb
...hhhhhhhh.....oo.oo..........hhhhh...bb
..bhhhhhhh......oo.oo..........hhhhh....b
.bhhhhhhh.......oo.oo..........oohoo....b
..hhhhhhh.......oo.oo..........oo.oo....b
.hhhhhhh........oo.oo..........oo.oo....b
.hhhhh..........oo.oo..........oo.oo....b
.hhhkh..........oo.oo..........oo.oo.....
.hhhhh..........oo.oo..........oo.oo.....
hhhhhh..........oo.oo..........oo.oo.....
hhhhh...........oo.oo..........oo.oo.....
hhhhh...........oo.oo..........oo.oo.....
.hhhh...........oo.oo..........oo.oo.....
.hhhh...........oo.oo..........oo.oo.....
................oo.oo..........oo.oo.....
................kk.kk..........kk.kk.....
.........................................`];
  const DEER = [`
.........t..
........ttt.
........tktt
.......tt...
.qtttttttt..
qtttttttttt.
.tttttttt...
.t.t...t.t..
.t.t...t.t..
.k.k...k.k..`, `
............
............
............
............
.qtttttttt..
qtttttttttt.
.tttttttt.t.
.t.t...t.ttk
.t.t...t.ttt
.k.k...k.k..`];
  const OWL = `
.h.h.
hhhhh
tEhEt
hhghh
htttt
.hhh.
.g.g.`;
  const HERON = `
...kaa.
gggaaa.
....aa.
.....a.
.....a.
....aa.
...aaaa
..aaaaa
..aaaaa
...aaa.
...k.k.
...k.k.
...k.k.`;
  const MINSTREL = `
..rr.....
.rppr....
..ff.....
..fkf....
..ff.....
.uuuu....
uuuuuwww.
uuuuwwgww
.uuu..ww.
.uuu.....
.dd.dd...
.dd.dd...
.kk.kk...`;
  const ANGLER = `
..hh....
.hhhh...
..ff....
..fk....
.dddd.w.
dddddw..
.ddddd..
.hhhhh..`;
  const SNOWMAN = `
...bbb...
..bbbbb..
.bbbbbbb.
..qqqqq..
..qkqkq..
..qqqxx..
...qqq...
.qqqqqqq.
qqqqkqqqq
qqqqqqqqq
qqqqkqqqq
.qqqqqqq.`;
  const DUCK = `
.hh....
ghkh...
.hhhhhh
..hhhh.`;
  const WIZ_HEAD_X = 9;

  const DRAGON_BODY = `
...................................x....
.................................xxxx...
................................xxxxxx..
..............................xxxxxcxxx.
.................xxxxxxxx....xxxxxxxxxxx
x.............xxxxxxxxxxxxxxxxxxxx..cc..
xx..........xxxxxxxxxxxxxxxxxxxx........
.xx.......xxxxxggggggggggxxxxx..........
..xxxxxxxxxxxggggggggggxxxxx............
...xxxxxxx......xx....xx................
.............xxxx....xxxx...............`;
  const WING_UP = `
..................z
................zzzz
..............zzzzzz
............zzzZzzzz
..........zzzzZzzzzZ
........zzzzzZzzzzZz
......zzzzzzZzzzzZzz
.....zzzzzzZzzzzZzzz
......zzzzZzzzzZzzzz
........zzzzzzzZzzzz
...........zzzzzzzzz`;
  const WING_DOWN = `
...............zzzzzzzzz
..............zzzzzzZzz
..............zzzzzZzzzz
.............zzzzzZzzzZz
............zzzzZzzzZzzz
...........zzzZzzzZzzz
..........zzZzzzZzzz
..........zZzzzZzz
..........zzzzzz
...........zzz`;
  const DRAGON_MOUTH = [41, 13]; // in the shaded frame, facing right

  // the four cats of the camp ('E' are the eyes: they shine and blink) and the rookery's raven
  const CATS = {
    blackLoaf: `
...........b..b
..........bbbbb
...bbbbbbbbEbEb
..bbbbbbbbbbbbb
.bbbbbbbbbbqqb.
bbbbbbbbbbbqqb.
bbbbbbbbbbbbb..
.bbbbbbbbbbbb..
bbbbbbb........`, // white on the throat
    spotted: `
.b..b....
.bbbb....
bEbEq....
qqqqq....
.qqqqb...
.qbbqqq..
qqbbqqqq.
qqqqqbbq.
qqqqqbbqq
qqqqqqqqqb.
.qq.qqqbbbbb`, // white with black patches
    thin: `
b.b...
bbb...
EbE...
bbb...
.b....
.bb...
.bbb..
.bbb..
.bbbb.
.bbbb.b
.b.bbb.`,
    whiteTabby: `
.q.q..........
.qqqq.........
qEqETq........
qqqqqTTqqTqq..
.qqTTqqqqTTqqq
.qqqqqTTqqqqqq
..qq.qq..qq.qT.
............TqT`,
  };
  const RAVEN = `
....nnn.
...nncny
...nnnnyy
..nnnnn.
.nnNnnn.
nnNnnnn.
nNnnnn..
...h.h..`;
  /** Where the eyes ('E') are in a shaded sprite (outline adds one pixel all round). */
  const eyesOf = (text) => text.trim().split('\n').flatMap((r, y) => [...r].map((c, x) => (c === 'E' ? [x + 1, y + 1] : null)).filter(Boolean));

  /* ---- helpers --------------------------------------------------------- */

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const pack = (c) => (255 << 24) | (clamp(Math.round(c[2]), 0, 255) << 16)
    | (clamp(Math.round(c[1]), 0, 255) << 8) | clamp(Math.round(c[0]), 0, 255);
  const unpack = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Smooth 1D value noise in [0, 1], period n. */
  function noise1(rng, n = 64) {
    const t = Array.from({ length: n }, rng);
    return (x) => {
      const i = Math.floor(x); const f = x - i;
      const a = t[((i % n) + n) % n]; const b = t[(((i + 1) % n) + n) % n];
      return a + (b - a) * f * f * (3 - 2 * f);
    };
  }
  function fbm(rng, oct = 4) {
    const ns = Array.from({ length: oct }, () => noise1(rng));
    return (x) => {
      let s = 0; let a = 1; let w = 0;
      for (let k = 0; k < oct; k += 1) { s += a * ns[k](x * 2 ** k); w += a; a /= 2; }
      return s / w;
    };
  }

  /** Shaded sprite from a silhouette: each material is lit on the side facing the fire (+x) and,
   *  dithered, on top; shaded on the far side and underneath. Seams between parts and a 1 px
   *  outline come out of the same rule. Returns { w, h, px }, px = palette index or -1. */
  function shadeSprite(text) {
    const rows = text.trim().split('\n');
    const w0 = Math.max(...rows.map((r) => r.length));
    const h0 = rows.length;
    const at = (x, y) => (y >= 0 && y < h0 && x >= 0 && x < rows[y].length ? rows[y][x] : '.');
    const w = w0 + 2; const h = h0 + 2;
    const px = new Int16Array(w * h).fill(-1);
    for (let y = -1; y <= h0; y += 1) {
      for (let x = -1; x <= w0; x += 1) {
        const c = at(x, y);
        let v = -1;
        if (c === '.') {
          if (NEIGH.some(([dx, dy]) => at(x + dx, y + dy) !== '.')) v = I.OUTLINE;
        } else if (FLAT[c]) {
          v = I[FLAT[c]];
        } else {
          const name = MATS[ALIAS[c.toLowerCase()] || c.toLowerCase()][0];
          const same = (q) => q !== '.' && !FLAT[q] && q.toLowerCase() === c.toLowerCase();
          if (c !== c.toLowerCase()) v = I[`${name}_SH`];
          else if (!same(at(x + 1, y)) || (at(x, y - 1) === '.' && (x + y) % 2 === 0)) v = I[`${name}_HI`];
          else if (!same(at(x - 1, y)) || !same(at(x, y + 1))) v = I[`${name}_SH`];
          else v = I[name];
        }
        px[(y + 1) * w + x + 1] = v;
      }
    }
    return { w, h, px };
  }

  function flip(s) {
    const px = new Int16Array(s.px.length);
    for (let y = 0; y < s.h; y += 1) for (let x = 0; x < s.w; x += 1) px[y * s.w + x] = s.px[y * s.w + s.w - 1 - x];
    return { w: s.w, h: s.h, px };
  }

  /** Lay silhouette `top` over `base` from row dy: behind it (only where base is empty) or in front. */
  function overlay(base, top, dy, behind) {
    const b = base.trim().split('\n'); const t = top.trim().split('\n');
    const h = Math.max(b.length, t.length + dy);
    const w = Math.max(...b.map((r) => r.length), ...t.map((r) => r.length));
    const out = Array.from({ length: h }, (_, y) => (b[y] || '').padEnd(w, '.').split(''));
    t.forEach((r, y) => r.split('').forEach((c, x) => {
      if (c !== '.' && (!behind || out[y + dy][x] === '.')) out[y + dy][x] = c;
    }));
    return out.map((r) => r.join('')).join('\n');
  }

  const SPRITES = {};
  function sprites() {
    if (SPRITES.knight) return;
    SPRITES.knight = shadeSprite(KNIGHT);
    SPRITES.wizard = shadeSprite(WIZARD);
    // the schoolmaster: not the wizard of the camp, a doctor in a red gown and a black cap, his
    // staff a plain pointer with a gilt knob
    SPRITES.master = shadeSprite(WIZARD.replace(/[uv]/g, 'r').replace(/p/g, 'b').replace(/y/g, 'g').replace(/\*/g, 'g'));
    // the body from row 6 of the frame: the raised wing behind it, the lowered one over its belly
    const body = `${'.\n'.repeat(6)}${DRAGON_BODY.trim()}`;
    SPRITES.dragon = [shadeSprite(overlay(body, WING_UP, 0, true)), shadeSprite(overlay(body, WING_DOWN, 13, false))];
    SPRITES.dragonL = SPRITES.dragon.map(flip);
    SPRITES.cats = Object.fromEntries(Object.entries(CATS).map(([k, txt]) => [k, { ...shadeSprite(txt), eyes: eyesOf(txt) }]));
    const lf = SPRITES.cats.blackLoaf; // she faces the fire: mirrored
    SPRITES.cats.blackLoaf = { ...flip(lf), eyes: lf.eyes.map(([x, y]) => [lf.w - 1 - x, y]) };
    SPRITES.raven = shadeSprite(RAVEN);
    SPRITES.peasant = PEASANT.map(shadeSprite);
    SPRITES.horse = HORSE.map(shadeSprite);
    SPRITES.deer = DEER.map(shadeSprite);
    SPRITES.owl = shadeSprite(OWL);
    SPRITES.heron = shadeSprite(HERON);
    SPRITES.duck = shadeSprite(DUCK);
    SPRITES.duckR = flip(SPRITES.duck);
    SPRITES.minstrel = shadeSprite(MINSTREL);
    SPRITES.snowman = shadeSprite(SNOWMAN);
    SPRITES.angler = shadeSprite(ANGLER);
    SPRITES.walkerL = SPRITES.peasant.map(flip);
  }

  /* ---- the scene: seven planes of palette indices, generated once per size ---- */

  function generate(W, H, Ws) {
    sprites();
    const rng = mulberry32(1888);
    const M = MARGIN; const WE = W + 2 * M; // plane width; stage x = M + screen x
    const planes = Array.from({ length: RATE.length }, () => new Uint8Array(WE * H).fill(CLEAR));
    let cur = L.SKY;
    const on = (l) => { cur = l; };
    const set = (x, y, i) => {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && x < WE && y >= 0 && y < H) planes[cur][y * WE + x] = i;
    };
    const get = (x, y, l = cur) => (x >= 0 && x < WE && y >= 0 && y < H ? planes[l][y * WE + x] : CLEAR);
    const rect = (x, y, w, h, i) => {
      for (let yy = Math.round(y); yy < Math.round(y + h); yy += 1) {
        for (let xx = Math.round(x); xx < Math.round(x + w); xx += 1) set(xx, yy, i);
      }
    };
    const u = Math.min(Ws / 125, H / 175); // castle and hill scale, from the visible stage
    const v = u * 0.78; // heights: the castle stands back, under a wide sky

    const yg = Math.round(H * 0.77); // top of the meadow (the GROUND plane)
    const yl0 = yg - Math.max(10, Math.round(H * 0.1)); // top of the lake
    const rockH = Math.round(H * 0.07);
    const crest = yl0 - Math.round(H * 0.12) - rockH; // the castle's foot, on its rock
    const top = crest + rockH; // the hill's summit, at the rock's foot
    const yHor = yl0 - 0.05 * H; // altitude 0, for the sun and the moon
    const cx = M + Math.round(0.64 * Ws);
    const castleW = 46 * u;
    const fire = { x: M + Math.round(0.55 * Ws), y: yg + Math.round((H - yg) * 0.62) };
    const yfg = H - Math.round(H * 0.13); // the foreground strip begins here

    // sky: five stops, solid bands joined by ordered dither
    on(L.SKY);
    for (let y = 0; y < H; y += 1) {
      const g = clamp(y / yHor) * (N_SKY - 1);
      const j = Math.min(N_SKY - 2, Math.floor(g));
      const t = clamp((g - j - 0.3) / 0.5);
      for (let x = 0; x < WE; x += 1) set(x, y, t > bayer(x, y) ? j + 1 : j);
    }

    // mountains: ridged multi-octave noise (sharp crests, a main peak every `span` px), facets
    // lit from the left; gullies are scattered, of random length, and wander as they run down
    function range(y0top, depth, span, light, shade, snowLine) {
      const n = fbm(rng);
      const oct = Array.from({ length: 4 }, () => noise1(rng));
      const ridge = (x) => {
        let s0 = 0; let a = 1; let w = 0;
        for (let k = 0; k < 4; k += 1) { s0 += a * (1 - Math.abs(2 * oct[k](x * 2 ** k) - 1)) ** 1.6; w += a; a *= 0.45; }
        return s0 / w;
      };
      const ys = new Float32Array(WE + 1);
      // stretch the ridge's range so crests are peaks, not a plateau
      for (let x = 0; x <= WE; x += 1) ys[x] = y0top + (1 - clamp((ridge(x / span + 3) - 0.2) / 0.55) ** 1.3) * depth;
      const gully = new Uint8Array(WE * H);
      for (let g = 0; g < WE / 6; g += 1) {
        let gx0 = rng() * WE; const len = 3 + rng() * depth * 0.5;
        const y0 = Math.round(ys[clamp(Math.round(gx0), 0, WE)]) + 2;
        for (let y = y0; y < y0 + len && y < H; y += 1) {
          gx0 += (n(y * 0.3 + g * 7) - 0.5) * 1.6;
          if (rng() < 0.85) gully[y * WE + clamp(Math.round(gx0), 0, WE - 1)] = 1;
        }
      }
      for (let x = 0; x < WE; x += 1) {
        const y0 = Math.round(ys[x]);
        const slope = ys[x + 1] - ys[Math.max(0, x - 1)];
        const snowDepth = snowLine === null ? 0 : (snowLine - y0) * 0.8 + (n(x * 0.9) - 0.5) * 4;
        for (let y = Math.max(0, y0); y < yg; y += 1) {
          // facets run diagonally down from the crests, as rock does, not in vertical bands
          const lit = slope * 1.5 + (n((x - y * 0.9) * 0.11 + 31) - 0.5) * 2.4 + (n((x + y) * 0.07 + 57) - 0.5) * 1.2 > 0;
          const gl = gully[y * WE + x] === 1;
          if (y - y0 < snowDepth + (gl ? 4 : 0)) set(x, y, lit && !gl ? I.SNOW : I.SNOW_SH);
          else set(x, y, lit && !gl ? light : shade);
        }
      }
    }
    // ?season= previews another time of year (screenshots); the month follows it
    const qSeason = new URLSearchParams(location.search).get('season');
    const month = { winter: 0, spring: 4, summer: 6, autumn: 9 }[qSeason] ?? new Date().getMonth(); const season = SEASON(month);
    on(L.FAR); range(yg - 0.6 * H, 0.24 * H, 70, I.MT_FAR, I.MT_FAR_SH, yg - (season === 'winter' ? 0.43 : 0.5) * H);
    on(L.NEAR); range(yg - 0.44 * H, 0.15 * H, 95, I.MT_NEAR, I.MT_NEAR_SH, null);

    // west of the castle, on the near range: a watchtower on the crest (its signal fire burns at night)
    const crestAt = (x) => { for (let y = 0; y < H; y += 1) if (get(x, y, L.NEAR) !== CLEAR) return y; return H; };
    // far off, it is a silhouette in the range's own colours (the haze is on it too), standing on
    // the highest point near its place, its foot sunk in the rock
    const watch = { x: M + Math.round(0.17 * Ws) };
    for (let x = watch.x - 10; x <= watch.x + 10; x += 1) if (crestAt(x) < crestAt(watch.x)) watch.x = x;
    {
      const yb = crestAt(watch.x) + 3; const x0 = watch.x - 2;
      rect(x0, yb - 9, 4, 10, I.ROCK_SH); rect(x0, yb - 9, 1, 10, I.ROCK); rect(x0 + 3, yb - 9, 1, 10, I.ROCK_DK); // shaft, lit on the west
      rect(x0 - 1, yb - 1, 6, 2, I.ROCK_SH); set(x0 - 1, yb - 1, I.ROCK); // its footing in the rock
      set(x0, yb - 10, I.ROCK_SH); set(x0 + 2, yb - 10, I.ROCK_SH); set(x0 + 3, yb - 10, I.ROCK_DK); // merlons
      set(x0 + 1, yb - 6, I.ROCK_DK); // a loophole
      watch.y = yb - 11; // where the fire burns
    }
    const VINES = { autumn: month >= 9 ? [I.VINE_AUT, I.RUST_HI] : [I.VINE, I.GRAPE], summer: [I.VINE, month === 7 ? I.GRAPE : I.VINE],
      spring: [I.VINE, I.OAK_HI], winter: [I.BARK, I.BARK] }[season];
    /** A broadleaf tree (oak, now and then a birch) in the current plane, dressed for the season:
     *  leaves, blossom in spring, rust and gold in autumn, bare branches in winter. */
    function broadleaf(xc, yb, h) {
      const kind = rng(); const birch = kind < 0.2;
      const trunkH = Math.max(2, Math.round(h * 0.38));
      const rx = Math.max(2, h * 0.36); const ry = Math.max(2, h * 0.32); const cy = yb - trunkH - ry + 1;
      for (let y = 0; y < trunkH + (season === 'winter' ? ry : 0); y += 1) set(xc, yb - y, birch && y % 3 !== 1 ? I.BIRCH : I.BARK);
      if (season === 'winter') { // bare: forking branches, a few twigs
        [0.2, 0.55].forEach((f, j) => [-1, 1].forEach((dir) => {
          for (let k = 1; k <= rx * (1 - j * 0.3); k += 1) set(xc + dir * k, Math.round(cy + ry * (0.6 - f) - k * 0.8), I.BARK);
        }));
        return;
      }
      const P = season === 'autumn'
        ? (kind < 0.45 ? [I.RUST_HI, I.RUST, I.RUST_SH] : kind < 0.8 ? [I.LEAF2, I.RUST_HI, I.RUST] : [I.OAK_HI, I.OAK, I.OAK_SH])
        : [I.OAK_HI, I.OAK, I.OAK_SH];
      for (let dy = -Math.ceil(ry); dy <= ry; dy += 1) {
        for (let dx = -Math.ceil(rx); dx <= rx; dx += 1) {
          const x = Math.round(xc + dx); const y = Math.round(cy + dy);
          if ((dx / rx) ** 2 + (dy / ry) ** 2 + (bayer(x, y) - 0.5) * 0.4 > 1) continue; // a lumpy edge
          let c = dx + dy < -rx * 0.3 ? P[0] : dx + dy > rx * 0.35 || dy > ry * 0.45 ? P[2] : P[1];
          if (season === 'spring' && kind > 0.5 && bayer(x, y) < 0.14) c = I.BLOSSOM;
          set(x, y, c);
        }
      }
    }

    // the forest: two rows of small conifers, irregularly spaced and sized, over a dark understorey
    on(L.TREES);
    const tn = fbm(rng, 3);
    [[0.12, 4, 8, I.TREES_FAR, I.TREES_FAR_SH], [0.07, 6, 12, I.PINE, I.PINE_SH]].forEach(([dy, hMin, hMax, lit, sh], row) => {
      const edge = (x) => Math.round(yl0 - dy * H + (tn(x / 40 + row * 9) - 0.5) * 0.06 * H);
      for (let x = 0; x < WE; x += 1) for (let y = edge(x) + 2; y < yg; y += 1) set(x, y, sh);
      for (let x = Math.floor(rng() * 3); x < WE; x += 2 + Math.floor(rng() * 4)) {
        const h = hMin + rng() * (hMax - hMin) * (0.5 + tn(x / 25 + row)); const base = edge(x) + 3;
        if (row === 1 && tn(x / 18 + 40) > 0.55) { broadleaf(x, base, h * 0.85); x += 2; continue; } // groves of broadleaf
        for (let r = 0; r < h; r += 1) {
          const half = (h - r) * 0.3 + (r % 3 === 0 ? 0.6 : 0); // tiers
          for (let dx = -Math.round(half); dx <= Math.round(half); dx += 1) set(x + dx, base - r, dx < 0 || (dx === 0 && r % 2) ? lit : sh);
        }
      }
    });

    // behind the hamlet the forest gives way to a vineyard on the gentle slope: rows of vines
    // across it, green, then grapes in late summer, red-gold in October, bare stakes in winter
    { // a small plot: rows of separate vine stocks over bare earth, wider down the slope, framed by trees
      const xa = M + Math.round(0.06 * Ws); const xb = M + Math.round(0.19 * Ws);
      const top0 = (x) => Math.round(yl0 - 0.12 * H + (tn(x / 40) - 0.5) * 0.06 * H) + 6;
      for (let rw = 0; rw < 4; rw += 1) {
        const inset = (3 - rw) * 3 + Math.round(rng() * 2);
        for (let x = xa + inset; x < xb - inset; x += 1) {
          const y = top0(x) + rw * 3; const k = x - xa;
          if (y + 2 >= yl0 - 9) continue; // the hamlet's roofs below
          set(x, y + 2, I.FURROW_SH);
          if (k % 3 === 2) { set(x, y, I.HILL_SH); set(x, y + 1, I.FURROW_SH); continue; } // between two stocks
          const leaf = season === 'winter' ? I.BARK : (k * 5 + rw) % 7 === 0 ? VINES[1] : (k + rw) % 3 === 0 ? I.VINE : VINES[0];
          set(x, y, leaf); set(x, y + 1, season === 'winter' ? I.FURROW_SH : (k % 3 === 0 ? I.VINE_AUT === leaf ? I.VINE : leaf : leaf));
        }
      }
      for (let x = xa - 3; x < xb + 4; x += 4 + Math.floor(rng() * 4)) { // small conifers along its top
        const h = 5 + Math.floor(rng() * 4); const b = top0(x) - 1;
        for (let rr = 0; rr < h; rr += 1) { const half = Math.round((h - rr) * 0.3); for (let dx = -half; dx <= half; dx += 1) set(x + dx, b - rr, dx < 0 ? I.PINE : I.PINE_SH); }
      }
    }

    /* MID: hill, rock, castle, lake, the upper path, its pines and bushes */
    on(L.MID);
    const hn = fbm(rng); const hn2 = fbm(rng, 3);
    const patch = (n1, n2, x, y) => Math.sqrt(n1(x * 0.21 + y * 0.83) * n2(x * 0.17 - y * 0.71 + 40)) * 1.15; // blotches, no stripes
    const hill = new Float32Array(WE);
    for (let x = 0; x < WE; x += 1) {
      const b = Math.exp(-(((x - cx) / (0.3 * Ws)) ** 2));
      hill[x] = yl0 - 3 - b * (yl0 - 3 - top) + (hn(x / 30) - 0.5) * 5 * u * (1 - b);
    }
    for (let x = 0; x < WE; x += 1) {
      const y0 = Math.round(hill[x]);
      for (let y = y0; y < yg; y += 1) {
        const t = patch(hn, hn2, x, y);
        let c = y === y0 ? I.HILL_HI : t > 0.62 ? I.HILL_SH : (t < 0.22 && bayer(x, y) < 0.5) ? I.HILL_HI : I.HILL;
        if ((x * 3 + y * 7) % 31 === 0 && y > y0 + 1) c = I.HILL_SH; // sparse tufts: it is far
        set(x, y, c);
      }
    }

    // the rock under the castle: warped strata, cracks, lit from the left
    const cracks = new Set(Array.from({ length: Math.round(castleW / 5) }, () => Math.round(cx - castleW / 2 + rng() * castleW)));
    // its flanks wander (one noise per side), strata come in broken lengths, ledges hold grass
    const rl = fbm(rng, 3); const rr = fbm(rng, 3); const st = fbm(rng, 3);
    for (let y = crest; y < yl0; y += 1) {
      const dy = y - crest;
      const a = cx - castleW / 2 - 6 * u - dy * (0.5 + rl(dy * 0.02) * 0.6) - (rl(dy * 0.25 + 5) - 0.5) * 6;
      const b = cx + castleW / 2 + 6 * u + dy * (0.5 + rr(dy * 0.02) * 0.6) + (rr(dy * 0.25 + 5) - 0.5) * 6;
      for (let x = Math.round(a); x <= Math.round(b); x += 1) {
        if (y > hill[clamp(x, 0, WE - 1)] + 2 + hn(x * 0.7) * 3) continue;
        const k = (x - a) / (b - a);
        let c = k < 0.1 ? I.ROCK_HI : k < 0.5 ? I.ROCK : k < 0.93 ? I.ROCK_SH : I.ROCK_DK;
        const stratum = (dy + Math.round(hn(x * 0.08 + 9) * 7)) % 5 === 4 && st(x * 0.15 + dy) > 0.45;
        if (stratum) c = c === I.ROCK_HI ? I.ROCK : I.ROCK_DK;
        if (cracks.has(x + ((y >> 2) & 1)) && rng() < 0.7) c = I.ROCK_DK;
        if (y === crest || x === Math.round(a)) c = I.ROCK_HI;
        set(x, y, c);
        if (stratum && k < 0.75 && rng() < 0.25) set(x, y - 1, rng() < 0.5 ? I.HILL_HI : I.HILL); // a tuft on the ledge
      }
    }

    // a cellar door cut into the rock, left of the stair: the way down (the descent, `>`)
    const cellar = { x: Math.round(cx - castleW * 0.3), y: crest + Math.max(3, Math.round(rockH * 0.35)), w: 5, h: 6 };
    for (let y = 0; y < cellar.h; y += 1) {
      for (let x = 0; x < cellar.w; x += 1) {
        const arch = y === 0 && (x === 0 || x === cellar.w - 1);
        if (!arch) set(cellar.x + x, cellar.y + y, y > cellar.h - 3 && x === y - 2 ? I.ROCK_SH : I.OUTLINE); // dark, a step or two going down
      }
    }
    for (let x = -1; x <= cellar.w; x += 1) set(cellar.x + x, cellar.y - 1, I.ROCK_HI); // its lintel
    set(cellar.x - 1, cellar.y + 2, I.TIMBER); set(cellar.x - 1, cellar.y + 3, I.TIMBER_SH); // a post with a lamp hook

    // the path: from the bottom edge to the foot of the rock, then steps cut up to the gate
    const pathX = new Float32Array(H).fill(-99); const pathW = new Float32Array(H);
    for (let y = top; y < H; y += 1) {
      const t = (H - y) / (H - top); // 0 at the bottom, 1 at the rock
      pathX[y] = M + 0.8 * Ws + (cx + 2 - M - 0.8 * Ws) * t + 0.07 * Ws * Math.sin(t * 5) * (1 - t);
      pathW[y] = Math.max(1, 5 * (1 - t) ** 1.2 + 1);
    }
    function drawPath(y) {
      const xc = pathX[y]; const hw = pathW[y];
      for (let x = Math.floor(xc - hw); x <= Math.ceil(xc + hw); x += 1) {
        const e = Math.abs(x - xc);
        let c = e > hw - 0.8 ? I.PATH_SH : (bayer(x, y) < 0.12 ? I.PATH_SH : (bayer(x + 1, y) < 0.08 ? I.PATH_HI : I.PATH));
        if (y > yg && hw > 3 && rng() < 0.03) c = I.STONE; // pebbles, only near
        set(x, y, c);
      }
    }
    for (let y = top + 2; y < yg; y += 1) drawPath(y);
    for (let y = crest + 1; y < top + 2; y += 1) {
      for (let x = cx - 1; x <= cx + 3; x += 1) set(x, y, (y - crest) % 2 ? I.PATH_HI : I.PATH_SH);
    }

    // the river: across the whole width, its banks wandering and the bed meandering a little;
    // shallows paler at the edges, a muddy near bank, reed clumps; a stone bridge for the path
    const ln = fbm(rng, 3); const ln2 = fbm(rng, 3); const ln3 = fbm(rng, 3);
    const bend = (x) => Math.round((ln3(x * 0.015) - 0.5) * 5);
    const riverTop = (x) => Math.round(yl0 + 1 + ln(x * 0.06) * 2.5) + bend(x);
    const ln4 = fbm(rng, 2);
    const riverBot = (x) => Math.round(yg - 3 - ln2(x * 0.05) * 3 - (ln4(x * 0.02) < 0.35 ? 3 : 0)) + bend(x); // narrows here and there
    const islet = { x: M + Math.round(0.3 * Ws), y: 0, rx: 8, ry: 2 };
    islet.y = Math.round((riverTop(islet.x) + riverBot(islet.x)) / 2);
    const onIslet = (x, y) => ((x - islet.x) / islet.rx) ** 2 + ((y - islet.y) / islet.ry) ** 2 < 1;
    const isWater = (x, y) => y >= riverTop(x) && y <= riverBot(x) && !onIslet(x, y);
    for (let x = 0; x < WE; x += 1) {
      for (let y = riverTop(x); y <= riverBot(x); y += 1) {
        const edge = !isWater(x, y - 1) || !isWater(x, y + 1) || !isWater(x, y + 2);
        set(x, y, edge && bayer(x, y) < 0.7 ? I.WATER_HI : I.WATER);
      }
      const yb = riverBot(x) + 1;
      set(x, yb, I.MUD); if (bayer(x, yb) < 0.45) set(x, yb + 1, I.MUD); // the near bank
      if (ln(x * 0.4 + 70) > 0.62) for (let k = 0; k < 1 + (x % 3); k += 1) set(x, riverTop(x) - k, k ? I.REED : I.REED_SH);
      if (ln2(x * 0.35 + 90) > 0.68) for (let k = 0; k < 2 + (x % 3); k += 1) set(x, riverBot(x) - k, k % 2 ? I.REED : I.REED_SH);
    }
    for (let y = islet.y - islet.ry - 1; y <= islet.y + islet.ry; y += 1) { // the islet: mud, grass, a bush, reeds
      for (let x = islet.x - islet.rx; x <= islet.x + islet.rx; x += 1) {
        if (!onIslet(x, y)) continue;
        set(x, y, onIslet(x, y - 1) ? (onIslet(x, y + 1) ? I.GRASS : I.MUD) : I.GRASS_HI);
      }
    }
    for (let k = -1; k <= 1; k += 1) set(islet.x + 3 + k, islet.y - islet.ry - 1, I.BUSH);
    set(islet.x + 3, islet.y - islet.ry - 2, I.BUSH_HI);
    [-5, -4, 6].forEach((dx) => { set(islet.x + dx, islet.y - 2, I.REED); set(islet.x + dx, islet.y - 3, I.REED_SH); });
    for (let k = 0; k < Math.round(WE / 70); k += 1) { // stones in the current, foam on their lee
      const x = Math.round(rng() * WE); const y = Math.round(riverTop(x) + 1 + rng() * Math.max(1, riverBot(x) - riverTop(x) - 2));
      if (!isWater(x, y) || Math.abs(x - pathX[clamp(y, 0, H - 1)]) < 12) continue;
      set(x, y, I.STONE); set(x + 1, y, I.STONE_SH); set(x, y - 1, I.STONE_HI); set(x + 2, y, I.WATER_HI); set(x + 3, y + (rng() < 0.5 ? 0 : 1), I.WATER_HI);
    }
    // water lilies in the slack water, west by the hamlet and east by the willow (none in winter)
    if (season !== 'winter') {
      [0.07, 0.15, 0.8, 0.86].forEach((f, j) => {
        const x0 = M + Math.round(f * Ws);
        for (let k = 0; k < 5; k += 1) {
          const x = x0 + Math.round((rng() - 0.5) * 10); const y = riverTop(x) + 2 + Math.floor(rng() * Math.max(1, riverBot(x) - riverTop(x) - 3));
          if (!isWater(x, y) || !isWater(x + 1, y)) continue;
          set(x, y, season === 'autumn' ? I.RUST_SH : I.LILY); set(x + 1, y, season === 'autumn' ? I.RUST : I.LILY);
          if (season !== 'autumn' && (k + j) % 2 === 0) set(x, y - 1, I.LILY_FL);
        }
      });
    }
    { // the bridge: a humped stone deck with parapets, its arch open over the water on the near side
      const yA = Math.min(...[-2, 0, 2].map((d) => riverTop(Math.round(pathX[yl0 + 4]) + d))) - 2;
      const yB = Math.max(...[-2, 0, 2].map((d) => riverBot(Math.round(pathX[yg - 2]) + d))) + 1;
      for (let y = yA; y <= yB; y += 1) {
        const xc = pathX[clamp(y, top, H - 1)]; const hw = pathW[clamp(y, top, H - 1)] + 1.5;
        for (let x = Math.round(xc - hw); x <= Math.round(xc + hw); x += 1) {
          const e = x - (xc - hw);
          const post = (y - yA) % 3 === 0; // parapet posts, a little proud of the rail
          set(x, y, e < 1 ? (post ? I.WALL_DK : I.WALL_HI) : e > 2 * hw - 1 ? (post ? I.WALL_DK : I.WALL_SH) : (y % 2 ? I.PATH : I.PATH_SH));
          if (post && (e < 1 || e > 2 * hw - 1)) set(x + (e < 1 ? -1 : 1), y, I.WALL);
        }
      }
      const xc = pathX[clamp(yB, top, H - 1)]; const hw = pathW[clamp(yB, top, H - 1)] + 1.5;
      for (let x = Math.round(xc - hw); x <= Math.round(xc + hw); x += 1) { // the near face and its arch
        const ax = (x - xc) / (hw - 1);
        set(x, yB + 1, I.WALL); set(x, yB + 2, Math.abs(ax) < 0.75 ? I.WALL_DK : I.WALL_SH);
        if (Math.abs(ax) < 0.55) set(x, yB + 3, I.WATER_HI);
      }
    }

    function blob(x0, y0, rx, ry, [hi, mid, sh], shadow = I.GRASS_SH) {
      for (let y = -ry; y <= ry; y += 1) {
        for (let x = -rx; x <= rx; x += 1) {
          const q = (x / rx) ** 2 + (y / ry) ** 2;
          if (q > 1) continue;
          set(x0 + x, y0 + y, q > 0.7 && x + y > 0 ? sh : x + y < -rx * 0.4 ? hi : x + y > rx * 0.4 ? sh : mid);
        }
      }
      if (shadow !== null) for (let x = -rx + 1; x < rx; x += 1) set(x0 + x, y0 + ry + 1, shadow);
    }
    // the month's field, on the hill west of the castle: ploughed in autumn, ripe in summer,
    // green rows in spring, under snow in winter; its labourer walks it by day (see step)
    // east of the rock (the menu box hangs over the west slope), the path spared
    const rockEast = Math.round(cx + castleW / 2 + 6 * u + (yl0 - crest) * 0.9); // the flank's widest reach
    const field = { x0: rockEast + 3 };
    field.x1 = Math.min(field.x0 + Math.round(0.16 * Ws), M + Ws - 12);
    field.top = (x) => Math.round(hill[clamp(x, 0, WE - 1)]) + 2; // it follows the slope
    field.bot = yl0 - 2;
    if (field.x1 - field.x0 > 12 && field.bot - field.top(field.x1) > 4) {
      const F = { autumn: [I.FURROW, I.FURROW_SH], summer: [I.WHEAT, I.WHEAT_SH], spring: [I.HILL_HI, I.FURROW], winter: [I.SNOWFIELD, I.SNOW_SH] }[season];
      for (let x = field.x0; x <= field.x1; x += 1) {
        const y0 = field.top(x) + (rng() < 0.3 ? 1 : 0); // ragged edges, a rim of grass below
        const y1 = field.bot - 2 - (rng() < 0.4 ? 1 : 0);
        if (y1 - y0 < 2) continue;
        for (let y = y0; y <= y1; y += 1) {
          if (Math.abs(x - pathX[y]) <= pathW[y] + 2) continue;
          set(x, y, (y + Math.floor(x / 3)) % 2 ? F[1] : F[0]); // furrows, gently slanting
        }
      }
    } else field.none = true;
    field.season = season;

    // a windmill above the field, its sails turning with the real wind over Paris (see draw)
    const mill = { x: field.none ? Math.round(rockEast + 12) : field.x1 - 4 };
    {
      const base = Math.round(hill[clamp(mill.x, 0, WE - 1)]) + 3; const bh = Math.max(10, Math.round(13 * u * 0.85));
      for (let y = 0; y < bh; y += 1) {
        const half = Math.round(3.5 - (y / bh) * 1.4);
        for (let dx = -half; dx <= half; dx += 1) set(mill.x + dx, base - y, dx === -half ? I.WALL_HI : dx === half ? I.WALL_SH : I.WALL);
      }
      const capY = base - bh;
      for (let k = 0; k < 4; k += 1) for (let dx = -(3 - k); dx <= 3 - k; dx += 1) set(mill.x + dx, capY - k, dx < 0 ? I.ROOF_HI : I.ROOF_SH);
      rect(mill.x - 1, base - 3, 2, 3, I.TIMBER_SH); // its door
      mill.win = [mill.x, Math.round(base - bh * 0.6)];
      mill.hub = [mill.x, capY - 1]; mill.len = Math.max(7, Math.round(9 * u * 0.8));
    }

    for (let k = 0; k < WE / 30; k += 1) { // a few bushes on the hill
      const x = Math.round(rng() * WE); const y = Math.round(hill[clamp(x, 0, WE - 1)] + 2 + rng() * 6);
      if ((Math.abs(x - cx) < castleW / 2 + 8) || get(x, y) === I.WATER || get(x, y + 3) === I.WATER || y >= yg - 2) continue;
      if (Math.abs(x - pathX[clamp(y, 0, H - 1)]) < pathW[clamp(y, 0, H - 1)] + 3) continue;
      blob(x, y, 3, 2, [I.BUSH_HI, I.BUSH, I.BUSH_SH], I.HILL_SH);
      if (season === 'spring') { set(x - 1, y - 1, I.BLOSSOM); set(x + 2, y, I.BLOSSOM); }
    }

    /* the castle, back to front: asymmetric, an observatory, a gallery, sentries, a chimney */
    const windows = []; const flags = []; const torches = [];
    const darker = { [I.WALL_HI]: I.WALL, [I.WALL]: I.WALL_SH, [I.WALL_SH]: I.WALL_DK, [I.WALL_DK]: I.WALL_DK };
    const masonry = (x, y, c, t0) => { // courses every third row, staggered joints
      const row = y - t0;
      return row % 3 === 2 && ((x + ((Math.floor(row / 3) & 1) * 2)) & 3) === 0 ? darker[c] : c;
    };
    /** Window of a kind: 0 slit, 1 tall slit, 2 paired lights, 3 great window with a mullion. */
    function windowAt(x, y, kind) {
      const pts = [[x, y + 1]];
      if (kind >= 1) pts.push([x, y], [x, y + 2]);
      if (kind >= 2) pts.push([x + 1, y + 1], [x + 1, y + 2]);
      if (kind === 3) { pts.push([x + 2, y + 1], [x + 2, y + 2], [x, y + 3], [x + 2, y + 3], [x + 1, y]); }
      windows.push({ pts, lit: rng() < 0.3, big: kind >= 2 });
      const sill = kind === 3 ? 3 : kind >= 2 ? 2 : 1;
      for (let k = 0; k < sill; k += 1) set(x + k, y + (kind === 3 ? 4 : kind >= 1 ? 3 : 2), I.WALL_HI);
    }
    function crenels(x0, x1, y) { // merlons of uneven width, one broken here and there
      let x = x0;
      while (x < x1) {
        const w = 1 + Math.floor(rng() * 2.4);
        const broken = rng() < 0.12;
        for (let k = 0; k < w && x + k < x1; k += 1) {
          set(x + k, y - 1, I.WALL);
          if (!broken) set(x + k, y - 2, k === 0 ? I.WALL_HI : I.WALL);
        }
        x += w + 1 + Math.floor(rng() * 1.6);
      }
    }
    function cone(mid, y0, half0, rh, [hi, md, sh]) {
      for (let r = 0; r < rh; r += 1) {
        const half = half0 * (1 - r / rh) ** 0.9;
        for (let x = Math.round(mid - half); x < Math.round(mid + half); x += 1) {
          const k = (x - (mid - half)) / (2 * half);
          let c = k < 0.3 ? hi : k < 0.68 ? md : sh;
          if (r % 2 === 1 && (x + r) % 3 === 0) c = c === hi ? md : sh; // shingles
          set(x, y0 - r, c);
        }
      }
      set(Math.round(mid - 0.5), y0 - rh, I.WALL_DK);
      set(Math.round(mid - 0.5), y0 - rh - 1, I.WALL_DK);
      return y0 - rh - 1;
    }
    function body(x0, ww, t0, round) { // masonry; round towers get a lit band left of centre
      for (let y = t0; y < crest; y += 1) {
        for (let x = x0; x < x0 + ww; x += 1) {
          const k = (x - x0 + 0.5) / ww;
          const c = round
            ? (k < 0.1 ? I.WALL : k < 0.38 ? I.WALL_HI : k < 0.7 ? I.WALL : k < 0.9 ? I.WALL_SH : I.WALL_DK)
            : (k < 0.08 ? I.WALL_HI : k > 0.88 ? I.WALL_SH : I.WALL);
          set(x, y, masonry(x, y, c, t0));
        }
      }
    }
    function tower(dx, w, h, roof, opt = {}) {
      const ww = Math.max(4, Math.round(w * u));
      const x0 = Math.round(cx + dx * u - ww / 2);
      const t0 = Math.round(crest - h * v);
      body(x0, ww, t0, true);
      for (let x = x0 - 1; x <= x0 + ww; x += 1) { // corbelled parapet over machicolations
        set(x, t0, ((x - x0) & 1) ? I.WALL_DK : I.WALL_SH);
        set(x, t0 - 1, x < x0 + ww * 0.4 ? I.WALL_HI : I.WALL);
      }
      if (ww >= 5) {
        const stepY = Math.max(6, Math.round((6 + rng() * 3) * u));
        for (let y = t0 + 4; y < crest - 6; y += stepY) {
          const kind = ww >= 9 ? (rng() < 0.5 ? 2 : 1) : ww >= 6 ? (rng() < 0.6 ? 1 : 0) : 0;
          windowAt(x0 + Math.floor(ww * (0.3 + rng() * 0.25)), y, kind);
        }
      }
      if (roof) {
        const tip = cone(x0 + ww / 2, t0 - 2, ww / 2 + 2, Math.max(4, Math.round(roof * v)),
          opt.slate ? [I.SLATE_HI, I.SLATE, I.SLATE_SH] : [I.ROOF_HI, I.ROOF, I.ROOF_SH]);
        for (let x = x0 - 2; x <= x0 + ww + 1; x += 1) set(x, t0 - 1, I.WALL_DK); // eave
        if (opt.flag) flags.push({ x: Math.round(x0 + ww / 2 + 0.5), y: tip, c: opt.flag, long: opt.long });
      } else {
        crenels(x0 - 1, x0 + ww + 1, t0 - 1);
      }
      return { x0, ww, t0 };
    }
    function observatory(dx, w, h) { // a round tower under a verdigris dome, its glass out
      const ww = Math.max(6, Math.round(w * u)); const x0 = Math.round(cx + dx * u - ww / 2);
      const t0 = Math.round(crest - h * v);
      body(x0, ww, t0, true);
      for (let x = x0 - 1; x <= x0 + ww; x += 1) set(x, t0, ((x - x0) & 1) ? I.WALL_DK : I.WALL_SH);
      const r = ww / 2 + 1; const mid = x0 + ww / 2 - 0.5;
      for (let y = 0; y <= r; y += 1) {
        for (let x = -Math.ceil(r); x <= r; x += 1) {
          if (x * x + y * y > r * r) continue;
          const k = (x + r) / (2 * r);
          set(mid + x, t0 - 1 - y, k < 0.3 ? I.DOME_HI : k < 0.7 ? I.DOME : I.DOME_SH);
        }
      }
      for (let y = 1; y < r * 0.8; y += 1) set(mid + 1, t0 - 1 - y, I.OUTLINE); // the slit
      for (let k = 0; k < 5; k += 1) { // the telescope, aimed high to the east
        set(mid + 2 + k, t0 - Math.round(r * 0.55) - k, k ? I.BLADE : I.BLADE_SH);
        set(mid + 2 + k, t0 - Math.round(r * 0.55) - k + 1, I.BLADE_SH);
      }
      set(mid, t0 - 2 - r, I.WALL_DK); set(mid, t0 - 3 - r, I.WALL_DK); // vane
      flags.push({ x: Math.round(mid + 1), y: Math.round(t0 - 3 - r), c: I.FLAG3, long: true });
      const stepY = Math.max(6, Math.round(7 * u));
      for (let y = t0 + 4; y < crest - 6; y += stepY) windowAt(Math.round(mid - 1), y, 0);
      return { x0, ww, t0 };
    }
    function keep(dx, w, h) { // square donjon, flat faces, windows of two sizes
      const ww = Math.round(w * u); const x0 = Math.round(cx + dx * u - ww / 2); const t0 = Math.round(crest - h * v);
      body(x0, ww, t0, false);
      for (let x = x0 - 1; x <= x0 + ww; x += 1) { set(x, t0, ((x - x0) & 1) ? I.WALL_DK : I.WALL_SH); set(x, t0 - 1, I.WALL); }
      crenels(x0 - 1, x0 + ww + 1, t0 - 1);
      const stepY = Math.max(7, Math.round(8 * u));
      let row = 0;
      for (let y = t0 + 5; y < crest - 7; y += stepY, row += 1) {
        windowAt(x0 + Math.round(ww * 0.2), y, row % 2 ? 1 : 2);
        windowAt(x0 + Math.round(ww * 0.62), y, row === 1 ? 3 : 1);
      }
      return { x0, ww, t0 };
    }
    function hall(dx0, dx1, h, roof) { // long hall, slate roof seen side-on, great windows, a chimney
      const x0 = Math.round(cx + dx0 * u); const x1 = Math.round(cx + dx1 * u); const t0 = Math.round(crest - h * v);
      for (let y = t0; y < crest; y += 1) {
        for (let x = x0; x < x1; x += 1) set(x, y, masonry(x, y, x === x0 ? I.WALL_HI : I.WALL, t0));
      }
      const rh = Math.max(4, Math.round(roof * v));
      for (let r = 0; r < rh; r += 1) {
        const a = Math.round(x0 - 1 + r * 0.7); const b = Math.round(x1 + 1 - r * 0.7);
        for (let x = a; x <= b; x += 1) set(x, t0 - 1 - r, x === a || r === rh - 1 ? I.SLATE_HI : r % 2 ? I.SLATE : I.SLATE_SH);
      }
      for (let x = x0 + 3; x < x1 - 3; x += Math.max(5, Math.round(6 * u))) windowAt(x, t0 + 3, 3);
      const chx = Math.round(x1 - 4 * u); const cht = t0 - rh - 3;
      rect(chx, cht, 2, rh + 2, I.WALL); set(chx + 1, cht, I.WALL_SH); rect(chx - 1, cht - 1, 4, 1, I.WALL_DK);
      return { x: chx + 0.5, y: cht - 2 };
    }
    function gallery(xa, xb, y) { // a covered timber walk between two towers
      for (let x = xa; x <= xb; x += 1) {
        set(x, y - 4, I.SLATE_HI); set(x, y - 3, I.SLATE);
        set(x, y - 2, (x - xa) % 3 ? I.TIMBER : I.TIMBER_SH);
        set(x, y - 1, (x - xa) % 3 ? I.TIMBER_HI : I.TIMBER_SH);
        set(x, y, I.TIMBER_SH);
        if ((x - xa) % 3 === 0) set(x, y + 1, I.TIMBER_SH); // corbels
      }
      for (let x = xa + 2; x < xb - 1; x += 3) windows.push({ pts: [[x, y - 2]], lit: rng() < 0.5 });
    }

    const rooms = {};
    const room = (id, x, y, w, h) => { rooms[id] = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }; };
    const obs = observatory(-19, 7, 47);
    room('research', obs.x0 - 1, obs.t0 - obs.ww / 2 - 5, obs.ww + 2, crest - obs.t0 + obs.ww / 2 + 5);
    const castleTop = Math.round(crest - 56 * v - 15 * v - 4); // over the tallest spire
    const tall = tower(9, 8, 56, 15, { flag: I.FLAG2 });
    // the belfry: an opening high in the tall tower, where the bell hangs (rung each planetary hour)
    const bell = { x: tall.x0 + Math.floor(tall.ww / 2), y: tall.t0 + 2 };
    rect(bell.x - 2, bell.y - 1, 5, 6, I.OUTLINE); set(bell.x - 2, bell.y - 1, I.WALL_SH); set(bell.x + 2, bell.y - 1, I.WALL_SH);
    rect(bell.x - 3, bell.y + 5, 7, 1, I.WALL_HI);
    const tallTip = flags.find((f) => f.c === I.FLAG2);
    room('talks', tall.x0 - 2, tall.t0 - 15 * v - 3, tall.ww + 4, (crest - tall.t0) * 0.55 + 15 * v + 3);
    const kp = keep(-2, 14, 37);
    const keepTop = { x: kp.x0 + Math.floor(kp.ww / 2), y: kp.t0 - 3 }; // where the visitor's banner goes up
    room('about', kp.x0, kp.t0 - 3, kp.ww, crest - kp.t0 - 12 * v);
    const pep = tower(-8.5, 3.5, 44, 7, { slate: true }); // a pepperpot turret on the keep's corner
    room('news', pep.x0 - 2, pep.t0 - 7 * v - 3, pep.ww + 4, 7 * v + 10);
    gallery(obs.x0 + obs.ww, kp.x0 - 1, Math.round(crest - 31 * v));
    const chimney = hall(6, 20, 25, 9);
    room('publications', cx + 6 * u, crest - 25 * v - 9 * v, 7 * u, 25 * v + 9 * v - 12 * v);
    room('projects', cx + 13 * u, crest - 25 * v - 9 * v - 4, 7 * u, 25 * v + 13 * v - 12 * v);
    const right = tower(21, 9, 39, 13, { flag: I.FLAG });
    room('teaching', right.x0 - 1, right.t0 - 13 * v, right.ww + 2, crest - right.t0 + 13 * v - 12 * v);
    // curtain wall: uneven crenellations, walkway, banners, ivy
    const wTop = Math.round(crest - 12 * v);
    const wx0 = Math.round(cx - castleW / 2); const wx1 = Math.round(cx + castleW / 2);
    for (let y = wTop; y < crest; y += 1) {
      for (let x = wx0; x < wx1; x += 1) set(x, y, masonry(x, y, y === wTop ? I.WALL_HI : I.WALL, wTop));
    }
    crenels(wx0, wx1, wTop);
    for (let x = wx0; x < wx1; x += 1) set(x, wTop + 1, ((x - wx0) % 2) ? I.WALL_DK : I.WALL_SH);
    // the wall flies the colours of the three schools of now (Saclay prune, Sorbonne navy,
    // Dauphine blue), each charged with a pale argent, swallow-tailed
    [[-0.36, I.T_PRUNE], [-0.22, I.T_NAVY], [0.27, I.T_AZURE]].forEach(([f, field], k) => {
      const bx = Math.round(cx + f * castleW); const bh = Math.max(6, Math.round((k === 1 ? 9 : 7) * v));
      for (let y = 0; y < bh; y += 1) {
        for (let x = 0; x < 3; x += 1) {
          if (y === bh - 1 && x === 1) continue;
          set(bx + x, wTop + 2 + y, x === 1 ? I.T_ARGENT : x === 2 && y % 2 ? I.OUTLINE : field);
        }
      }
    });
    for (let k = 0; k < 6; k += 1) { // ivy climbing from the foot of the wall
      const ix = Math.round(wx0 + rng() * castleW); const ih = (3 + rng() * 7) * v;
      for (let y = crest - 1; y > crest - ih; y -= 1) {
        for (let x = -2; x <= 2; x += 1) {
          if (bayer(ix + x, y) < 0.55 * (1 - (crest - y) / ih)) set(ix + x, y, (x + y) % 3 ? I.IVY : I.IVY_SH);
        }
      }
    }
    tower(-23, 8, 25, 10, { flag: I.FLAG, long: true });
    tower(24, 7, 20, 0); // the other corner, unroofed: the castle is not symmetrical
    tower(-5.5, 4.5, 17, 6);
    tower(5.5, 4.5, 15, 6);
    const gw = Math.max(4, Math.round(5 * u)); const gh = Math.max(5, Math.round(8 * v));
    const gx = Math.round(cx + 1 - gw / 2);
    for (let y = 0; y < gh; y += 1) {
      for (let x = 0; x < gw; x += 1) {
        const ex = (x + 0.5 - gw / 2) / (gw / 2); const ey = (y - gw / 2) / (gw / 2);
        if (y < gw / 2 && ex * ex + ey * ey > 1) continue;
        const grid = x % 2 === 1 || (gh - y) % 3 === 0;
        set(gx + x, crest - gh + y, grid && y > 1 ? I.WALL_SH : I.WALL_DK);
      }
    }
    torches.push({ x: gx - 2, y: crest - Math.round(gh * 0.6) }, { x: gx + gw + 1, y: crest - Math.round(gh * 0.6) });
    room('contact', gx - 6 * u, crest - 17 * v - 6 * v, gw + 12 * u, 17 * v + 6 * v);
    torches.forEach((tc) => set(tc.x, tc.y + 1, I.WALL_DK));
    const sentries = [ // they walk the curtain wall, behind the merlons
      { x: wx0 + 4, a: wx0 + 3, b: cx - gw, v: 0.07, pause: 0, wall: wTop },
      { x: wx1 - 6, a: cx + gw, b: wx1 - 3, v: -0.06, pause: 0, wall: wTop },
    ];

    // a hamlet by the river, west of the castle: cottages under thatch, a chapel and its spire;
    // their chimneys smoke and their windows light up after dark
    const hamlet = { x0: M + Math.round(0.09 * Ws), x1: M + Math.round(0.22 * Ws) };
    const chimneys = []; const doors = []; const eaves = []; let spire = null;
    windows.push({ pts: [mill.win], lit: true });
    {
      let x = hamlet.x0;
      [[9, 6, 'thatch'], [5, 9, 'chapel'], [11, 6, 'roof'], [8, 5, 'thatch']].forEach(([w, h, kind], j) => {
        const yb = Math.min(...Array.from({ length: w }, (_, k) => riverTop(x + k))) - 2;
        const wall = (xx) => (xx === x ? I.WALL_HI : xx === x + w - 1 ? I.WALL_SH : I.WALL);
        for (let yy = yb - h + 1; yy <= yb; yy += 1) for (let xx = x; xx < x + w; xx += 1) set(xx, yy, wall(xx));
        if (kind === 'chapel') { // a narrow nave and its spire, a bell under the cap
          for (let k = 0; k < 6; k += 1) for (let dx = -Math.floor(k / 2); dx <= Math.floor(k / 2); dx += 1) set(x + 2 + dx, yb - h - 6 + k, dx < 0 ? I.SLATE_HI : I.SLATE_SH);
          set(x + 2, yb - h - 7, I.GOLD); set(x + 2, yb - h + 2, I.GOLD_SH); spire = [x + 2, yb - h - 8];
          windows.push({ pts: [[x + 2, yb - 3]], lit: rng() < 0.5 });
        } else { // a gable roof seen from the side, overhanging, a chimney at one end
          const rh = Math.ceil(w / 3); const R = kind === 'thatch' ? [I.THATCH, I.THATCH_SH] : [I.ROOF_HI, I.ROOF_SH];
          for (let k = 0; k < rh; k += 1) for (let xx = x - 1 + k; xx <= x + w - k; xx += 1) set(xx, yb - h - k, k === rh - 1 || xx > x + w / 2 ? R[1] : R[0]);
          const chx = x + (j % 2 ? 2 : w - 3); rect(chx, yb - h - rh - 1, 1, rh, I.WALL_SH); chimneys.push({ x: chx, y: yb - h - rh - 2 });
          set(x + 1 + (j % 3), yb - 1, I.TIMBER_SH); set(x + 1 + (j % 3), yb - 2, I.TIMBER_SH); // a door
          doors.push([x + 1 + (j % 3), yb]); eaves.push([x - 1, x + w, yb - h]);
          windows.push({ pts: [[x + w - 3, yb - 3]], lit: rng() < 0.6 });
        }
        x += w + 2 + (j === 1 ? 1 : 0);
      });
      hamlet.x1 = x;
    }

    // pines on the hill, smaller and sparser with distance
    function pine(xc, yb, h, [hi, mid, sh]) {
      const trunk = Math.max(1, Math.round(h * 0.08));
      rect(xc, yb - trunk, 1, trunk, I.DIRT_SH);
      const tiers = Math.max(2, Math.round(h / 7));
      const th = (h - trunk) / tiers;
      for (let r = 0; r < h - trunk; r += 1) {
        const y = yb - trunk - r;
        const inTier = (r - Math.floor(r / th) * th) / th; // 0 at a tier's skirt
        const half = (h * 0.24) * (1 - r / (h - trunk)) * (1 - 0.35 * inTier) + 0.5;
        for (let x = Math.round(xc - half); x <= Math.round(xc + half); x += 1) {
          const k = (x - (xc - half)) / (2 * half + 1e-9);
          let c = k < 0.2 && bayer(x, y) < 0.6 ? hi : k > 0.55 ? sh : mid;
          if (inTier < 0.15 && bayer(x, y) < 0.5) c = sh;
          set(x, y, c);
        }
      }
    }
    const mids = [];
    for (let k = 0; k < Math.round(WE / 5); k += 1) {
      const x = Math.round(rng() * WE);
      if (Math.abs(x - cx) < castleW / 2 + 5) continue;
      const hx = hill[clamp(x, 0, WE - 1)];
      const yb = Math.round(hx + 3 + rng() * Math.max(1, yl0 - hx - 3));
      if (get(x, yb) === I.WATER) continue;
      if (!field.none && x >= field.x0 - 3 && x <= field.x1 + 3 && yb <= field.bot + 6) continue;
      if (x > hamlet.x0 - 4 && x < hamlet.x1 + 4) continue; // the hamlet's clearing
      if (Math.abs(x - mill.x) < 8) continue;
      mids.push([x, yb, (6 + rng() * 9) * u * (0.6 + (0.4 * (yb - top)) / (yl0 - top + 1))]);
    }
    mids.sort((a, b) => a[1] - b[1]).forEach(([x, yb, h], k) => ((x * 7 + k) % 3 === 0
      ? broadleaf(x, yb, Math.max(5, h * 0.8)) : pine(x, yb, Math.max(5, h), [I.PINE_HI, I.PINE, I.PINE_SH])));

    /* GROUND: the meadow, denser in detail towards the viewer */
    on(L.GROUND);
    const gn = fbm(rng, 3); const gn2 = fbm(rng, 3);
    const near = (y) => clamp((y - yg) / (H - yg)); // 0 at the meadow's top, 1 at the bottom
    for (let y = yg; y < H; y += 1) {
      for (let x = 0; x < WE; x += 1) {
        const t = patch(gn, gn2, x, y);
        set(x, y, y === yg ? I.GRASS_HI : t > 0.6 ? I.GRASS_SH : (t < 0.25 && bayer(x, y) > 0.5) ? I.GRASS_HI : I.GRASS);
      }
    }
    for (let x = 0; x < WE; x += 1) { // its far edge is ragged, grass over the bank (not the path)
      if (Math.abs(x - pathX[yg]) <= pathW[yg] + 2) continue;
      const h = Math.floor(gn(x * 0.3 + 11) * 4 + (bayer(x, yg) < 0.3 ? 1 : 0));
      for (let k = 1; k <= h; k += 1) set(x, yg - k, k === h ? I.GRASS_HI : I.GRASS);
    }
    for (let y = yg; y < H; y += 1) drawPath(y);
    const meadow = (x, y) => [I.GRASS, I.GRASS_SH, I.GRASS_HI].includes(get(x, y, L.GROUND)) && y > yg;
    const watchers = (x, y) => x > fire.x - 76 && x < fire.x + 34 && y > fire.y - 36 && y < fire.y + 18;
    // the knight's track, trodden down from the path to the fire
    for (let k = 0; k <= 40; k += 1) {
      const t = k / 40;
      const x = fire.x + 12 + (pathX[fire.y + 3] - fire.x - 12) * t; const y = fire.y + 3 + Math.sin(t * 3) * 2;
      for (let dx = -1; dx <= 1; dx += 1) if (bayer(Math.round(x + dx), Math.round(y)) < 0.45) set(x + dx, y, I.DIRT);
    }
    for (let k = 0; k < WE * 1.6; k += 1) { // tufts: little v's, more of them near
      const x = Math.floor(rng() * WE); const y = yg + 2 + Math.floor((rng() ** 0.6) * (H - yg - 2));
      if (!meadow(x, y) || rng() > 0.3 + 0.7 * near(y)) continue;
      set(x, y, I.GRASS_SH); set(x - 1, y - 1, I.GRASS_HI); set(x + 1, y - 1, I.GRASS_HI);
    }
    const FL = [I.FL_RED, I.FL_YEL, I.FL_WHITE, I.FL_BLUE, I.FL_VIOLET];
    for (let k = 0; k < WE / 3; k += 1) { // flowers in small clusters of one colour
      const x0 = rng() * WE; const y0 = yg + 3 + (rng() ** 0.7) * (H - yg - 4); const c = FL[Math.floor(rng() * FL.length)];
      const n = 2 + Math.round(5 * near(y0));
      for (let j = 0; j < n; j += 1) {
        const x = Math.round(x0 + (rng() - 0.5) * 8); const y = Math.round(y0 + (rng() - 0.5) * 3);
        if (!meadow(x, y) || watchers(x, y)) continue;
        set(x, y, c);
        if (near(y) > 0.5) { set(x, y + 1, I.GRASS_SH); if (rng() < 0.5) set(x + 1, y, c); } // nearer: bigger heads, stems
      }
    }
    for (let k = 0; k < WE / 30; k += 1) {
      const x = Math.round(rng() * WE); const y = Math.round(yg + 4 + rng() * (H - yg - 6));
      if (meadow(x, y) && !watchers(x, y) && Math.abs(x - pathX[y]) > pathW[y] + 3) {
        blob(x, y, 2 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 2), [I.STONE_HI, I.STONE, I.STONE_SH]);
        if (rng() < 0.5) set(x - 1, y - 1, I.MOSS);
      }
    }
    for (let k = 0; k < WE / 26; k += 1) { // bushes along the meadow's far edge
      const x = Math.round(rng() * WE); const y = Math.round(yg + 1 + rng() * 4);
      if (watchers(x, y) || Math.abs(x - pathX[y]) < pathW[y] + 3) continue;
      blob(x, y, 3 + Math.floor(rng() * 2), 2 + Math.floor(rng() * 2), [I.BUSH_HI, I.BUSH, I.BUSH_SH]);
    }

    // a great oak on the near bank, east of the bridge: a crown of clumps, each lit from the
    // west and each its own shade of the season (no single block of colour); bare in winter
    {
      const wy = yg + 6; let wx = M + Math.round(0.84 * Ws);
      while (Math.abs(wx - pathX[wy]) < pathW[wy] + 18 && wx < M + Ws) wx += 2; // clear of the path
      const h = Math.round(0.19 * H); const trunk = Math.round(h * 0.42);
      rect(wx - 1, wy - trunk, 3, trunk, I.BARK); set(wx - 1, wy - trunk, I.DIRT_SH); set(wx - 2, wy, I.BARK); set(wx + 2, wy, I.BARK);
      [[-1, 0.62], [1, 0.58]].forEach(([dir, f]) => { for (let k = 0; k < h * 0.22; k += 1) set(wx + dir * (1 + k), Math.round(wy - trunk - k * 0.9 + h * 0.08 * f), I.BARK); });
      const PAL = season === 'autumn' ? [[I.RUST_HI, I.RUST, I.RUST_SH], [I.LEAF2, I.RUST_HI, I.RUST], [I.OAK_HI, I.OAK, I.OAK_SH], [I.RUST_HI, I.RUST, I.RUST_SH]]
        : [[I.OAK_HI, I.OAK, I.OAK_SH]];
      const clumps = [[0, -0.92, 0.15], [-0.2, -0.84, 0.14], [0.21, -0.83, 0.14], [-0.36, -0.68, 0.13], [0.37, -0.67, 0.13],
        [-0.12, -0.7, 0.15], [0.12, -0.72, 0.15], [-0.42, -0.52, 0.11], [0.43, -0.53, 0.11], [-0.2, -0.53, 0.13], [0.22, -0.54, 0.12], [0, -0.57, 0.14]];
      if (season === 'winter') {
        clumps.forEach(([fx, fy]) => { for (let k = 0; k < 6; k += 1) set(wx + Math.round(fx * h * (k / 5)), Math.round(wy - trunk - (fy * -h - trunk) * (k / 5) * 0.9), I.BARK); });
      } else {
        clumps.forEach(([fx, fy, fr], j) => {
          const P = PAL[j % PAL.length]; const R = fr * h; const cx0 = wx + fx * h; const cy0 = wy + fy * h;
          for (let dy = -Math.ceil(R); dy <= R; dy += 1) for (let dx = -Math.ceil(R); dx <= R; dx += 1) {
            const x = Math.round(cx0 + dx); const y = Math.round(cy0 + dy); const q = (dx * dx + dy * dy) / (R * R);
            if (q + (bayer(x, y) - 0.5) * 0.35 > 1) continue;
            let c = dx + dy < -R * 0.45 ? P[0] : dx + dy > R * 0.35 || q > 0.75 && dy > 0 ? P[2] : P[1];
            if (bayer(x * 3, y * 5) < 0.12) c = c === P[1] ? P[2] : P[1]; // leaves, not a flat fill
            if (season === 'spring' && bayer(x, y) < 0.08) c = I.BLOSSOM;
            set(x, y, c);
          }
        });
      }
      for (let x = -9; x <= 9; x += 1) if (bayer(x, 1) < 0.5) set(wx + x, wy + 1, I.GRASS_SH); // its shade
    }

    // the bonfire: scorched ground, a ring of stones, a sword driven into the coals
    for (let y = -4; y <= 4; y += 1) {
      for (let x = -11; x <= 11; x += 1) {
        if ((x / 11) ** 2 + (y / 4) ** 2 < 1 && bayer(x, y) < 0.7) set(fire.x + x, fire.y + y, I.DIRT_SH);
      }
    }
    for (let k = 0; k < 11; k += 1) {
      const a = (k / 11) * 2 * Math.PI;
      const sx = Math.round(fire.x + Math.cos(a) * 8); const sy = Math.round(fire.y + Math.sin(a) * 3);
      rect(sx - 1, sy - 1, 3, 2, I.STONE); set(sx - 1, sy - 1, I.STONE_HI); rect(sx - 1, sy + 1, 3, 1, I.STONE_SH);
    }
    const bx = fire.x + 1; const tip = fire.y - 1; const blade = 13;
    rect(bx, tip - blade, 1, blade, I.BLADE); rect(bx + 1, tip - blade, 1, blade, I.BLADE_SH);
    rect(bx - 3, tip - blade, 8, 1, I.HILT); rect(bx, tip - blade - 4, 2, 4, I.HILT); set(bx, tip - blade - 5, I.BLADE_SH);
    // firewood stacked by the ring
    for (let k = 0; k < 3; k += 1) rect(fire.x + 10, fire.y + 1 - k * 2 + (k === 1 ? 0 : 0), 6 - k, 2, k % 2 ? I.DIRT : I.DIRT_SH);

    // the watchers and their shadows
    const kn = SPRITES.knight; const wz = SPRITES.wizard;
    const knight = { x: fire.x - 9 - kn.w, y: fire.y + 4 - kn.h };
    const wizard = { x: knight.x - wz.w - 2, y: fire.y + 6 - wz.h };
    const C = SPRITES.cats; const low = (dy, s0) => Math.min(H - 1, fire.y + dy) - s0.h;
    // each cat lives in one place: these two by the fire; the thin black one in the observatory,
    // the white one in the library
    const cats = [ // [sprite, x, y]: by the fire, at the knight's feet
      [C.blackLoaf, fire.x + 13, low(6, C.blackLoaf)],
      [C.spotted, knight.x + 16, low(12, C.spotted)],
    ].map(([sp, x, y], k) => ({ sp, x, y, ph: k * 1.7 }));
    for (let y = -2; y <= 2; y += 1) {
      for (let x = -13; x <= 13; x += 1) {
        if ((x / 13) ** 2 + (y / 2) ** 2 < 1 && bayer(x, y) < 0.5) {
          set(knight.x + kn.w * 0.45 + x, fire.y + 4 + y, I.GRASS_SH);
          if (Math.abs(x) < 8) set(wizard.x + wz.w * 0.4 + x, fire.y + 6 + y, I.GRASS_SH);
        }
      }
    }

    // the knight's horse grazes east of the fire (tail swishing, see draw), clear of the path
    // (east of the cat if the path leaves room, else west of the wizard)
    const hsp = SPRITES.horse[0]; const hpy = clamp(fire.y + 6, 0, H - 1);
    const horse = { x: fire.x + 28, y: fire.y + 9 - hsp.h };
    if (horse.x + hsp.w > pathX[hpy] - pathW[hpy] - 3) horse.x = wizard.x - hsp.w - 4;
    for (let x = 2; x < hsp.w - 2; x += 1) if (bayer(x, 0) < 0.6) set(horse.x + x, fire.y + 8, I.GRASS_SH); // its shadow
    // deer come out at the forest's edge at dawn and dusk (west, on the meadow's far rim)
    const deer = [0.1, 0.155].map((f, k) => ({ x: M + Math.round(f * Ws), y: yg + 6 + k * 3, ph: k * 2.3 }));

    /* FG: the nearest plane: big pines, mossy rocks, mushrooms, ferns, a stump, a fallen branch */
    on(L.FG);
    const FGP = [I.FG_PINE_HI, I.FG_PINE, I.FG_PINE_SH];
    const clearOf = wizard.x - 3; // the left pines' skirts stop short of the wizard
    pine(Math.min(M + Math.round(-0.08 * Ws), Math.round(clearOf - 0.24 * 0.78 * H)), H + 2, 0.78 * H, FGP);
    pine(Math.min(M + Math.round(0.05 * Ws), Math.round(clearOf - 0.24 * 0.5 * H)), H + 2, 0.5 * H, FGP);
    pine(M + Math.round(Ws * 1.02), H + 2, 0.66 * H, FGP);
    pine(M + Math.round(Ws * 0.93), H + 2, 0.42 * H, FGP);
    // a bare branch out of that pine's west side, where an owl perches at night
    const owl = { x: M + Math.round(Ws * 0.93) - Math.round(0.12 * 0.42 * H) - 7, y: Math.round(H + 2 - 0.42 * H * 0.52) };
    rect(owl.x - 1, owl.y, Math.round(0.12 * 0.42 * H) + 8, 1, I.BARK); set(owl.x - 2, owl.y - 1, I.BARK);
    owl.y -= SPRITES.owl.h - 1;
    const free = (x) => !(x > fire.x - 70 && x < fire.x + 22) && Math.abs(x - pathX[H - 1]) > pathW[H - 1] + 4;
    function mossyRock(x0, y0, rx, ry) {
      blob(x0, y0, rx, ry, [I.STONE_HI, I.STONE, I.STONE_SH], null);
      for (let x = -rx + 1; x < rx; x += 1) { // moss on its crown, lit at the top
        const yTop = y0 - Math.floor(ry * Math.sqrt(1 - (x / rx) ** 2));
        set(x0 + x, yTop, bayer(x0 + x, yTop) < 0.5 ? I.MOSS_HI : I.MOSS);
        if (rng() < 0.6) set(x0 + x, yTop + 1, I.MOSS);
      }
    }
    function mushroom(x, y, red) {
      const cap = red ? [I.CAP, I.CAP_SH] : [I.CAP_BR, I.DIRT_SH];
      set(x, y, I.STEM); set(x, y - 1, I.STEM);
      for (let dx = -2; dx <= 2; dx += 1) set(x + dx, y - 2, Math.abs(dx) === 2 ? cap[1] : cap[0]);
      for (let dx = -1; dx <= 1; dx += 1) set(x + dx, y - 3, cap[0]);
      if (red) { set(x - 1, y - 3, I.FL_WHITE); set(x + 1, y - 2, I.FL_WHITE); }
    }
    function fern(x0, y0, h, dir) {
      for (let r = 0; r < h; r += 1) {
        const x = x0 + dir * Math.round((r / h) ** 2 * h * 0.6); const y = y0 - r;
        set(x, y, I.FERN);
        if (r % 2 === 0 && r < h - 1) { set(x - 1, y, I.FERN_SH); set(x + 1, y, I.FERN); set(x + 2 * dir, y + 1, I.FERN_SH); }
      }
    }
    for (let k = 0; k < Math.max(2, Math.round(WE / 90)); k += 1) {
      const x = Math.round(rng() * WE); if (!free(x)) continue;
      mossyRock(x, H - 2 - Math.floor(rng() * 4), 4 + Math.floor(rng() * 3), 3 + Math.floor(rng() * 2));
    }
    for (let k = 0; k < Math.round(WE / 25); k += 1) {
      const x = Math.round(rng() * WE); if (!free(x)) continue;
      const y = H - 1 - Math.floor(rng() * (H - yfg));
      mushroom(x, y, rng() < 0.55);
      if (rng() < 0.5) mushroom(x + 3, y + 1, false);
    }
    for (let k = 0; k < Math.round(WE / 30); k += 1) {
      const x = Math.round(rng() * WE); if (!free(x)) continue;
      const y = H - Math.floor(rng() * 5);
      for (let j = 0; j < 4; j += 1) fern(x + j * 2 - 3, y, 6 + Math.floor(rng() * 6), j < 2 ? -1 : 1);
    }
    const stumpX = M + Math.round(0.7 * Ws);
    if (free(stumpX)) { // a stump with its rings, a branch fallen beside it
      rect(stumpX - 4, H - 9, 9, 9, I.DIRT); rect(stumpX + 2, H - 9, 3, 9, I.DIRT_SH); rect(stumpX - 4, H - 9, 1, 9, I.TIMBER_HI);
      rect(stumpX - 4, H - 10, 9, 1, I.TIMBER_HI); set(stumpX, H - 10, I.TIMBER); set(stumpX - 2, H - 10, I.TIMBER);
      set(stumpX - 3, H - 6, I.MOSS); set(stumpX - 3, H - 5, I.MOSS_HI);
      for (let k = 0; k < 16; k += 1) set(stumpX + 6 + k, H - 3 - Math.round(k * 0.15), k % 5 ? I.DIRT : I.DIRT_SH);
      set(stumpX + 10, H - 5, I.DIRT); set(stumpX + 11, H - 6, I.DIRT); set(stumpX + 15, H - 6, I.DIRT_SH);
    }

    // tall grass along the bottom, in tufts of three blades fanning out; drawn each frame (wind)
    const blades = [];
    const GR = [I.GRASS_HI, I.GRASS, I.GRASS, I.REED, I.GRASS_SH, I.GRASS_HI, I.GRASS_LT];
    for (let k = 0; k < WE * 0.3; k += 1) {
      const x = Math.floor(rng() * WE); const y = H + 1 - Math.floor((rng() ** 2.2) * (H - yfg));
      if (x > fire.x - 76 && x < fire.x + 34 && y < fire.y + 18) continue; // not in front of the camp
      const nf = clamp((y - yfg) / (H - yfg));
      const h = 2 + rng() * 3 + nf * 4; const c = GR[Math.floor(rng() * GR.length)];
      for (let j = -1; j <= 1; j += 1) blades.push({ x: x + j, y, h: Math.round(h * (j ? 0.75 : 1)), spread: j * (1 + rng()), c });
    }

    // stars, clouds: screen coordinates (the sky does not move)
    const stars = [];
    for (let k = 0; k < (W * yHor) / 70; k += 1) {
      stars.push({ x: Math.floor(rng() * W), y: Math.floor(rng() * yHor), big: rng() < 0.06,
        ph: rng() * 6.28, sp: 0.6 + rng() * 2, tint: rng() });
    }
    const clouds = [];
    for (let k = 0; k < Math.max(3, Math.round(W / 70)); k += 1) {
      const cw = Math.round((24 + rng() * 30) * u); const ch = Math.max(4, Math.round(cw * 0.42));
      const m = new Uint8Array(cw * ch);
      const nb = 4 + Math.floor(rng() * 3);
      for (let b = 0; b < nb; b += 1) {
        const bx2 = cw * (0.14 + (0.72 * b) / (nb - 1));
        const r = ch * (0.26 + 0.24 * Math.sin((Math.PI * b) / (nb - 1))) * (0.9 + 0.2 * rng());
        const by = ch - 1 - r * 0.8;
        for (let y = 0; y < ch; y += 1) {
          for (let x = 0; x < cw; x += 1) {
            if ((x - bx2) ** 2 + (y - by) ** 2 < r * r) m[y * cw + x] = y > ch * 0.7 || (y > ch * 0.55 && bayer(x, y) < 0.5) ? 2 : 1;
          }
        }
      }
      clouds.push({ m, w: cw, h: ch, x: rng() * (W + cw), y: Math.round(yHor * (0.06 + rng() * 0.45)), v: 0.6 + rng() * 0.8 });
    }
    for (let k = 0; k < Math.max(2, Math.round(W / 120)); k += 1) {
      const cw = Math.round((30 + rng() * 40) * u); const m = new Uint8Array(cw * 3);
      for (let x = 0; x < cw; x += 1) {
        if (x > cw * 0.2 && x < cw * 0.85) m[x] = 1;
        m[cw + x] = 2;
        if (x > cw * 0.4 && x < cw * 0.95) m[2 * cw + x] = 2;
      }
      clouds.push({ m, w: cw, h: 3, x: rng() * (W + cw), y: Math.round(yHor * (0.55 + rng() * 0.3)), v: 0.25 });
    }

    // the rows each plane covers, so compositing skips the empty ones
    const rows = planes.map((p) => {
      let a = H; let b = 0;
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < WE; x += 1) if (p[y * WE + x] !== CLEAR) { a = Math.min(a, y); b = y + 1; break; }
      }
      return [a, b];
    });

    return {
      W, H, Ws, WE, M, planes, rows, yHor, castleTop, rooms, yl0, yg, windows, flags, torches, sentries, chimney, stars, clouds,
      bell, keepTop, tallTip: tallTip && { x: tallTip.x, y: tallTip.y }, cellar, riverTop, riverBot,
      ferry: { x: M + 10, dir: 1, wait: 600 }, hoist: null, ringUntil: 0,
      fire, knight, wizard, blades, cats, field, season, shieldSp: null,
      peasant: field.none ? null : { x: Math.round((field.x0 + field.x1) / 2), dir: 1, seeds: [] },
      falling: Array.from({ length: Math.round(WE / 8) }, () => ({ x: rng() * WE, y: rng() * H, ph: rng() * 6, c: rng() < 0.5 })),
      fw: 11, fh: 22, cells: new Float32Array(11 * 22), embers: [], smoke: [], fumes: [], sparks: [],
      flies: Array.from({ length: 22 }, () => ({ x: M + rng() * Math.min(W, Ws), y: yl0 + (rng() ** 0.5) * (H - yl0), ph: rng() * 6 })),
      butterflies: Array.from({ length: 3 }, (_, k) => ({ x: M + rng() * Math.min(W, Ws), y: yg + 6 + rng() * (H - yg - 12), ph: rng() * 6, c: [I.FL_WHITE, I.FL_YEL, I.FL_BLUE][k] })),
      birds: null, dragon: null, nextDragon: null,
      // the countryside (see draw and step)
      watch, mill, chimneys, horse, deer, owl, month, hamlet: { doors, eaves, spire, x1: hamlet.x1 }, fireworks: [], notes: [],
      pathX, pathW, top, walker: null, zzz: [], fish: null,
      angler: (() => { const x = M + Math.round(0.135 * Ws); return { x, y: yg + 3 - SPRITES.angler.h, wy: riverBot(x + 6) - 1 }; })(),
      bonfires: [[mill.x + 16, Math.round(hill[clamp(mill.x + 16, 0, WE - 1)]) + 1, L.MID], [hamlet.x1 + 7, riverTop(hamlet.x1 + 7) - 3, L.MID],
        [M + Math.round(0.33 * Ws), crestAt(M + Math.round(0.33 * Ws)) + 1, L.NEAR]],
      heron: (() => { const x = M + Math.round(0.74 * Ws); return { x, y: riverTop(x) + 4 - SPRITES.heron.h }; })(),
      ducks: [0, 1, 2].map((k) => ({ x: pathX[yl0 + 4] + 20 + k * 9, a: pathX[yl0 + 4] + 16, b: M + Math.round(0.92 * Ws), dir: k % 2 ? 1 : -1, ph: k })),
      geese: null, swallows: null, meteors: [], millAngle: 0,
    };
  }

  /* ---- inside the castle: one room per section ------------------------------------------
     Built from a few pieces of furniture (procedural, in the scene's palette), lit by candles,
     a hearth or torches; the window shows the true sky. `Wi` is the part of the width the
     parchment leaves free (wide screens: the left half), where the furniture stands. */

  const ROOM_NAMES = {
    about: 'the scriptorium', research: 'the observatory', projects: 'the workshop',
    publications: 'the library', talks: 'the great hall', teaching: 'the schoolroom',
    news: 'the rookery', contact: 'the gatehouse',
  };
  const roomOf = (id) => (ROOM_NAMES[id] ? id : 'projects'); // project pages: the workshop

  /* ---- heraldry: coats from assets/js/arms.js (window.ARMS), flat tinctures, dark outline ---- */
  const TINCT = { O: 'T_OR', A: 'T_ARGENT', G: 'T_GULES', B: 'T_AZURE', V: 'T_VERT', S: 'T_SABLE', P: 'T_PRUNE', R: 'T_BORDEAUX', N: 'T_NAVY', C: 'T_BRIGHT' };
  const armsCache = {};
  function armsSprite(id) {
    if (armsCache[id]) return armsCache[id];
    const rows = (window.ARMS || {})[id];
    if (!rows) return null;
    const h0 = rows.length; const w0 = Math.max(...rows.map((r) => r.length));
    const at = (x, y) => (y >= 0 && y < h0 && x >= 0 && x < rows[y].length ? rows[y][x] : '.');
    const w = w0 + 2; const h = h0 + 2; const px = new Int16Array(w * h).fill(-1);
    for (let y = -1; y <= h0; y += 1) {
      for (let x = -1; x <= w0; x += 1) {
        const c = at(x, y);
        if (c !== '.') px[(y + 1) * w + x + 1] = I[TINCT[c]];
        else if (NEIGH.some(([dx, dy]) => at(x + dx, y + dy) !== '.')) px[(y + 1) * w + x + 1] = I.OUTLINE;
      }
    }
    armsCache[id] = { w, h, px };
    return armsCache[id];
  }

  // a 3x5 chalk hand for the schoolroom's equations
  const GLYPHS = {
    i: ['010', '000', '010', '010', '010'], 'ħ': ['100', '111', '100', '111', '101'], '∂': ['011', '001', '111', '101', '111'],
    'ψ': ['101', '101', '111', '010', '010'], '/': ['001', '001', '010', '100', '100'], t: ['010', '111', '010', '010', '011'],
    '=': ['000', '111', '000', '111', '000'], H: ['101', '101', '111', '101', '101'], 'ρ': ['000', '111', '101', '111', '100'],
    D: ['110', '101', '101', '101', '110'], '∇': ['111', '101', '101', '010', '000'], '²': ['110', '010', '100', '110', '000'],
    Z: ['111', '001', '010', '100', '111'], 'Σ': ['111', '100', '010', '100', '111'], e: ['000', '111', '111', '100', '111'],
    '^': ['010', '101', '000', '000', '000'], '-': ['000', '000', '111', '000', '000'], 'β': ['010', '101', '110', '101', '110'],
    E: ['111', '100', '110', '100', '111'], u: ['000', '101', '101', '101', '111'], '+': ['000', '010', '111', '010', '000'],
    '(': ['010', '100', '100', '100', '010'], ')': ['010', '001', '001', '001', '010'], 0: ['111', '101', '101', '101', '111'],
  };
  const CHALK = ['iħ∂ψ/∂t=Hψ', '∂ρ/∂t=D∇²ρ', 'Z=Σe^-βE', '-∂u/∂t+H(∇u)=0'];

  // the labour of the month, as in a book of hours (sower in autumn, reaper in summer...)
  const SEASON = (m) => (m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn');
  const PEASANT = [`
..rr...
.rffr..
.rffr..
.hhhh.f
hhhhhh.
.hhhh..
.hhhh..
.h..h..
.h..h..`, `
..rr...
.rffr..
.rffr..
.hhhh..
hhhhhh.
.hhhhf.
.hhhh..
..hh...
..hh...`];

  // pupils seen from behind, seated: 1 hair, 2 tunic (filled in per pupil); the last one has a question
  const PUPIL = [`
..111..
.11111.
1111111
1111111
f11111f
.11111.
..1f1..
.22222.
2222222
2222222
2222222
2222222`, `
........f
..111...2
.11111..2
1111111.2
1111111.2
f11111f2.
.11111.2.
..1f1.2..
.222222..
2222222..
2222222..
2222222..`];
  const HAIR = ['h', 'b', 't', 'g', 'h', 'b'];
  const TUNIC = ['r', 'u', 'd', 'p', 'u', 'r'];
  const pupilCache = {};
  const pupil = (k) => {
    const key = `${k % 6}${k === 4 ? 'q' : ''}`; // the fifth asks a question
    pupilCache[key] ||= shadeSprite(PUPIL[k === 4 ? 1 : 0].replace(/1/g, HAIR[k % 6]).replace(/2/g, TUNIC[(k * 5 + 1) % 6]));
    return pupilCache[key];
  };

  function generateInterior(id, W, H, Wi, sup) {
    const rng = mulberry32(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const idx = new Uint8Array(W * H); const out = new Uint8Array(W * H);
    const set = (x, y, i, o = 0) => {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && x < W && y >= 0 && y < H) { idx[y * W + x] = i; out[y * W + x] = o; }
    };
    const rect = (x, y, w, h, i) => { for (let yy = Math.round(y); yy < Math.round(y + h); yy += 1) for (let xx = Math.round(x); xx < Math.round(x + w); xx += 1) set(xx, yy, i); };
    const lights = []; const flames = []; const stars = []; const motes = []; const blinks = []; const camps = []; const deco = [];
    const stamp = (sp, x0, y0) => { for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) { const c = sp.px[y * sp.w + x]; if (c >= 0) set(x0 + x, y0 + y, c); } };
    const yf = Math.round(H * 0.8); // the floor's edge
    const sn = fbm(rng, 3);
    const kind = roomOf(id);
    // a room as a box (prototype: the scriptorium): the back wall between BL and BR, two side walls
    // in perspective; sideBot(x) is where floor meets wall (the near edge at the bottom of the view)
    // each room its shape, after what it is (flat beamed ceilings: one great building): a plain box,
    // a deep library lined with shelves, a narrow stone tower room, a sooty brick workshop, a wide
    // hall on pillars, a schoolroom lit from the side, a plank-lined rookery, a stone gate passage
    // (project pages stay the flat workshop)
    const SHAPES = {
      about: { side: 0.17, mat: 'wainscot' }, publications: { side: 0.25, mat: 'shelves' },
      research: { side: 0.11, mat: 'stone' }, projects: { side: 0.15, mat: 'brick' },
      talks: { side: 0.09, mat: 'ashlar', pillars: true }, teaching: { side: 0.17, mat: 'lime', sideWindow: true },
      news: { side: 0.16, mat: 'boards' }, contact: { side: 0.2, mat: 'ashlar' },
    };
    const SHAPE = ROOM_NAMES[id] ? SHAPES[kind] : null;
    const box3d = Boolean(SHAPE);
    const BL = box3d ? Math.round(W * SHAPE.side) : 0; const BR = W - BL;
    const sideBot = (x) => (x < BL ? H - (H - yf) * (x / BL) : x >= BR ? H - (H - yf) * ((W - 1 - x) / BL) : yf);
    const noise2 = (x, y) => sn(x * 0.11 + y * 0.37) * 0.6 + sn(x * 0.31 - y * 0.13 + 50) * 0.4;

    /* walls: each room its own material, at a grain that reads at this size */
    function stones(bw, bh, [hi, mid, sh, joint]) { // courses of blocks bw x bh, staggered
      for (let y = 0; y < yf; y += 1) {
        const course = Math.floor(y / bh); const off = (course % 2) * Math.floor(bw / 2);
        for (let x = 0; x < W; x += 1) {
          const j = y % bh === bh - 1 || (x + off) % bw === 0;
          const t = noise2(x + course * 13, y);
          set(x, y, j ? joint : t > 0.6 ? sh : t < 0.3 ? hi : mid);
        }
      }
    }
    function plaster(top, [hi, mid, sh]) {
      for (let y = top; y < yf; y += 1) for (let x = 0; x < W; x += 1) {
        const t = noise2(x, y);
        set(x, y, t > 0.66 ? sh : t < 0.22 && bayer(x, y) < 0.5 ? hi : mid);
      }
      for (let k = 0; k < 3; k += 1) { // a crack or two
        let cx0 = Math.floor(rng() * W); for (let y = top + Math.floor(rng() * 10); y < top + 14; y += 1) { cx0 += rng() < 0.5 ? 0 : (rng() < 0.5 ? -1 : 1); set(cx0, y, sh); }
      }
    }
    function panels(top, bottom, pw) { // wooden panelling: stiles, rails, sunk panels
      for (let y = top; y < bottom; y += 1) for (let x = 0; x < W; x += 1) {
        const stile = x % pw < 2; const rail = (y - top) % 14 < 2 || y >= bottom - 2;
        const edge = x % pw === 2 || (y - top) % 14 === 2;
        set(x, y, stile || rail ? (x % pw === 0 || (y - top) % 14 === 0 ? I.TIMBER_HI : I.TIMBER) : edge ? I.TIMBER_SH : (noise2(x, y) > 0.55 ? I.TIMBER_SH : I.TIMBER));
      }
      for (let x = 0; x < W; x += 1) set(x, top, I.TIMBER_HI);
    }
    const STONE = [I.ROCK_HI, I.ROCK, I.ROCK_SH, I.ROCK_DK];
    if (kind === 'about') { plaster(0, [I.PLASTER_HI, I.PLASTER, I.PLASTER_SH]); panels(yf - Math.round(H * 0.26), yf, 10); }
    else if (kind === 'publications') panels(0, yf, 12);
    else if (kind === 'research') stones(6, 3, STONE);
    else if (kind === 'projects') { // brick, blackened by the forge towards the top
      stones(5, 2, [I.BRICK_HI, I.BRICK, I.BRICK_SH, I.ROCK_DK]);
      for (let y = 0; y < yf * 0.45; y += 1) for (let x = 0; x < W; x += 1) if (bayer(x, y) < 0.6 * (1 - y / (yf * 0.45))) set(x, y, I.ROCK_DK);
    } else if (kind === 'talks') stones(10, 4, STONE);
    else if (kind === 'teaching') { plaster(0, [I.LIME_HI, I.LIME, I.LIME_SH]); panels(yf - Math.round(H * 0.16), yf, 8); }
    else if (kind === 'news') { // the rookery: plank walls
      for (let y = 0; y < yf; y += 1) for (let x = 0; x < W; x += 1) set(x, y, y % 5 === 4 ? I.TIMBER_SH : (noise2(x, y) > 0.6 ? I.TIMBER_SH : (x * 7 + y * 3) % 31 === 0 ? I.TIMBER_HI : I.TIMBER));
    } else stones(9, 4, STONE); // the gatehouse: big ashlar

    // the ceiling's beams (the observatory has its dome, the rookery its rafters)
    if (kind !== 'research') {
      for (let x = 0; x < W; x += 1) { rect(x, 0, 1, 3, I.TIMBER_SH); set(x, 3, I.OUTLINE); }
      for (let x = 4; x < W; x += 22) { rect(x, 0, 4, 5, I.TIMBER); rect(x, 0, 1, 5, I.TIMBER_HI); rect(x, 5, 4, 1, I.OUTLINE); }
    }
    for (let x = 0; x < W; x += 1) { set(x, yf - 1, I.TIMBER_SH); set(x, yf - 2, kind === 'talks' || kind === 'contact' ? I.ROCK_SH : I.TIMBER); } // skirting

    /* the floor in perspective: seams run to a vanishing point, rows close up with distance */
    const vx = box3d ? W / 2 : W * 0.42; const vy = yf - (H - yf) * 1.4;
    const flag = kind === 'talks' || kind === 'contact' || kind === 'research';
    for (let y = yf; y < H; y += 1) {
      const k = (y - yf) / (H - yf);
      const rowN = Math.floor(Math.pow(k, 0.62) * (flag ? 5 : 8));
      const prevN = Math.floor(Math.pow(Math.max(0, (y - 1 - yf) / (H - yf)), 0.62) * (flag ? 5 : 8));
      for (let x = 0; x < W; x += 1) {
        const u0 = (x - vx) / (y - vy) * (H - vy); // where this seam would meet the bottom edge
        const seam = Math.abs(((u0 / (flag ? 18 : 9)) % 1 + 1) % 1) < (flag ? 0.1 : 0.14);
        const across = rowN !== prevN && (flag || (Math.floor(u0 / 9) + rowN) % 2 === 0);
        const t = noise2(x, y);
        if (flag) set(x, y, seam || across ? I.ROCK_DK : t > 0.6 ? I.ROCK_SH : t < 0.3 ? I.ROCK_HI : I.ROCK);
        else set(x, y, seam || across ? I.TIMBER_SH : t > 0.65 ? I.TIMBER_SH : t < 0.2 ? I.TIMBER_HI : I.TIMBER);
      }
    }
    const pools = []; // pale light under each window (lit in lightInterior, no dither)
    const doorList = [];
    if (box3d) { // the side walls, receding: each room's own material and ceiling
      const hw = yf + H; // wall height, back units: the walls run up out of sight, under a flat ceiling
      const topOf = (x) => sideBot(x) - hw * (sideBot(x) / yf); // where a side wall's top runs (y, may be < 0)
      const LOG8 = Math.log(0.8);
      const BOOKS = [I.CLOTH, I.ROBE, I.GOLD_SH, I.HAT, I.DRAKE_SH, I.WING_SH, I.LEATHER, I.FERN_SH];
      const texel = (x, y, sx, bot, k) => { // the wall's material at (x, y); depth cells shrink as they recede
        const v = (bot - y) / k; const jf = Math.log(Math.max(1e-3, 1 - sx / BL)) / LOG8; const m = SHAPE.mat;
        if (m === 'wainscot' || m === 'lime') {
          const wain = Math.round(H * (m === 'lime' ? 0.16 : 0.26));
          if (v < wain) {
            const st = Math.abs(jf - Math.round(jf)) < 0.08; const rail = Math.abs(v - wain) < 1 || Math.abs(v - 2) < 0.8;
            return st || rail ? I.TIMBER_HI : (noise2(x, y) > 0.55 ? I.TIMBER_SH : I.TIMBER);
          }
          const P = m === 'lime' ? [I.LIME_HI, I.LIME, I.LIME_SH] : [I.PLASTER_HI, I.PLASTER, I.PLASTER_SH];
          return noise2(x + 7, y) > 0.66 ? P[2] : P[1];
        }
        if (m === 'shelves') { // bookcases lining the wall: uprights, boards, spines
          const f = jf - Math.floor(jf); const row = Math.floor(v / 9);
          if (f < 0.1 || v % 9 < 1.1) return f < 0.1 ? I.TIMBER_HI : I.TIMBER;
          if (v % 9 > 7.5) return I.OUTLINE; // the dark above each row of books
          const spine = Math.floor(jf * 7);
          return (jf * 7) % 1 < 0.14 ? I.OUTLINE : BOOKS[(spine * 7 + row * 3 + (spine >> 2)) % BOOKS.length];
        }
        if (m === 'boards') return v % 5 < 1 ? I.TIMBER_SH : (noise2(x, y) > 0.6 ? I.TIMBER_SH : I.TIMBER);
        const brick = m === 'brick'; const ch = brick ? 2 : m === 'ashlar' ? 4 : 3; // stone courses
        const row = Math.floor(v / ch); const cells = brick ? 2.5 : 1.2;
        const g = jf * cells + (row % 2) * 0.5;
        const joint = v % ch < 0.9 || g % 1 < 0.1;
        const pal = brick ? [I.BRICK_HI, I.BRICK, I.BRICK_SH, I.ROCK_DK] : [I.ROCK_HI, I.ROCK, I.ROCK_SH, I.ROCK_DK];
        if (joint) return pal[3];
        if (brick && v > yf * 0.55 && bayer(x, y) < 0.5) return I.ROCK_DK; // soot
        const t = noise2(x + row * 13, y); return t > 0.6 ? pal[2] : t < 0.3 ? pal[0] : pal[1];
      };
      const darker = { [I.PLASTER_HI]: I.PLASTER, [I.PLASTER]: I.PLASTER_SH, [I.PLASTER_SH]: I.ROCK_SH, [I.LIME_HI]: I.LIME,
        [I.LIME]: I.LIME_SH, [I.LIME_SH]: I.ROCK_SH, [I.TIMBER_HI]: I.TIMBER, [I.TIMBER]: I.TIMBER_SH, [I.ROCK_HI]: I.ROCK,
        [I.ROCK]: I.ROCK_SH, [I.ROCK_SH]: I.ROCK_DK, [I.BRICK_HI]: I.BRICK, [I.BRICK]: I.BRICK_SH, [I.BRICK_SH]: I.ROCK_DK };
      const roofAt = (_x, y) => (y % 2 ? I.TIMBER : I.TIMBER_SH); // the ceiling's boards
      for (let x = 0; x < W; x += 1) {
        if (x >= BL && x < BR) continue;
        const left = x < BL; const sx = left ? x : W - 1 - x; const bot = sideBot(x); const k = bot / yf; const top = topOf(x);
        for (let y = 0; y < bot; y += 1) {
          if (y < top) { set(x, y, roofAt(x, y)); continue; }
          let c = texel(x, y, sx, bot, k);
          if (bayer(x, y) < 0.5 * (1 - sx / BL) + (left ? 0 : 0.2)) c = darker[c] ?? c; // turning away from the light
          set(x, y, c);
        }
        if (top > 0) set(x, Math.round(top), I.TIMBER_SH); // the wall plate
        set(x, Math.round(bot), I.TIMBER_SH); // the skirting
      }
      {
        for (let x = 0; x < BL; x += 1) { // the cornice under the ceiling, falling towards us
          const yc = Math.round(5 * (1 - x / BL)) - 1; set(x, yc + 4, I.TIMBER_SH); set(W - 1 - x, yc + 4, I.TIMBER_SH);
          for (let y = 0; y < yc + 4; y += 1) { set(x, y, I.TIMBER); set(W - 1 - x, y, I.TIMBER_SH); }
        }
      }
      for (let y = 0; y < yf; y += 1) { set(BL, y, I.ROCK_SH); set(BR - 1, y, I.ROCK_SH); } // the corners
      if (SHAPE.pillars) [BL, BR - 6].forEach((px0) => { // the hall's pillars at the corners
        rect(px0, 0, 6, yf, I.ROCK); rect(px0, 0, 1, yf, I.ROCK_HI); rect(px0 + 5, 0, 1, yf, I.ROCK_SH);
        rect(px0 - 1, yf - 3, 8, 3, I.ROCK_SH); for (let y = 6; y < yf; y += 7) rect(px0, y, 6, 1, I.ROCK_SH);
      });
      // doors in the side walls: west and north on the left, east and south on the right;
      // a window in the side with fewer doors, where the room has one there (the schoolroom)
      const sides = { l: [], r: [] };
      (doorsOf(id) || []).forEach((d) => sides[d.dir === 'w' || d.dir === 'n' ? 'l' : 'r'].push(d));
      const spans = [[0.1, 0.5], [0.6, 0.88]]; // near, far (fractions of the side wall's width)
      const toX = (side, f0, f1) => { const a = Math.round(BL * f0); const b = Math.round(BL * f1); return side === 'l' ? [a, b] : [W - 1 - b, W - 1 - a]; };
      if (SHAPE.sideWindow) {
        const side = sides.l.length <= sides.r.length ? 'l' : 'r'; const [xa, xb] = toX(side, 0.45, 0.85);
        for (let x = xa; x <= xb; x += 1) {
          const bot = sideBot(x); const k = bot / yf; const y0 = Math.round(bot - yf * 0.86 * k); const y1 = Math.round(bot - yf * 0.36 * k);
          for (let y = y0; y <= y1; y += 1) {
            const frame = x === xa || x === xb || y === y0 || y === y1; const mull = x === Math.round((xa + xb) / 2);
            const g = clamp((y - y0) / (y1 - y0 + 1)) * (N_SKY - 1); const j = Math.min(N_SKY - 2, Math.floor(g));
            if (frame || mull) set(x, y, I.TIMBER_SH); else set(x, y, (g - j) > bayer(x, y) ? j + 1 : j, 1);
          }
          set(x, y1 + 1, I.LIME_HI);
        }
        pools.push({ x: side === 'l' ? BL + 6 : BR - 6, w: 10, y0: yf });
        sides[side] = sides[side].slice(0, 1); // the window takes the far place
      }
      Object.entries(sides).forEach(([side, list]) => list.slice(0, 2).forEach((d, n) => {
        const [xa, xb] = toX(side, ...spans[list.length === 1 && !SHAPE.sideWindow ? 0 : n]);
        const dh = Math.min(Math.round(yf * 0.62), hw - 3); let top = H; let bottom = 0;
        for (let x = xa; x <= xb; x += 1) {
          const bot = sideBot(x); const k = bot / yf; const yt = Math.round(bot - dh * k);
          top = Math.min(top, yt); bottom = Math.max(bottom, Math.round(bot));
          for (let y = yt; y < bot; y += 1) {
            const edge = x === xa || x === xb || y === yt;
            const band = Math.abs(y - (bot - dh * k * 0.3)) < 0.6 || Math.abs(y - (bot - dh * k * 0.75)) < 0.6;
            set(x, y, edge ? I.OUTLINE : band ? I.ARM_SH : ((x - xa) % 3 === 0 ? I.TIMBER_SH : I.TIMBER));
          }
          set(x, yt - 1, I.ROCK_HI); // its lintel
        }
        const rx = side === 'l' ? xb - 2 : xa + 2; const rb = sideBot(rx); set(rx, Math.round(rb - dh * (rb / yf) * 0.45), I.GOLD); // the ring
        const pm = Math.round((xa + xb) / 2); const pt = Math.round(sideBot(pm) - dh * (sideBot(pm) / yf)) - 4;
        rect(pm - 3, pt, 7, 2, I.GOLD_SH); rect(pm - 2, pt, 5, 1, I.GOLD_HI); // its plaque
        doorList.push({ t: d, b: { x: xa - 1, y: pt - 1, w: xb - xa + 3, h: bottom - pt + 1 } });
      }));
    }

    // pieces of furniture
    function windowArch(x0, y0, w, h) { // shows the sky and a line of far mountains
      const r = w / 2;
      for (let y = y0 - 2; y < y0 + h + 2; y += 1) {
        for (let x = x0 - 2; x < x0 + w + 2; x += 1) {
          const ax = x + 0.5 - (x0 + r); const ay = y - (y0 + r);
          const inside = y >= y0 + r ? x >= x0 && x < x0 + w && y < y0 + h : ax * ax + ay * ay < r * r;
          const frame = y >= y0 + r - 2 ? x >= x0 - 2 && x < x0 + w + 2 && y < y0 + h + 2 : ax * ax + ay * ay < (r + 2) ** 2;
          if (inside) {
            const g = clamp((y - y0) / h) * (N_SKY - 1);
            const j = Math.min(N_SKY - 2, Math.floor(g));
            let c = (g - j) > bayer(x, y) ? j + 1 : j;
            // looking out from the castle: the far edge of the forest, the meadow, the river below
            const edge = y0 + h * (0.66 + 0.05 * Math.abs(Math.sin(x * 0.9)) + 0.04 * ((x * 7) % 3));
            if (y > edge) c = I.FG_PINE;
            if (y > y0 + h * 0.76) c = (x + y) % 5 ? I.GRASS : I.GRASS_SH;
            if (y > y0 + h * 0.9) c = y === Math.ceil(y0 + h * 0.9) ? I.WATER_HI : I.WATER;
            set(x, y, c, 1);
          } else if (frame) set(x, y, I.WALL_HI);
        }
      }
      rect(x0 + Math.floor(r) - 1, y0, 2, h, I.TIMBER_SH); // mullion and transom
      rect(x0, y0 + Math.round(h * 0.45), w, 1, I.TIMBER_SH);
      rect(x0 - 3, y0 + h + 1, w + 6, 2, I.WALL_HI); rect(x0 - 3, y0 + h + 3, w + 6, 1, I.WALL_SH); // sill
      for (let k = 0; k < (w * h) / 18; k += 1) stars.push({ x: x0 + Math.floor(rng() * w), y: y0 + Math.floor(rng() * h * 0.6), ph: rng() * 6 });
      // the camp, far below: seen from the castle it is mirrored, so the knight and the wizard sit
      // to the right of their fire (outside, from the meadow's side, they are to its left)
      camps.push({ x: x0 + Math.max(1, Math.round(w * 0.3)), y: Math.round(y0 + h * 0.83) });
      pools.push({ x: x0 + w / 2, w, y0: y0 + h }); // a pale fall of light on the floor below it
      for (let k = 0; k < 10; k += 1) motes.push({ x: x0 + rng() * w, y: y0 + h + rng() * (yf - y0 - h), ph: rng() * 6 });
    }
    function candle(x, y, big) {
      rect(x, y - (big ? 4 : 3), 1, big ? 4 : 3, I.STEM); set(x, y, I.GOLD_SH); set(x - 1, y, I.GOLD); set(x + 1, y, I.GOLD);
      flames.push({ x, y: y - (big ? 5 : 4) }); lights.push({ x, y: y - 4, r: big ? 0.5 * H : 0.38 * H });
    }
    function desk(x, y, w) { // y: the top's height
      rect(x, y, w, 1, I.TIMBER_HI); rect(x, y + 1, w, 2, I.TIMBER); rect(x, y + 3, w, 1, I.TIMBER_SH);
      rect(x + 1, y + 4, 2, yf - y - 3, I.TIMBER_SH); rect(x + w - 3, y + 4, 2, yf - y - 3, I.TIMBER_SH);
    }
    const BOOK = [I.CLOTH, I.ROBE, I.GOLD_SH, I.HAT, I.DRAKE_SH, I.WING_SH, I.LEATHER, I.FERN_SH];
    function books(x, y, n, lean) { // spines standing on y
      let xx = x;
      for (let k = 0; k < n; k += 1) {
        const h = 4 + Math.floor(rng() * 4); const c = BOOK[Math.floor(rng() * BOOK.length)];
        rect(xx, y - h, 2, h, c); set(xx, y - h + 1, I.GOLD); set(xx + 1, y - h, c === I.GOLD_SH ? I.CLOTH : I.GOLD_SH);
        xx += 2 + (rng() < 0.2 ? 1 : 0);
        if (lean && k === n - 1) { set(xx, y - 1, c); set(xx + 1, y - 2, c); set(xx + 2, y - 3, c); }
      }
      return xx;
    }
    function openBook(x, y, w) {
      rect(x, y - 1, w, 1, I.LEATHER_SH);
      for (let k = 0; k < w; k += 1) {
        const hump = Math.round(Math.sin((k / (w - 1)) * Math.PI * 2) ** 2 * 1.5);
        set(x + k, y - 2 - hump, I.BEARD); set(x + k, y - 3 - hump, k === Math.floor(w / 2) ? I.BEARD_SH : I.BEARD_HI);
        if (k % 3 === 1 && k !== Math.floor(w / 2)) set(x + k, y - 2 - hump, I.BEARD_SH); // lines of text
      }
    }
    function shelf(x, y, w, h) { // a bookcase standing on the floor, top at y; returns its shelves
      rect(x, y, w, h, I.TIMBER_SH); rect(x, y, w, 1, I.TIMBER_HI); rect(x, y, 1, h, I.TIMBER_HI);
      const rows = [];
      for (let sy = y + 9; sy < y + h; sy += 9) {
        rect(x + 1, sy - 8, w - 2, 8, I.OUTLINE);
        books(x + 2, sy, Math.floor((w - 4) / 2.2), rng() < 0.5);
        rect(x + 1, sy, w - 2, 1, I.TIMBER);
        rows.push({ x: x + 1, y: sy - 8, w: w - 2, h: 9 });
      }
      return rows;
    }
    function rug(x, y, w) {
      for (let r = 0; r < 4; r += 1) for (let k = 0; k < w; k += 1) set(x + k, y + r, r === 0 || r === 3 || k === 0 || k === w - 1 ? I.GOLD_SH : (k + r) % 4 === 0 ? I.GOLD : I.CLOTH_SH);
    }
    function lantern(x, y) { set(x, y - 1, I.OUTLINE); rect(x - 1, y, 3, 3, I.ARM_SH); set(x, y + 1, I.WIN_LIT); flames.push({ x, y: y + 1, small: true }); lights.push({ x, y: y + 1, r: 0.3 * H }); }

    /* the text's holder stands where the text is (`sup`: its box, from the page, in this room's
       pixels); the room's other things keep to its left */
    const S0 = sup || { x: Math.round(W * 0.56), y: Math.round(H * 0.2), w: Math.round(W * 0.4), h: Math.round(H * 0.45) };
    const x0 = S0.x; const x1 = S0.x + S0.w; const top = S0.y; const bot = Math.min(H - 4, S0.y + S0.h);
    const stage = sup ? Math.max(30, x0 - 4) : Wi;
    const s = (f) => Math.round(f * stage);
    const floorY = (k) => yf + Math.round(k * (H - yf)); // k in [0, 1]: from the wall to the near edge
    const cat = (name, x, yb) => { const c = SPRITES.cats[name]; if (c) stamp(c, x, yb - c.h); };

    function easelUnder(dt) {
      const t = Math.min(dt, floorY(0.2)); const fy = floorY(0.5);
      rect(x0 - 2, t, x1 - x0 + 4, 2, I.TIMBER_HI); // the ledge the sheet rests on
      [[x0 + 4, x0 - 6], [x1 - 4, x1 + 6]].forEach(([ta, fa]) => { for (let y = t + 2; y < fy; y += 1) { const k = (y - t) / (fy - t); set(ta + (fa - ta) * k, y, I.TIMBER_SH); set(ta + (fa - ta) * k + 1, y, I.TIMBER); } });
      rect(x0, Math.round((t + fy) / 2), x1 - x0, 1, I.TIMBER_SH);
      rect(Math.round((x0 + x1) / 2), Math.max(6, top - 6), 1, 6, I.TIMBER_SH); // the mast behind, its clamp
      rect(Math.round((x0 + x1) / 2) - 2, Math.max(6, top - 2), 5, 2, I.ARM_SH);
    }
    function chandelier(cx0, y0 = 12) { // hangs from the beams on its chain: a ring of candles
      for (let y = 4; y < y0; y += 1) set(cx0, y, y % 2 ? I.ARM_SH : I.ARM);
      rect(cx0 - 7, y0, 15, 1, I.ARM_SH); rect(cx0 - 6, y0 + 1, 13, 1, I.ARM);
      [-6, -2, 2, 6].forEach((dx) => candle(cx0 + dx, y0 - 1, false));
    }

    const things = ROOM_NAMES[id] ? (itemsOf(id) || []) : null; // null: a project page, its text on the easel
    const slots = [];
    if (things) {
    /* ---- the rooms of the castle: each piece of the section is a thing in the room ---------
       (script.js lists them: `things`); laid out on a table seen from a little above, a shelf,
       a wall, a board; a second row when the first is full, so more content only means more
       things. slots[i]: where thing i is, for its hotspot. */
    const S = (f) => Math.round(BL + f * (BR - BL)); // a place on the back wall (fraction of it)
    const Sw = (f) => Math.round(f * (BR - BL)); // a width on it
    const box = (x, y, w, h) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    const shadow = (xc, y, w) => { for (let x = -Math.floor(w / 2); x <= Math.floor(w / 2); x += 1) if (bayer(xc + x, y) < 0.7) set(xc + x, y, I.TIMBER_SH); };
    function table3d(xc, yTop, w, depth = 7) { // the top a trapezoid (we look down on it), then its edge and legs
      const half = w / 2;
      for (let r = 0; r < depth; r += 1) {
        const ins = depth - 1 - r;
        for (let x = Math.round(xc - half + ins); x <= Math.round(xc + half - ins); x += 1) set(x, yTop + r, r === 0 ? I.TIMBER_HI : (x * 3 + r * 7) % 13 === 0 ? I.TIMBER_SH : I.TIMBER);
      }
      rect(xc - half, yTop + depth, w + 1, 3, I.TIMBER_SH); rect(xc - half, yTop + depth, w + 1, 1, I.TIMBER);
      const legY = yTop + depth + 3; const fy = floorY(0.5);
      [xc - half + depth - 1, xc + half - depth - 1].forEach((lx) => rect(lx, legY, 2, fy - legY - 4, I.OUTLINE)); // the far legs
      [xc - half + 1, xc + half - 3].forEach((lx) => { rect(lx, legY, 3, fy - legY, I.TIMBER_SH); set(lx, legY, I.TIMBER); });
      return { l: Math.round(xc - half + depth + 1), r: Math.round(xc + half - depth - 1), back: yTop + 3, front: yTop + depth };
    }
    /** n places along [l, r], `per` apart at least; overflow goes to further rows. Drawn back rows first. */
    function spread(n, l, r, per) {
      const fit = Math.max(1, Math.floor((r - l) / per)); const out = [];
      for (let k = 0; k < n; k += 1) {
        const row = Math.floor(k / fit); const inRow = Math.min(fit, n - row * fit);
        out.push({ k, row, xc: Math.round(l + (((k % fit) + 0.5) * (r - l)) / inRow) });
      }
      return out.sort((a, b) => b.row - a.row);
    }
    function charter(xc, y, armsId) { // a framed charter on a cord, sealed with the school's arms
      const w = 17; const h = 21; const x = xc - 8;
      set(xc, y - 4, I.OUTLINE); for (let k = 1; k <= 3; k += 1) { set(xc - k * 2, y - 4 + k, I.PLASTER_SH); set(xc + k * 2, y - 4 + k, I.PLASTER_SH); }
      rect(x, y, w, h, I.TIMBER); rect(x, y, w, 1, I.TIMBER_HI); rect(x, y, 1, h, I.TIMBER_HI);
      rect(x + 1, y + 1, w - 2, h - 2, I.PLASTER_HI);
      rect(x + 3, y + 2, w - 6, 1, I.PLASTER_SH); rect(x + 4, y + 4, w - 8, 1, I.PLASTER_SH);
      const sp = armsSprite(armsId); if (sp) stamp(sp, x + 2, y + 5);
      return box(x - 1, y - 4, w + 2, h + 5);
    }
    function scrollThing(xc, yb, armsId) { // a rolled report, tied, its seal the colour of the lab's field
      const x = xc - 7;
      rect(x + 1, yb - 4, 12, 4, I.PLASTER_HI); rect(x + 1, yb - 4, 12, 1, I.PLASTER_HI); rect(x + 1, yb - 1, 12, 1, I.PLASTER_SH);
      rect(x, yb - 4, 1, 4, I.PLASTER_SH); rect(x + 13, yb - 4, 1, 4, I.PLASTER_SH); set(x, yb - 3, I.PLASTER_HI); set(x + 13, yb - 3, I.PLASTER_HI);
      rect(x + 4, yb - 4, 1, 4, I.CLOTH); rect(x + 9, yb - 4, 1, 4, I.CLOTH);
      const rows = (window.ARMS || {})[armsId]; const f = rows ? I[TINCT[rows[1][1]]] : I.CAP;
      rect(x + 5, yb - 3, 4, 3, f); set(x + 6, yb - 2, I.GOLD); set(x + 7, yb - 2, I.GOLD);
      shadow(xc, yb, 13);
      return box(x - 1, yb - 6, 16, 8);
    }
    function model(xc, yb, mid) { // each project as a working model on its plinth
      rect(xc - 5, yb - 1, 11, 1, I.TIMBER_SH); rect(xc - 4, yb - 2, 9, 1, I.TIMBER);
      if (mid === 'nuclear-emulators') { // a nucleus and two orbits, on a brass rod
        rect(xc, yb - 7, 1, 5, I.ARM_SH);
        for (let a = 0; a < 6.28; a += 0.25) { set(xc + Math.round(Math.cos(a) * 5), yb - 11 + Math.round(Math.sin(a) * 2), I.ARM_HI); set(xc + Math.round(Math.cos(a) * 2), yb - 11 + Math.round(Math.sin(a) * 4), I.GOLD); }
        [[0, 0, I.CAP], [1, 0, I.WING], [0, 1, I.WING], [1, 1, I.CAP], [-1, 0, I.WING_SH], [0, -1, I.CAP_SH]].forEach(([dx, dy, c]) => set(xc + dx, yb - 11 + dy, c));
      } else if (mid === 'urban-morphogenesis') { // a jar where a little city has grown like a crystal
        for (let y = yb - 13; y < yb - 2; y += 1) { set(xc - 4, y, I.PLASTER_SH); set(xc + 4, y, I.PLASTER_HI); }
        rect(xc - 4, yb - 14, 9, 1, I.TIMBER); rect(xc - 3, yb - 15, 7, 1, I.TIMBER_HI);
        [[0, 0], [0, -1], [-1, -2], [1, -2], [0, -3], [-2, -3], [2, -4], [-1, -5], [1, -5], [-3, -5], [0, -6], [2, -7], [-2, -7], [1, -8], [-1, -9], [3, -6]]
          .forEach(([dx, dy]) => set(xc + dx, yb - 3 + dy, I.GOLD_HI));
      } else if (mid === 'n-body') { // three masses on wires round a centre
        rect(xc, yb - 8, 1, 6, I.ARM_SH);
        [[-4, -10, I.CAP], [4, -11, I.WING_HI], [1, -14, I.GOLD_HI]].forEach(([dx, dy, c]) => {
          for (let k = 0; k <= 8; k += 1) set(xc + Math.round((dx * k) / 8), yb - 8 + Math.round(((dy + 8) * k) / 8), I.ARM);
          rect(xc + dx - 1, yb + dy - 1, 2, 2, c);
        });
      } else { rect(xc - 4, yb - 9, 9, 7, I.TIMBER); rect(xc - 4, yb - 9, 9, 1, I.TIMBER_HI); set(xc, yb - 6, I.GOLD); } // a crate
      rect(xc + 5, yb - 4, 3, 2, I.PLASTER_HI); set(xc + 4, yb - 4, I.OUTLINE); // its paper tag
      shadow(xc, yb, 10);
      return box(xc - 6, yb - 17, 15, 18);
    }
    function bookFace(xc, yb, k) { // a book shown face out, gilt title
      const c = BOOK[k % BOOK.length]; const x = xc - 4;
      rect(x, yb - 12, 9, 12, c); rect(x, yb - 12, 1, 12, I.OUTLINE);
      rect(x + 2, yb - 11, 6, 1, I.GOLD); rect(x + 2, yb - 2, 6, 1, I.GOLD); rect(x + 3, yb - 8, 4, 1, I.GOLD_HI); rect(x + 3, yb - 6, 4, 1, I.GOLD_HI);
      return box(x - 1, yb - 13, 11, 14);
    }
    function letterThing(xc, y, k) { // a sealed letter pinned up, a little askew
      const x = xc - 6 + ((k * 7) % 3) - 1; const yy = y + ((k * 5) % 3) - 1;
      rect(x, yy, 12, 9, I.PLASTER_HI); rect(x, yy, 12, 1, I.PLASTER_HI); rect(x + 11, yy, 1, 9, I.PLASTER_SH); rect(x, yy + 8, 12, 1, I.PLASTER_SH);
      for (let r = 0; r < 3; r += 1) rect(x + 2, yy + 3 + r * 2, 7 - (r === 2 ? 3 : 0), 1, I.PLASTER_SH);
      rect(x + 8, yy + 5, 2, 2, I.CAP); set(x + 5, yy - 1, I.GOLD); set(x + 5, yy, I.ARM_SH);
      return box(x - 1, yy - 2, 14, 12);
    }
    function door(a, b, t) { // a great door under a round arch
      const r = (b - a) / 2;
      for (let y = t - 3; y < yf; y += 1) for (let x = a - 3; x < b + 3; x += 1) {
        const ax = (x + 0.5 - a - r) / r; const ay = (y - t - r) / r;
        const inArch = y >= t + r ? x >= a && x < b : ax * ax + ay * ay <= 1;
        const inStone = y >= t + r ? x >= a - 3 && x < b + 3 : ax * ax + ay * ay <= ((r + 3) / r) ** 2;
        if (inArch) set(x, y, (x - a) % 5 === 0 ? I.TIMBER_SH : (y - t) % 12 === 6 ? I.ARM_SH : noise2(x, y) > 0.6 ? I.TIMBER_SH : I.TIMBER);
        else if (inStone) set(x, y, (x + y) % 7 === 0 ? I.ROCK_DK : I.ROCK_HI);
      }
      set(b - 4, Math.round((t + yf) / 2) + 4, I.GOLD); set(b - 4, Math.round((t + yf) / 2) + 5, I.GOLD_SH);
    }
    const n = things.length;
    /* the path so far, as wall hangings: each school or lab its own small tapestry on a rod,
       the schools in the council chamber, the labs in the observatory; each one can be looked at */
    const LABS = new Set(['ijclab', 'ceremade', 'sciencespo']);
    const hangs = (heraldry.tapestry || []).filter(([aid]) => (kind === 'research' ? LABS.has(aid) : kind === 'talks' ? !LABS.has(aid) : false));
    const extra = [];
    const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    function hanging(xc, y0, [aid, name, desc], k) {
      const w = 17; const h = 19; const x = xc - 8; const cy = y0 + 2;
      rect(x - 2, y0, w + 4, 1, I.TIMBER_SH); set(x - 3, y0, I.GOLD); set(x + w + 2, y0, I.GOLD); // the rod and its finials
      set(x + 2, y0 + 1, I.OUTLINE); set(x + w - 3, y0 + 1, I.OUTLINE); // its rings
      for (let y = 0; y < h; y += 1) for (let xx = 0; xx < w; xx += 1) {
        const edge = xx === 0 || xx === w - 1 || y === 0 || y === h - 1;
        set(x + xx, cy + y, edge ? I.GOLD_SH : (xx + y * 3 + k) % 7 === 0 ? I.PLASTER : I.PLASTER_HI); // woven, a little uneven
      }
      for (let xx = 0; xx < w; xx += 2) set(x + xx, cy + h, I.GOLD); // the fringe
      const sp = armsSprite(aid); if (sp) stamp(sp, x + 2, cy + 2);
      extra.push({ t: { kind: 'hanging', label: name, html: `<h3>${escHtml(name)}</h3><p>${escHtml(desc)}</p>` }, b: box(x - 2, y0, w + 4, h + 4) });
    }
    const of = (kind) => things.map((t, i) => [t, i]).filter(([t]) => t.kind === kind);

    if (kind === 'about') { // the scriptorium: a notebook open on the table, the charters of the schools on the wall
      const ww = Math.max(14, Sw(0.16)); windowArch(S(0.5) - Math.round(ww / 2), Math.round(H * 0.1), ww, Math.round(H * 0.4)); // the great window, over the table
      const tb = table3d(S(0.48), yf - 16, Math.round((BR - BL) * 0.34));
      of('desk-book').forEach(([, i]) => { openBook(S(0.48) - 9, tb.front, 18); slots[i] = box(S(0.48) - 10, tb.front - 6, 20, 7); });
      candle(tb.l - 1, tb.back, true); candle(tb.r + 1, tb.back, false);
      deco.push({ type: 'hourglass', x: tb.r - 4, y: tb.front - 10 });
      const ch = of('charter');
      const half = Math.ceil(ch.length / 2); // the charters either side of the window
      spread(half, S(0), S(0.41), 20).forEach(({ k, row, xc }) => { const [t, i] = ch[k]; slots[i] = charter(xc, Math.round(H * 0.14) + row * 26, t.arms); });
      spread(ch.length - half, S(0.59), S(0.81), 20).forEach(({ k, row, xc }) => { const [t, i] = ch[half + k]; slots[i] = charter(xc, Math.round(H * 0.14) + row * 26, t.arms); });
      const shX = S(box3d ? 0.83 : 0.8); const shTop = Math.round(H * 0.3); shelf(shX, shTop, Math.max(16, BR - shX - 2), yf - shTop);
      rug(S(0.3), floorY(0.6), Math.round((BR - BL) * 0.36));
    } else if (kind === 'research') { // the observatory: the labs' reports, rolled and sealed, on the chart table
      for (let y = 4; y < Math.round(H * 0.42); y += 1) {
        const half = Math.sqrt(Math.max(0, 1 - ((Math.round(H * 0.42) - y) / (H * 0.4)) ** 2)) * W * 0.5; // (over the side walls too: the dome caps the whole tower)
        for (let x = 0; x < W; x += 1) if (Math.abs(x - W / 2) > half) set(x, y, (x + Math.round(y * 1.5)) % 9 === 0 ? I.SLATE_HI : (x + y) % 5 ? I.SLATE_SH : I.SLATE);
      }
      const sw = Math.max(14, Sw(0.18)); windowArch(S(0.5) - Math.round(sw / 2), 5, sw, Math.round(H * 0.46)); // the slit, wide open
      for (let k = 0; k < 22; k += 1) { const tx = S(0.2) + k; const ty = floorY(0.1) - 20 - Math.round(k * 0.75); set(tx, ty, k < 4 ? I.GOLD_SH : I.ARM_HI); set(tx, ty + 1, I.ARM_SH); if (k > 15) set(tx, ty - 1, I.ARM); } // the telescope, at the slit
      [-5, 0, 5].forEach((dx) => { for (let r = 0; r < 20; r += 1) set(S(0.21) + dx * (r / 20), floorY(0.1) - 20 + r, I.TIMBER_SH); });
      const tb = table3d(S(0.62), yf - 16, Sw(0.4));
      spread(n, tb.l, tb.r, 16).forEach(({ k, row, xc }) => { slots[k] = scrollThing(xc, row ? tb.back + 1 : tb.front, things[k].arms); });
      deco.push({ type: 'orrery', x: S(0.9), y: floorY(0.1) - 14 });
      hangs.forEach((e, k) => { // the labs' hangings, either side of the slit
        const lft = k < Math.ceil(hangs.length / 2); const j = lft ? k : k - Math.ceil(hangs.length / 2);
        hanging(lft ? S(0.32) - j * 24 : S(0.68) + j * 24, Math.round(H * 0.18), e, k);
      });
      rect(S(0.86), floorY(0.1) - 6, 13, 1, I.TIMBER_HI); rect(S(0.87), floorY(0.1) - 5, 1, 6, I.TIMBER_SH); rect(S(0.86) + 11, floorY(0.1) - 5, 1, 6, I.TIMBER_SH);
      cat('thin', S(0.04), floorY(0.5));
    } else if (kind === 'projects') { // the workshop: a working model of each project on the bench
      const hx = S(0.03); const hw = Math.max(18, S(0.2)); const hy = yf - 24;
      rect(hx - 3, hy - 5, hw + 6, 29, I.BRICK_SH); rect(hx - 3, hy - 5, hw + 6, 2, I.BRICK_HI);
      rect(hx, hy, hw, 24, I.OUTLINE);
      for (let y = 0; y < hy - 5; y += 1) rect(hx + hw / 2 - 4, y, 8, 1, y % 3 ? I.BRICK : I.BRICK_SH);
      flames.push({ x: hx + hw / 2, y: yf - 1, hearth: true, w: hw - 4 }); lights.push({ x: hx + hw / 2, y: yf - 6, r: 0.6 * H });
      rect(S(0.4), Math.round(H * 0.26), S(0.36), 1, I.TIMBER_SH); // the tool rack over the bench
      for (let k = 0; k < 7; k += 1) { const tx = S(0.42) + k * Math.max(4, S(0.05)); rect(tx, Math.round(H * 0.26) + 1, 1, 6 + (k % 3) * 2, k % 2 ? I.ARM_SH : I.TIMBER); rect(tx - 1, Math.round(H * 0.26) + 6 + (k % 3) * 2, 3, 2, I.ARM_HI); }
      const tb = table3d(S(0.58), yf - 16, Sw(0.42));
      spread(n, tb.l, tb.r, 17).forEach(({ k, row, xc }) => { slots[k] = model(xc, row ? tb.back : tb.front, things[k].model); });
      deco.push({ type: 'gear', x: S(0.88), y: Math.round(H * 0.45), r: 4, sp: 0.8 }, { type: 'gear', x: S(0.88) + 8, y: Math.round(H * 0.45) + 4, r: 3, sp: -1.1 });
      lantern(S(0.93), Math.round(H * 0.2));
      const ax = S(0.3); rect(ax, floorY(0.4) - 9, 12, 3, I.ARM_HI); rect(ax, floorY(0.4) - 9, 12, 1, I.BLADE); rect(ax + 3, floorY(0.4) - 6, 6, 3, I.ARM_SH); rect(ax + 2, floorY(0.4) - 3, 8, 3, I.ARM_SH);
    } else if (kind === 'publications') { // the library: each work face out on the display shelf
      // the two bookcases: each shelf a subject (site.toml [library]), each catalogued volume a gilt spine on it
      const rx = S(0.76);
      const shelfRows = [...shelf(S(0) + 2, 7, Math.max(16, Sw(0.22)), yf - 7), ...shelf(rx, 7, Math.max(16, BR - rx - 2), yf - 7)];
      const rowOf = {};
      of('shelf').forEach(([t, i], k) => { if (shelfRows[k]) { slots[i] = box(shelfRows[k].x, shelfRows[k].y, shelfRows[k].w, shelfRows[k].h); rowOf[t.shelf] = shelfRows[k]; } });
      const onShelf = {};
      of('volume').forEach(([t, i]) => {
        const sr = rowOf[t.shelf]; if (!sr) return;
        const j = onShelf[t.shelf] = (onShelf[t.shelf] || 0) + 1; const x = sr.x + sr.w - 1 - j * 4;
        if (x < sr.x + 1) return; // a full shelf: the rest are in the catalogue only
        rect(x, sr.y + 1, 3, 7, I.CLOTH_SH); rect(x, sr.y + 2, 3, 1, I.GOLD_HI); rect(x, sr.y + 6, 3, 1, I.GOLD); set(x + 1, sr.y + 4, I.GOLD);
        slots[i] = box(x - 1, sr.y, 5, 9);
      });
      const pubs = of('book'); const np = pubs.length;
      const l = S(0.32); const r = S(0.68); const fit = Math.max(1, Math.floor((r - l) / 13)); const rows = Math.ceil(np / fit) || 1;
      for (let row = 0; row < rows; row += 1) { const y = Math.round(H * 0.5) - row * 17; rect(l - 2, y, r - l + 4, 2, I.TIMBER_HI); rect(l - 2, y + 2, r - l + 4, 1, I.TIMBER_SH); }
      spread(np, l, r, 13).forEach(({ k, row, xc }) => { slots[pubs[k][1]] = bookFace(xc, Math.round(H * 0.5) - row * 17, k); });
      if (rows < 2) windowArch(S(0.5) - 6, 7, 12, Math.round(H * 0.24));
      const lx = S(0.5) - 4; rect(lx + 3, yf - 13, 2, 13, I.TIMBER_SH); rect(lx + 1, yf - 1, 6, 1, I.TIMBER_SH); // a lectern before them
      for (let k = 0; k < 9; k += 1) set(lx + k, yf - 14 + Math.floor(k / 3), I.TIMBER_HI);
      openBook(lx, yf - 14, 9); candle(lx + 12, yf - 2, true);
      rug(S(0.3), floorY(0.55), Sw(0.4));
      cat('whiteTabby', S(0.36), floorY(0.55) + 4); // asleep on the rug, by the lectern
    } else if (kind === 'talks') { // the great hall: a banner on the pole for each talk; the tapestry
      // the schools' hangings along the wall, each on its own rod (one row; spread when there is room)
      const gap = clamp(Math.floor((BR - BL - 6) / Math.max(1, hangs.length)), 21, 24); const tw = hangs.length * gap; const narrow = BR - (tw + S(0.05) + 10) < 72;
      const tx = narrow ? Math.max(BL + 2, Math.round(BL + (BR - BL - tw) / 2)) : S(0.05); const ty = 9;
      hangs.forEach((e, k) => hanging(tx + 12 + k * gap, ty + (k % 2) * 2, e, k));
      // the council chamber: a round table, high-backed chairs about it, a chandelier over it;
      // each talk a scroll laid at a place (from the far side round to the near), more at the centre
      // the table takes the room right of the tapestry, whole: it never runs off the edges
      // (a narrow room: the table stands in front of the tapestry, which hangs on the wall behind it)
      const free0 = narrow ? S(0.1) : tx + tw + 10;
      const rx = Math.max(22, Math.min(56, Math.floor((BR - free0 - 12) / 2)));
      const tcx = Math.round(free0 + (BR - free0) / 2); const ry = Math.max(7, Math.round(rx * 0.28));
      const tcy = Math.min(yf + 2, H - ry - 14);
      const onEllipse = (ang, k = 1) => [Math.round(tcx + Math.cos(ang) * rx * k), Math.round(tcy + Math.sin(ang) * ry * k)];
      const far = [-0.78, -0.5, -0.22].map((f) => f * Math.PI); // the places behind the table
      far.forEach((ang) => { // a high back rising behind the table's far edge (the table hides the seat)
        const [x, y] = onEllipse(ang, 1);
        rect(x - 3, y - 13, 7, 14, I.TIMBER); rect(x - 3, y - 13, 7, 1, I.TIMBER_HI); rect(x - 3, y - 13, 1, 14, I.TIMBER_HI);
        set(x, y - 14, I.GOLD); rect(x - 1, y - 10, 3, 4, I.CLOTH);
      });
      for (let y = -ry; y <= ry; y += 1) { // the top, an ellipse seen from a little above
        const half = Math.round(rx * Math.sqrt(1 - (y / ry) ** 2));
        for (let x = -half; x <= half; x += 1) set(tcx + x, tcy + y, y === -ry || Math.abs(x) === half ? I.TIMBER_HI : ((x * 3 + y * 5) % 13 === 0 ? I.TIMBER_SH : I.TIMBER));
      }
      for (let x = -rx + 1; x < rx; x += 1) { const yy = tcy + Math.round(ry * Math.sqrt(1 - (x / rx) ** 2)); rect(tcx + x, yy + 1, 1, 3, I.TIMBER_SH); } // its edge
      rect(tcx - 3, tcy + ry + 4, 7, Math.max(2, floorY(0.85) - tcy - ry - 4), I.TIMBER_SH); rect(tcx - 8, floorY(0.85) - 1, 17, 2, I.TIMBER_SH); // the pedestal
      [Math.PI, 0].forEach((ang) => { // the two ends: chairs seen from the side, against the table
        const x = Math.round(tcx + Math.cos(ang) * (rx + 3)); const dir = Math.cos(ang) > 0 ? 1 : -1;
        rect(x + dir * 2, tcy - 12, 2, 18, I.TIMBER); set(x + dir * 2, tcy - 13, I.GOLD); // the back
        rect(x - 2, tcy + 2, 6, 2, I.TIMBER_HI); rect(x - 2, tcy + 4, 1, 6, I.TIMBER_SH); rect(x + 3, tcy + 4, 1, 6, I.TIMBER_SH); // seat, legs
      });
      for (let a2 = 0; a2 < 6.28; a2 += 0.35) set(tcx + Math.round(Math.cos(a2) * rx * 0.25), tcy + Math.round(Math.sin(a2) * ry * 0.25), I.GOLD_SH); // a carved rose
      rect(tcx, tcy - 3, 1, 3, I.GOLD_SH); rect(tcx - 3, tcy - 3, 7, 1, I.GOLD); // the candelabrum
      [-3, 0, 3].forEach((dx) => candle(tcx + dx, tcy - 4, false));
      [[-0.6, -0.3], [0.55, -0.2], [0.15, 0.45]].forEach(([fx, fy]) => { const gx = tcx + Math.round(fx * rx); const gy = tcy + Math.round(fy * ry); rect(gx, gy - 3, 2, 2, I.GOLD); set(gx, gy - 1, I.GOLD_SH); set(gx + 1, gy - 1, I.GOLD_SH); }); // goblets
      { const mx0 = tcx - Math.round(rx * 0.45); const my = tcy + Math.round(ry * 0.2); rect(mx0, my, 11, 5, I.PLASTER_HI); for (let k = 0; k < 11; k += 1) set(mx0 + k, my + 2 + (k % 3 === 0 ? 1 : 0), I.WATER); set(mx0 + 3, my + 1, I.CAP); } // a map unrolled
      set(tcx + Math.round(rx * 0.45), tcy + 1, I.OUTLINE); set(tcx + Math.round(rx * 0.45) + 1, tcy, I.PLASTER_HI); // the quill in its pot
      // the talks: a scroll at each place, far side first, then the ends, then the near side; the rest at the centre
      const places = [...far, -0.92 * Math.PI, -0.08 * Math.PI, 0.75 * Math.PI, 0.25 * Math.PI];
      things.forEach((_t, k) => {
        const [x, y] = k < places.length ? onEllipse(places[k], 0.72) : [tcx + ((k * 5) % 9) - 4, tcy + 1];
        slots[k] = scrollThing(x, y + 2, null);
      });
      [0.72, 0.28].map((f) => f * Math.PI).forEach((ang) => { // the near chairs: their backs, seen from behind, against the near edge
        const [x, y] = onEllipse(ang, 1);
        rect(x - 4, y - 6, 9, 12, I.TIMBER_SH); rect(x - 4, y - 6, 9, 1, I.TIMBER);
        for (let k = 1; k < 8; k += 2) rect(x - 4 + k, y - 4, 1, 8, I.TIMBER);
        rect(x - 4, y + 6, 1, Math.max(1, floorY(0.95) - y - 6), I.TIMBER_SH); rect(x + 4, y + 6, 1, Math.max(1, floorY(0.95) - y - 6), I.TIMBER_SH);
      });
      if (!narrow) chandelier(tcx, Math.max(Math.round(H * 0.3), tcy - ry - 26)); // low over the table, clear of the menu's beam
      const lx = tcx - rx - 16; // the speaker's lectern, at the head of the table, waiting
      rect(lx + 3, yf - 13, 2, 13, I.TIMBER_SH); rect(lx + 1, yf - 1, 6, 1, I.TIMBER_SH);
      for (let k = 0; k < 9; k += 1) set(lx + k, yf - 14 + Math.floor(k / 3), I.TIMBER_HI);
      (narrow ? [] : [S(0.95), S(0.86)]).forEach((bx) => { // the council's two banners on the end wall
        const by = Math.round(H * 0.24);
        for (let r = 0; r < 16; r += 1) for (let c = 0; c < 5; c += 1) { if (r === 15 && c === 2) continue; set(bx + c, by + r, c === 2 ? I.T_OR : c === 4 ? I.BANNER_SH : I.BANNER); }
        rect(bx - 1, by - 1, 7, 1, I.TIMBER_SH);
      });
    } else if (kind === 'teaching') { // the schoolroom: each course a line of chalk on the board
      const bl = S(0.16); const br = S(0.84); const bt = Math.round(H * 0.18); const bb = Math.round(H * 0.6);
      for (let y = bt - 3; y < bb + 3; y += 1) for (let x = bl - 3; x < br + 3; x += 1) {
        const fr = x < bl || x >= br || y < bt || y >= bb;
        set(x, y, fr ? ((x === bl - 3 || y === bt - 3) ? I.TIMBER_HI : I.TIMBER) : (noise2(x, y) > 0.62 ? I.SLATEB_HI : I.SLATEB));
      }
      rect(bl - 3, bb + 3, br - bl + 6, 2, I.TIMBER_HI); set(bl + 4, bb + 2, I.FL_WHITE); set(bl + 5, bb + 2, I.FL_WHITE); set(br - 8, bb + 2, I.FL_YEL);
      things.forEach((_t, k) => { // a line of chalk, then a little sketch at its end
        const y = bt + 5 + k * 7; let x = bl + 4;
        while (x < br - 10) { const w = 2 + ((x * 7 + k) % 4); for (let c = 0; c < w; c += 1) set(x + c, y + ((c + k) % 3 === 0 ? -1 : 0), I.FL_WHITE); x += w + 2; }
        slots[k] = box(bl + 2, y - 3, br - bl - 4, 6);
      });
      // under the courses, the board's standing equations, in chalk: Schrödinger, diffusion,
      // the partition function, Hamilton-Jacobi-Bellman (the M1, the projects, the masters)
      let ey = bt + 4 + things.length * 7;
      CHALK.forEach((line) => {
        const w = line.length * 4;
        if (ey + 5 > bb - 2 || w > br - bl - 4) return; // what does not fit the board is not written
        let ex = Math.round(bl + (br - bl - w) / 2);
        [...line].forEach((ch) => { const g = GLYPHS[ch]; if (g) g.forEach((row, ry) => [...row].forEach((b, rx) => { if (b === '1') set(ex + rx, ey + ry, (ex + ey + rx) % 7 ? I.FL_WHITE : I.PLASTER); })); ex += 4; });
        ey += 8;
      });
      const dx = S(0.86); const dw = Math.max(10, BR - dx - 2); desk(dx, yf - 10, dw); candle(dx + dw - 3, yf - 11, true);
      for (let k = 0; k < 5; k += 1) set(dx + 3 + k * 2, yf - 12, k % 2 ? I.CAP : I.GOLD); rect(dx + 2, yf - 13, 11, 1, I.TIMBER_SH);
      // the class: two rows, each a long desk, the pupils on their chairs before it (we see their
      // backs: they face the board); the master at the board's left, his staff on the equations
      const rowAt = [yf + 7, Math.min(H - 2, yf + 16)];
      let pk = 0;
      rowAt.forEach((fy, row) => {
        const l = bl - 4 - row * 5; const r = (row ? br + 2 : br - 4); const seats = Math.max(2, Math.floor((r - l) / 19));
        const dt = fy - 11; // the desk's top, beyond the pupils
        rect(l, dt, r - l, 1, I.TIMBER_HI); rect(l, dt + 1, r - l, 2, I.TIMBER); rect(l, dt + 3, r - l, 1, I.TIMBER_SH); set(l, dt, I.OUTLINE); set(r - 1, dt, I.OUTLINE);
        for (let x = l + 1; x < r; x += Math.max(8, Math.floor((r - l - 2) / 3))) rect(Math.min(x, r - 2), dt + 4, 1, 6, I.OUTLINE); // its legs
        for (let k = 0; k < seats; k += 1) {
          const xc = Math.round(l + ((k + 0.5) * (r - l)) / seats);
          rect(xc + 5, dt - 1, 5, 1, I.SLATEB); rect(xc + 5, dt - 2, 5, 1, I.TIMBER); // a slate on the desk, an inkpot
          set(xc - 8, dt - 1, I.OUTLINE); set(xc - 8, dt - 2, I.ARM_SH);
          const sp = pupil(pk); pk += 1;
          stamp(sp, xc - 4, fy - 5 - sp.h + 2);
          // the chair's back, between us and the pupil: posts, top rail, a slat; the seat's edge below
          rect(xc - 6, fy - 11, 2, 11, I.TIMBER_SH); rect(xc + 4, fy - 11, 2, 11, I.TIMBER_SH); set(xc - 6, fy - 11, I.TIMBER_HI);
          rect(xc - 6, fy - 11, 12, 2, I.TIMBER); rect(xc - 6, fy - 11, 12, 1, I.TIMBER_HI); rect(xc - 4, fy - 7, 8, 1, I.TIMBER);
          rect(xc - 6, fy - 4, 12, 1, I.TIMBER_SH); rect(xc - 6, fy - 1, 1, 1, I.OUTLINE); rect(xc + 5, fy - 1, 1, 1, I.OUTLINE);
        }
      });
      { const ms = SPRITES.master; stamp(ms, bl - ms.w + 4, yf + 3 - ms.h); }
      [bl + 12, bl + Math.round((br - bl) * 0.3)].forEach((x) => { rect(x, yf + 9, 5, 2, I.SLATEB); rect(x, yf + 8, 5, 1, I.TIMBER); });
      { const gx0 = dx + Math.round(dw / 2); const gy = yf - 16; // a globe on the master's desk
        for (let y = -3; y <= 3; y += 1) for (let x = -3; x <= 3; x += 1) if (x * x + y * y <= 10) set(gx0 + x, gy + y, (x + y * 2) % 4 === 0 ? I.FERN : I.WATER);
        rect(gx0, gy + 4, 1, 2, I.GOLD_SH); rect(gx0 - 2, gy + 5, 5, 1, I.GOLD); set(gx0 - 4, gy, I.GOLD_SH); set(gx0 + 4, gy, I.GOLD_SH); }
      [[2, I.CLOTH], [1, I.ROBE], [3, I.FERN_SH]].forEach(([w, c], k) => rect(dx + 2, yf + 2 - k * 2, 4 + w, 2, c)); // books stacked under the master's desk
      rect(bl + 3, bb + 2, 4, 1, I.CLOTH_SH); // the duster on the ledge
    } else if (kind === 'news') { // the rookery: each piece of news a letter pinned on the cork
      const cl = S(0.64); const cr = S(0.97); const ct = Math.round(H * 0.18);
      const fit = Math.max(1, Math.floor((cr - cl - 4) / 15)); const cb = Math.max(Math.round(H * 0.5), ct + 6 + Math.ceil(n / fit) * 13);
      for (let y = ct - 2; y < cb + 2; y += 1) for (let x = cl - 2; x < cr + 2; x += 1) {
        const fr = x < cl || x >= cr || y < ct || y >= cb;
        set(x, y, fr ? I.TIMBER_SH : (x * 7 + y * 3) % 5 === 0 ? I.CORK_SH : I.CORK);
      }
      things.forEach((_t, k) => { slots[k] = letterThing(cl + 8 + (k % fit) * 15, ct + 4 + Math.floor(k / fit) * 13, k); });
      const rv = SPRITES.raven;
      [[0.02, 0.3, 2], [0.05, 0.56, 2]].forEach(([f, fy, nn]) => {
        const py = Math.round(H * fy); rect(S(f), py, Sw(0.3), 2, I.TIMBER_SH); set(S(f), py, I.TIMBER_HI);
        for (let k = 0; k < nn; k += 1) { const x = S(f) + 2 + k * (rv.w + 3); stamp(rv, x, py - rv.h + 2); blinks.push({ x: x + 6, y: py - rv.h + 3, ph: rng() * 6 }); }
      });
      const nw = Math.max(16, Sw(0.22)); windowArch(S(0.48) - Math.round(nw / 2), Math.round(H * 0.1), nw, Math.round(H * 0.42)); // where they come and go
      for (let k = 0; k < 7; k += 1) set(S(0.1) + Math.floor(rng() * S(0.8)), floorY(0.2 + rng() * 0.6), I.BEARD_SH);
      lantern(S(0.96), Math.round(H * 0.24));
    } else { // contact: the letterbox in the door, a lodestone and the register on the table, a map of Paris
      const a = S(0.42); const b = S(0.62); door(a, b, Math.round(H * 0.16));
      lantern(b + 6, Math.round(H * 0.38));
      for (let k = 0; k < 3; k += 1) { set(a - 6 + k * 2, Math.round(H * 0.42), I.GOLD); set(a - 6 + k * 2, Math.round(H * 0.42) + 1, I.GOLD_SH); }
      const tb = table3d(S(0.2), yf - 14, Sw(0.26));
      things.forEach((t, i) => {
        if (t.kind === 'letterbox') { const lx = Math.round((a + b) / 2) - 4; const ly = Math.round(H * 0.5); rect(lx, ly, 9, 5, I.ARM_SH); rect(lx, ly, 9, 1, I.ARM_HI); rect(lx + 2, ly + 2, 5, 1, I.OUTLINE); set(lx + 4, ly + 4, I.GOLD); slots[i] = box(lx - 1, ly - 1, 11, 7); }
        else if (t.kind === 'lodestone') { const xc = tb.l + 4; rect(xc - 3, tb.front - 4, 7, 4, I.STONE); rect(xc - 3, tb.front - 4, 7, 1, I.STONE_HI); rect(xc - 4, tb.front - 3, 5, 1, I.CAP); rect(xc + 1, tb.front - 3, 4, 1, I.WING); shadow(xc, tb.front, 8); slots[i] = box(xc - 5, tb.front - 6, 11, 7); }
        else if (t.kind === 'map') { const mx0 = S(0.72); const my = Math.round(H * 0.24); rect(mx0, my, 20, 15, I.TIMBER); rect(mx0 + 1, my + 1, 18, 13, I.BEARD);
          for (let x = 0; x < 18; x += 1) set(mx0 + 1 + x, my + 7 + Math.round(Math.sin(x * 0.5) * 2), I.WATER); [[5, 4], [11, 9], [14, 3]].forEach(([dx, dy]) => set(mx0 + dx, my + dy, I.CAP)); slots[i] = box(mx0 - 1, my - 1, 22, 17); }
        else if (t.kind === 'register') { openBook(tb.r - 12, tb.front, 11); slots[i] = box(tb.r - 13, tb.front - 6, 13, 7); }
        else { const xc = tb.l + 14; rect(xc - 3, tb.front - 3, 6, 3, I.BEARD); slots[i] = box(xc - 4, tb.front - 4, 8, 5); }
      });
      candle(tb.r - 2, tb.back, true);
      windowArch(S(0.06), Math.round(H * 0.14), Math.max(10, Sw(0.1)), Math.round(H * 0.26));
    }
    doorList.forEach((e) => extra.push(e));
    extra.forEach(({ t, b }) => { slots[things.length] = b; things.push(t); }); // the hangings and the doors can be looked at too
    } else { // a project page: the workshop, its text on the blueprint on the easel
      easelUnder(bot);
      const hx = s(0.05); const hw = Math.max(18, s(0.32)); const hy = yf - 24;
      rect(hx - 3, hy - 5, hw + 6, 29, I.BRICK_SH); rect(hx - 3, hy - 5, hw + 6, 2, I.BRICK_HI);
      rect(hx, hy, hw, 24, I.OUTLINE);
      for (let y = 0; y < hy - 5; y += 1) rect(hx + hw / 2 - 4, y, 8, 1, y % 3 ? I.BRICK : I.BRICK_SH); // the flue
      flames.push({ x: hx + hw / 2, y: yf - 1, hearth: true, w: hw - 4 }); lights.push({ x: hx + hw / 2, y: yf - 6, r: 0.6 * H });
      const ax = s(0.52); rect(ax, floorY(0.3) - 9, 12, 3, I.ARM_HI); rect(ax, floorY(0.3) - 9, 12, 1, I.BLADE); rect(ax + 3, floorY(0.3) - 6, 6, 3, I.ARM_SH); rect(ax + 2, floorY(0.3) - 3, 8, 3, I.ARM_SH); set(ax - 1, floorY(0.3) - 8, I.ARM); // anvil
      rect(s(0.45), Math.round(H * 0.28), s(0.45), 1, I.TIMBER_SH); // the tool rack
      for (let k = 0; k < 6; k += 1) { const tx = s(0.48) + k * Math.max(3, s(0.07)); rect(tx, Math.round(H * 0.28) + 1, 1, 6 + (k % 3) * 2, k % 2 ? I.ARM_SH : I.TIMBER); rect(tx - 1, Math.round(H * 0.28) + 6 + (k % 3) * 2, 3, 2, I.ARM_HI); }
      deco.push({ type: 'gear', x: s(0.78), y: Math.round(H * 0.5), r: 4, sp: 0.8 }, { type: 'gear', x: s(0.78) + 8, y: Math.round(H * 0.5) + 4, r: 3, sp: -1.1 });
      lantern(s(0.9), Math.round(H * 0.18));
    }
    return { id, W, H, idx, out, lights, flames, stars, motes, blinks, camps, deco, pools, yf, slots: things ? slots : [], things: things || [], cells: new Float32Array(9 * 14) };
  }

  /* ---- palette from the sun's altitude -------------------------------- */

  // at night the volumes go flat (no sun to model them): each group is pulled to its mean
  const FLATTEN = [['MT_FAR', 'MT_FAR_SH'], ['SNOW', 'SNOW_SH'], ['MT_NEAR', 'MT_NEAR_SH'],
    ['TREES_FAR', 'TREES_FAR_SH'], ['HILL_HI', 'HILL', 'HILL_SH'], ['ROCK_HI', 'ROCK', 'ROCK_SH'],
    ['WALL_HI', 'WALL', 'WALL_SH'], ['ROOF_HI', 'ROOF', 'ROOF_SH'], ['SLATE_HI', 'SLATE', 'SLATE_SH'],
    ['DOME_HI', 'DOME', 'DOME_SH'], ['PINE_HI', 'PINE', 'PINE_SH'], ['TIMBER_HI', 'TIMBER', 'TIMBER_SH']];
  // small near things keep some colour after dark (the eye looks for them), the path does not
  const DETAIL = new Set(['FL_RED', 'FL_YEL', 'FL_WHITE', 'FL_BLUE', 'FL_VIOLET', 'CAP', 'CAP_SH', 'CAP_BR',
    'STEM', 'MOSS', 'MOSS_HI', 'FERN', 'FERN_SH', 'GRASS_LT']);

  /** Palette for a sun altitude (deg); `moonlit` in [0, 1]: lit fraction of the disc times its height. */
  function paletteAt(alt, moonlit = 0) {
    let k = 0;
    while (k < KEYS.length - 2 && alt > KEYS[k + 1][0]) k += 1;
    const [a0, s0, am0, f0] = KEYS[k]; const [a1, s1, am1, f1] = KEYS[k + 1];
    const t = clamp((alt - a0) / (a1 - a0));
    const sky = s0.map((c, i) => mix(hex(c), hex(s1[i]), t));
    const night = clamp((-alt - 1) / 8);
    const moon = moonlit * night;
    const amb = mix(am0, am1, t).map((a, j) => a * (1 + moon * [0.45, 0.55, 0.7][j])); // cold moonlight
    const fog = f0 + (f1 - f0) * t;
    const horizon = sky[N_SKY - 1];
    const lit = (h, depth, a = amb) => mix(hex(h).map((c, j) => c * a[j]), horizon, depth * fog);
    const ambDetail = amb.map((a) => a ** 0.55);
    const pal = new Array(NAMES.length);
    sky.forEach((c, i) => { pal[i] = c; });
    SURFACES.forEach(([n, h, depth]) => {
      let c = lit(h, depth, DETAIL.has(n) ? ambDetail : amb);
      if (n.startsWith('PATH')) c = c.map((q) => q * (1 - 0.35 * night));
      if (n === 'CLOUD' || n === 'CLOUD_SH') c = mix(c, night > 0.5 ? sky[2] : horizon, 0.3 + 0.3 * night);
      if (n === 'WIN_LIT') c = mix(c, [255, 176, 72], night);
      if (n === 'OUTLINE') c = hex(h);
      pal[I[n]] = c;
    });
    Object.values(MATS).forEach(([n, hi, mid, sh]) => {
      pal[I[`${n}_HI`]] = lit(hi, 0); pal[I[n]] = lit(mid, 0); pal[I[`${n}_SH`]] = lit(sh, 0);
    });
    Object.entries(EMISSIVE).forEach(([n, h]) => { pal[I[n]] = hex(h); });
    const flat = 0.7 * night * (1 - 0.5 * moon);
    FLATTEN.forEach((g) => {
      const mean = g.map((n) => pal[I[n]]).reduce((a, c) => a.map((q, j) => q + c[j] / g.length), [0, 0, 0]);
      g.forEach((n) => { pal[I[n]] = mix(pal[I[n]], mean, flat); });
    });
    return {
      pal, night, stars: clamp((-alt - 4) / 6),
      sun: alt > 6 ? [255, 246, 208] : [255, 176, 96],
      smoke: mix([200, 200, 206], [58, 56, 72], night),
      bird: lit('#2a2a3a', 0.3),
    };
  }

  /* ---- runtime ------------------------------------------------------- */

  const root = document.documentElement;
  let plate; let canvas; let ctx; let img; let buf; let obuf; let idxNow; let pal32; let planeColour;
  let backBuf; let backIdx; let backKey = ''; // the still planes, composed (see draw)
  let ipal32; let interior = null; let ibase; let ibuf; let iprev;
  let view = { state: 'scene', id: null, t0: 0 }; // scene | in | room | out | swap
  let hoverId = null; let pendingRoom = null; let pendingHoist = false;
  let heraldry = { own: 'silva', tapestry: [] }; let say = () => {}; let rumour = () => '';
  let itemsOf = () => []; let spotsTo = () => {}; let descendTo = () => {}; let doorsOf = () => []; let hl = -1; // the room's things, their hotspots, the one pointed at
  let scene = null; let look = null; let skyFn; let reduce = false; let px = 3;
  let running = false; let visible = true; let raf = 0; let last = 0; let tick = 0;
  let bodies = null; let label0 = ''; let castUntil = 0;
  let par = 0; let parTarget = 0; // pointer parallax, -1 (left) .. 1 (right)
  // the weather over Paris (script.js, from Open-Meteo): kind clear|cloudy|overcast|fog|drizzle|rain|snow|storm,
  // cover 0..1 (cloud cover), wind (km/h)
  let weather = { kind: 'clear', cover: 0.3, wind: 10, dir: 270 };
  /** The wind across the screen, +x to the right: we look south, so east is on the left and a
   *  west wind (dir 270, where it comes from) pushes things left. About -1..1 for 0..30 km/h. */
  const windX = () => Math.sin((weather.dir ?? 270) * Math.PI / 180) * clamp(weather.wind / 30, 0.1, 1.5);
  const WET = { drizzle: 0.35, showers: 0.7, rain: 1, storm: 1.4 }; // rain: drops, relative
  let clockFn = () => new Date(); // the instant the sky shows (script.js: now, or a previewed hour)
  // meteor showers: [month (0-11), day of peak, ZHR, half-width in days]; IMO calendar, rounded
  const SHOWERS = [[0, 3, 110, 0.6], [3, 22, 18, 1], [4, 6, 50, 4], [7, 12, 100, 4], [9, 8, 10, 0.5],
    [9, 21, 20, 3], [10, 17, 15, 1], [11, 14, 150, 1.5]];
  /** The day the landscape keeps: today (the sky's instant), or ?date=MM-DD for a preview. */
  function today() {
    const q = /^(\d\d)-(\d\d)$/.exec(new URLSearchParams(location.search).get('date') || '');
    const d = clockFn();
    return q ? new Date(d.getFullYear(), Number(q[1]) - 1, Number(q[2]), d.getHours(), d.getMinutes()) : d;
  }
  /** The festival kept on day d, if any: [name, its line for the message bar]. */
  function festival(d) {
    const m = d.getMonth() + 1; const day = d.getDate(); const md = m * 100 + day;
    if (md >= 1030 && md <= 1101) return ['samhain', 'All Hallows: the hamlet has carved its pumpkins.'];
    if (md === 621) return ['music', 'Midsummer and the feast of music: a minstrel has joined the fire.'];
    if (md >= 623 && md <= 624) return ['stjohn', "Saint John's Eve: fires burn on the hills tonight."];
    if (md === 714) return ['fireworks', 'The fourteenth of July: fireworks over the castle tonight.'];
    if (md === 1231 || md === 101) return ['fireworks', 'The year turns: fireworks over the castle tonight.'];
    if (md >= 1224 && md <= 1226) return ['christmas', 'Christmas: a star shines over the chapel.'];
    if (m === 12) return ['advent', 'Advent: lights along the eaves of the hamlet.'];
    if (md === 401) return ['april', "The first of April. Look at the knight's back."];
    if (md === 501) return ['may', 'The first of May: lily of the valley by the fire.'];
    return null;
  }

  /** Meteors an hour under a dark sky on date d: the showers near their peak, plus ~6 sporadic. */
  function meteorRate(d) {
    if (new URLSearchParams(location.search).has('meteors')) return 150; // preview
    return 6 + SHOWERS.reduce((a, [m, day, zhr, w]) => {
      const peak = new Date(d.getFullYear(), m, day); const dd = (d - peak) / 864e5;
      return a + zhr * Math.exp(-((dd / w) ** 2));
    }, 0);
  }
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;
  const isOn = () => root.getAttribute('data-theme') === 'hours';
  const SCENE_LABEL = 'Pixel-art landscape under the sky over Paris at this hour: a castle with an observatory on a '
    + 'rock above a river, mountains and a forest; in front, a knight resting by a bonfire with a sword driven '
    + 'into its coals, and a wizard with a glowing staff, in tall grass.';

  const shift = (rate) => Math.round(-par * rate * PARALLAX);
  /** The meadow's slide at row y: the hill's at its top, the foreground's near the bottom. */
  const groundOff = (y) => shift(RATE[L.MID] + (GROUND_END - RATE[L.MID]) * clamp((y - scene.yg) / (scene.H - scene.yg)));
  const planeOff = (l, y) => (l === L.GROUND ? groundOff(y) : shift(RATE[l]));

  function project(v) {
    const { W, H, Ws, yHor } = scene;
    const phi = Math.atan2(v[0], -v[1]); // from south, east positive
    const alt = Math.asin(clamp(v[2], -1, 1));
    const mid = Math.min(W, Ws) / 2; // south sits over the middle of the visible stage
    return [mid - (phi / (75 * deg)) * mid, yHor - (alt / (62 * deg)) * (yHor - Math.max(4, 0.06 * H)), alt];
  }

  function relight() {
    const sky = skyFn();
    const elong0 = Math.acos(clamp(sky.sun[0] * sky.moon[0] + sky.sun[1] * sky.moon[1] + sky.sun[2] * sky.moon[2], -1, 1));
    const moonlit = ((1 - Math.cos(elong0)) / 2) * clamp(sky.moon[2] / Math.sin(25 * deg)); // phase x height
    look = paletteAt(Math.asin(sky.sun[2]) / deg, moonlit);
    pal32 = look.pal.map(pack);
    backKey = ''; // new colours: compose the still planes again
    planeColour = scene.planes.map((p) => {
      const c = new Uint32Array(p.length);
      for (let i = 0; i < p.length; i += 1) if (p[i] !== CLEAR) c[i] = pal32[p[i]];
      return c;
    });
    ipal32 = NAMES.map((_n, i) => (i < N_SKY ? pal32[i] : pack(hex(DAYLIGHT[i]).map((c) => c * 0.62))));
    if (interior) lightInterior();
    const sun = project(sky.sun); const moon = project(sky.moon);
    const elong = Math.acos(clamp(sky.sun[0] * sky.moon[0] + sky.sun[1] * sky.moon[1] + sky.sun[2] * sky.moon[2], -1, 1));
    const d = [sun[0] - moon[0], sun[1] - moon[1]]; const n = Math.hypot(...d) || 1;
    bodies = { sun, moon, light: [(d[0] / n) * Math.sin(elong), (d[1] / n) * Math.sin(elong), -Math.cos(elong)] };
  }

  /** The stage: the part of the plate left of the text column (full-page layout), else all of it. */
  function stageWidth(r, W) {
    if (getComputedStyle(plate.parentElement).position !== 'fixed') return W;
    const term = document.querySelector('.term').getBoundingClientRect();
    const Ws = Math.floor((term.left - r.left) / px) - 2;
    return Ws < 110 ? W : Ws;
  }

  let plateRect = null; let wizPx = null;
  function anchorMenu(r = plateRect) { // the top of the wizard's hat, in viewport pixels
    plateRect = r;
    const x = Math.round(r.left + (scene.wizard.x - scene.M + groundOff(scene.fire.y) + WIZ_HEAD_X) * px);
    if (x === wizPx) return;
    wizPx = x;
    root.style.setProperty('--wiz-x', `${x}px`);
    root.style.setProperty('--wiz-y', `${Math.round(r.top + scene.wizard.y * px)}px`);
  }

  function resize() {
    const r = plate.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    // ~200 scene rows whatever the screen, so the watchers keep their size; integer scales, even
    // from 4 up, so the interface's pixels (--upx, half as big) stay on the same grid
    const raw = r.height / 200;
    px = raw < 2.5 ? 2 : raw < 3.5 ? 3 : raw < 5 ? 4 : raw < 7 ? 6 : 8;
    root.style.setProperty('--px', `${px}px`);
    root.style.setProperty('--upx', `${Math.max(2, Math.round(px / 2))}px`);
    const W = Math.ceil(r.width / px); const H = Math.ceil(r.height / px);
    const Ws = stageWidth(r, W);
    if (scene && scene.W === W && scene.H === H && scene.Ws === Ws) { wizPx = null; anchorMenu(r); if (view.state === 'room') publishSpots(true); return false; }
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    obuf = new Uint32Array(img.data.buffer);
    buf = new Uint32Array(W * H); ibuf = new Uint32Array(W * H); iprev = new Uint32Array(W * H); ibase = new Uint32Array(W * H);
    backBuf = new Uint32Array(W * H); backIdx = new Uint8Array(W * H); backKey = '';
    idxNow = new Uint8Array(W * H);
    const hoisted = scene && scene.hoist;
    scene = generate(W, H, Ws);
    if (hoisted || pendingHoist) { scene.hoist = { t0: -99 }; pendingHoist = false; }
    wizPx = null;
    anchorMenu(r);
    if (view.id) { interior = makeInterior(view.id); hl = -1; }
    relight();
    if (view.state === 'room') publishSpots(true);
    for (let k = 0; k < 40; k += 1) stepFire(); // a lit fire from the first frame
    return true;
  }

  /** Demo-scene fire: each cell is the smoothed cell below it (shifted by the wind) less a random
   *  cooling, stronger towards the edges so the flame tapers. */
  function stepFire() { stepCells(scene.cells, scene.fw, scene.fh); }
  function stepCells(cells, fw, fh) {
    const p = (FIRE_MAX + 1) / (fh * 0.8);
    const wind = Math.sin(performance.now() / 700) * 0.6;
    for (let x = 0; x < fw; x += 1) {
      const e = Math.abs((2 * x) / (fw - 1) - 1);
      cells[(fh - 1) * fw + x] = (FIRE_MAX + 0.9) * (1 - e * e) * (0.75 + 0.25 * Math.random());
    }
    const at = (x, y) => cells[y * fw + clamp(x, 0, fw - 1)];
    for (let y = 0; y < fh - 1; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const sx = x + Math.round(wind + Math.random() - 0.5);
        const c = (at(sx - 1, y + 1) + 2 * at(sx, y + 1) + at(sx + 1, y + 1)) / 4;
        const e = Math.abs((2 * x) / (fw - 1) - 1);
        cells[y * fw + x] = Math.max(0, c - p * Math.random() * 2 * (1 + 1.6 * e * e));
      }
    }
  }

  /** Copy plane l into the frame at its parallax offset (row by row: the meadow is sheared). */
  function composite(l) {
    const { W, WE, M, planes, rows } = scene;
    const src = planes[l]; const col = planeColour[l];
    const [y0, y1] = rows[l];
    let off = planeOff(l, y0);
    for (let y = y0; y < y1; y += 1) {
      if (l === L.GROUND) off = groundOff(y);
      const from = y * WE + M - off; const to = y * W;
      for (let x = 0; x < W; x += 1) {
        const i = src[from + x];
        if (i !== CLEAR) { buf[to + x] = col[from + x]; idxNow[to + x] = i; }
      }
    }
  }

  /** Mix buf[i] towards (r, g, b) by a (0..1), integer maths: it runs over the whole frame. */
  function tint(i, r, g, b, a) {
    const v = buf[i]; const k = Math.round(a * 256); const j = 256 - k;
    buf[i] = 0xff000000 | ((((v >> 16) & 255) * j + b * k) >> 8) << 16 | ((((v >> 8) & 255) * j + g * k) >> 8) << 8 | (((v & 255) * j + r * k) >> 8);
  }
  /** Overcast: a grey veil over the sky, hiding sun and stars as the cover closes. */
  function skyVeil() {
    const wet = WET[weather.kind];
    const a = clamp((weather.cover - 0.5) * 2) * (wet || weather.kind === 'snow' || weather.kind === 'fog' ? 0.92 : 0.7);
    if (a <= 0) return;
    const g = look.night > 0.5 ? [36, 40, 52] : wet ? [112, 118, 130] : [166, 170, 178];
    const { W, yl0 } = scene;
    for (let y = 0; y < yl0; y += 1) for (let x = 0; x < W; x += 1) { const i = y * W + x; if (idxNow[i] < N_SKY) tint(i, g[0], g[1], g[2], a); }
  }
  /** Fog: far things fade first; rain dims the whole land a little. */
  function landVeil() {
    const { W, H, yl0 } = scene;
    const fog = weather.kind === 'fog'; const wet = WET[weather.kind] || 0;
    if (!fog && !wet && weather.kind !== 'snow') return;
    const c = look.night > 0.5 ? [52, 56, 68] : fog ? [196, 200, 204] : [120, 128, 140];
    for (let y = 0; y < H; y += 1) {
      const far = clamp(1 - (y - yl0 * 0.6) / (H - yl0 * 0.6)); // 1 up to the far hills, 0 at the bottom
      const a = fog ? 0.12 + 0.6 * far : (0.06 + 0.12 * far) * Math.max(wet, 0.5);
      for (let x = 0; x < W; x += 1) { const i = y * W + x; if (idxNow[i] >= N_SKY) tint(i, c[0], c[1], c[2], a); }
    }
  }
  /** Rain streaks or snowflakes, in front of everything; a lightning flash in a storm. */
  function precipitation(put, blend) {
    const k = weather.kind;
    if (WET[k]) {
      const c = look.night > 0.5 ? [130, 145, 170] : [226, 234, 246]; const slant = clamp(windX() * 0.75, -1, 1);
      const n = Math.round(scene.drops.length * Math.min(1, WET[k] / 1.4));
      for (let j = 0; j < n; j += 1) { const d = scene.drops[j]; for (let q = 0; q < 5; q += 1) blend(d.x - q * slant * 0.5, d.y - q, c, 0.75 - q * 0.12, false); }
    } else if (k === 'snow') {
      const c = pack([240, 244, 250]);
      scene.drops.forEach((d, j) => { if (j % 2 === 0) put(d.x + Math.sin(now() * 0.8 + d.ph) * 2, d.y, c, false); });
    }
    if (scene.flash > 0) for (let i = 0; i < buf.length; i += 1) tint(i, 236, 240, 255, 0.28 * scene.flash);
  }

  function draw(t) {
    const { W, H, M, fire, fw, fh, cells, yl0, yg, yHor } = scene;
    const put = (x, y, c, skyOnly) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      const i = y * W + x;
      if (!skyOnly || idxNow[i] < N_SKY) buf[i] = c;
    };
    const blend = (x, y, rgb, a, skyOnly) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
      const i = y * W + x;
      if (skyOnly && idxNow[i] >= N_SKY) return;
      buf[i] = pack(mix(unpack(buf[i]), rgb, a));
    };
    const halo = (x0, y0, r, rgb, a) => { // a dithered glow ring
      for (let y = -Math.ceil(r); y <= r; y += 1) {
        for (let x = -Math.ceil(r); x <= r; x += 1) {
          const q = Math.hypot(x, y);
          if (q > 1 && q < r && bayer(x0 + x, y0 + y) < 0.7 - q / (r * 1.4)) blend(x0 + x, y0 + y, rgb, a, false);
        }
      }
    };
    const blit = (s, x0, y0, maxY = H, sh = null) => {
      for (let y = 0; y < s.h; y += 1) {
        const yy = y0 + y + (sh ? sh(y) : 0);
        if (yy >= maxY) continue;
        for (let x = 0; x < s.w; x += 1) {
          const c = s.px[y * s.w + x];
          if (c >= 0) put(x0 + x, yy, pal32[c], false);
        }
      }
    };
    const mx = (x) => x - M + shift(RATE[L.MID]); // castle and hill things, plane to screen
    const gx = (x, y) => x - M + groundOff(y); // meadow things

    // the planes from the sky to the castle are still between parallax steps and relights: kept
    // composed in backBuf (5 planes, ~0.3 MB a frame otherwise); what moves over them draws on
    // sky pixels only, or (the dragon) on the far ones, so the result is the same as in order
    const key = RATE.slice(0, L.GROUND).map((r) => shift(r)).join();
    if (key !== backKey) {
      [L.SKY, L.FAR, L.NEAR, L.TREES, L.MID].forEach(composite);
      backBuf.set(buf); backIdx.set(idxNow); backKey = key;
    } else { buf.set(backBuf); idxNow.set(backIdx); }

    // stars
    if (look.stars > 0) {
      scene.stars.forEach((s) => {
        const tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
        const a = Math.round(look.stars * tw * 4) / 4;
        const c = s.tint < 0.15 ? [255, 228, 170] : s.tint > 0.88 ? [180, 205, 255] : [255, 255, 255];
        blend(s.x, s.y, c, a, true);
        if (s.big && a > 0.5) NEIGH.forEach(([dx, dy]) => blend(s.x + dx, s.y + dy, c, a * 0.5, true));
      });
    }

    // shooting stars: streaks with a bright head, fading as they go
    scene.meteors.forEach((m) => {
      const a = 1 - m.age / m.life;
      for (let k = 0; k < 7; k += 1) blend(m.x - m.dx * k * 0.6, m.y - m.dy * k * 0.6, [255, 250, 230], a * (1 - k / 7) * 0.9, true);
    });

    // sun: disc and a dithered halo; moon: lit where it faces the sun (phase and tilt follow)
    const { sun, moon, light } = bodies;
    if (sun[2] > -3 * deg) {
      const rs = 5;
      for (let y = -rs - 3; y <= rs + 3; y += 1) {
        for (let x = -rs - 3; x <= rs + 3; x += 1) {
          const q = Math.hypot(x, y); const X = Math.round(sun[0]) + x; const Y = Math.round(sun[1]) + y;
          if (q <= rs) put(X, Y, pack(look.sun), true);
          else if (q <= rs + 3 && bayer(X, Y) < 0.5 - (q - rs) / 8) blend(X, Y, look.sun, 0.45, true);
        }
      }
    }
    if (moon[2] > -3 * deg) {
      const rm = 6;
      for (let y = -rm; y <= rm; y += 1) {
        for (let x = -rm; x <= rm; x += 1) {
          const q = (x * x + y * y) / (rm * rm);
          if (q > 1) continue;
          const lit = (x / rm) * light[0] + (y / rm) * light[1] + Math.sqrt(1 - q) * light[2] > 0;
          const X = Math.round(moon[0]) + x; const Y = Math.round(moon[1]) + y;
          const crater = (x * 7 + y * 13) % 11 === 0 && q < 0.6;
          if (lit) put(X, Y, pack(crater ? [196, 196, 186] : [240, 238, 220]), true);
          else blend(X, Y, [240, 238, 220], 0.12, true);
        }
      }
    }

    skyVeil();
    // clouds drift west, as many as the real cover, as fast as the wind; at night, thin dithered wisps
    // under a closed sky the clouds turn grey and a second rank fills the gaps
    const grey = clamp((weather.cover - 0.6) * 2.5) * (look.night > 0.5 ? 0 : 1);
    const gc = (i, g) => pack(mix(unpack(pal32[i]), g, grey * 0.75));
    const pc = gc(I.CLOUD, WET[weather.kind] ? [126, 132, 144] : [178, 182, 190]); const ps = gc(I.CLOUD_SH, WET[weather.kind] ? [94, 100, 112] : [140, 146, 156]);
    const veil = 1 - 0.65 * look.night;
    const nCloud = Math.round(scene.clouds.length * clamp(0.15 + weather.cover)); const gust = 0.4 + clamp(weather.wind / 25, 0, 2);
    const ranks = weather.cover > 0.7 ? [[0, 0], [0.5, 0.18]] : [[0, 0]];
    ranks.forEach(([dx, dy]) => scene.clouds.forEach((c, j) => {
      if (j >= nCloud) return;
      const x0 = Math.round(((c.x + dx * W + (reduce ? 0 : t * c.v * gust * (windX() < 0 ? -1 : 1))) % (W + c.w) + (W + c.w)) % (W + c.w) - c.w);
      const y0 = c.y + Math.round(dy * scene.yHor);
      c.sx = x0; c.sy = y0; // where it is, for its shadow on the land
      for (let y = 0; y < c.h; y += 1) {
        for (let x = 0; x < c.w; x += 1) {
          const k = c.m[y * c.w + x];
          if (k && (veil === 1 || bayer(x0 + x, y0 + y) < veil)) put(x0 + x, y0 + y, k === 1 ? pc : ps, true);
        }
      }
    }));
    // a rainbow when it rains with the sun out, opposite the sun and 42 deg round its antisolar
    // point (so only while the sun is under 42 deg); on the sky and the far mountains
    {
      const alt = Math.asin(Math.sin(sun[2])) / deg; // sun[2]: its altitude, radians
      if ((WET[weather.kind] && weather.kind !== 'storm') && weather.cover < 0.9 && alt > 1 && alt < 41 && look.night < 0.2) {
        const span = yHor - Math.max(4, 0.06 * H); const R = (42 / 62) * span;
        const ax = clamp(W - sun[0], W * 0.15, W * 0.85); const ay = yHor + (alt / 62) * span;
        const bands = [[226, 70, 60], [240, 150, 60], [244, 220, 90], [110, 190, 90], [80, 130, 220], [140, 90, 200]];
        const bw = Math.max(1, Math.round(R * 0.03)); const a0 = 0.34 * (1 - weather.cover * 0.5);
        for (let y = Math.max(0, Math.floor(ay - R)); y < Math.min(yl0, ay); y += 1) {
          for (let x = Math.max(0, Math.floor(ax - R)); x < Math.min(W, ax + R); x += 1) {
            const k = Math.floor((R - Math.hypot(x - ax, y - ay)) / bw);
            if (k < 0 || k >= bands.length || idxNow[y * W + x] > FAR) continue;
            blend(x, y, bands[k], a0 * clamp((ay - y) / (R * 0.3)), false); // it fades into the haze low down
          }
        }
      }
    }
    if (scene.geese) { // autumn: a V of geese going south-west, wings beating
      const gc = pack(mix(look.bird, [90, 90, 96], 0.3));
      scene.geese.forEach((g, k) => {
        const up = (Math.floor(t * 3) + k) % 2;
        put(g.x, g.y, gc, true); put(g.x + 1, g.y, gc, true); put(g.x - 1, g.y - up, gc, true); put(g.x + 2, g.y - up, gc, true);
      });
    }
    scene.fireworks.forEach((f) => { // rockets climbing, then their sparks falling and fading
      if (f.rocket) { put(f.x, f.y, pack([255, 230, 180]), false); put(f.x, f.y + 1, pack([200, 120, 60]), false); return; }
      const a = 1 - f.age / f.life; put(f.x, f.y, pack(mix(f.c, [40, 30, 60], 1 - a)), false);
      if (a > 0.6) blend(f.x + 1, f.y, f.c, 0.4, false);
    });
    if (scene.birds) {
      const bc = pack(look.bird);
      scene.birds.forEach((b, k) => {
        const up = (Math.floor(t * 4) + k) % 2;
        put(b.x, b.y + up, bc, true); put(b.x + 1, b.y + 1, bc, true); put(b.x + 2, b.y + up, bc, true);
      });
    }

    // the dragon, high up: in front of the mountains, behind the trees and the castle
    const dg = scene.dragon;
    if (dg) {
      const sat = dg.land && dg.land.phase !== 'fly';
      const far = (x, y) => x >= 0 && x < W && y >= 0 && y < yl0 && (sat || idxNow[y * W + x] <= FAR);
      const sp = (dg.dir > 0 ? SPRITES.dragon : SPRITES.dragonL)[sat ? 1 : Math.floor(tick / 3) % 2];
      const x0 = Math.round(dg.x); const y0 = Math.round(dg.y);
      for (let y = 0; y < sp.h; y += 1) {
        for (let x = 0; x < sp.w; x += 1) {
          const c = sp.px[y * sp.w + x];
          if (c >= 0 && far(x0 + x, y0 + y)) buf[(y0 + y) * W + x0 + x] = pal32[c];
        }
      }
      dg.flames.forEach((f) => { if (far(Math.round(f.x), Math.round(f.y))) put(f.x, f.y, pack(hex(FIRE[Math.max(1, Math.round(FIRE_MAX * (1 - f.age / f.life)))])), false); });
    }

    if (look.night > 0.4) { // the watchtower's signal fire on the crest
      const wx = scene.watch.x - M + shift(RATE[L.NEAR]); const wy = scene.watch.y;
      const f = reduce ? 0 : Math.floor(t * 8) % 3;
      if (wx >= 0 && wx < W && idxNow[wy * W + wx] <= FAR) {
        put(wx, wy, pack(hex(FIRE[6 - f])), false); put(wx, wy - 1 - (f === 2 ? 1 : 0), pack(hex(FIRE[4 + f])), false);
        halo(wx, wy, 4, [255, 170, 70], 0.4 * look.night);
      }
    }

    // the castle's life: windows (glowing at night), pennants, torches, chimney smoke, sentries
    const wl = pal32[I.WIN_LIT]; const wd = pal32[I.WIN_DARK];
    scene.windows.forEach((w) => {
      w.pts.forEach(([x, y]) => put(mx(x), y, w.lit ? wl : wd, false));
      if (w.lit && w.big && look.night > 0.3) {
        const [x, y] = w.pts[1];
        [[-1, 0], [-1, 1], [2, 0], [2, 1]].forEach(([dx, dy]) => blend(mx(x + dx), y + dy, [255, 170, 70], 0.18 * look.night, false));
      }
    });
    scene.flags.forEach((f, k) => {
      const c = pal32[f.c]; const wave = (Math.floor(t * 3) + k) % 2; const x = mx(f.x);
      put(x, f.y, c); put(x + 1, f.y + wave, c); put(x + 2, f.y, c); put(x + 3, f.y + 1 - wave, c);
      put(x, f.y + 1, c); put(x + 1, f.y + 1, c); put(x + 2, f.y + 1, c);
      if (f.long) { put(x + 4, f.y + wave, c); put(x + 5, f.y + 1, c); }
    });
    scene.fumes.forEach((p) => {
      const a = (1 - p.age / p.life) * 0.6;
      for (let y = 0; y < p.r; y += 1) {
        for (let x = 0; x < p.r; x += 1) if (bayer(Math.round(p.x) + x, Math.round(p.y) + y) < a) blend(mx(p.x) + x, p.y + y, look.smoke, 0.7, false);
      }
    });
    { // the windmill's sails: four lattice arms, the cloth on their trailing side
      const [hx0, hy] = scene.mill.hub; const hx = mx(hx0); const L0 = scene.mill.len;
      const spar = pal32[I.TIMBER_SH]; const cloth = pal32[I.PLASTER_HI];
      for (let a = 0; a < 4; a += 1) {
        const ang = scene.millAngle + (a * Math.PI) / 2; const c = Math.cos(ang); const sn = Math.sin(ang);
        for (let k = 1; k <= L0; k += 1) {
          put(hx + c * k, hy + sn * k, spar, false);
          if (k > 2) { put(hx + c * k - sn, hy + sn * k + c, cloth, false); if (k > 3) put(hx + c * k - sn * 2, hy + sn * k + c * 2, (k % 2 ? cloth : spar), false); }
        }
      }
      put(hx, hy, pal32[I.OUTLINE], false);
    }
    if (look.night > 0.15) { // bats about the towers from dusk on, in jerky loops
      const bc = pack([30, 26, 38]); const top0 = scene.castleTop;
      for (let k = 0; k < 5; k += 1) {
        const ph = t * (1.1 + k * 0.13) + k * 1.9;
        const bx = mx(M + Math.round(0.64 * scene.Ws)) + Math.round(Math.sin(ph) * (14 + k * 4) + Math.sin(ph * 2.7) * 3); // round the castle
        const by = Math.round(top0 + 10 + k * 3 + Math.cos(ph * 1.3) * 8);
        const up = Math.floor(t * 10 + k) % 2;
        put(bx, by, bc, false); put(bx - 1, by - up, bc, false); put(bx + 1, by - up, bc, false);
      }
    }
    const guard = pal32[I.GUARD]; const tabard = pal32[I.GUARD_HI]; const spear = pal32[I.BLADE_SH];
    scene.sentries.forEach((s) => {
      const x = mx(Math.round(s.x)); const y = s.wall;
      put(x, y - 4, guard); put(x, y - 3, tabard); put(x, y - 2, tabard); put(x, y - 1, guard);
      put(x + 1, y - 5, spear); put(x + 1, y - 4, spear); put(x + 1, y - 3, spear);
      if (look.night > 0.3) { put(x - 1, y - 3, pack([255, 214, 120])); halo(x - 1, y - 3, 3, [255, 190, 90], 0.35 * look.night); }
    });
    const hl = hoverId && view.state === 'scene' && scene.rooms[roomOf(hoverId)];
    if (hl) { // the part of the castle the menu points at: its stones warm, its windows lit, a mark
      const x0 = mx(hl.x); const pulse = 0.2 + 0.12 * Math.sin(t * 5);
      for (let y = Math.max(0, hl.y); y < Math.min(H, hl.y + hl.h); y += 1) {
        for (let x = Math.max(0, x0); x < Math.min(W, x0 + hl.w); x += 1) if (CASTLE.has(idxNow[y * W + x])) blend(x, y, [255, 214, 120], pulse, false);
      }
      scene.windows.forEach((w) => {
        if (w.pts[0][0] >= hl.x && w.pts[0][0] < hl.x + hl.w && w.pts[0][1] >= hl.y && w.pts[0][1] < hl.y + hl.h) w.pts.forEach(([x, y]) => put(mx(x), y, pack([255, 190, 80]), false));
      });
      const bob = Math.floor(t * 3) % 2; const mxc = x0 + Math.floor(hl.w / 2); const myc = hl.y - 4 - bob;
      [[0, 0], [-1, 1], [1, 1], [0, 2], [0, 1]].forEach(([dx, dy]) => put(mxc + dx, myc + dy, pal32[dx === 0 && dy === 1 ? I.GOLD_HI : I.GOLD], false));
      [[0, -1], [-2, 1], [2, 1], [0, 3]].forEach(([dx, dy]) => put(mxc + dx, myc + dy, pal32[I.OUTLINE], false));
    }
    if (look.night > 0.2) {
      scene.torches.forEach((tc, k) => {
        const hot = reduce || Math.sin(t * 17 + k * 3) > -0.3; const x = mx(tc.x);
        put(x, tc.y, pack([255, 220, 120]));
        put(x, tc.y - 1, pack(hot ? [255, 140, 50] : [220, 80, 30]));
        halo(x, tc.y, 3.5, [255, 170, 80], 0.4 * look.night);
      });
    }

    // the labourer of the month, by day: walks his field, sowing (or reaping) as he goes
    const pz = scene.peasant;
    if (pz && look.night < 0.4) {
      const f = scene.field; const frame0 = Math.floor(t * 3) % 2;
      const sp = pz.dir > 0 ? SPRITES.peasant[frame0] : flip(SPRITES.peasant[frame0]);
      const fy = Math.round((f.top(Math.round(pz.x)) + f.bot) / 2);
      blit(sp, mx(Math.round(pz.x)), fy - sp.h + 3, H);
      pz.seeds.forEach((q) => put(mx(q.x), q.y, pal32[f.season === 'summer' ? I.WHEAT : I.FL_YEL], false));
    }

    { // the bell: still, or swinging (and its peal in rings) for a while after the hour turns
      const b = scene.bell; const bx = mx(b.x); const ringing = t < scene.ringUntil;
      const sw = ringing && !reduce ? Math.round(Math.sin(t * 9)) : 0;
      put(bx, b.y, pal32[I.ARM_SH]);
      [[0, 1], [-1, 2], [0, 2], [1, 2], [-1, 3], [0, 3], [1, 3]].forEach(([dx, dy]) => put(bx + dx + (dy > 1 ? sw : 0), b.y + dy, pal32[dy === 3 ? I.GOLD_SH : I.GOLD], false));
      if (ringing) {
        const r = 4 + Math.floor((t * 4) % 4);
        for (let a = -0.9; a <= 0.9; a += 0.3) { blend(bx + Math.round(Math.cos(a) * r), b.y + 2 + Math.round(Math.sin(a) * r), [255, 240, 190], 0.5, true); blend(bx - Math.round(Math.cos(a) * r), b.y + 2 + Math.round(Math.sin(a) * r), [255, 240, 190], 0.5, true); }
      }
    }
    if (scene.hoist) { // the visitor's banner, up the keep's pole once every room has been seen
      const k = reduce ? 1 : clamp((t - scene.hoist.t0) / 3); const top = scene.keepTop; const x = mx(top.x);
      for (let y = 0; y < 14; y += 1) put(x, top.y - y, pal32[I.TIMBER_SH], false); // the pole
      put(x, top.y - 14, pal32[I.GOLD], false);
      const rowsA = (window.ARMS || {})[heraldry.own];
      if (rowsA) { // a small standard in the arms' two tinctures (the castle is too small for the whole coat)
        const field = pal32[I[TINCT[rowsA[1][1]]]];
        const charge = pal32[I[TINCT[[...rowsA.join('')].find((c) => c !== '.' && c !== rowsA[1][1]) || 'O']]];
        const by = Math.round(top.y - 4 - k * 10); const wave = reduce ? 0 : Math.floor(t * 2) % 2;
        for (let y = 0; y < 8; y += 1) for (let xx = 0; xx < 6; xx += 1) {
          if (y === 7 && (xx === 2 || xx === 3)) continue; // swallow-tailed
          const c = (xx >= 2 && xx <= 3 && y >= 2 && y <= 4) || (y === 3 && xx >= 1 && xx <= 4) ? charge : field;
          if (by + y < top.y - 1) put(x + 1 + xx, by + y + (xx > 3 ? wave : 0), c, false);
        }
      }
    }
    if (look.night > 0.3) { // a lamp at the cellar door
      const c = scene.cellar; const lx = mx(c.x - 1); const ly = c.y + 1;
      put(lx, ly, pack([255, 214, 120])); halo(lx, ly, 3, [255, 190, 90], 0.35 * look.night);
    }

    // the lake mirrors what stands above it, rippled, with a glint now and then
    const water = look.pal[I.WATER];
    for (let y = yl0; y < yg; y += 1) {
      const d = y - yl0; const sy = yl0 - 1 - d * 2; // squeezed: the castle shows in it
      if (sy < 0) continue;
      for (let x = 0; x < W; x += 1) {
        if (idxNow[y * W + x] !== I.WATER) continue;
        const off = reduce ? 0 : Math.round(Math.sin(y * 1.3 + t * 2.2 + x * 0.04) * (0.4 + d * 0.12));
        let c = mix(unpack(buf[sy * W + clamp(x + off, 0, W - 1)]), water, 0.35 + 0.02 * d).map((q) => q * 0.88);
        if (!reduce && ((((x - Math.floor(t * 5)) * 7 + y * 13) % 61) + 61) % 61 === 0) c = mix(c, [255, 255, 255], 0.45 * (1 - look.night * 0.6)); // glints drift with the current
        buf[y * W + x] = pack(c);
      }
    }
    if (moon[2] > 0 && look.night > 0.3) { // the moon's road: glints under it, shivering
      for (let y = yl0; y < yg; y += 1) {
        const spread = 1 + (y - yl0) * 0.35;
        for (let x = Math.floor(moon[0] - spread); x <= moon[0] + spread; x += 1) {
          if (x < 0 || x >= W || idxNow[y * W + x] !== I.WATER) continue;
          if (reduce ? bayer(x, y) < 0.3 : Math.sin(x * 3.1 + y * 7.7 + t * 4) > 0.55) blend(x, y, [240, 238, 210], 0.55 * look.night, false);
        }
      }
    }

    { // the ferryman's boat crosses the river now and then; it shows only on the water
      const f = scene.ferry; const fx = Math.round(f.x); const fy = scene.riverBot(fx) - 1; const sx = mx(fx);
      const onWater = (x, y) => x >= 0 && x < W && y >= 0 && y < H && (idxNow[y * W + x] === I.WATER || idxNow[y * W + x] === I.WATER_HI);
      const dot = (x, y, c) => { if (onWater(x, y)) buf[y * W + x] = c; };
      if (f.wait <= 0) {
        for (let x = -4; x <= 4; x += 1) { dot(sx + x, fy, pal32[I.TIMBER]); dot(sx + x, fy + 1, pal32[I.TIMBER_SH]); }
        dot(sx - 5, fy - 1, pal32[I.TIMBER_HI]); dot(sx + 5, fy - 1, pal32[I.TIMBER_HI]);
        const m = sx + f.dir; // the ferryman, his pole slanting back into the water
        [[0, -1, I.CLOAK_SH], [0, -2, I.CLOAK], [0, -3, I.CLOAK], [0, -4, I.SKIN], [0, -5, I.HAT]].forEach(([dx, dy, c]) => dot(m + dx, fy + dy, pal32[c]));
        for (let k = 0; k < 6; k += 1) dot(m - f.dir * (1 + k), fy - 4 + k, pal32[I.TIMBER_SH]);
        if (!reduce && Math.floor(t * 3) % 2) dot(sx - f.dir * 6, fy + 1, pal32[I.WATER_HI]); // its wake
        if (look.night > 0.3) { dot(sx + f.dir * 4, fy - 2, pack([255, 214, 120])); }
      }
    }

    { // the heron in the shallows; the ducks paddle up and down the reach east of the bridge
      const hn = scene.heron; blit(SPRITES.heron, mx(hn.x), hn.y + (reduce ? 0 : Math.floor(t / 3) % 5 === 0 ? 1 : 0));
      scene.ducks.forEach((d) => {
        const x = Math.round(d.x); const sp = d.dir < 0 ? SPRITES.duck : SPRITES.duckR;
        const y = Math.round((scene.riverTop(x) + scene.riverBot(x)) / 2) - sp.h + 2;
        blit(sp, mx(x) - Math.floor(sp.w / 2), y, scene.riverBot(x) + 1);
        if (!reduce && Math.floor(t * 2 + d.ph) % 2) put(mx(x) + d.dir * -4, y + sp.h - 1, pal32[I.WATER_HI], false); // its wake
      });
    }
    { // mist on the river at dawn, and in fog
      const alt = Math.asin(Math.sin(sun[2])) / deg; const morning = clockFn().getHours() < 12;
      const k = weather.kind === 'fog' ? 1 : morning && alt > -6 && alt < 9 ? 1 - Math.abs(alt - 1.5) / 7.5 : 0;
      if (k > 0) {
        const c = look.night > 0.5 ? [150, 160, 180] : [228, 232, 238];
        for (let y = yl0 - 5; y < yg + 2; y += 1) {
          const fade = 1 - Math.abs(y - (yl0 + yg) / 2) / ((yg - yl0) / 2 + 6);
          for (let x = 0; x < W; x += 1) {
            const n = Math.sin(x * 0.06 + t * 0.25 + y * 0.4) + Math.sin(x * 0.021 - t * 0.13 + y * 0.9) * 0.8;
            if (n > 0.35) blend(x, y, c, 0.42 * k * fade * Math.min(1, n - 0.35 + 0.3), false);
          }
        }
      }
    }

    const wk = scene.walker; // a passer-by on the castle road, far part: a tiny figure on the hill
    if (wk && wk.y < yg) {
      const x = mx(Math.round(scene.pathX[Math.round(wk.y)])); const y = Math.round(wk.y);
      put(x, y - 2, pal32[wk.kind === 'messenger' ? I.FLAG : I.CLOAK], false); put(x, y - 1, pal32[I.CLOAK_SH], false); put(x, y - 3, pal32[I.SKIN], false);
      if (wk.kind === 'lantern') { put(x + 1, y - 2, pack([255, 214, 120]), false); halo(x + 1, y - 2, 3, [255, 190, 90], 0.4 * look.night); }
    }
    { // market day (Saturdays): two stalls with striped awnings by the hamlet, folk about them
      const d = today();
      if (d.getDay() === 6 && look.night < 0.3) {
        const x0 = scene.hamlet.x1 + 1;
        [[0, I.FLAG], [9, I.FLAG2]].forEach(([dx, c]) => {
          const x = mx(x0 + dx); const y = scene.riverTop(x0 + dx) - 3;
          for (let k = 0; k < 7; k += 1) { put(x + k, y - 6, k % 2 ? pal32[c] : pal32[I.FL_WHITE], false); put(x + k, y - 5, k % 2 ? pal32[c] : pal32[I.FL_WHITE], false); }
          put(x, y - 4, pal32[I.TIMBER_SH], false); put(x + 6, y - 4, pal32[I.TIMBER_SH], false);
          for (let k = 0; k < 7; k += 1) put(x + k, y - 2, pal32[I.TIMBER], false);
          put(x + 1, y - 3, pal32[I.RUST_HI], false); put(x + 3, y - 3, pal32[I.GRASS_HI], false); put(x + 5, y - 3, pal32[I.FL_YEL], false); // the wares
          const fx = x + 2 + Math.round(Math.sin(t * 0.5 + dx) * 2); // a buyer
          put(fx, y - 1, pal32[I.ROBE], false); put(fx, y, pal32[I.ROBE_SH], false); put(fx, y - 2, pal32[I.SKIN], false);
        });
      }
    }

    composite(L.GROUND);

    { // the angler on the near bank, by day: his line in the water; now and then a fish jumps
      const an = scene.angler; const ax = gx(an.x, an.y + 6);
      if (look.night < 0.5) {
        blit(SPRITES.angler, ax, an.y);
        const tipX = ax + 13; const tipY = an.y - 6; // the rod, bending a little, then the line down
        for (let k = 0; k <= 8; k += 1) put(ax + 6 + k * 0.9, an.y + 4 - k * 1.25 + (k * k) * 0.02, pal32[I.TIMBER_SH], false);
        for (let y = tipY + 1; y < an.wy; y += 1) put(tipX, y, pack([200, 200, 200]), false);
        if (!reduce && Math.floor(t * 1.2) % 2) put(tipX, an.wy, pal32[I.WATER_HI], false); // the float bobs
      }
      const f = scene.fish;
      if (f) { const fx = mx(f.x); const fy = Math.round(f.y); put(fx, fy, pack([200, 210, 220]), false); put(fx + f.dir, fy - 1, pack([170, 180, 190]), false); if (f.age > 8) put(fx - f.dir, fy + 2, pal32[I.WATER_HI], false); }
    }

    // cloud shadows drift over the land when the sun is out between clouds
    if (weather.cover > 0.12 && weather.cover < 0.85 && Math.asin(Math.sin(sun[2])) / deg > 6) {
      scene.clouds.forEach((c) => {
        if (c.sx === undefined || c.h < 4) return;
        const cx0 = c.sx + c.w / 2 + (W / 2 - sun[0]) * 0.15; const cy0 = yl0 + 4 + (c.sy / yHor) * (H - yl0) * 1.6;
        const rx = c.w * 0.55; const ry = Math.max(3, c.h * 0.45);
        for (let y = Math.floor(cy0 - ry); y <= cy0 + ry; y += 1) {
          if (y < yl0 - 30 || y >= H) continue;
          for (let x = Math.floor(cx0 - rx); x <= cx0 + rx; x += 1) {
            if (x < 0 || x >= W || idxNow[y * W + x] <= FAR) continue;
            const q = ((x - cx0) / rx) ** 2 + ((y - cy0) / ry) ** 2;
            if (q < 1 && bayer(x, y) < 1.4 - q) tint(y * W + x, 20, 30, 40, 0.16);
          }
        }
      });
    }

    { // the knight's horse grazes, swishing its tail; deer at the forest's edge at dawn and dusk
      const gh = groundOff(fire.y) - M; const hs = scene.horse;
      blit(SPRITES.horse[!reduce && Math.floor(t / 0.35) % 9 === 0 ? 1 : 0], hs.x + gh, hs.y);
      const alt = Math.asin(Math.sin(sun[2])) / deg;
      if (alt > -8 && alt < 6) scene.deer.forEach((d) => {
        const sp = SPRITES.deer[reduce || Math.floor(t / 2.5 + d.ph) % 3 === 0 ? 0 : 1];
        blit(sp, gx(d.x, d.y), d.y - sp.h);
      });
    }
    { // the festival of the day, if any
      const fe = festival(today()); const kind = fe && fe[0]; const go0 = groundOff(fire.y) - M; const hm = scene.hamlet;
      const glow = (x, y, c, r0) => { put(x, y, pack(c), false); if (look.night > 0.3) halo(x, y, r0, c, 0.4 * look.night); };
      if (kind === 'samhain') { // pumpkins at the doors and by the fire, lit from within after dark
        const pumpkin = (x, y) => {
          [[0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2]].forEach(([dx, dy]) => put(x + dx, y + dy, pal32[I.RUST_HI], false));
          put(x + 1, y - 1, pal32[I.FERN_SH], false);
          const eye = look.night > 0.3 ? pack([255, 230, 120]) : pal32[I.OUTLINE]; put(x, y + 1, eye, false); put(x + 2, y + 1, eye, false);
          if (look.night > 0.3) halo(x + 1, y + 1, 3, [255, 160, 60], 0.35 * look.night);
        };
        hm.doors.forEach(([x, y]) => pumpkin(mx(x) + 2, y - 2));
        pumpkin(fire.x + go0 - 16, fire.y + 6); pumpkin(fire.x + go0 + 5, fire.y + 9);
      }
      if (kind === 'music') { // a minstrel west of the wizard; notes rise from the lute
        const ms = SPRITES.minstrel; const x0 = scene.wizard.x + go0 - ms.w - 3; const y0 = fire.y + 6 - ms.h;
        blit(ms, x0, y0 + (reduce ? 0 : Math.floor(t * 2) % 2));
        scene.minstrelAt = [x0 + 7, y0 + 6];
        scene.notes.forEach((n) => { const c = pack([250, 240, 200]); put(n.x, n.y, c, false); put(n.x + 1, n.y, c, false); put(n.x + 1, n.y - 1, c, false); put(n.x + 1, n.y - 2, c, false); });
      } else scene.minstrelAt = null;
      if (kind === 'stjohn' && look.night > 0.3) scene.bonfires.forEach(([x, y, l]) => { // fires on the hills
        const sx = x - M + shift(RATE[l]); const f = reduce ? 0 : Math.floor(t * 9 + x) % 3;
        put(sx, y, pack(hex(FIRE[6])), false); put(sx, y - 1, pack(hex(FIRE[5 - f])), false); put(sx + (f === 1 ? 1 : 0), y - 2, pack(hex(FIRE[4])), false);
        halo(sx, y - 1, 5, [255, 160, 60], 0.45 * look.night);
      });
      if (kind === 'advent' || kind === 'christmas') { // lights along the eaves, twinkling
        const C = [[255, 90, 80], [255, 220, 100], [110, 200, 255], [130, 240, 130]];
        hm.eaves.forEach(([a, b, y]) => { for (let x = a; x <= b; x += 2) { const k = (x + Math.floor(t * 1.5)) % 4; put(mx(x), y, pack(look.night > 0.3 ? C[k] : mix(C[k], [90, 80, 70], 0.5)), false); } });
        if (today().getMonth() === 11 || today().getMonth() === 0) { const sm = SPRITES.snowman; blit(sm, gx(M + Math.round(0.2 * scene.Ws), yg + 14), yg + 14 - sm.h); }
      }
      if (kind === 'christmas' && hm.spire) glow(mx(hm.spire[0]), hm.spire[1], [255, 236, 150], 4);
      if (kind === 'april') { // a paper fish pinned to the knight's back
        const kx = scene.knight.x + go0 + 5; const ky = scene.knight.y + 15; const fc = pack([240, 140, 60]);
        [[0, 1], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [3, 1], [4, 0], [4, 2]].forEach(([dx, dy]) => put(kx + dx, ky + dy, fc, false));
      }
      if (kind === 'may') [[-14, 5], [-11, 7], [9, 8], [12, 6]].forEach(([dx, dy]) => { // lily of the valley
        const x = fire.x + go0 + dx; const y = fire.y + dy;
        put(x, y, pal32[I.FERN_SH], false); put(x, y - 1, pal32[I.FERN], false); put(x + 1, y - 2, pal32[I.FL_WHITE], false); put(x + 1, y - 1, pal32[I.FL_WHITE], false);
      });
    }
    if (wk && wk.y >= yg) { // the passer-by, near: full size, walking
      const sp = (wk.dir < 0 ? SPRITES.peasant : SPRITES.walkerL)[Math.floor(t * 4) % 2]; const y = Math.min(H - 1, Math.round(wk.y));
      const x = Math.round(scene.pathX[y]) - M + groundOff(y) - 3;
      blit(sp, x, y - sp.h);
      if (wk.kind === 'lantern') { put(x + 6, y - sp.h + 4, pack([255, 214, 120]), false); halo(x + 6, y - sp.h + 4, 4, [255, 190, 90], 0.45 * look.night); }
      if (wk.kind === 'messenger') { for (let k = 0; k < 7; k += 1) put(x + 1, y - sp.h - k, pal32[I.TIMBER_SH], false); put(x + 2, y - sp.h - 6, pal32[I.FLAG], false); put(x + 3, y - sp.h - 6, pal32[I.FLAG], false); put(x + 2, y - sp.h - 5, pal32[I.FLAG], false); }
    }
    scene.zzz.forEach((z) => { // the knight dozes after dark
      const c = pack([220, 226, 255]); const x = Math.round(z.x); const y = Math.round(z.y);
      put(x, y, c, false); put(x + 1, y, c, false); put(x + 1, y + 1, c, false); put(x, y + 2, c, false); put(x + 1, y + 2, c, false);
    });
    if (scene.season === 'summer' && look.night < 0.3) { // swallows skimming the meadow and the water
      const sc = pack([34, 30, 52]);
      for (let k = 0; k < 4; k += 1) {
        const ph = t * (0.9 + k * 0.17) + k * 2.1;
        const x = Math.round(W * (0.35 + 0.3 * Math.sin(ph)) + Math.sin(ph * 3.1) * 12); const y = Math.round(yl0 + (yg - yl0) * 0.5 + Math.sin(ph * 2.3) * 9);
        const up = Math.floor(t * 12 + k) % 2;
        put(x, y, sc, false); put(x - 1, y - up, sc, false); put(x + 1, y - up, sc, false); put(x + 2, y + 1 - up, sc, false);
      }
    }

    // butterflies by day, fireflies at night
    if (look.night < 0.3) {
      scene.butterflies.forEach((b) => {
        const c = pal32[b.c]; const open = Math.floor(t * 6 + b.ph) % 2; const x = gx(b.x, b.y);
        put(x, b.y, pal32[I.OUTLINE]);
        if (open) { put(x - 1, b.y - 1, c); put(x + 1, b.y - 1, c); put(x - 1, b.y, c); put(x + 1, b.y, c); } else { put(x - 1, b.y, c); put(x + 1, b.y, c); }
      });
    }
    if (look.night > 0.5) {
      scene.flies.forEach((f) => {
        if (Math.sin(t * 2.3 + f.ph * 3) < -0.2) return;
        const x = gx(f.x, f.y);
        put(x, f.y, pack([232, 255, 138]));
        NEIGH.forEach(([dx, dy]) => blend(x + dx, f.y + dy, [200, 255, 120], 0.35, false));
      });
    }

    // the watchers: the knight's head sinks a pixel as he breathes; the wizard's orb glows
    const { knight, wizard } = scene;
    const go = groundOff(fire.y) - M;
    const breath = reduce ? 0 : Math.floor(t / 1.7) % 2;
    blit(SPRITES.knight, knight.x + go, knight.y, H, (y) => (y < KNIGHT_HEAD ? breath : 0));
    blit(SPRITES.wizard, wizard.x + go, wizard.y);
    const shield = scene.shieldSp || (scene.shieldSp = armsSprite(heraldry.own)); // the knight's arms, leant on the log
    if (shield) blit(shield, knight.x + go + 1, fire.y + 7 - shield.h);
    scene.cats.forEach((c) => { // they blink now and then; the black one by the fire breathes
      const breathe = c.sp === SPRITES.cats.blackLoaf && !reduce ? Math.floor(t / 2.1 + c.ph) % 2 : 0;
      blit(c.sp, c.x + go, c.y, H, (y) => (y < 3 ? breathe : 0));
      c.breathe = breathe;
    });
    { // the knight's blue butterfly, wandering round his helm
      const hx = knight.x + go + 13; const hy = knight.y + 4;
      const bx = hx + Math.round(10 * Math.sin(t * 0.8)); const by = hy - 3 + Math.round(5 * Math.sin(t * 1.7) * Math.cos(t * 0.45));
      const open = reduce || Math.floor(t * 7) % 2; const wcol = pal32[I.WING_HI]; const wsh = pal32[I.WING];
      put(bx, by, pal32[I.OUTLINE], false);
      if (open) { put(bx - 1, by - 1, wcol); put(bx + 1, by - 1, wcol); put(bx - 1, by, wsh); put(bx + 1, by, wsh); put(bx - 2, by - 1, wsh); put(bx + 2, by - 1, wsh); }
      else { put(bx - 1, by, wcol); put(bx + 1, by, wcol); }
      if (look.night > 0.4) halo(bx, by, 2.5, [140, 180, 255], 0.3);
    }
    const glow = t < castUntil ? 5.5 : 3.2 + (reduce ? 0 : 0.6 * Math.sin(t * 3));
    halo(wizard.x + go + ORB[0], wizard.y + ORB[1], glow, [180, 250, 255], 0.55);

    // smoke, flames, coals, embers, the wizard's sparks
    const fxs = fire.x + go;
    const catEyes = () => scene.cats.forEach((c) => {
      const shut = !reduce && Math.sin(t * 0.7 + c.ph * 3) > 0.96;
      c.sp.eyes.forEach(([ex, ey]) => put(c.x + go + ex, c.y + ey + (ey < 3 ? c.breathe : 0), pal32[shut ? I.BLACKFUR_SH : I.EYE], false));
    });
    scene.smoke.forEach((p) => {
      const a = (1 - p.age / p.life) * 0.7;
      for (let y = 0; y < p.r; y += 1) {
        for (let x = 0; x < p.r; x += 1) {
          const X = Math.round(p.x + go) + x; const Y = Math.round(p.y) + y;
          if (bayer(X, Y) < a) blend(X, Y, look.smoke, 0.8, false);
        }
      }
    });
    const fx0 = fxs - Math.floor(fw / 2); const fy0 = fire.y - fh;
    const fc = FIRE.map((h) => (h ? pack(hex(h)) : 0));
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const lv = Math.min(FIRE_MAX, Math.floor(cells[y * fw + x] + bayer(x, y) * 0.9));
        if (lv > 0) put(fx0 + x, fy0 + y, fc[lv], false);
      }
    }
    for (let x = -3; x <= 3; x += 1) put(fxs + x, fire.y, fc[(reduce || Math.random() < 0.5) ? 5 : 3], false);
    scene.embers.forEach((e) => {
      const f = e.age / e.life;
      put(e.x + go, e.y, fc[f < 0.3 ? 7 : f < 0.65 ? 5 : 3], false);
    });
    scene.sparks.forEach((s) => {
      const c = [[255, 255, 255], [160, 240, 255], [255, 220, 110]][s.c];
      put(s.x + go, s.y, pack(c), false);
      if (s.age < 6) NEIGH.forEach(([dx, dy]) => blend(s.x + go + dx, s.y + dy, c, 0.4, false));
    });

    // the nearest plane, then the tall grass bending in the wind
    landVeil();
    composite(L.FG);
    if (scene.season === 'autumn' && !WET[weather.kind]) { // leaves drift down (snow falls only when it snows)
      scene.falling.forEach((q) => {
        const x = Math.round(q.x - M + Math.sin(t * 0.8 + q.ph) * 3);
        if (q.y > scene.yHor * 0.6) put(x, Math.round(q.y), pal32[q.c ? I.LEAF : I.LEAF2], false);
      });
    }
    const fo = shift(RATE[L.FG]) - M;
    scene.blades.forEach((b) => {
      const c = pal32[b.c];
      const lean = reduce ? 0 : (Math.sin(t * 1.6 + b.x * 0.21) * 0.6 * clamp(weather.wind / 15, 0.3, 1.6) + Math.sin(t * 0.7 + b.x * 0.05) * 0.6 + windX() * 0.8) * b.h * 0.22;
      for (let r = 0; r < b.h; r += 1) put(b.x + fo + Math.round((lean + b.spread) * (r / b.h) ** 2), b.y - r, c, false);
    });
    if (look.night > 0.5) { // the owl on its branch, blinking now and then
      const ow = scene.owl; const ox = ow.x + fo;
      blit(SPRITES.owl, ox, ow.y);
      if (!reduce && Math.sin(t * 0.6) > 0.95) { put(ox + 2, ow.y + 3, pal32[I.LEATHER], false); put(ox + 4, ow.y + 3, pal32[I.LEATHER], false); }
    }
    precipitation(put, blend);

    // firelight: warm, stepped falloff, flickering radius; strongest at night
    const k0 = 0.3 + 0.95 * look.night;
    const R = 0.42 * H * (1 + (reduce ? 0 : 0.05 * Math.sin(t * 13) + 0.03 * Math.sin(t * 29))); const iR2 = 1 / (R * R);
    for (let y = Math.max(0, Math.floor(fire.y - R * 0.7)); y < Math.min(H, fire.y + R * 0.7); y += 1) {
      for (let x = Math.max(0, Math.floor(fxs - R)); x < Math.min(W, fxs + R); x += 1) {
        const i = y * W + x;
        if (idxNow[i] <= FAR) continue;
        const dx = x - fxs; const dy = (y - fire.y) * 1.5; const d2 = (dx * dx + dy * dy) * iR2;
        if (d2 >= 1) continue;
        const k = Math.floor(((1 - Math.sqrt(d2)) ** 1.6 * k0) * 4 + bayer(x, y)) / 4;
        if (k <= 0) continue;
        const v = buf[i]; const r = v & 255; const g = (v >> 8) & 255; const b = (v >> 16) & 255; // no arrays: this runs ~40k times a frame
        buf[i] = 0xff000000 | (Math.min(255, Math.round(b + b * 0.05 * k)) << 16)
          | (Math.min(255, Math.round(g + (g * 0.6 + 26) * k)) << 8) | Math.min(255, Math.round(r + (r * 1.5 + 70) * k));
      }
    }
    catEyes();
  }

  /* ---- the rooms at run time: lighting, animation, the camera between outside and in ---- */

  /* A project page's text sits on the workshop's easel: its box in fractions of the room (it
     hangs from `top`, under the menu); the room draws the easel there and the page puts the
     text box on it (--sup-*). The castle's rooms lay out their own things instead. */
  const PLACE = { x: 0.43, w: 0.47, top: 0.15, h: 0.56 };
  function placeOf(W, H) {
    const p = PLACE; const k = px * 2;
    const pr = plate.getBoundingClientRect(); const menu = document.querySelector('.tabs');
    const mb = menu ? Math.ceil((menu.getBoundingClientRect().bottom - pr.top) / k) + 2 : 4; // keep under the menu
    const x = Math.round(p.x * W); const w = Math.round(p.w * W);
    const y = Math.max(Math.round(p.top * H), mb); const h = Math.min(Math.round(p.h * H), Math.round(H * 0.78) - y);
    return { x, w, y, h };
  }
  /** Hand the text box's place to the page, in viewport pixels. */
  function placeText(pl) {
    const r = plate.getBoundingClientRect(); const k = px * 2;
    const set = (n, v) => root.style.setProperty(n, `${Math.round(v)}px`);
    set('--sup-l', r.left + pl.x * k); set('--sup-w', pl.w * k);
    set('--sup-t', r.top + pl.y * k); set('--sup-h', pl.h * k);
  }
  /** A room at half the scene's resolution (we are inside, closer: its pixels are twice as big). */
  function makeInterior(id) {
    const W2 = Math.ceil(scene.W / 2); const H2 = Math.ceil(scene.H / 2);
    // the castle's rooms lay out their own things; a project page keeps its text on the easel
    const pl = ROOM_NAMES[id] ? null : placeOf(W2, H2);
    if (pl) placeText(pl);
    const r = generateInterior(id, W2, H2, Math.round(interiorStage(scene.W) / 2), pl);
    for (let k = 0; k < 30; k += 1) stepCells(r.cells, 9, 14); // a hearth already burning
    return r;
  }
  const iAt = (x, y) => ibuf[(y >> 1) * interior.W + (x >> 1)];

  /** Width left to the furniture: on wide screens the parchment hangs over the right half. */
  function interiorStage(W) {
    return getComputedStyle(plate.parentElement).position === 'fixed' ? Math.round(W * 0.46) : W;
  }

  /** Indoor colours under a dim ambient, darker towards the corners and the beams; the window's
   *  pixels take the outdoor palette, so it shows the true sky. */
  function lightInterior() {
    const { W, H, idx, out } = interior;
    for (let y = 0; y < H; y += 1) {
      const vy = 0.72 + 0.28 * clamp(y / (H * 0.3));
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x;
        if (out[i]) { ibase[i] = pal32[idx[i]]; continue; }
        let v = vy * (0.62 + 0.38 * clamp(1 - Math.abs(x - W * 0.45) / (W * 0.7)));
        interior.pools.forEach((p) => { // daylight (or moonlight) falling from a window onto the floor
          if (y < interior.yf) return;
          const dx = Math.abs(x - p.x) / (p.w * 0.5 + (y - interior.yf) * 0.6);
          if (dx < 1) v *= 1 + (1 - dx) * (0.35 - 0.25 * look.night) * (1 - (y - interior.yf) / (H - interior.yf + 1) * 0.5);
        });
        ibase[i] = pack(unpack(ipal32[idx[i]]).map((c) => c * v));
      }
    }
  }

  function stepInterior() {
    interior.flames.forEach((f) => { if (f.hearth) stepCells(interior.cells, 9, 14); });
    interior.motes.forEach((m) => { m.x += Math.sin(now() * 0.4 + m.ph) * 0.15; m.y += Math.cos(now() * 0.3 + m.ph) * 0.1; });
  }

  function drawInterior(t) {
    const { W, H, out, idx, lights, flames, stars, motes, blinks } = interior;
    ibuf.set(ibase);
    const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) ibuf[y * W + x] = c; };
    const blend = (x, y, rgb, a) => {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && x < W && y >= 0 && y < H) ibuf[y * W + x] = pack(mix(unpack(ibuf[y * W + x]), rgb, a));
    };
    if (look.stars > 0) {
      stars.forEach((st) => {
        const i = st.y * W + st.x;
        if (out[i] && idx[i] < N_SKY) blend(st.x, st.y, [255, 255, 255], look.stars * (reduce ? 0.8 : 0.5 + 0.5 * Math.sin(t * 2 + st.ph)));
      });
    }
    if (look.night < 0.5) motes.forEach((m) => blend(m.x, m.y, [255, 250, 220], 0.5 * (0.5 + 0.5 * Math.sin(t + m.ph))));
    blinks.forEach((b) => put(b.x, b.y, pal32[Math.sin(t * 0.8 + b.ph) > 0.95 ? I.OUTLINE : I.CREAM]));
    // a discreet hint: a glint passes from one thing to the next, as candlelight would catch it
    if (hl < 0 && !reduce && interior.slots.length) {
      const P = 2.6; const k = Math.floor(t / P) % interior.slots.length; const ph = (t % P) / 0.6;
      const g = interior.slots[k]; // (a thing with no room to be drawn has no slot)
      if (ph < 1 && g) {
        const gx = g.x + g.w - 2; const gy = g.y + 1; const a = Math.sin(ph * Math.PI);
        blend(gx, gy, [255, 255, 240], a);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => blend(gx + dx, gy + dy, [255, 236, 170], a * 0.7));
        if (a > 0.6) [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(([dx, dy]) => blend(gx + dx, gy + dy, [255, 236, 170], a * 0.35));
      }
    }
    const sl = hl >= 0 && interior.slots[hl];
    if (sl) { // the thing pointed at: a pulsing outline just outside it
      const a = 0.45 + (reduce ? 0 : 0.25 * Math.sin(t * 6));
      for (let x = sl.x - 1; x <= sl.x + sl.w; x += 1) { blend(x, sl.y - 1, [255, 228, 150], a); blend(x, sl.y + sl.h, [255, 228, 150], a); }
      for (let y = sl.y; y < sl.y + sl.h; y += 1) { blend(sl.x - 1, y, [255, 228, 150], a); blend(sl.x + sl.w, y, [255, 228, 150], a); }
    }
    interior.deco.forEach((d) => {
      const P = (n) => pal32[I[n]];
      if (d.type === 'hourglass') { // sand runs for a minute, then the glass is turned
        const k = reduce ? 0.5 : (t % 60) / 60;
        put(d.x - 2, d.y, P('TIMBER_HI')); put(d.x + 2, d.y, P('TIMBER_HI')); put(d.x - 2, d.y + 8, P('TIMBER_HI')); put(d.x + 2, d.y + 8, P('TIMBER_HI'));
        for (let x = -2; x <= 2; x += 1) { put(d.x + x, d.y, P('TIMBER')); put(d.x + x, d.y + 8, P('TIMBER')); }
        for (let y = 1; y < 8; y += 1) {
          const half = Math.abs(y - 4) * 0.5 + 0.5;
          for (let x = -Math.floor(half); x <= Math.floor(half); x += 1) put(d.x + x, d.y + y, P('BEARD_SH'));
        }
        const top = Math.round(3 * (1 - k)); const bot = Math.round(3 * k);
        for (let y = 4 - top; y < 4; y += 1) put(d.x, d.y + y, P('GOLD'));
        for (let y = 0; y < bot; y += 1) { put(d.x, d.y + 7 - y, P('GOLD')); if (y < bot - 1) { put(d.x - 1, d.y + 7 - y, P('GOLD_SH')); put(d.x + 1, d.y + 7 - y, P('GOLD_SH')); } }
        if (k > 0 && k < 1 && Math.floor(t * 6) % 2) put(d.x, d.y + 5, P('GOLD_HI'));
      } else if (d.type === 'orrery') { // brass rings, the sun, three planets at their own speeds
        put(d.x, d.y + 7, P('TIMBER_SH')); put(d.x, d.y + 6, P('GOLD_SH')); put(d.x - 2, d.y + 8, P('TIMBER_SH')); put(d.x + 2, d.y + 8, P('TIMBER_SH'));
        put(d.x, d.y, pack([255, 210, 90]));
        [[2.2, 0.9, 'WING_HI'], [3.6, 0.5, 'CAP'], [5, 0.3, 'ROBE_HI']].forEach(([r, w, c], k) => {
          for (let a = 0; a < 6.28; a += 0.5) put(d.x + Math.round(Math.cos(a) * r), d.y + Math.round(Math.sin(a) * r * 0.45), P('GOLD_SH'));
          const a = (reduce ? k : t * w) + k * 2;
          put(d.x + Math.round(Math.cos(a) * r), d.y + Math.round(Math.sin(a) * r * 0.45), P(c));
        });
      } else if (d.type === 'gear') { // a rim, a hub, teeth that turn
        const a0 = reduce ? 0 : t * d.sp;
        for (let a = 0; a < 6.28; a += 0.35) put(d.x + Math.round(Math.cos(a) * d.r), d.y + Math.round(Math.sin(a) * d.r), P('GOLD'));
        for (let k = 0; k < 6; k += 1) { const a = a0 + (k * Math.PI) / 3; put(d.x + Math.round(Math.cos(a) * (d.r + 1)), d.y + Math.round(Math.sin(a) * (d.r + 1)), P('GOLD_HI')); }
        put(d.x, d.y, P('ARM_SH'));
      }
    });
    interior.camps.forEach((c) => { // the campfire through the window, and the two by it
      const hot = reduce || Math.random() < 0.6;
      if (look.night > 0.3) [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => blend(c.x + dx, c.y + dy, [255, 150, 60], 0.45 * look.night));
      put(c.x, c.y, pack(hex(FIRE[hot ? 7 : 5]))); put(c.x, c.y - 1, pack(hex(FIRE[hot ? 5 : 4])));
      put(c.x + 2, c.y, pal32[I.ARM]); put(c.x + 2, c.y - 1, pal32[I.ARM_HI]); // the knight, seated
      put(c.x + 4, c.y, pal32[I.ROBE]); put(c.x + 4, c.y - 1, pal32[I.ROBE]); put(c.x + 4, c.y - 2, pal32[I.HAT]); // the wizard
    });
    lights.forEach((l, k) => { // warm, stepped, flickering
      const R = l.r * (1 + (reduce ? 0 : 0.05 * Math.sin(t * 11 + k * 2) + 0.03 * Math.sin(t * 23 + k)));
      for (let y = Math.max(0, Math.floor(l.y - R)); y < Math.min(H, l.y + R); y += 1) {
        for (let x = Math.max(0, Math.floor(l.x - R)); x < Math.min(W, l.x + R); x += 1) {
          const i = y * W + x;
          if (out[i]) continue;
          const dd = Math.hypot(x - l.x, (y - l.y) * 1.25) / R;
          if (dd >= 1) continue;
            // five steps, the dither only a sliver at each step's edge; mixed towards a warm
          // target that never runs to white (a candle lights, it does not blind)
          const kk = Math.floor(((1 - dd) ** 1.7 * 0.7) * 5 + 0.25 + bayer(x, y) * 0.5) / 5;
          if (kk <= 0) continue;
          const c = unpack(ibuf[i]);
          ibuf[i] = pack(mix(c, [Math.min(235, c[0] * 1.7 + 34), Math.min(190, c[1] * 1.3 + 14), Math.min(150, c[2] * 1.02)], kk));
        }
      }
    });
    const fc = FIRE.map((h) => (h ? pack(hex(h)) : 0));
    flames.forEach((f) => {
      if (f.hearth) {
        for (let y = 0; y < 14; y += 1) {
          for (let x = 0; x < f.w; x += 1) {
            const cx = Math.min(8, Math.floor((x / f.w) * 9));
            const lv = Math.min(FIRE_MAX, Math.floor(interior.cells[y * 9 + cx] + bayer(x, y) * 0.9));
            if (lv > 0) put(f.x - f.w / 2 + x, f.y - 14 + y, fc[lv]);
          }
        }
        return;
      }
      const hot = reduce || Math.random() < 0.7;
      put(f.x, f.y, fc[7]); put(f.x, f.y - 1, fc[hot ? 6 : 5]);
      if (!f.small && hot) put(f.x, f.y - 2, fc[4]);
    });
  }

  const ZOOMS = [1, 2, 3, 4, 6]; // integer steps: the pixels stay square all the way in
  const STEP = 0.09; const DISSOLVE = 0.32; // seconds per step; the dithered cross-fade

  function setReady(on) { root.classList.toggle('room-ready', on); publishSpots(on); }
  /** Tell the page where the room's things are (viewport px), for their hotspots; wide screens only. */
  function publishSpots(on) {
    const wide = plate && getComputedStyle(plate.parentElement).position === 'fixed';
    if (!on || !wide || !interior || !interior.slots.length) { spotsTo([], []); return; }
    const r = plate.getBoundingClientRect(); const k = px * 2;
    spotsTo(Array.from(interior.slots, (b) => b && ({ l: Math.round(r.left + b.x * k), t: Math.round(r.top + b.y * k), w: Math.round(b.w * k), h: Math.round(b.h * k) })), interior.things);
  }
  const travelling = (on) => root.classList.toggle('travelling', on);

  /** Where the camera heads: the room's part of the castle, on screen. */
  function anchorOf(id) {
    const a = id && scene.rooms[roomOf(id)];
    return a ? [a.x - scene.M + shift(RATE[L.MID]) + a.w / 2, a.y + a.h / 2] : [scene.W / 2, scene.H / 2];
  }

  /** Paint the screen: the landscape, the room, or the way between (zoom, then dissolve). */
  function render(t) {
    const { W, H } = scene;
    const st = view.state;
    if (st === 'scene') { draw(t); obuf.set(buf); }
    else if (st === 'room') { drawInterior(t); for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) obuf[y * W + x] = iAt(x, y); }
    else if (st === 'swap') {
      drawInterior(t);
      const th = clamp((t - view.t0) / DISSOLVE);
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const i = y * W + x; obuf[i] = bayer(x, y) < th ? iAt(x, y) : iprev[i]; }
      if (th >= 1) { view.state = 'room'; travelling(false); }
    } else {
      const e = t - view.t0; const n = ZOOMS.length;
      const into = st === 'in';
      const th = into ? clamp((e - n * STEP) / DISSOLVE) : 1 - clamp(e / DISSOLVE);
      const zi = into ? Math.min(n - 1, Math.floor(e / STEP)) : n - 1 - Math.min(n - 1, Math.floor(Math.max(0, e - DISSOLVE) / STEP));
      draw(t);
      if (th > 0) drawInterior(t);
      const z = ZOOMS[zi]; const [ax, ay] = anchorOf(view.anchor); const k = zi / (n - 1);
      const vw = W / z; const vh = H / z;
      const vx = Math.round(clamp(W / 2 + (ax - W / 2) * k - vw / 2, 0, W - vw));
      const vy = Math.round(clamp(H / 2 + (ay - H / 2) * k - vh / 2, 0, H - vh));
      for (let y = 0; y < H; y += 1) {
        const row = (vy + Math.floor(y / z)) * W + vx;
        for (let x = 0; x < W; x += 1) {
          const i = y * W + x;
          obuf[i] = th > 0 && bayer(x, y) < th ? iAt(x, y) : buf[row + Math.floor(x / z)];
        }
      }
      if (into && e >= n * STEP + DISSOLVE) { view.state = 'room'; setReady(true); travelling(false); }
      if (!into && e >= DISSOLVE + n * STEP) { view.state = 'scene'; interior = null; travelling(false); }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Go into room `id` (null: back out to the landscape). */
  function goRoom(id, animate) {
    if (!scene) { pendingRoom = id; return; }
    const t = now(); const anim = animate && !reduce;
    const label = (r) => `Inside the castle: ${ROOM_NAMES[roomOf(r)]}, lit by candles; its window shows the sky over Paris at this hour.`;
    if (id) {
      if (view.id && (view.state === 'room' || view.state === 'swap' || view.state === 'in')) {
        if (roomOf(id) === roomOf(view.id)) { view.id = id; return; }
        iprev.set(obuf);
        interior = makeInterior(id); lightInterior();
        view = { state: anim ? 'swap' : 'room', id, anchor: id, t0: t };
        setReady(true); travelling(anim);
      } else {
        interior = makeInterior(id); lightInterior();
        view = { state: anim ? 'in' : 'room', id, anchor: id, t0: t };
        if (!anim) setReady(true);
        travelling(anim);
      }
      plate.setAttribute('aria-label', label(id));
    } else {
      if (view.state === 'scene') return;
      setReady(false); hl = -1;
      view = { state: anim && interior ? 'out' : 'scene', id: null, anchor: view.anchor, t0: t };
      if (view.state === 'scene') interior = null;
      travelling(view.state === 'out');
      plate.setAttribute('aria-label', SCENE_LABEL);
    }
    if (!running) render(t);
  }

  /* ---- the realm: Paris in pixels for the map dialog (lon, lat -> 240 x 150 px) ---- */
  const REALM = { // where each school stands; Orsay is off the map, south-west
    sorbonne: [2.3561, 48.8466], paris1: [2.3462, 48.8463], pariscite: [2.3405, 48.8510],
    sciencespo: [2.3285, 48.8540], dauphine: [2.2737, 48.8706], ceremade: [2.2760, 48.8700],
    saclay: [2.226, 48.818], ijclab: [2.232, 48.816],
  };
  const SEINE = [[2.47, 48.815], [2.41, 48.83], [2.37, 48.845], [2.35, 48.853], [2.33, 48.86], [2.30, 48.862],
    [2.29, 48.857], [2.27, 48.849], [2.255, 48.838], [2.243, 48.832], [2.236, 48.845], [2.248, 48.868], [2.258, 48.889], [2.23, 48.905]];
  function drawRealm(cv) {
    const g = cv.getContext('2d'); const Wm = cv.width; const Hm = cv.height;
    const P = (lon, lat) => [Math.round(((lon - 2.22) / 0.25) * Wm), Math.round(((48.905 - lat) / 0.09) * Hm)];
    const rgb = (n) => { const c = DAYLIGHT[I[n]]; return c; };
    g.fillStyle = '#efe2c2'; g.fillRect(0, 0, Wm, Hm);
    for (let y = 0; y < Hm; y += 1) for (let x = 0; x < Wm; x += 1) if ((x * 7 + y * 13) % 29 === 0) { g.fillStyle = '#e2d2ac'; g.fillRect(x, y, 1, 1); } // its grain
    const blob = (lon, lat, rx, ry, col) => { const [cx0, cy0] = P(lon, lat); g.fillStyle = col; for (let y = -ry; y <= ry; y += 1) for (let x = -rx; x <= rx; x += 1) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1 && (x + y) % 3) g.fillRect(cx0 + x, cy0 + y, 1, 1); };
    blob(2.25, 48.862, 9, 11, rgb('PINE_HI')); blob(2.435, 48.835, 12, 8, rgb('PINE_HI')); // the woods of Boulogne and Vincennes
    for (let a = 0; a < 6.283; a += 0.02) { // the old walls' line (the boulevard ring), dotted
      const [x, y] = P(2.345 + Math.cos(a) * 0.105, 48.858 + Math.sin(a) * 0.038);
      if (Math.floor(a * 60) % 2) { g.fillStyle = rgb('WALL_SH'); g.fillRect(x, y, 1, 1); }
    }
    g.fillStyle = rgb('WATER'); // the Seine, three pixels wide
    for (let k = 1; k < SEINE.length; k += 1) {
      const [x0, y0] = P(...SEINE[k - 1]); const [x1, y1] = P(...SEINE[k]); const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let j = 0; j <= n; j += 1) { const x = Math.round(x0 + ((x1 - x0) * j) / n); const y = Math.round(y0 + ((y1 - y0) * j) / n); g.fillRect(x - 1, y - 1, 3, 3); }
    }
    const [ix, iy] = P(2.347, 48.8545); g.fillStyle = rgb('PATH'); g.fillRect(ix - 3, iy - 1, 7, 2); // the Île de la Cité
    g.fillStyle = rgb('ROOF'); g.fillRect(ix, iy - 3, 1, 2);
    Object.entries(REALM).forEach(([id, [lon, lat]], k) => { // a pennant in the school's field colour
      if (!(window.ARMS || {})[id]) return;
      let [x, y] = P(lon, lat); x = clamp(x, 3, Wm - 8); y = clamp(y + (k % 2) * 2, 8, Hm - 2);
      const field = DAYLIGHT[I[TINCT[window.ARMS[id][1][1]]]];
      g.fillStyle = '#16121c'; g.fillRect(x, y - 8, 1, 9);
      g.fillStyle = field; g.fillRect(x + 1, y - 8, 4, 3); g.fillRect(x + 1, y - 5, 2, 1);
      g.fillStyle = '#16121c'; g.fillRect(x - 1, y + 1, 3, 1);
    });
    g.fillStyle = '#16121c'; // Orsay, off the map: an arrow
    [[4, Hm - 4], [5, Hm - 5], [6, Hm - 6], [4, Hm - 5], [4, Hm - 6], [5, Hm - 4], [6, Hm - 4]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
    g.strokeStyle = '#8a6f2e'; g.lineWidth = 2; g.strokeRect(1, 1, Wm - 2, Hm - 2);
  }

  /* ---- the camp answers a click: the cats, the knight, the wizard, the fire, the shield ---- */

  const CAT_SAYS = {
    blackLoaf: 'The big black cat purrs, one eye on the fire.',
    spotted: 'The spotted cat ignores you, as is proper.',
  };
  const WIZARD_SAYS = [
    'The wizard taps his staff: "Choose a door, traveller."',
    'The wizard murmurs: "Press ? and the keys will tell you their secrets."',
    'The wizard squints at the sky: "The dragon passes about once a minute. Up, up, down, down..."',
    'The wizard points at the castle: "Each window is a room. Each room, a part of the story."',
  ];

  /** What sits under scene pixel (x, y), if anything one can talk to. */
  function hitAt(x, y) {
    if (!scene || view.state !== 'scene') return null;
    const go = groundOff(scene.fire.y) - scene.M; const { fire, knight, wizard } = scene;
    const inBox = (x0, y0, w, h) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
    const cat = scene.cats.find((c) => inBox(c.x + go, c.y, c.sp.w, c.sp.h));
    if (cat) return { kind: 'cat', name: Object.keys(SPRITES.cats).find((k) => SPRITES.cats[k] === cat.sp) };
    const sh = scene.shieldSp;
    if (sh && inBox(knight.x + go + 1, fire.y + 7 - sh.h, sh.w, sh.h)) return { kind: 'shield' };
    if (inBox(fire.x + go - 7, fire.y - 18, 14, 22)) return { kind: 'fire' };
    const c = scene.cellar; const cmx = c.x - scene.M + shift(RATE[L.MID]);
    if (inBox(cmx - 1, c.y - 1, c.w + 2, c.h + 1)) return { kind: 'cellar' };
    if (inBox(knight.x + go, knight.y, SPRITES.knight.w, SPRITES.knight.h)) return { kind: 'knight' };
    if (scene.meteors.some((m) => Math.hypot(x - m.x, y - m.y) < 6)) return { kind: 'meteor' };
    const an = scene.angler; if (look.night < 0.5 && inBox(an.x - scene.M + groundOff(an.y + 6), an.y, SPRITES.angler.w + 6, SPRITES.angler.h)) return { kind: 'angler' };
    const hs = scene.horse; if (inBox(hs.x + go, hs.y, SPRITES.horse[0].w, SPRITES.horse[0].h)) return { kind: 'horse' };
    const ow = scene.owl; const fo = shift(RATE[L.FG]) - scene.M;
    if (look.night > 0.5 && inBox(ow.x + fo - 1, ow.y - 1, SPRITES.owl.w + 2, SPRITES.owl.h + 2)) return { kind: 'owl' };
    const [mhx, mhy] = scene.mill.hub; const mmx = mhx - scene.M + shift(RATE[L.MID]); const ml = scene.mill.len;
    if (inBox(mmx - ml, mhy - ml, 2 * ml + 1, 2 * ml + 14)) return { kind: 'mill' };
    if (inBox(wizard.x + go, wizard.y, SPRITES.wizard.w, SPRITES.wizard.h)) return { kind: 'wizard' };
    return null;
  }
  function talk(hit) {
    if (hit.kind === 'cat') say(CAT_SAYS[hit.name] || 'A cat looks at you.');
    else if (hit.kind === 'knight' && look.night > 0.7) say('The knight is asleep by the fire. Best not to wake him.');
    else if (hit.kind === 'knight') { const r = rumour(); say(`The knight looks up from the fire: "${r[0].toUpperCase()}${r.slice(1)}"`); }
    else if (hit.kind === 'wizard') { say(WIZARD_SAYS[Math.floor(Math.random() * WIZARD_SAYS.length)]); castUntil = now() + 0.8; sparkle(16); }
    else if (hit.kind === 'fire') {
      say('The fire crackles and throws up sparks.');
      for (let k = 0; k < 24; k += 1) scene.embers.push({ x: scene.fire.x + (Math.random() - 0.5) * 8, y: scene.fire.y - 10, vy: -(0.8 + Math.random() * 1.4), ph: Math.random() * 6, age: 0, life: 20 + Math.random() * 30 });
    } else if (hit.kind === 'shield') say("On the knight's shield: azure, an armillary sphere or, over a bell curve argent.");
    else if (hit.kind === 'cellar') { say('A low door in the rock. Stone steps go down into the dark.'); descendTo(); }
    else if (hit.kind === 'horse') say("The knight's horse crops the grass and flicks its tail at you.");
    else if (hit.kind === 'meteor') say('You catch the shooting star and make a wish. It is yours to keep.');
    else if (hit.kind === 'angler') say(['The angler raises a finger to his lips. The fish are listening.', 'The angler shows you an empty basket and a patient smile.', '"They bite at dawn," says the angler, "and never when you watch."'][Math.floor(Math.random() * 3)]);
    else if (hit.kind === 'owl') say('The owl turns its head right round and hoots: "Who-oo?"');
    else if (hit.kind === 'mill') {
      const w = Math.round(weather.wind);
      say(w < 2 ? 'The mill stands still: not a breath of wind over Paris.' : `The mill's sails turn in the wind: ${w} km/h over Paris.`);
    }
  }
  const scenePoint = (e) => {
    const r = plate.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / px), Math.floor((e.clientY - r.top) / px)];
  };

  function sparkle(n) {
    if (!scene) return;
    const { wizard } = scene;
    for (let k = 0; k < n; k += 1) {
      scene.sparks.push({ x: wizard.x + ORB[0], y: wizard.y + ORB[1], vx: (Math.random() - 0.5) * 1.2,
        vy: -(0.3 + Math.random() * 1.1), age: 0, life: 14 + Math.random() * 16, c: Math.floor(Math.random() * 3) });
    }
  }

  /** Particles, walkers, flights and flocks: one step per frame. */
  function step(t) {
    const { fire, fh, fw, W, Ws, M, yHor, yg, H, chimney } = scene;
    const span = Math.min(W, Ws);
    tick += 1;
    scene.drops ||= Array.from({ length: Math.round((W * H) / 160) }, () => ({ x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6 }));
    if (WET[weather.kind]) { // rain falls fast, leaning with the wind
      const slant = clamp(windX() * 0.75, -1, 1);
      scene.drops.forEach((d) => { d.y += 5; d.x += slant * 2.5; if (d.y > H) { d.y -= H + 4; d.x = Math.random() * W; } d.x = (d.x + W) % W; });
    } else if (weather.kind === 'snow') scene.drops.forEach((d) => { d.y += 0.6; if (d.y > H) { d.y = -2; d.x = Math.random() * W; } });
    scene.flash = Math.max(0, (scene.flash || 0) - 1);

    // the countryside: the mill turns with the wind (still in a calm), the hamlet's chimneys smoke,
    // the ducks paddle and turn, geese pass in autumn, shooting stars on clear nights
    if (!reduce) scene.millAngle += Math.min(weather.wind, 60) * 0.0025;
    if (scene.chimneys.length && Math.random() < 0.08) {
      const c = scene.chimneys[Math.floor(Math.random() * scene.chimneys.length)];
      scene.fumes.push({ x: c.x, y: c.y, r: 1, age: 0, life: 40 + Math.random() * 30 });
    }
    scene.ducks.forEach((d) => {
      d.x += d.dir * 0.06;
      if (d.x < d.a || d.x > d.b || Math.random() < 0.002) d.dir = -d.dir;
    });
    if (!scene.geese && scene.season === 'autumn' && look.night < 0.3 && Math.random() < 0.0012) {
      const y0 = Math.round(yHor * (0.2 + Math.random() * 0.25));
      scene.geese = Array.from({ length: 9 }, (_, k) => ({ x: span + 10 + Math.ceil(k / 2) * 5, y: y0 + Math.ceil(k / 2) * (k % 2 ? 3 : -3) }));
    }
    if (scene.geese) {
      scene.geese.forEach((g) => { g.x -= 0.8; g.y += 0.05; });
      if (scene.geese.every((g) => g.x < -6)) scene.geese = null;
    }
    if (look.night > 0.6 && weather.cover < 0.6 && !reduce && Math.random() < (meteorRate(clockFn()) * 8) / (3600 * 12)) {
      const dir = Math.random() < 0.5 ? -1 : 1; const v = 2 + Math.random() * 2;
      scene.meteors.push({ x: Math.random() * W, y: Math.random() * yHor * 0.5, dx: dir * v, dy: v * (0.4 + Math.random() * 0.5), age: 0, life: 6 + Math.random() * 6 });
    }
    scene.meteors = scene.meteors.filter((m) => { m.x += m.dx; m.y += m.dy; m.age += 1; return m.age < m.life; });
    // a passer-by on the castle road now and then: peasant or messenger by day, a lantern by night
    if (!scene.walker && !reduce && Math.random() < 0.004) {
      const up = Math.random() < 0.5;
      scene.walker = { y: up ? H + 2 : scene.top + 1, dir: up ? -1 : 1, kind: look.night > 0.5 ? 'lantern' : Math.random() < 0.25 ? 'messenger' : 'peasant' };
    }
    if (scene.walker) {
      const w = scene.walker; w.y += w.dir * (w.y >= yg ? 0.22 : 0.07); // slower far off: perspective
      if (w.y < scene.top || w.y > H + 3) scene.walker = null;
    }
    if (!scene.fish && look.night < 0.6 && !reduce && Math.random() < 0.01) {
      const x = M + Math.round(Math.random() * Ws); const y = Math.round((scene.riverTop(x) + scene.riverBot(x)) / 2);
      scene.fish = { x, y0: y, y, age: 0, dir: Math.random() < 0.5 ? -1 : 1 };
    }
    if (scene.fish) { const f = scene.fish; f.age += 1; f.x += f.dir * 0.4; f.y = f.y0 - Math.sin((f.age / 12) * Math.PI) * 4; if (f.age > 12) scene.fish = null; }
    if (look.night > 0.7 && !reduce && Math.random() < 0.025) {
      const go0 = groundOff(fire.y) - M; scene.zzz.push({ x: scene.knight.x + go0 + 17, y: scene.knight.y + 2, age: 0 });
    }
    scene.zzz = scene.zzz.filter((z) => { z.y -= 0.25; z.x += 0.15; z.age += 1; return z.age < 40; });
    const fest = festival(today());
    if (fest && fest[0] === 'fireworks' && look.night > 0.4 && !reduce && Math.random() < 0.07) {
      scene.fireworks.push({ rocket: true, x: Math.round(W * (0.5 + Math.random() * 0.3)) + shift(RATE[L.MID]), y: scene.castleTop + 30, top: scene.castleTop - 10 - Math.random() * yHor * 0.4 });
    }
    const sparksOut = [];
    scene.fireworks = scene.fireworks.filter((f) => {
      if (f.rocket) {
        f.y -= 3.5;
        if (f.y > f.top) return true;
        const c = [[255, 90, 90], [255, 220, 110], [120, 210, 255], [200, 130, 255], [140, 255, 150]][Math.floor(Math.random() * 5)];
        for (let k = 0; k < 26; k += 1) { const a = (k / 26) * 2 * Math.PI; const v = 1 + Math.random() * 0.6; sparksOut.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 22 + Math.random() * 10, c }); }
        return false;
      }
      f.x += f.vx; f.y += f.vy; f.vy += 0.04; f.vx *= 0.97; f.age += 1; return f.age < f.life;
    });
    scene.fireworks.push(...sparksOut);
    if (scene.minstrelAt && !reduce && Math.random() < 0.06) scene.notes.push({ x: scene.minstrelAt[0], y: scene.minstrelAt[1], age: 0, ph: Math.random() * 6 });
    scene.notes = scene.notes.filter((n) => { n.y -= 0.3; n.x += Math.sin(n.age * 0.15 + n.ph) * 0.4; n.age += 1; return n.age < 70; });
    if (fest && !scene.toldFest) { scene.toldFest = true; try { if (sessionStorage.getItem('fest') !== fest[0]) { sessionStorage.setItem('fest', fest[0]); say(fest[1]); } } catch { /* private mode */ } }
    if (weather.kind === 'storm' && !reduce && Math.random() < 0.006) scene.flash = 3;

    if (Math.random() < 0.5) {
      scene.embers.push({ x: fire.x + (Math.random() - 0.5) * fw * 0.6, y: fire.y - fh * 0.5,
        vy: -(0.5 + Math.random() * 0.8), ph: Math.random() * 6, age: 0, life: 18 + Math.random() * 30 });
    }
    if (Math.random() < 0.25 + 0.3 * look.night) {
      scene.smoke.push({ x: fire.x - 1 + Math.random() * 3, y: fire.y - fh * 0.9, r: 2, age: 0, life: 50 + Math.random() * 40 });
    }
    if (Math.random() < 0.12) scene.fumes.push({ x: chimney.x, y: chimney.y, r: 1, age: 0, life: 60 + Math.random() * 40 });
    const age = (list, move) => list.filter((p) => { p.age += 1; move(p); return p.age < p.life; });
    scene.embers = age(scene.embers, (e) => { e.y += e.vy; e.x += Math.sin(e.age * 0.3 + e.ph) * 0.5 + windX() * 0.2; });
    scene.smoke = age(scene.smoke, (p) => {
      p.y -= 0.35; p.x += windX() * 0.22 + Math.sin(p.age * 0.05) * 0.1; // drifts with the real wind
      if (p.age % 20 === 0 && p.r < 4) p.r += 1;
    });
    scene.fumes = age(scene.fumes, (p) => {
      p.y -= 0.18; p.x += windX() * 0.15 + Math.sin(p.age * 0.07) * 0.05;
      if (p.age % 25 === 0 && p.r < 3) p.r += 1;
    });
    if (t < castUntil && Math.random() < 0.8) sparkle(1);
    scene.sparks = age(scene.sparks, (s) => { s.x += s.vx; s.y += s.vy; s.vy += 0.015; });
    scene.flies.forEach((f) => { f.x += Math.sin(t * 0.7 + f.ph) * 0.3; f.y += Math.cos(t * 0.9 + f.ph * 2) * 0.2; });
    const pz = scene.peasant;
    if (pz) {
      pz.x += pz.dir * 0.12;
      if (pz.x > scene.field.x1 - 6 || pz.x < scene.field.x0 + 1) pz.dir = -pz.dir;
      const fy = Math.round((scene.field.top(Math.round(pz.x)) + scene.field.bot) / 2);
      if (scene.field.season !== 'winter' && Math.random() < 0.15) pz.seeds.push({ x: pz.x + (pz.dir > 0 ? 6 : 0), y: fy - 4, age: 0, life: 6 });
      pz.seeds = age(pz.seeds, (q) => { q.y += 0.4; q.x += pz.dir * 0.2; });
    }
    scene.falling.forEach((q) => {
      q.y += scene.season === 'winter' ? 0.35 : 0.25;
      if (q.y > H) { q.y = -2; q.x = Math.random() * scene.WE; }
    });
    scene.butterflies.forEach((b) => {
      b.x += Math.sin(t * 0.9 + b.ph) * 0.6 + Math.sin(t * 2.7 + b.ph * 3) * 0.3;
      b.y = clamp(b.y + Math.cos(t * 1.3 + b.ph * 2) * 0.4, yg + 4, H - 6);
      b.x = clamp(b.x, M + 5, M + span - 5);
    });
    scene.sentries.forEach((s) => { // walk to an end, wait, turn back
      if (s.pause > 0) { s.pause -= 1; return; }
      s.x += s.v;
      if (s.x < s.a || s.x > s.b) { s.v = -s.v; s.x = clamp(s.x, s.a, s.b); s.pause = 30 + Math.floor(Math.random() * 60); }
    });
    if (look.night > 0 && Math.random() < 0.01) { // a window goes out or comes on
      const w = scene.windows[Math.floor(Math.random() * scene.windows.length)];
      if (w) w.lit = !w.lit;
    }

    if (!scene.birds && look.night < 0.3 && Math.random() < 0.004) {
      const y0 = yHor * (0.15 + Math.random() * 0.4);
      scene.birds = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, k) => ({ x: span + 10 + k * 5, y: y0 + Math.abs(k - 2) * 3 }));
    }
    if (scene.birds) {
      scene.birds.forEach((b) => { b.x -= 0.7; b.y += Math.sin(t + b.x * 0.1) * 0.1; });
      if (scene.birds.every((b) => b.x < -5)) scene.birds = null;
    }

    const fe = scene.ferry; // crosses, waits on the far bank, comes back
    if (fe.wait > 0) fe.wait -= 1;
    else {
      fe.x += fe.dir * 0.25;
      const lo = M + 6; const hi = M + span - 6;
      if (fe.x < lo || fe.x > hi) { fe.x = clamp(fe.x, lo, hi); fe.dir = -fe.dir; fe.wait = 600 + Math.floor(Math.random() * 900); }
    }

    // the dragon: every minute or so (every few seconds in wizard mode), across the sky
    const wiz = root.classList.contains('wizard');
    scene.nextDragon ??= t + 6;
    if (!scene.dragon && t > scene.nextDragon) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const high = Math.max(3, scene.castleTop - 30); // the frame's 23 rows and the wing-beat under the spires
      scene.dragon = { dir, x: dir > 0 ? -45 : span + 5, y: 0, y0: 3 + Math.random() * (high - 3), flames: [], breath: -1 };
    }
    const dg = scene.dragon;
    // in wizard mode it comes down onto the tall tower, sits a while, smoking, then flies on
    const tip = scene.tallTip;
    if (dg && wiz && tip && !dg.land) {
      const sp = SPRITES.dragon[1]; const tx = tip.x - M + shift(RATE[L.MID]) - Math.round(sp.w / 2);
      if (Math.abs(dg.x - tx) < 40) dg.land = { phase: 'down', t0: t, x0: dg.x, y0: dg.y, tx, ty: tip.y - sp.h + 4 };
    }
    if (dg && dg.land && dg.land.phase !== 'fly') {
      const L0 = dg.land; const k = clamp((t - L0.t0) / 1.6);
      if (L0.phase === 'down') {
        dg.x = L0.x0 + (L0.tx - L0.x0) * k; dg.y = L0.y0 + (L0.ty - L0.y0) * k * k;
        if (k >= 1) { L0.phase = 'sit'; L0.t0 = t; }
      } else if (L0.phase === 'sit') {
        if (!reduce && Math.random() < 0.15) scene.fumes.push({ x: dg.x - shift(RATE[L.MID]) + M + (dg.dir > 0 ? DRAGON_MOUTH[0] : SPRITES.dragon[0].w - DRAGON_MOUTH[0]), y: dg.y + DRAGON_MOUTH[1] - 2, r: 1, age: 0, life: 40 });
        if (t - L0.t0 > 10) { L0.phase = 'fly'; dg.y0 = dg.y - 20; }
      }
    } else if (dg) {
      dg.x += dg.dir * 1.4;
      dg.y = dg.y0 + Math.sin(dg.x * 0.05) * 4;
      if (dg.breath < 0 && Math.random() < (wiz ? 0.08 : 0.006)) dg.breath = 14;
      if (dg.breath > 0) {
        dg.breath -= 1;
        if (dg.breath === 0) dg.breath = -1;
        const mouth = dg.dir > 0 ? dg.x + DRAGON_MOUTH[0] : dg.x + SPRITES.dragon[0].w - 1 - DRAGON_MOUTH[0];
        for (let k = 0; k < 3; k += 1) {
          dg.flames.push({ x: mouth, y: dg.y + DRAGON_MOUTH[1], vx: dg.dir * (1.5 + Math.random()), vy: (Math.random() - 0.3) * 0.6,
            age: 0, life: 10 + Math.random() * 8 });
        }
      }
      dg.flames = age(dg.flames, (f) => { f.x += f.vx; f.y += f.vy; });
      if (dg.x < -50 || dg.x > span + 10) {
        scene.dragon = null;
        scene.nextDragon = t + (wiz ? 4 : 50 + Math.random() * 50);
      }
    }
  }

  /** The scene animates at ~12 fps; the parallax eases at the screen's rate (time-based, 0.2 s),
   *  and the frame is recomposed whenever a plane has moved by a pixel. */
  let lastMs = 0; let lastSig = '';
  function frame(ms) {
    raf = 0;
    if (!running) return;
    const dt = lastMs ? Math.min(0.1, (ms - lastMs) / 1000) : 0;
    lastMs = ms;
    par += (parTarget - par) * (1 - Math.exp(-dt / 0.2));
    let dirty = view.state === 'in' || view.state === 'out' || view.state === 'swap';
    if (ms - last >= FPS_MS) {
      last = ms;
      if (view.state !== 'room') { stepFire(); step(now()); }
      if (interior) stepInterior();
      dirty = true;
    }
    const sig = RATE.map((r) => shift(r)).join() + groundOff(scene.H - 1);
    if (sig !== lastSig) { lastSig = sig; dirty = dirty || view.state === 'scene'; }
    if (dirty) { render(now()); if (view.state === 'scene') anchorMenu(); }
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    const want = isOn() && visible && !document.hidden;
    if (want) {
      if (!view.id) plate.setAttribute('aria-label', SCENE_LABEL);
      resize();
      if (pendingRoom !== null) { const id = pendingRoom; pendingRoom = null; goRoom(id, false); }
      if (reduce) { render(now()); return; }
      if (!running) { running = true; lastMs = 0; raf = requestAnimationFrame(frame); }
    } else {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (!isOn()) plate.setAttribute('aria-label', label0);
    }
  }

  window.Hours = {
    start(o) {
      if (canvas) return;
      plate = o.plate; skyFn = o.sky; reduce = o.reduceMotion; clockFn = o.clock || clockFn;
      heraldry = o.heraldry || heraldry; say = o.say || say; rumour = o.rumour || rumour;
      itemsOf = o.items || itemsOf; spotsTo = o.spots || spotsTo; descendTo = o.descend || descendTo; doorsOf = o.doors || doorsOf;
      pendingRoom = root.dataset.room || null;
      label0 = plate.getAttribute('aria-label');
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      plate.append(canvas);
      ctx = canvas.getContext('2d');
      const redraw = () => { if (isOn() && resize() && !running) render(now()); };
      new ResizeObserver(redraw).observe(plate);

      addEventListener('resize', redraw);
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(plate);
      document.addEventListener('visibilitychange', sync);
      new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
      // parallax follows a mouse, not a finger; the menu box moves with the wizard
      if (!reduce) {
        addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse' || !isOn()) return;
          parTarget = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
        }, { passive: true });
      }
      // the wizard answers the menu he holds: sparks while a choice is pointed at, a burst on one
      const pointed = (e) => isOn() && e.target instanceof Element && e.target.closest('.tabs a');
      const roomIn = (a) => (a ? (a.getAttribute('href').split('#')[1] || null) : null);
      document.addEventListener('pointerover', (e) => { const a = pointed(e); hoverId = roomIn(a) || hoverId; if (a) castUntil = now() + 1.2; });
      document.addEventListener('pointerout', (e) => { if (pointed(e)) hoverId = null; });
      document.addEventListener('focusin', (e) => { const a = pointed(e); hoverId = roomIn(a); if (a) castUntil = now() + 1.2; });
      document.addEventListener('click', (e) => { if (pointed(e)) { castUntil = now() + 0.6; sparkle(24); } });
      canvas.addEventListener('click', (e) => { const h = isOn() && hitAt(...scenePoint(e)); if (h) talk(h); });
      canvas.addEventListener('pointermove', (e) => { canvas.style.cursor = isOn() && hitAt(...scenePoint(e)) ? 'pointer' : ''; });
      sync();
    },
    /** New minute, or another hour asked for with `sky`: relight the same scene. */
    update() {
      if (!scene) return;
      relight();
      if (!running && isOn()) render(now());
    },
    /** Into the room of section `id`, or back out (null); script.js calls it as the hash changes. */
    room(id, { animate = true } = {}) { goRoom(id, animate); },
    /** Draw the realm (the map dialog's Paris) into a 240x150 canvas. */
    realm(cv) { if (cv) drawRealm(cv); },
    /** The hour has turned: the bell swings a few seconds. */
    ring() { if (scene) scene.ringUntil = now() + 5; },
    /** Every room seen: the visitor's banner goes up the keep (`instant`: already up). */
    hoist(instant) { if (scene && !scene.hoist) scene.hoist = { t0: instant ? -99 : now() }; else if (!scene) pendingHoist = true; },
    /** The weather over Paris changed (or a preview asked for one). */
    weather(w) { weather = { ...weather, ...w }; if (scene && !running && isOn()) render(now()); },
    /** Light the thing at index i (hotspot hovered or focused); -1 for none. */
    highlight(i) { hl = i; if (!running && interior && isOn()) render(now()); },
  };
}());
