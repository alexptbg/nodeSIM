var modem = require('sim8x').Modem();
var device = '/dev/ttyS0';

let modemOptions = {
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: false,
  xon: false,
  rtscts: false,
  xoff: false,
  xany: false,
  buffersize: 0,
  onNewMessage: true,
  onNewMessageIndicator: true
}
/*
modem.listOpenPorts((err,result)=>{
  console.log(result)
});
*/
setInterval(() => {
  if (!modem.isOpened) {
    modem.open(device,modemOptions, (err,result) => {
      if(err){
        console.log(err);
      }else{
        console.log(result);
      }
    })
  } else {
    //console.log(`Serial port ${modem.port.path} is open`);
  }
},6000);

modem.on('open', (data) => {
  modem.initializeModem((response) => {
    console.log('response:',response);
  });
  setTimeout(function(){
    modem.getSimState(function(response){
      console.log(response);
    });
  },1000);
  
  setInterval(function(){
    //modem.deleteAllSimMessages(function(response){
      //console.log(response);
    //});
    //myNumber "+359886595907"
    //pilev "+359885828289"
    //misho "+359889535478"
    /*
    modem.callNumber("+359885828289",false,100,function(response){
      console.log(response);
    });
    */
  },15000);
  
  
  setTimeout(function(){
    //setSMSmode();

  },4000);
  
  /*
  setTimeout(function(){
    var rand = Math.floor(Math.random()*100)+1;
    sendSMS("+359886595907","test msg "+rand);
  },10000);
  */

  modem.on('gotCall', (data) => {
    console.log('======================================');
    console.log(data);
    console.log('======================================');
  });
  
  var intervalObj = setInterval(() => { intervals(); },5000);
});

modem.on('onNewMessage', (data) => {
  console.log('======================================');
  console.log(`Parts: ${data.header&&data.header['current_part']} of ${data.header&&data.header['parts']}`);
  console.log('SMS Text: ',data.message);
  console.log('======================================');
});

modem.on('onMessageSent', (data) => {
  console.log('onMessageSent');
  console.log(data);
});

modem.on('getMessages', (data) => {
  console.log('getMessages');
  console.log(data);
});

modem.on('onSendingMessage', (data) => {
  console.log('onSendingMessage');
  console.log(data);
});

function intervals() {
  modem.getNetworkSignal((response) => {
    console.log(response);
    var signal = getSignal(response.data.signalQuality);
    console.log(signal);
  });
  modem.getNetworkName((response) => {
    console.log(response);
  });
  getSMScenter();
  setSMSmode();
  modem.getMessages((response) => {
    console.log(response);
  });
}

function setSMSmode() {
  modem.modemMode((response) => {
    console.log(response);
    console.log('SMS MODE');
  },"SMS");
}

function getSMScenter() {
  modem.getSMSCenter((response) => {
    console.log(response);
    console.log('SMS Center');
  });
}

