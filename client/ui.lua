
UI = {}

local state = {
    elements = {},
    title = "",
    subtitle = "",
    onSelect = nil,
    onClose = nil,
    onChange = nil,
    onRowAction = nil,
    open = false,
    hideCameraBar = false,
}

local dialogPromise = nil
local alertPromise = nil
local spawnSelectPromise = nil

-- Wardrobe (clothing store) view.  It lives beside the generic list menu rather
-- than inside it: the payload is a whole screen - tab rail, category list, item
-- browser, colour swatches - not a flat list of rows.
local wardrobe = {
    payload = nil,
    handlers = nil,
}

local function sendMenu()
    SendNUIMessage({
        action = "openMenu",
        title = state.title,
        subtitle = state.subtitle,
        elements = state.elements,
        hideCameraBar = state.hideCameraBar,
    })
end

local function sendWardrobe()
    local payload = wardrobe.payload
    if not payload then return end
    payload.action = "openWardrobe"
    SendNUIMessage(payload)
end

local function restoreFocusAfterOverlay()
    if state.open then
        sendMenu()
    elseif wardrobe.payload then
        -- A dialog opened on top of the wardrobe (naming an outfit, confirming a
        -- purchase).  Re-send the view so it is still there underneath.
        sendWardrobe()
    else
        SetNuiFocus(false, false)
    end
end

local function buildMenuObject()
    local menu = {}

    function menu.setElement(index, prop, value)
        local el = state.elements[index]
        if not el then return end
        el[prop] = value
    end

    function menu.refresh()
        sendMenu()
    end

    function menu.addNewElement(element)
        table.insert(state.elements, element)
    end

    function menu.removeElementByIndex(index)
        table.remove(state.elements, index)
    end

    function menu.close()
        UI.CloseAll()
    end

    return menu
end

function UI.Open(_type, _resource, _name, menuData, onSelect, onClose, onChange, onRowAction)
    state.elements = menuData and menuData.elements or {}
    state.title = menuData and menuData.title or ""
    state.subtitle = menuData and menuData.subtext or ""
    state.hideCameraBar = menuData and menuData.hideCameraBar or false
    state.onSelect = onSelect
    state.onClose = onClose
    state.onChange = onChange
    state.onRowAction = onRowAction
    state.open = true

    sendMenu()
    SetNuiFocus(true, true)
end

function UI.CloseAll()
    state.open = false
    state.elements = {}
    wardrobe.payload = nil
    wardrobe.handlers = nil
    SendNUIMessage({ action = "closeAll" })
    SetNuiFocus(false, false)
end

function UI.inputDialog(header, fields)
    dialogPromise = promise.new()
    SendNUIMessage({ action = "dialog", header = header, fields = fields })
    SetNuiFocus(true, true)
    local result = Citizen.Await(dialogPromise)
    restoreFocusAfterOverlay()
    if result == false or result == nil then
        return false
    end
    return result
end

function UI.alertDialog(opts)
    opts = opts or {}
    alertPromise = promise.new()
    SendNUIMessage({ action = "alert", header = opts.header, cancel = opts.cancel ~= false })
    SetNuiFocus(true, true)
    local result = Citizen.Await(alertPromise)
    restoreFocusAfterOverlay()
    return result
end

function UI.OpenSpawnSelect(opts)
    opts = opts or {}
    spawnSelectPromise = promise.new()
    SendNUIMessage({
        action = "openSpawnSelect",
        title = opts.title,
        subtitle = opts.subtitle,
        elements = opts.elements or {},
    })
    SetNuiFocus(true, true)
    local value = Citizen.Await(spawnSelectPromise)
    SendNUIMessage({ action = "closeSpawnSelect" })
    SetNuiFocus(false, false)
    return value
end

RegisterNUICallback("spawnSelect", function(data, cb)
    cb("ok")
    if spawnSelectPromise then
        spawnSelectPromise:resolve(data.value)
        spawnSelectPromise = nil
    end
end)

function UI.ShowCharacterInfo(data)
    SendNUIMessage({
        action = "showCharInfo",
        empty = data.empty or false,
        name = data.name,
        job = data.job,
        birthdate = data.birthdate,
        nationality = data.nationality,
        cash = data.cash,
        desc = data.desc,
    })
end

function UI.HideCharacterInfo()
    SendNUIMessage({ action = "hideCharInfo" })
end

function UI.ShowLoadingScreen(text)
    SendNUIMessage({ action = "showLoadingScreen", text = text })
end

function UI.HideLoadingScreen()
    SendNUIMessage({ action = "hideLoadingScreen" })
end

RegisterNUICallback("charInfoPlay", function(data, cb)
    cb("ok")
    TriggerEvent("rsg-character:client:CharInfoPlay")
end)

RegisterNUICallback("charInfoGenderChange", function(data, cb)
    cb("ok")
    TriggerEvent("rsg-character:client:CharInfoGenderChange", data.gender)
end)

RegisterNUICallback("charInfoDelete", function(data, cb)
    cb("ok")
    TriggerEvent("rsg-character:client:CharInfoDelete")
end)

