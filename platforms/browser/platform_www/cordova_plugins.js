cordova.define('cordova/plugin_list', function(require, exports, module) {
module.exports = [
    {
        "file": "plugins/cordova-plugin-bluetoothle/www/bluetoothle.js",
        "id": "cordova-plugin-bluetoothle.BluetoothLe",
        "pluginId": "cordova-plugin-bluetoothle",
        "clobbers": [
            "window.bluetoothle"
        ]
    }
];
module.exports.metadata = 
// TOP OF METADATA
{
    "cordova-plugin-bluetoothle": "6.2.0",
    "cordova-plugin-whitelist": "1.3.4"
}
// BOTTOM OF METADATA
});