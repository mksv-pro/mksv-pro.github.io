/* The castle's drawings, in letters: each sprite a block of text, one letter a pixel, its material
   by letter (hours.js: MATS, shaded and outlined by shadeSprite); '.' is empty. Loaded before hours.js. */
(function () {
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
..kaa.
ggaaa.
...aa.
....a.
...aa.
..aaaa
..aaaa
...aa.
...k..
...k..`;
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
  // the messenger on his horse, two strides (facing left, up the road)
  const RIDER = [`
......rr.......
.....rffr......
.....rrrr......
....arrrra.....
.....rrrr......
.hh..rrrrhhhhh.
hkhhhhhhhhhhhhh
.hhhhhhhhhhhhhh
..hhhhhhhhhhhh.
..h.h.....h.h..
..h..h...h..h..
..k...k.k...k..`, `
......rr.......
.....rffr......
.....rrrr......
....arrrra.....
.....rrrr......
.hh..rrrrhhhhh.
hkhhhhhhhhhhhhh
.hhhhhhhhhhhhhh
..hhhhhhhhhhhh.
...hh.....hh...
...hh.....hh...
...kk.....kk...`];
  // what the knight dreams of (1, 2: two colours, see dream), one picture a subject
  const DREAMS = {
    nucleus: [/nucle|scatter|r-matrix|isotop/i, ['..1..', '.121.', '12121', '.121.', '..1..'], ['CAP', 'WING']],
    spins: [/quantum|spin|qubit|qaoa/i, ['1.2.1', '.....', '2.1.2', '.....', '1.2.1'], ['CAP', 'WING']],
    city: [/urban|city|morpho|dla|fractal/i, ['..1..', '.111.', '1.1.1', '..1..', '.1.1.'], ['GOLD', 'GOLD']],
    orbits: [/n-body|gravit|orbit|planet/i, ['.1.1.', '1...1', '..2..', '1...1', '.1.1.'], ['ARM', 'GOLD']],
    bell: [/market|financ|stochast|mean-field|econom|dataset/i, ['..1..', '.111.', '.111.', '11111', '11111'], ['GOLD', 'GOLD']],
  };
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
  const WORLD_MAP = '0000000000000000fc0000003cfe7c38ffff3ffe327fffff03ff01bfffff01ff81ffff6001fe03dfffa000fc03fffff4006003fbdfc0003803fd99c0000f03fc09800007c1fc07c00007f07c07e00007e07c00600003c07a01f00003803801f80003003001f0000200000014000200000000000000000000000100000000ff1fffffffffffffffffffffffffffffffff'; // 48 x 24 land/sea, 7.5 deg cells from 180 W and 90 N, a row in 12 hex digits (for the library's globe)
  // who lives in each room: one standing figure, an adult at the rooms' scale (28 px, five heads;
  // a table's top at his hip), its clothes by letter: H the head's covering, B the body, A the arms
  // (sleeves), L the legs, X an emblem; f skin, e beard (MATS), k the belt; a raven on the falconer's fist
  const PERSON = `
....HHHH....
...HHHHHH...
..HHHHHHHH..
...ffffff...
...fkffkf...
...ffffff...
...eeffee...
....eeee....
...BBBBBB...
..BBBBBBBB..
.ABBBBBBBBA.
.ABBBBBBBBA.
.ABBBXXBBBA.
.ABBBXXBBBA.
.ABBBBBBBBA.
.ABBBBBBBBA.
.ffkkkkkkff.
...BBBBBB...
...BBBBBB...
..BBBBBBBB..
..BBBBBBBB..
..BBBBBBBB..
...LL..LL...
...LL..LL...
...LL..LL...
...LL..LL...
...LL..LL...
..hhh..hhh..`;
  // a piece in the foreground of each room, cut by the bottom edge: it gives the floor its depth
  const NEAR_SP = {
    about: `
.wwwwwww.
wwwwwwwww
.w.....w.
.w.....w.
.w.....w.`, // a stool
    research: `
hhhhhhhhhhhh
hgggggggggggh
hhhhhhhhhhhhh
hhhhhggghhhhh
hhhhhhhhhhhhh
hhhhhhhhhhhhh`, // a chest of instruments, brass-bound
    projects: `
.aaaaaaa.
awwwwwwwa
.wwwwwww.
.aaaaaaa.
.wwwwwww.
.wwwwwww.`, // the quenching bucket
    publications: `
..rrrrr..
.uuuuuuu.
..hhhhhh.
.rrrrrrr.
uuuuuuuu.`, // books stacked on the floor
    talks: `
wwwwwwwwwwww
wwwwwwwwwwww
w.........w.
w.........w.`, // the end of a bench
    teaching: `
.hhhh.
hhhhhh
hhghhh
hhhhhh
hhhhhh`, // a satchel
    news: `
...w...
wwwwwww
...w...
...w...
...w...
..www..`, // a perch on its stand
    contact: `
hhhhhhhhhhh
hahhhhhhaah
hhhhhhhhhhh
hhhhhghhhhh
hhhhhhhhhhh`, // a traveller's trunk
    cellar: `
..wwwwwww..
.waawwwaaw.
wwwwwwwwwww
wwaawwwaaww
.wwwwwwwww.`, // a cask on its side
  };
  // the frame's small life (paintFrame, frameLife): Blanc Blanc asleep, a rat, a bat hanging and in
  // flight, a spider, a torch on its bracket, a snail in the vine
  const FRAME_SP = {
    bbLoaf: `
.b..b.......
.bbbb.......
bkbkqqqbbqq.
qqqqqqqbbqqq
.qqqqqqqqqqqq
..qq...qq..qq`,
    rat: `
.......dd.
.ddddddd*d
dddddddddd
.d..d..d..`,
    batHang: `
..n..
.nEn.
nnnnn
.nnn.`,
    batA: `
n.....n
nn.n.nn
.nnnnn.
...n...`,
    batB: `
.......
nnnnnnn
.nnnnn.
...n...`,
    spider: `
k.k.k
.kkk.
kkdkk
.kkk.
k.k.k`,
    torch: `
.www.
..w..
..w..
aaaaa
..a..`,
    snail: `
..ggg.
.gkgkg
.ggggg
fffffff`,
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
  // a chalk hand for the schoolroom's equations: 5 rows, each glyph its own width (Greek letters wider)
  const GLYPHS = {
    i: ['1', '0', '1', '1', '1'], 'ħ': ['100', '111', '100', '111', '101'], '∂': ['010', '001', '011', '101', '010'],
    'ψ': ['10101', '10101', '01110', '00100', '00100'], '/': ['001', '001', '010', '100', '100'], t: ['010', '111', '010', '010', '011'],
    '=': ['000', '111', '000', '111', '000'], H: ['101', '101', '111', '101', '101'], 'ρ': ['000', '010', '101', '110', '100'],
    D: ['110', '101', '101', '101', '110'], '∇': ['11111', '10001', '01010', '00100', '00000'], '²': ['11', '01', '10', '11', '00'],
    Z: ['111', '001', '010', '100', '111'], 'Σ': ['111', '100', '010', '100', '111'], e: ['000', '111', '111', '100', '111'],
    x: ['000', '101', '010', '101', '000'], p: ['000', '111', '101', '111', '100'], '-': ['000', '000', '111', '000', '000'],
    'β': ['010', '101', '110', '101', '110'], E: ['111', '100', '110', '100', '111'], u: ['000', '101', '101', '101', '111'],
    '+': ['000', '010', '111', '010', '000'], '(': ['01', '10', '10', '10', '01'], ')': ['10', '01', '01', '01', '10'], 0: ['111', '101', '101', '101', '111'],
  };
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
  // the copyist, a Benedictine in his black habit, seated in profile facing right, his hood down (his writing hand: deco 'copyist')
  const MONK = `
..nnn...
.nnfff..
.nffkf..
.nfffff.
..fff...
..bbb...
.bbbbb..
bbbbbbb.
bbbbbbbb
bbbbbb..
bbbbbb..
bbbbbbb.
bbbbbbbb
bbbbbbbb
bbbbbbbb
.bb..bb.`;
  const HAIR = ['h', 'b', 't', 'g', 'h', 'b'];
  const TUNIC = ['r', 'u', 'd', 'p', 'u', 'r'];
  window.HOURS_ART = { KNIGHT, KNIGHT_HEAD, WIZARD, ORB, HORSE, DEER, OWL, HERON, MINSTREL, ANGLER, SNOWMAN, DUCK, WIZ_HEAD_X, RIDER, DREAMS, DRAGON_BODY, WING_UP, WING_DOWN, DRAGON_MOUTH, CATS, WORLD_MAP, PERSON, NEAR_SP, FRAME_SP, RAVEN, GLYPHS, PEASANT, PUPIL, MONK, HAIR, TUNIC };
}());
