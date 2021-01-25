let serviceuuid = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
var uuids = {
"rxCharacteristic":"6e400002-b5a3-f393-e0a9-e50e24dcca9e",
"txCharacteristic":"6e400003-b5a3-f393-e0a9-e50e24dcca9e"
}
var addresses = [];
var foundDevices = [];

document.addEventListener('deviceready', function () {

    new Promise(function (resolve, reject) {

        bluetoothle.initialize(resolve, reject,
            { request: true, statusReceiver: false, restoreKey: "bluetoothleplugin"});

    }).then(initializeSuccess, handleError);

});

function initializeSuccess(result) {

    if (result.status === "enabled") {

        log("Bluetooth is enabled.");
        log(result);
    }

    else {

        document.getElementById("start-scan").disabled = true;

        log("Bluetooth is not enabled:", "status");
        log(result, "status");
    }
}

function startScan() {

    log("Starting scan for devices...", "status");

    foundDevices = [];

    document.getElementById("devices").innerHTML = "";
    document.getElementById("services").innerHTML = "";
    document.getElementById("output").innerHTML = "";

    if (window.cordova.platformId === "windows") {

        bluetoothle.retrieveConnected(retrieveConnectedSuccess, handleError, {});
    }
    else {
        bluetoothle.startScan(startScanSuccess, handleError, { services: [serviceuuid] });
    }
}

function retrieveConnectedSuccess(result) {

    log("retrieveConnectedSuccess()");
    log(result);

    result.forEach(function (device) {

        addDevice(device.name, device.address);

    });
}

function startScanSuccess(result) {

    log("startScanSuccess(" + result.status + ")");

    if (result.status === "scanStarted") {

        log("Scanning for devices (will continue to scan until you select a device)...", "status");
    }
    else if (result.status === "scanResult") {

        if (!foundDevices.some(function (device) {

            return device.address === result.address;

        })) {

            log('FOUND DEVICE:');
            log(result);
            foundDevices.push(result);
            addDevice(result.name, result.address);
        }
    }
}

function addDevice(name, address) {

    addresses.push(address);
    var button = document.createElement("button");
    button.style.width = "100%";
    button.style.fontSize = "16px";
    button.style.height = "30px";
    button.textContent = name + ": " + address;
    var test = document.createElement("div");
    test.setAttribute("id", "id:"+address);

    button.addEventListener("click", function () {

        document.getElemedentById("services").innerHTML = "";
        connect(address);
    });

    document.getElementById("devices").appendChild(button);
    document.getElementById("devices").appendChild(test);

}

function connect(address) {

    log('Connecting to device: ' + address + "...", "status");

    if (cordova.platformId === "windows") {

        getDeviceServices(address);

    }
    else {

        new Promise(function (resolve, reject) {

            bluetoothle.connect(resolve, reject, { address: address });

        }).then(connectSuccess, handleError);

    }
}

function connectSuccess(result) {

    log("- " + result.status);

    if (result.status === "connected") {

        getDeviceServices(result.address);
    }
    else if (result.status === "disconnected") {

        log("Disconnected from device: " + result.address, "status");
        bluetoothle.close(result=>{console.log("closed successfully.");}, handleError, {address:result.address})
    }
}

function getDeviceServices(address) {

    log("Getting device services...", "status");

    var platform = window.cordova.platformId;

    if (platform === "android" || platform === "ios") {

        new Promise(function (resolve, reject) {

            bluetoothle.discover(resolve, reject,
                { address: address });

        }).then(discoverSuccess, handleError);

    }
    else if (platform === "windows") {

        new Promise(function (resolve, reject) {

            bluetoothle.services(resolve, reject,
                { address: address });

        }).then(servicesSuccess, handleError);

    }
    else {

        log("Unsupported platform: '" + window.cordova.platformId + "'", "error");
    }
}

