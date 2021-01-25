var serviceuuid = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
var uuids = {
    "rxCharacteristic":"6e400002-b5a3-f393-e0a9-e50e24dcca9e",
    "txCharacteristic":"6e400003-b5a3-f393-e0a9-e50e24dcca9e"
}
var foundDevices = [];
var startTime, endTime;

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
    bluetoothle.startScan(startScanSuccess, handleError, { services: [serviceuuid] });
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
    $("<pre id='wrapperDevice'></pre>")
    .append("<button id="+ address +" class='buttonConnect connect'>Connect</button>")
    .append("<button id="+ address +" class='buttonConnect disconnect nodisplay'>Disconnect</button>")
    .append("<span class='devicename'>" + name+ "<br/></span>")
    .append("<span class='address'>" + address+ "<br/></span>")
    .appendTo($("#devices"));
    $(".connect"+jq(address)).click(function(){
        connect(address);
    });
    $(".disconnect"+jq(address)).click(function(){ disconnect(address); });
}

function changeTextContent(address){
    $(".connect"+jq(address)).text("Connecting");
}
function rechangeTextContent(address){
    $(".connect"+jq(address)).text("Connect");
}

function connect(address) {
    log('Connecting to device: ' + address + "...", "status");
    var wasConnected;
    var readSequence = Promise.resolve();

    readSequence = readSequence.then(function(){
        new Promise(function(resolve, reject){
            bluetoothle.wasConnected(wasConnectedSuccess, handleError, { address: address });
            function wasConnectedSuccess(result){
                wasConnected = result.wasConnected;
            }
            return resolve();
        });
    });
    readSequence.then(function(){
        new Promise(function (resolve, reject) {
            if(wasConnected==false){
                bluetoothle.connect(resolve, reject, { address: address });
            }else{
                console.log("reconecting...");
                bluetoothle.reconnect(resolve, reject, { address: address});
            }
        }).then(connectSuccess, handleError);
    });
}

function connectSuccess(result) {
    log("- " + result.status);
    if (result.status === "connected") {
        var readSequence = Promise.resolve();
        readSequence = readSequence.then(function(){
            new Promise(function(resolve, reject){
                changeTextContent(result.address);
                return resolve();
            });
        });

        readSequence.then(function(){
            new Promise(function (resolve, reject) {
                getDeviceServices(result.address);
            });
        });
    }
    else if (result.status === "disconnected") {
        log("Disconnected from device: " + result.address, "status");
        bluetoothle.close(result=>{console.log("closed successfully.");}, handleError, {address:result.address})
        $(".connect"+jq(result.address)).show();
        $(".disconnect"+jq(result.address)).hide();
        $("option"+jq(result.address)).remove();
        rechangeTextContent(result.address);
    }
}

function getDeviceServices(address) {
    log("Getting device services...", "status");
    new Promise(function (resolve, reject) {
        bluetoothle.discover(resolve, reject,
            { address: address });
    }).then(discoverSuccess, handleError);
}

function discoverSuccess(result) {
    log("Discover returned with status: " + result.status);
    if (result.status === "discovered") {
        var readSequence = result.services.reduce(function (sequence, service) {
            return sequence.then(function () {
                return addService(result.address, service.uuid, service.characteristics);
            });
        }, Promise.resolve());
    }
}

function disconnect(address){
    console.log("disconnecting...");
    new Promise(function (resolve, reject) {
        bluetoothle.disconnect(resolve, reject,
            { address: address });
    }).then(connectSuccess, handleError);
}

function addService(address, serviceUuid, characteristics){
    log('Adding service ' + serviceUuid + '; characteristics:');
    log(characteristics);
    var writeval = "hello\n";
//    var writeval = generateStrings(100000);

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
                    startTime = new Date();
                    bluetoothle.writeQ(resolve, reject, {address:address, service:serviceuuid, characteristic:uuids["rxCharacteristic"], value:encodedString, chunkSize:244});
                }).then(writeSuccess, handleError);
            }
            else if(characteristic.uuid==uuids["txCharacteristic"].toUpperCase()){
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
    document.getElementById("services").appendChild(wrapperDiv);
    return readSequence;
}

function subscribeSuccess(result){
    if(result.status === "subscribed"){
        log(result);
        connecting = 0;
        $(".connect"+jq(result.address)).hide();
        $(".disconnect"+jq(result.address)).show();
            $("#select_box").append("<option id="+result.address+">"+result.address+"</option>");
    }
    else if(result.status === "subscribedResult"){
        var address = $("#select_box option:selected").text();
        if(address == result.address){
            $("#rcv_content").text(window.atob(result.value));
        }
    }
}

function writeSuccess(result){
    endTime = new Date();
    var timeDiff = endTime - startTime;
    timeDiff /= 1000;
    var min = Math.floor(timeDiff / 60);
    var sec = timeDiff % 60;
    log("transmitted in " + min + " min " + sec + " seconds");
    log("writeSuccess():");
    log(result);
    if(result.status === "written"){
        reportValue(result.address, result.service, result.characteristic, "write success.");
    }
}

$("#start-scan").click(function(){
    $(this).hide();
    $("#stop-scan").show();
    startScan();
});

$("#stop-scan").click(function(){
    $(this).hide();
    $("#start-scan").show();
    stopScan();
});


function reportValue(address, serviceUuid, characteristicUuid, value) {
    document.getElementById(address + "." + serviceUuid + "." + characteristicUuid).textContent = value;
}

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

function generateStrings(length) {
    const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'START';
    const charactersLength = characters.length;
    for ( let i = 0; i < length-8; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    result += 'END';
    return result;
}

$("#btn_snd").click(function(){
    var address = $("#select_box option:selected").text();

//    var writeval = document.getElementById("snd_content").value;
    var writeval = generateStrings(1000);
    var bytes = bluetoothle.stringToBytes(writeval);
    var encodedString = bluetoothle.bytesToEncodedString(bytes);

    new Promise(function(resolve, reject){
        bluetoothle.write(resolve, reject, {address:address, service:serviceuuid, characteristic:uuids["rxCharacteristic"], value:encodedString});
    }).then((result=>{
        document.getElementById("status_write").innerHTML = new Blob([writeval]).size + "bytes sent."
    }), (error)=>{
        document.getElementById("status_write").innerHTML = error.message;
    });
});

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

function jq( myid ) {
    return "#" + myid.replace( /(:|\.|\[|\]|,|=|@)/g, "\\$1" );
}