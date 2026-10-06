-- Metaped clothing tints.
--
-- RDR2 colours clothing in two different ways and the wardrobe exposes both:
--
--   1. Variants  - the same garment shipped as separate component hashes
--                  (clothing_item_m_vest_003_tint_001, _tint_002, ...).  These are
--                  plain list entries and are handled by the item browser.
--   2. Tints     - assets flagged `useTintPalette` read their colour from a
--                  metaped_tint_* palette instead of a baked albedo.  Three
--                  channels are mixed on top of it:
--
--                      tint0 -> green channel  (primary, the bulk of the palette)
--                      tint1 -> red channel    (secondary)
--                      tint2 -> blue channel   (tertiary)
--
--                  Each channel takes 0-254.  255 disables the channel.
--
-- Applied with SET_TEXTURE_OUTFIT_TINTS (0x4EFC1F8FF1AD94DE), see
-- NativeSetTextureOutfitTints in client/functions.lua.

local Tints = {}

Tints.OFF = 255
Tints.DEFAULT_PALETTE = 0

-- Categories the colour section is offered for.
--
-- There is no runtime native that reports whether a given component carries the
-- `useTintPalette` flag, so this is a curated allowlist rather than a lookup.
-- If a category shows no visual change on your clothing pack, remove it here; if
-- a tintable category is missing, add it.  Keys are metaped category names, the
-- same strings used by RSG.MenuElements in shared/config.lua.
Tints.Categories = {
    hats            = true,
    neckwear        = true,
    neckties        = true,
    masks           = true,
    shirts_full     = true,
    vests           = true,
    suspenders      = true,
    coats           = true,
    coats_closed    = true,
    ponchos         = true,
    cloaks          = true,
    armor           = true,
    gloves          = true,
    gauntlets       = true,
    pants           = true,
    chaps           = true,
    skirts          = true,
    dresses         = true,
    spats           = true,
    boots           = true,
    gunbelts        = true,
    belts           = true,
    satchels        = true,
}

-- Swatches shown above the channel sliders.
--
-- `hex` is only what the swatch is painted with in the menu - the game resolves
-- the real colour from the palette, so treat these as labels and retune them to
-- whatever your palette actually produces.  The ped is the source of truth.
Tints.Presets = {
    { name = 'default',   hex = '#6b6257', palette = 0, t0 = Tints.OFF, t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'black',     hex = '#17161a', palette = 0, t0 = 4,   t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'charcoal',  hex = '#3a3a3c', palette = 0, t0 = 24,  t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'slate',     hex = '#5b6168', palette = 0, t0 = 40,  t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'bone',      hex = '#d8cdb4', palette = 0, t0 = 56,  t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'tan',       hex = '#b9956a', palette = 0, t0 = 72,  t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'saddle',    hex = '#8a5a33', palette = 0, t0 = 88,  t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'chocolate', hex = '#4e3324', palette = 0, t0 = 104, t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'rust',      hex = '#a1492a', palette = 0, t0 = 120, t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'crimson',   hex = '#8c2230', palette = 0, t0 = 136, t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'plum',      hex = '#5c3350', palette = 0, t0 = 152, t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'navy',      hex = '#2b3a5c', palette = 0, t0 = 168, t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'teal',      hex = '#2f5f5c', palette = 0, t0 = 184, t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'forest',    hex = '#39502f', palette = 0, t0 = 200, t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'olive',     hex = '#6c6a3a', palette = 0, t0 = 216, t1 = Tints.OFF, t2 = Tints.OFF },
    { name = 'mustard',   hex = '#b08a2e', palette = 0, t0 = 232, t1 = Tints.OFF, t2 = Tints.OFF },
}

function Tints.IsTintable(category)
    return Tints.Categories[category] == true
end

--- Normalises a channel value coming from the menu.
--- Anything outside 0-254 collapses to OFF so a bad payload cannot wedge a ped.
function Tints.Channel(value)
    value = tonumber(value)
    if not value then return Tints.OFF end
    value = math.floor(value)
    if value < 0 or value > 254 then return Tints.OFF end
    return value
end

function Tints.Palette(value)
    value = tonumber(value)
    if not value or value < 0 then return Tints.DEFAULT_PALETTE end
    return math.floor(value)
end

--- True when the three channels are all disabled, i.e. the garment is untinted.
function Tints.IsDefault(tint)
    if type(tint) ~= 'table' then return true end
    return (tint.tint0 or Tints.OFF) == Tints.OFF
        and (tint.tint1 or Tints.OFF) == Tints.OFF
        and (tint.tint2 or Tints.OFF) == Tints.OFF
end

return Tints