function servicesSuccess(result) {

    log("servicesSuccess()");
    log(result);

    if (result.status === "services") {

        var readSequence = result.services.reduce(function (sequence, service) {

            return sequence.then(function () {

                console.log('Executing promise for service: ' + service);

                new Promise(function (resolve, reject) {

                    bluetoothle.characteristics(resolve, reject,
                        { address: result.address, service: service });

                }).then(characteristicsSuccess, handleError);

            }, handleError);

        }, Promise.resolve());

        // Once we're done reading all the values, disconnect
        readSequence.then(function () {

            new Promise(function (resolve, reject) {

                bluetoothle.disconnect(resolve, reject,
                    { address: result.address });

            }).then(connectSuccess, handleError);

        });
    }


    if (result.status === "services") {

        result.services.forEach(function (service) {

            new Promise(function (resolve, reject) {

                bluetoothle.characteristics(resolve, reject,
                    { address: result.address, service: service });

            }).then(characteristicsSuccess, handleError);

        });

    }
}

function characteristicsSuccess(result) {

    log("characteristicsSuccess()");
    log(result);

    if (result.status === "characteristics") {

        return addService(result.address, result.service, result.characteristics);
    }
}

function addService(address, serviceUuid, characteristics){
    log('Adding service ' + serviceUuid + '; characteristics:');
    log(characteristics);
    var writeval = "hello\n";
    var bytes = bluetoothle.stringToBytes(writeval);
    var encodedString = bluetoothle.bytesToEncodedString(bytes);

    var readSequence = Promise.resolve();
    var wrapperDiv = document.createElement("div");
    wrapperDiv.className = "service-wrapper";
    var serviceDiv = document.createElement("div");
    serviceDiv.className = "service";
    serviceDiv.textContent = serviceuuid;
    wrapperDiv.appendChild(serviceDiv);

    characteristics.forEach(function(characteristic){
        var characteristicDiv = document.createElement("div");
        characteristicDiv.className = "characteristic";

        var characteristicNameSpan = document.createElement("span");
        characteristicNameSpan.textContent = characteristic.uuid + ":";
        characteristicDiv.appendChild(characteristicNameSpan);

        characteristicDiv.appendChild(document.createElement("br"));

        var characteristicValueSpan = document.createElement("span");
        characteristicValueSpan.id = address + "." + serviceuuid.toUpperCase() + "." + characteristic.uuid;
        characteristicValueSpan.style.color = "blue";
        characteristicDiv.appendChild(characteristicValueSpan);

        wrapperDiv.appendChild(characteristicDiv);

        readSequence = readSequence.then(function(){
            if(characteristic.uuid==uuids["rxCharacteristic"].toUpperCase()){
                return new Promise(function(resolve, reject){
                    bluetoothle.write(resolve, reject, {address:address, service:serviceuuid, characteristic:uuids["rxCharacteristic"], value:encodedString});
                }).then(writeSuccess, handleError);
            }
            else if(characteristic.uuid==uuids["txCharacteristic"].toUpperCase()){
                var div_rcv_content = document.createElement("div");
                div_rcv_content.setAttribute("id", "rcv:"+address);
                document.getElementById("rcv_content").appendChild(div_rcv_content);
                return new Promise(function(resolve, reject){
                    bluetoothle.subscribe(subscribeSuccess, handleError, {address:address, service:serviceuuid, characteristic:uuids["txCharacteristic"]});
                }).then(()=>{console.log("written.");}, handleError);
            }
            else{
                return new Promise(function(resolve, reject){
                    resolve();
                });
            }
        });
    });
    document.getElementById("id:"+address).appendChild(wrapperDiv);
    return readSequence;
}

function discoverSuccess(result) {

    log("Discover returned with status: " + result.status);

    if (result.status === "discovered") {

    var readSequence = result.services.reduce(function (sequence, service) {

        return sequence.then(function () {
            return addService(result.address, service.uuid, service.characteristics);
        });

    }, Promise.resolve());

    readSequence.then(function () {

        new Promise(function (resolve, reject) {

            bluetoothle.disconnect(resolve, reject,
                { address: result.address });

        }).then(connectSuccess, handleError);

    });

    }
}

