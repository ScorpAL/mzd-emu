// Dialog state now lives in the application that owns the dialog (see server/mmui/commonApp.js).
const owners = [
    require('../../server/mmui/uia/systemApp'),
    require('../../server/mmui/uia/sysupdateApp'),
    require('../../server/mmui/uia/syssettingsApp'),
    require('../../server/mmui/uia/vehsettingsApp'),
    require('../../server/mmui/uia/schedmaintApp')
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