local function BuildLocaleStrings()
    return {
        back = locale('ui.back'),
        camera = {
            rotate = locale('ui.camera.rotate'),
            height = locale('ui.camera.height'),
            zoom = locale('ui.camera.zoom'),
            rotateLeftTitle = locale('ui.camera.rotate_left_title'),
            rotateRightTitle = locale('ui.camera.rotate_right_title'),
            upTitle = locale('ui.camera.up_title'),
            downTitle = locale('ui.camera.down_title'),
            zoomInTitle = locale('ui.camera.zoom_in_title'),
            zoomOutTitle = locale('ui.camera.zoom_out_title'),
            reset = locale('ui.camera.reset'),
            resetTitle = locale('ui.camera.reset_title'),
        },
        total = locale('ui.total'),
        cancel = locale('ui.cancel'),
        confirm = locale('ui.confirm'),
        charInfo = {
            job = locale('charselect.info.job'),
            birthdate = locale('charselect.info.birthdate'),
            nationality = locale('charselect.info.nationality'),
            cash = locale('charselect.info.cash'),
            play = locale('charselect.info.play'),
            delete = locale('charselect.info.delete'),
            create = locale('charselect.info.create'),
            genderMale = locale('charselect.gender.male'),
            genderFemale = locale('charselect.gender.female'),
        },
    }
end

RegisterNUICallback("uiReady", function(data, cb)
    cb("ok")
    SendNUIMessage({ action = "setLocale", strings = BuildLocaleStrings() })
end)

RegisterNUICallback("select", function(data, cb)
    cb("ok")
    if not state.open then return end
    local element = state.elements[data.index + 1]
    if not element then return end
    if state.onSelect then
        state.onSelect({ current = element }, buildMenuObject())
    end
end)

RegisterNUICallback("rowAction", function(data, cb)
    cb("ok")
    if not state.open then return end
    local element = state.elements[data.index + 1]
    if not element then return end
    if state.onRowAction then
        state.onRowAction({ current = element }, buildMenuObject())
    end
end)

RegisterNUICallback("sliderChange", function(data, cb)
    cb("ok")
    if not state.open then return end
    local element = state.elements[data.index + 1]
    if not element then return end
    element.value = data.value
    if state.onChange then
        state.onChange({ current = element }, buildMenuObject())
    end
end)

RegisterNUICallback("back", function(data, cb)
    cb("ok")
    if not state.open then return end
    if state.onClose then
        state.onClose({}, buildMenuObject())
    end
end)


RegisterNUICallback("cameraMoveStart", function(data, cb)
    cb("ok")
    TriggerEvent("rsg-character:client:CameraMoveStart", data.direction)
end)

RegisterNUICallback("cameraReset", function(data, cb)
    cb("ok")
    TriggerEvent("rsg-character:client:CameraMoveStop")
    TriggerEvent("rsg-character:client:CameraReset")
end)

RegisterNUICallback("cameraMoveStop", function(data, cb)
    cb("ok")
    TriggerEvent("rsg-character:client:CameraMoveStop")
end)

RegisterNUICallback("dialogSubmit", function(data, cb)
    cb("ok")
    if dialogPromise then
        dialogPromise:resolve(data.values)
        dialogPromise = nil
    end
end)

RegisterNUICallback("dialogCancel", function(data, cb)
    cb("ok")
    if dialogPromise then
        dialogPromise:resolve(false)
        dialogPromise = nil
    end
end)

RegisterNUICallback("alertConfirm", function(data, cb)
    cb("ok")
    if alertPromise then
        alertPromise:resolve("confirm")
        alertPromise = nil
    end
end)

RegisterNUICallback("alertCancel", function(data, cb)
    cb("ok")
    if alertPromise then
        alertPromise:resolve("cancel")
        alertPromise = nil
    end
end)


-- ---------------------------------------------------------------------------
-- Wardrobe
-- ---------------------------------------------------------------------------

--- Opens the clothing store view.
--- @param payload table tabs, presets, labels, money and price - see BuildWardrobePayload
--- @param handlers table onItem, onVariant, onTint, onAction, onClose
function UI.OpenWardrobe(payload, handlers)
    state.open = false
    state.elements = {}
    wardrobe.payload = payload or {}
    wardrobe.handlers = handlers or {}
    sendWardrobe()
    SetNuiFocus(true, true)
end

--- Pushes changed values into an already open wardrobe without rebuilding it,
--- so the grid does not jump back to the top on every click.
--- @param patch table price and/or a categories array of partial category states
function UI.UpdateWardrobe(patch)
    if not wardrobe.payload then return end
    patch = patch or {}
    patch.action = "updateWardrobe"
    SendNUIMessage(patch)
end

function UI.CloseWardrobe()
    wardrobe.payload = nil
    wardrobe.handlers = nil
    SendNUIMessage({ action = "closeWardrobe" })
    SetNuiFocus(false, false)
end

function UI.IsWardrobeOpen()
    return wardrobe.payload ~= nil
end

local function wardrobeHandler(name)
    local handlers = wardrobe.handlers
    return handlers and handlers[name]
end

RegisterNUICallback("wardrobeItem", function(data, cb)
    cb("ok")
    local handler = wardrobeHandler("onItem")
    if handler then handler(data.category, tonumber(data.value) or 0) end
end)

RegisterNUICallback("wardrobeVariant", function(data, cb)
    cb("ok")
    local handler = wardrobeHandler("onVariant")
    if handler then handler(data.category, tonumber(data.value) or 1) end
end)

RegisterNUICallback("wardrobeTint", function(data, cb)
    cb("ok")
    local handler = wardrobeHandler("onTint")
    if handler then handler(data.category, data) end
end)

RegisterNUICallback("wardrobeAction", function(data, cb)
    cb("ok")
    local handler = wardrobeHandler("onAction")
    if handler then handler(data.id) end
end)

RegisterNUICallback("wardrobeClose", function(data, cb)
    cb("ok")
    local handler = wardrobeHandler("onClose")
    if handler then handler() end
end)
