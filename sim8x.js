let SerialPort = require('serialport');
let pdu = require('pdu');
let EventEmitter = require('events').EventEmitter;
//init
const Modem = function() {
  let modem = new EventEmitter();
  let data = '';
  let resultData = {};
  let timeouts = {};
  let returnResult = false;
  modem.queue = [];
  modem.jobID = 1;
  modem.isLocked = false;
  modem.isOpened = false;
  //next
  modem.close = function(callback) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.close((error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });
    }
    modem.port.close(error => {
      if (error) {
        callback(error);
      } else {
        callback(null, {
          status: 'success',
          request: 'diconnectModem',
          data: {
            comName: modem.port.path,
            status: 'Offline'
          }
        });
      }
    });
  }
  modem.open = function(device, options, callback) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.open((error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });
    }
    if (options) options['parser'] = SerialPort.parsers.raw;
    modem.port = SerialPort(device, options, (error) => {
      let result = { status: 'success', request: 'connectModem', data: {modem: modem.port.path,status: 'Online' }};
      if (error) {
        callback(error);
      } else {
        modem.emit('open', result);
        callback(null, result);
      }
    });
    modem.port.on('open', function() {
      modem.isOpened = true;
      modem.port.on('data', modem.dataReceived.bind(this));
    });
    modem.port.on('close', function() {
      modem.emit('close', {
        modem: modem.port.path
      });
      modem.isOpened = false;
    });
    modem.port.on('error', function() {
      modem.emit('error', {
        modem: modem.port.path
      });
      modem.isOpened = false;
    });
  }
  modem.dataReceived = function(buffer) {
    data += buffer.toString();
    let parts = data.split('\r\n');
    data = parts.pop();
    //start;
    parts.forEach(function(part) {
      let newparts = [];
      newparts = part.split('\r');
      newparts = part.split('\n');
      newparts.forEach(function(newpart) {
        let pduTest = /[0-9A-Fa-f]{6}/g;
        if (newpart.substr(0, 6) == '+CMTI:') { // New Message Indicatpr with SIM Card ID, After Recieving Read The DMessage From the SIM Card
          newpart = newpart.split(',');
          modem.ReadSMSByID(newpart[1], function(res){});
        }
        //if someone calls
        if (newpart == 'RING') {
          modem.executeCommand(`AT+CLIP=1`, function(data){}, true);
        }
        //if calls someone
        if (newpart.startsWith("ATD")) {
          if (newpart.trim().substr(0,4) === 'ATD+') {
            var calledTo = newpart.split('+');
            var calledNumber = calledTo[1].replace(/\;/g,"");
            console.log("Calling to: "+calledNumber);
            const cancelCall = setTimeout(() => {
              modem.port.write('ATH'+'\r');
              console.log("End of call to: "+calledNumber);
            },8000);
          }
        }
        /*
        if (newpart.startsWith("AT+CMGL")) {
          console.log('AT+CMGL="ALL"');
        }
        */
        if (modem.queue.length) {
          if (modem.queue[0] && (modem.queue[0]['status'] == 'sendSMS')) { // If SMS is currently Sending Emit currently sending SMS
            modem.emit('onSendingMessage', {
              time: getTimeDate(),
              status: 'Sending SMS',
              request: 'sendingSMS',
              data: {
                messageId: modem.queue[0]['messageID'],
                message: modem.queue[0]['message'],
                recipient: modem.queue[0]['recipient'],
                response: 'Message Currently Sending'
              }
            });
            modem.queue[0]['status'] = 'Sending SMS';
          }
          if (modem.queue[0] && (modem.queue[0]['command'] == `AT+CPMS='SM'`)) { // Query SIM Card Space Available
            if (newpart.trim().substr(0, 6) === '+CPMS:') {
              modem.parseSIMCardResponse(newpart, function(result) {
                resultData = result;
              });
            }
            if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true;
            }
          } else if (modem.queue[0] && (modem.queue[0]['command'] == 'AT+CMGD=1,4')) { // Delete All Data from SIM Card
            if (newpart == 'OK') {
              resultData = {
                time: getTimeDate(),
                status: 'success',
                request: 'deleteAllSimMessages',
                data: 'success'
              }
              returnResult = true;
            }
          } else if (modem.queue[0] && (modem.queue[0]['command'] == 'ATZ')) { // Query Modem AT to initialize
            resultData = {
              time: getTimeDate(),
              status: 'success',
              request: 'modemInitialized',
              data: 'Modem Successfully Initialized'
            }
            if ((newpart == ">" || newpart =="> " || newpart == 'OK') && resultData) {
              returnResult = true;
            }
          } else if (modem.queue[0] && (modem.queue[0]['command'] == 'AT+CSQ')) { // Query Modem AT to initialize
            if(newpart.substr(0, 5)=='+CSQ:'){
              var signal = newpart.split(' ');
              signal = signal[1].split(',')
              resultData = {
                time: getTimeDate(),
                status: 'success',
                request: 'getNetworkSignal',
                data: {'signalQuality':signal[0]}
              }
            }
            if ((newpart == ">" || newpart =="> " || newpart == 'OK') && resultData) {
              returnResult = true;
            }else if(newpart == "ERROR"){
              resultData = {
                time: getTimeDate(),
                status: 'ERROR',
                request: 'getNetworkSignal',
                data: 'Cant Get Signal'
              }
            }
          } else if (modem.queue[0] && (modem.queue[0]['command'] == 'AT+CLIP=1')) { // Query caller id on new call received
            if(newpart.substr(0,6)=='+CLIP:'){
              //+CLIP: "+359886595907",145,"",0,"",0
              var clip = newpart.split(',');
              var rework = clip[0].replace(/\"/g,"");
              var number = rework.split(' ');
              //console.log(number[1]);
              //send hangup call
              modem.port.write('ATH'+'\r');
              var caller = {
                time: getTimeDate(),
                request: 'gotCall',
                data: number[1]
              }
              modem.emit('gotCall', caller);
            }
            if ((newpart == ">" || newpart =="> " || newpart == 'OK') && resultData) {
              returnResult = true;
            }else if(newpart == "ERROR"){
              resultData = {
                time: getTimeDate(),
                status: 'ERROR',
                request: 'getCallerId',
                data: 'Cant Get Caller ID'
              }
            }
          } else if (modem.queue[0] && (modem.queue[0]['command'] == 'AT+CPIN?')) { // Query SIm CArd State
            if(newpart.substr(0,6)=='+CPIN:'){
              var simState = newpart.split(' ');
              resultData = {
                time: getTimeDate(),
                status: 'success',
                request: 'getSimState',
                data: {'getSimState': simState[1]}
              }
            }
            if ((newpart == ">" || newpart =="> " || newpart == 'OK') && resultData) {
              returnResult = true;
            }else if(newpart == "ERROR"){
              resultData = {
                time: getTimeDate(),
                status: 'ERROR',
                request: 'getSimState',
                data: 'Cant Get Sim Card State'
              }
            }
          //test  
          } else if (modem.queue[0] && (modem.queue[0]['command'] == 'AT+CMGL="ALL"')) {
            //if(newpart.substr(0,6)=='+CMGL:'){
              console.log(newpart);


            var messages = [];
            var lines = newpart.split("\n");
            var i = 0;

            lines.forEach(function(line) {
                if(line.trim().length === 0)
                    return;

                if(line.slice(0,1) === '+') {
                    i = modem.parseResponse(line)[0];
                    return;
                }

                var message = modem.processReceivedPdu(line, i);
                if(message)
                    messages.push(message);
            }.bind(this));

            if(messages) {
              //console.log(messages);
            }

            //}
          //+COPS: 0,0,"M-TEL GSM" 
          } else if (modem.queue[0] && (modem.queue[0]['command'] == 'AT+COPS?')) { // Query Modem AT to initialize
            if(newpart.substr(0,6)=='+COPS:'){
              var name = newpart.split(',');
              //var networkName = newpart;
              var networkName = name[2].split(' ');//error in split from time to time
              resultData = {
                time: getTimeDate(),
                status: 'success',
                request: 'getNetworkName',
                data: {'NetworkName': networkName[0].substr(1)}
              }
            }
            if ((newpart == ">" || newpart =="> " || newpart == 'OK') && resultData) {
              returnResult = true;
            }else if(newpart == "ERROR"){
              resultData = {
                time: getTimeDate(),
                status: 'ERROR',
                request: 'getNetworkName',
                data: 'Cant Get Network name'
              }
            }
          //+CSCA: "+35988000301",145
          } else if (modem.queue[0] && (modem.queue[0]['command'] == 'AT+CSCA?')) { // Query sms center number
            if(newpart.substr(0,6)=='+CSCA:'){
              var center = newpart.split('"');
              //var networkName = newpart;
              var centerNumber = center[1];
              resultData = {
                time: getTimeDate(),
                status: 'success',
                request: 'getSMScenter',
                data: {'SMScenter': centerNumber}
              }
            }
            if ((newpart == ">" || newpart =="> " || newpart == 'OK') && resultData) {
              returnResult = true;
            }else if(newpart == "ERROR"){
              resultData = {
                time: getTimeDate(),
                status: 'ERROR',
                request: 'getSMScenter',
                data: 'Cant Get SMS center number'
              }
            }
          } else if (modem.queue[0] && (modem.queue[0]['command'] == 'AT+CGSN')) { // Query Modem AT to initialize
            var isSerial = /^\d+$/.test(newpart);
            if(isSerial){
              resultData = {
                time: getTimeDate(),
                status: 'success',
                request: 'getModemSerial',
                data: {'modemSerial':newpart}
              }
            }
            if ((newpart == ">" || newpart =="> " || newpart == 'OK') && resultData) {
              returnResult = true;
            }else if(newpart == 'ERROR'){
              resultData = {
                time: getTimeDate(),
                status: 'ERROR',
                request: 'getModemSerial',
                data: 'Cant Get Modem Seial Number'
              }
              returnResult = true;
            }
          } else if (modem.queue[0] && (modem.queue[0]['command'] == 'AT+CMGF=0') || (modem.queue[0]['command'] == 'AT+CMGF=1')) { // PDU Mode for Modem .. Default PDU Mode to accomodate Long SMS
            if (modem.queue[0]['command'].substr(8, 8) == '0') {
              resultData = {
                time: getTimeDate(),
                status: 'success',
                request: 'modemMode',
                data: 'PDU_Mode'
              }
            } else if (modem.queue[0]['command'].substr(8, 8) == '1') {
              resultData = {
                time: getTimeDate(),
                status: 'success',
                request: 'modemMode',
                data: 'SMS_Mode'
              }
            }
            if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true;
            }
          } else if (modem.queue[0] && (modem.queue[0]['command'].substr(0, 7) == 'AT+CMGS=' || pduTest.test(modem.queue[0]['command']))) { // Sending of Message if with response ok.. Then Message was sent successfully.. If Error then Message Sending Failed
            resultData = {
              time: getTimeDate(),
              status: 'success',
              request: 'SendSMS',
              data: {
                messageId: modem.queue[0]['messageID'],
                message: modem.queue[0]['message'],
                recipient: modem.queue[0]['recipient'],
                response: 'Message Successfully Sent'
              }
            }
            if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true;
            }else if(newpart=='ERROR'){
              resultData = {
                time: getTimeDate(),
                status: 'Fail',
                request: 'SendSMS',
                data: {
                  messageId: modem.queue[0]['messageID'],
                  message: modem.queue[0]['message'],
                  recipient: modem.queue[0]['recipient'],
                  response: 'Message Failed'
                }
              }
              returnResult = true;
            }
          } else if (modem.queue[0] && (modem.queue[0]['command'].substr(0, 7) == 'AT+CMGR')) { // Get New Message From SIM Card
            let re = /[0-9A-Fa-f]{6}/g;
            if (re.test(newpart)) {
              let newMessage = pdu.parse(newpart);
              resultData = {
                sender: newMessage.sender,
                timeSent: newMessage.time
              }
              var message = {
                'seneder': newMessage.sender || null,
                'message': newMessage.text || null,
                'dateTimeSent': newMessage.time || null,
                'dateTimeReceived': new Date(),
                'header': {
                  'encoding': newMessage.encodinh || null,
                  'smsc': newMessage.smsc || null,
                  'smscType': newMessage.smsc_type || null,
                  'senderType':newMessage.sender_type || null,
                  'length': (newMessage.udh && newMessage.udh.length) || null,
                  'iei': (newMessage.udh && newMessage.udh.iei) || null,
                  'reference_number': (newMessage.udh && newMessage.udh.reference_number) || null,
                  'parts': (newMessage.udh && newMessage.udh.parts) || null,
                  'current_part': (newMessage.udh && newMessage.udh.current_part) || null,

                }
              }
              modem.emit('onNewMessageIndicator', resultData);
              modem.emit('onNewMessage', message);
            }
            re.lastIndex = 0 // be sure to reset the index after using .text()
            if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true;
            }
          }
          let callback;
          if (returnResult) { // Expected Result was ok or with error call back function that asked for the data or emit to listener, Execute next Command if any or Execute Next Command if TIME Out and modem did not respond
            returnResult = false;
            if (modem.queue[0] && modem.queue[0]['callback']) {
              callback = modem.queue[0]['callback'];
            } else {
              callback = null;
            }
            modem.queue[0]['end_time'] = new Date();
            clearTimeout(timeouts[modem.queue[0].id]);
            modem.release();
            if (callback) {
              callback(resultData);
            }
            resultData = null;
            modem.executeNext();
          }
        }
      });
    });
  }
  function getTimeDate() {
    //timestamp
    const dateTime = new Date().getTime();
    const timestamp = Math.floor(dateTime/1000);
    //datetime
    var date = new Date();
    var Y = date.getFullYear();
    var M = date.getMonth()+1;
    if (M < 10) {
      M = "0"+M;
    }
    var D = date.getDate();
    if (D < 10) {
      D = "0"+D;
    }
    var h = date.getHours();
    if (h < 10) {
      h = "0"+h;
    }
    var m = date.getMinutes();
    if (m < 10) {
      m = "0"+m;
    }
    var s = date.getSeconds();
    if (s < 10) {
      s = "0"+s;
    }
    var datetime = Y+"-"+M+"-"+D+" "+h+":"+m+":"+s;
    return datetime;
  }
  modem.ReadSMSByID = function(id, callback) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.ReadSMSByID((error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });
    }
    modem.executeCommand(`AT+CMGR=${id}`, function(data) {}, true);
  }
  modem.checkSIMMemory = function(callback, priority) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.checkSIMMemory((error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });
    }
    if (priority == null) priority = false;
    modem.executeCommand(`AT+CPMS='` + `SM'`, function(data) {
      callback(data);
    }, priority);
  }
  modem.initializeModem = function(callback, priority) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.initializeModem((error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });
    }
    if (priority == null) priority = false;
    modem.executeCommand('ATZ', function(data) {
      callback(data);
    }, false, 30000);
  }
  modem.modemMode = function(callback, priority, timeout, mode) {
    modemMode = '0';
    if (priority == null) priority = true;
    if (timeout == 'PDU' || timeout == 'SMS') {
      mode == timeout;
    }
    if (priority == 'PDU' || priority == 'SMS') {
      mode = priority;
    }
    if (mode == 'PDU' || mode == 'SMS') {
      if (mode == 'PDU') {
        modemMode = '0';
      } else if (mode = 'SMS') {
        modemMode = '1';
      }
      modem.executeCommand(`AT+CMGF=${modemMode}`, function(data) {
        callback(data);
      }, false, 30000);
    } else {
      callback({
        time: getTimeDate(),
        status: 'Fail',
        request: 'modemMode',
        data: 'Modem Failed to Changed Mode'
      });
    }
  }
  modem.makeid = function(numOfCharacters) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < numOfCharacters; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    return text;
  }
  modem.sendSMS = function(number, message, callback, priority) {
    try {
      if (number && message) {
        let messageID = modem.makeid(25);
        let pduMessage = pdu.generate({
          text: message,
          receiver: number,
          encoding: '16bit'
        })
        modem.executeCommand(`AT+CMGS=${(pduMessage.toString().length/2)-1}`, function(data) {}, false, 100);
        modem.executeCommand(`${pduMessage.toString()}`+'\x1a', function(data) {
          var channel = ''
          if(data.status == "Fail"){
            channel = 'onMessageSendingFailed';
          }else{
            channel = 'onMessageSent';
          }
          var result = {
            status: data.status,
            request: data.request,
            Data: {
              messageId: data.data.messageId,
              message: data.data.message,
              recipient: data.data.recipient,
              response: data.data.response
            }
          }
          modem.emit(channel, result);
          callback(result);
        }, false, 30000,messageID, message, number);
        callback({
          time: getTimeDate(),
          status: 'Success',
          request: 'sendSMS',
          Data: {
            messageId: messageID,
            response: 'Successfully Sent to Message Queue'
          }
        });
      } else {
        callback({
          time: getTimeDate(),
          status: 'Error',
          request: 'sendSMS',
          error: 'Missing Arguments'
        });
      }
    } catch (error) {
      callback({
        time: getTimeDate(),
        status: 'Error',
        request: 'sendSMS',
        error: error
      });
    }
  }
  modem.getSimState = function(callback, priority, timeout) {
    if (priority == null) priority = false;
    modem.executeCommand('AT+CPIN?', function(data) {
      callback(data);
    }, priority, timeout);
  }
  modem.deleteAllSimMessages = function(callback, priority, timeout) {
    if (priority == null) priority = false;
    modem.executeCommand('AT+CMGD=1,4', function(data) {
      callback(data);
    }, priority, timeout);
  }
  modem.saveOwnNumber = function(number, callback, priority, timeout) {
    if (priority == null) priority = false;
    // modem.executeCommand(`AT+CPBS="ON"`, function(data) {
    //   callback(data)
    // }, priority, timeout)
    // modem.executeCommand(`AT+CPBW=?`, function(data) {
    //   callback(data)
    // }, priority, timeout)
    // modem.executeCommand(`AT+CPBR=1`, function(data) {
    //   callback(data)
    // }, priority, timeout)
    //
    // modem.executeCommand(`+CPBW=1,"18589898844",129,"Jane Smith"`, function(data) {
    //   callback(data)
    // }, priority, timeout)
  }
  //test +359886595907
  modem.callNumber = function(number,callback,priority,timeout) {
    if (priority == null) priority = false;
    modem.executeCommand(`ATD`+number+`;`, function(data) {
      callback(data);
    }, priority, timeout);
  }
  //new
  modem.getMessages = function(callback) {
    this.executeCommand('AT+CMGL="ALL"', function(data) {
      if(callback)
        callback(messages);
    }.bind(this));
  }
    modem.processReceivedPdu = function(pduString, index) {
        try {
            var message = pdu.parse(pduString);
            message.text = message.text.replace(/^\0+/, '').replace(/\0+$/, '');
        } catch(error) {
            return;
        }
        message['indexes'] = [index];

        if(typeof(message['udh']) === 'undefined') //Messages has no data-header and therefore, is not contatenated.
            return message;

        if(message['udh']['iei'] !== '00' && message['udh']['iei'] !== '08') //Message has some data-header, but its not a contatenated message;
            return message;

        var messagesId = message.sender+'_'+message.udh.reference_number;
        if(typeof(this.partials[messagesId]) === 'undefined')
            this.partials[messagesId] = [];

        this.partials[messagesId].push(message);
        if(this.partials[messagesId].length < message.udh.parts)
            return ;

        var text = '';
        var indexes = [];

        for(var i = 0; i<message.udh.parts;i++)
            for(var j = 0; j<message.udh.parts;j++)
                if(this.partials[messagesId][j].udh.current_part === i+1) {
                    text += this.partials[messagesId][j].text;
                    indexes.push(this.partials[messagesId][j].indexes[0]);
                    continue ;
                }
        message['text'] = text; //Update text.
        message['indexes'] = indexes; //Update idex list.

        delete this.partials[messagesId]; //Remove from partials list.

        return message;
}
  //endnew
  modem.getSMSCenter = function(callback, priority, timeout) {
    if (priority == null) priority = false;
    modem.executeCommand('AT+CSCA?', function(data) {
      callback(data);
    }, priority, timeout);
  }
  modem.getModemSerial = function(callback, priority, timeout) {
    if (priority == null) priority = false;
    modem.executeCommand('AT+CGSN', function(data) {
      callback(data);
    }, priority, timeout);
  }
  modem.getNetworkSignal = function(callback, priority, timeout) {
    if (priority == null) priority = false;
    modem.executeCommand('AT+CSQ', function(data) {
      callback(data);
    }, priority, timeout);
  }
  modem.getNetworkName = function(callback, priority, timeout) {
    if (priority == null) priority = false;
    modem.executeCommand('AT+COPS?', function(data) {
      callback(data);
    }, priority, timeout);
  }
  modem.listOpenPorts = function(callback) {
    if (callback === undefined) {
      return new Promise((resolve, reject) => {
        modem.listOpenPorts((error, results) => {
          if (error) {
            resolve(error);
          } else {
            reject(results);
          }
        });
      });
    }
    SerialPort.list((error, results) => {
      if (error) {
        callback(error);
      } else {
        callback(null, results);
      }
    });
  }
  modem.release = function() {
    this.data = ''; //Empty the result buffer.
    this.isLocked = false; //release the modem for next command.
    this.queue.shift(); //Remove current item from queue.
  }
  modem.executeCommand = function(command, c, priority, timeout, messageID, message, recipient) {
    if (!this.isOpened) {
      this.emit('close');
      return;
    }
    let item = new EventEmitter();
    if (messageID) {
      item.messageID = messageID;
      item.message = message;
      item.recipient = recipient;
      item.status = 'sendSMS';
    }
    item.command = command;
    item.callback = c;
    item.add_time = new Date();
    item.id = ++this.jobID;
    item.timeout = timeout;
    if (item.timeout == undefined){ //Default timeout it 60 seconds. Send false to disable timeouts.
      item.timeout = 60000;
    }
    if (priority) {
      // this.queue.unshift(item)
      if (this.queue.length > 1) {
        this.queue.splice(2, 0, item);
      } else {
        this.queue.push(item);
      }
    } else {
      this.queue.push(item);
    }
    this.emit('job', item);
    process.nextTick(this.executeNext.bind(this));
    return item;
  }
  modem.executeNext = function() {
    if (!this.isOpened) {
      this.emit('close');
      return;
    }
    //Wait Modem is in use...
    if (this.isLocked) {
      return;
    }
    let item = this.queue[0];
    if (!item) {
      this.emit('idle');
      return; //Queue is empty.
    }
    this.data = '';
    this.isLocked = true;
    item.execute_time = new Date();
    item.emit('start');
    if (item.timeout)
      timeouts[item.id] = setTimeout(function() {
        item.emit('timeout');
        this.release();
        this.executeNext();
      }.bind(this), item.timeout)
    modem.port.write(item['command'] + '\r');
  }
  /////////// Functions ////////////////////////////////
  modem.parseSIMCardResponse = function(newpart, callback) {
    let simCardCheck = {
      used: '',
      totalSpace: ''
    }
    newpart = (newpart.split(' '));
    newpart = (newpart[1].split(','));
    simCardCheck.used = newpart[0];
    simCardCheck.totalSpace = newpart[1];
    callback({
      time: getTimeDate(),
      status: 'success',
      request: 'checkSIMMemory',
      data: simCardCheck
    })
  }
  modem.parseResponse = function(response) {
    var plain = response.slice(response.indexOf(':')+1).trim();
    var parts = plain.split(/,(?=(?:[^"]|"[^"]*")*$)/);
    for(i in parts)
      parts[i] = parts[i].replace(/\"/g, '');
    return parts;
  }
  //end of functions and return
  return modem;
}
module.exports = {
  Modem
}
//eof