function sendSMS(number,text) {
  //MESSAGE CENTER MTEL/A1 = +35988000301;
  //AT+CSCA="+35988000301";
  try {
    modem.sendSMS(number,text,function(response){
      console.log(response);
    });
  } catch(e){
    console.log(e);
  }
}
function getSignal(value) {
  var min = 0, 
  max = 32,
  current = value, 
  difference = max - min, 
  percent = ((current - min)/difference)*100;
  return percent.toFixed(2);
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

/// Change the Mode of the Modem to SMS or PDU (Callback, "SMS"|"PDU")
  // modem.modemMode((response) => {
  //   console.log(response)
  // }, "PDU")
  // modem.getModemSerial((response) => {
  //   console.log(response)
  // })
  // modem.getNetworkSignal((response) => {
  //   console.log(response)
  // })

  // modem.saveOwnNumber("09985950851", (response) => {
  //   console.log(reponse)
  // });



  // for(var i=1;i<=100;i++){
  //   modem.sendSMS("09498893309", `Happy Mothers Day.. Love you..  ${i}`, function(response){
  //     console.log('messgae status',response)
  //   })
  // }
//
//   modem.modemMode((response) => {
//     console.log(response)
//     console.log('SMS')
//
//
//   }, "PDU")
//
//   // modem.checkSIMMemory(function(response){
//   //   console.log(response)
//   // })
//   //
//   modem.deleteAllSimMessages(function(response){
//     console.log(response)
//   })
//
//   try{
//     modem.sendSMS("09498893309", "Zab", function(response){
//       console.log(response)
//     })
//   }catch(e){
//     console.log(e)
//   }
//
//

  // modem.sendSMS("09498893309", "Zab", function(response){
  //   console.log(response)
  // })
  // modem.checkSIMMemory(function(response){
  //   console.log(response)
  // })
  // //
  // modem.deleteAllSimMessages(function(response){
  //   console.log(response)
  // })

  // modem.checkSIMMemory(function(response){
  //   console.log(response)
  // })
  // //


  // try{
  //   modem.sendSMS("09498893309", "Zab", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }
  // try{
  //   modem.sendSMS("09498893308", "Zab", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }

  //
  // try{
  //   modem.sendSMS("09498893309", "Test Message Dimple", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }
  //
  // try{
  //   modem.sendSMS("09498893309", "Test Message Dimple", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }
  //
  // try{
  //   modem.sendSMS("09498893309", "Test Message Dimple", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }
  //
  // try{
  //   modem.sendSMS("09498893309", "Test Message Dimple", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }

  // try{
  //   modem.sendSMS("09498893309", "Test Message Dimple", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }
  //
  // try{
  //   modem.sendSMS("09498893309", "Test Message Dimple", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }
  //
  // try{
  //   modem.sendSMS("09498893309", "Test Message Dimple", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }
  //
  // try{
  //   modem.sendSMS("09498893309", "Test Message Dimple", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }
  //
  // try{
  //   modem.sendSMS("09498893309", "Test Message Dimple", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }
  //
  // try{
  //   modem.sendSMS("09498893309", "Test Message Dimple", function(response){
  //     console.log(response)
  //   })
  // }catch(e){
  //   console.log(e)
  // }

// })
//
// modem.on('onSendingMessage', (data) => {
//   console.log('onSendingMessage')
//   console.log(data)
// })
// //
// modem.on('onMessageSent', (data) => {
//   console.log('onMessageSent')
//   console.log(data)
// })
//
// modem.on('onMessageSendingFailed', (data) => {
//   console.log('Fail')
//   console.log(data)
// })
//
// //
// modem.on('onNewMessage', (data) => {
//   console.log(data)
// })
// //
// modem.on('onNewMessageIndicator', (data) => {
//   console.log('onNewMessageIndicator')
//   console.log(data)
// })
//
// modem.on('onModemActivityStream', (data) => {
//   console.log(data)
// })

//
//dev/tty.usbserial
// let open_port = setInterval(() => {
//       m1.open((status) => {
//           if (status == true) {
//               console.log("Port is open")
//               // clearInterval(open_port)
//           } else {
//
//           }
//       })
//
// }, 3000)
//
// m1.eventEmitter.on('new message', (num, text) => {
//
// })
//

// let m1 = new modem.Modem("/dev/tty.usbserial")

// let modem = require("./modem/modem2.js")
// let m1 = new modem.Modem_text("/dev/tty.usbserial")
//
// let open_port = setInterval(() => {
//     m1.open((status) => {
//         if (status == true) {
//             // console.log("Port is open")
//             clearInterval(open_port)
//         } else {
//             // console.log("in else")
//             // console.log(status)
//         }
//     })
// }, 3000)
//
// m1.eventEmitter.on('new message', (num, text) => {
//     console.log("New message:")
//     console.log(num)
//     console.log(text)
//
//     // let msg = text.trim().split(/\s+/)
// if (msg.toUpperCase() == "HELLO") {
//     let reply = "Hi"
//     m1.sendMessage(num, reply, (err, res) => {
//         if (err) {
//             console.log(err)
//         } else {
//
//         }
//     })
// }
// })


// let modem = require('./modem/index.js').Modem()

// modem.getModem((modem) => {
//   console.log(modem)
// })
// modem.getModem()
// modem.on('modem:get-modem', function(modem) {
//   console.log(modem)
// })

// modem.getPorts((ports) => {
//   console.log(ports)
// })
// let modemOptions = {autoOpen: false, baudRate: 115200,  dataBits: 8,  parity: 'none',  stopBits: 1, flowControl: false, xon : false, rtscts:false, xoff:false, xany:false, buffersize:0}
// //
// modem.connectModem('/dev/tty.usbserial', modemOptions, (err, response) => {
//   if(err){
//     console.log(err)
//   }else{
//     console.log(response)
//   }
// })