function subscribeSuccess(result){
    if(result.status === "subscribed"){
        log(result);
    }
    else if(result.status === "subscribedResult"){
        document.getElementById("rcv:"+result.address).innerHTML = result.address + "<br />" + window.atob(result.value);
        reportValue(result.address, result.service, result.characteristic, window.atob(result.value));
    }
}

function writeSuccess(result){
    log("writeSuccess():");
    log(result);

    if(result.status === "written"){
        reportValue(result.address, result.service, result.characteristic, "write success.");
    }
}

function readSuccess(result) {

    log("readSuccess():");
    log(result);

    if (result.status === "read") {

        reportValue(result.address, result.service, result.characteristic, window.atob(result.value));
    }
}

function reportValue(address, serviceUuid, characteristicUuid, value) {

    document.getElementById(address + "." + serviceUuid + "." + characteristicUuid).textContent = value;
}

// Stop scanning for bluetoothle devices.
function stopScan() {
    new Promise(function (resolve, reject) {
        bluetoothle.stopScan(resolve, reject);

    }).then(stopScanSuccess, handleError);
}

function stopScanSuccess() {

    if (!foundDevices.length) {

        log("NO DEVICES FOUND");
    }
    else {

        log("Found " + foundDevices.length + " devices.", "status");
    }
}

function sndMsg(){
    var writeval = document.getElementById("snd_content").value;
    var bytes = bluetoothle.stringToBytes(writeval);
    var encodedString = bluetoothle.bytesToEncodedString(bytes);

    addresses.forEach(function(address){
        return new Promise(function(resolve, reject){
            bluetoothle.write(resolve, reject, {address:address, service:serviceuuid, characteristic:uuids["rxCharacteristic"], value:encodedString});
        }).then((result=>{
            document.getElementById("status_write").innerHTML = "write success."
        }), (error)=>{
            document.getElementById("status_write").innerHTML = error.message;
        });
    })
}

function log(msg, level) {

    level = level || "log";

    if (typeof msg === "object") {

        msg = JSON.stringify(msg, null, "  ");
    }

    console.log(msg);

    if (level === "status" || level === "error") {

        var msgDiv = document.createElement("div");
        msgDiv.textContent = msg;

        if (level === "error") {

            msgDiv.style.color = "red";
        }

        msgDiv.style.padding = "5px 0";
        msgDiv.style.borderBottom = "rgb(192,192,192) solid 1px";
        document.getElementById("output").appendChild(msgDiv);
    }
}

document.getElementById("start-scan").addEventListener("click", function () {
    x = document.getElementById("start-scan");
    if (x.style.display === "none") {
    x.style.display = "block";
    } else {
    x.style.display = "none";
    }
    x = document.getElementById("stop-scan");
    if (x.style.display === "none") {
    x.style.display = "block";
    } else {
    x.style.display = "none";
    }
    startScan();
});

document.getElementById("stop-scan").addEventListener("click", function () {
    x = document.getElementById("start-scan");
    if (x.style.display === "none") {
    x.style.display = "block";
    } else {
    x.style.display = "none";
    }
    x = document.getElementById("stop-scan");
    if (x.style.display === "none") {
    x.style.display = "block";
    } else {
    x.style.display = "none";
    }
    stopScan();
});

document.getElementById("btn_snd").addEventListener("click", function(){
    sndMsg();
});

function handleError(error) {

    var msg;

    if (error.error && error.message) {

        var errorItems = [];

        if (error.service) {

            errorItems.push("service: " + (uuids[error.service] || error.service));
        }

        if (error.characteristic) {

            errorItems.push("characteristic: " + (uuids[error.characteristic] || error.characteristic));
        }

        msg = "Error on " + error.error + ": " + error.message + (errorItems.length && (" (" + errorItems.join(", ") + ")"));
    }

    else {

        msg = error;
    }

    log(msg, "error");

    if (error.error === "read" && error.service && error.characteristic) {

        reportValue(error.service, error.characteristic, "Error: " + error.message);
    }
}
