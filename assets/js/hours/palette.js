/* The castle's palette, its one source: each surface by name with its daylight colour, the sprites'
   materials by letter (shaded highlight, mid, shadow). hours.js lights it by the hour; the game of the
   descent (game/) and the textures (textures.js, which name these colours) take it as it is. */
(function () {
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

  /** The daylight colour of a named surface or material shade ('ROCK', 'GOLD_SH'...), as [r, g, b]. */
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const BY = Object.fromEntries(SURFACES.map(([n, h]) => [n, h]));
  Object.values(MATS).forEach(([n, hi, mid, sh]) => { BY[`${n}_HI`] = hi; BY[n] = mid; BY[`${n}_SH`] = sh; });
  Object.entries(EMISSIVE).forEach(([n, h]) => { BY[n] = h; });
  const colourOf = (name) => hex(BY[name] || '#ff00ff');
  window.HOURS_PALETTE = { SURFACES, MATS, ALIAS, FLAT, EMISSIVE, colourOf };
}());
