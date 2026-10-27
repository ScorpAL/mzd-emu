// Dialog state now lives in the application that owns the dialog (see server/mmui/commonApp.js).
const owners = [
    require('../mmui/uia/systemApp'),
    require('../mmui/uia/sysupdateApp'),
    require('../mmui/uia/syssettingsApp'),
    require('../mmui/uia/vehsettingsApp'),
    require('../mmui/uia/schedmaintApp')
];

// Puts every dialog flag back to closed so tests do not leak into each other.
function resetDialogs() {
    owners.forEach((app) => {
        Object.keys(app.dialogs).forEach((key) => {
            app.dialogs[key] = typeof app.dialogs[key] === 'boolean' ? false : null;
        });
    });
}

module.exports = { resetDialogs: resetDialogs };
