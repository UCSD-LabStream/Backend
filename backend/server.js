const path = require('path');
const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const WebSocket = require('ws');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const webrtc = require("wrtc");

const app = express();

app.use(cors());
app.use('/static', express.static(path.join(__dirname, 'public')));

let senderStream;
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let clients = [];

const HTTP_PORT = 8080;
let devices = {
	relay_module1: { port: 8888 },
};

const httpServer = createServer(app);
const io = new Server(httpServer, {
    path: '/labstream/socket.io',
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// State management
let state = {
    gear1: 0,
    gear2: 0,
    gear3: 0,
    gear4: 0,
    lastAdjusted: null
};

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Front-end connected');

    socket.on('adjust', (data) => {
        const { gear, value } = data;

        switch(gear) {
            case 1:
                state.gear1 = value;
                break;
            case 2:
                state.gear2 = value;
                break;
            case 3:
                state.gear3 = value;
                break;
            case 4:
                state.gear4 = value;
                break;
        }

        state.lastAdjusted = new Date().toISOString().replace('T', ' ').substring(0, 19);

        io.emit('gear', {
            gear1: state.gear1,
            gear2: state.gear2,
            gear3: state.gear3,
            gear4: state.gear4,
            last_adjusted: state.lastAdjusted
        });
    });

    socket.on('gear_state', () => {
        socket.emit('gear', {
            gear1: state.gear1,
            gear2: state.gear2,
            gear3: state.gear3,
            gear4: state.gear4,
            last_adjusted: state.lastAdjusted
        });
    });
});

app.get('/labstream', (req, res) => {
    res.send(`
        <html>
        <head>
        <title>LabStream</title>
        </head>
        <body>
        <h1>LabStream</h1>
        <p>You have reached the LabStream server. You can see the gear values.</p>
        <p>Last adjusted: ${state.lastAdjusted || 'Have not been adjusted'}</p>
        <p>Gear 1: ${state.gear1} degrees</p>
        <p>Gear 2: ${state.gear2} degrees</p>
        <p>Gear 3: ${state.gear3} degrees</p>
        <p>Gear 4: ${state.gear4} degrees</p>
        <p>To change the gear value, please visit our front end.</p>
        </body>
        </html>
    `);
});

app.get('/get_gears/:gear', (req, res) => {
    var value;
    if (req.params.gear === "1") {
      value = state.gear1;
    } else if (req.params.gear === "2") {
      value = state.gear2;
    } else if (req.params.gear === "3") {
      value = state.gear3;
    } else if (req.params.gear === "4") {
      value = state.gear4;
    }
    res.json(value);
});

app.post("/consumer", async ({ body }, res) => {
    const peer = new webrtc.RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.stunprotocol.org"
            }
        ]
    });
    const desc = new webrtc.RTCSessionDescription(body.sdp);
    await peer.setRemoteDescription(desc);
    senderStream.getTracks().forEach(track => peer.addTrack(track, senderStream));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    const payload = {
        sdp: peer.localDescription
    }

    res.json(payload);
});

app.post('/broadcast', async ({ body }, res) => {
    const peer = new webrtc.RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.stunprotocol.org"
            }
        ]
    });
    peer.ontrack = (e) => handleTrackEvent(e, peer);
    const desc = new webrtc.RTCSessionDescription(body.sdp);
    await peer.setRemoteDescription(desc);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    const payload = {
        sdp: peer.localDescription
    }

    res.json(payload);
});

function handleTrackEvent(e, peer) {
    senderStream = e.streams[0];
};
  
app.post('/motor_state/:gear/in_progress', (req, res) => {
    var value;
    if (req.params.gear === "1") {
        value = "angle1"
    } else if (req.params.gear === "2") {
        value = "angle2"
    } else if (req.params.gear === "3") {
        value = "angle3"
    } else if (req.params.gear === "4") {
        value = "angle4"
    }
    io.emit('disableSlider', { slider: value });
    res.status(200).json({ message: 'Slider disabled on client.' });
});

app.post('/motor_state/:gear/done', (req, res) => {
    var value;
    if (req.params.gear === "1") {
        value = "angle1"
    } else if (req.params.gear === "2") {
        value = "angle2"
    } else if (req.params.gear === "3") {
        value = "angle3"
    } else if (req.params.gear === "4") {
        value = "angle4"
    }
    io.emit('enableSlider', { slider: value });
    res.status(200).json({ message: 'Slider enabled on client.' });
});

process.on('uncaughtException', (error, origin) => {
	console.log('----- Uncaught exception -----');
	console.log(error);
	console.log('----- Exception origin -----');
	console.log(origin);
	console.log('----- Status -----');
});

// Clients
const wss = new WebSocket.Server({port: '8555'}, () => console.log(`WS Client Server is listening on 8555`));

wss.on('connection', ws => {
	ws.on('message', data => {
		console.log("Someone's connecting!")
		if (ws.readyState !== ws.OPEN) return;
		clients.push(ws);

		try {
			data = JSON.parse(data);
		
			if(data.operation === 'command') {
				if(devices[data.command.recipient]) {
					devices[data.command.recipient].command = data.command.message.key + '=' + data.command.message.value;
				}
			}
		} catch (error) {}
	});
});

// Devices
Object.entries(devices).forEach(([key]) => {
	const device = devices[key];
	
	new WebSocket.Server({port: device.port}, () => console.log(`WS Device Server is listening on ${device.port}`)).on('connection',(ws) => {
		ws.on('message', data => {
			if (ws.readyState !== ws.OPEN) return;

			if (device.command) {
				ws.send(device.command);
				device.command = null; // Consume
			}

			if (typeof data === 'object') {
				device.image = Buffer.from(Uint8Array.from(data)).toString('base64');
			} else {
				device.peripherals = data.split(",").reduce((acc, item) => {
					const key = item.split("=")[0];
					const value = item.split("=")[1];
					acc[key] = value;
					return acc;
				}, {});
			}

			clients.forEach(client => {
				client.send(JSON.stringify({ devices: devices }));
			});
		});
	});
});

app.get('/client',(_req,res)=>{ res.sendFile(path.resolve(__dirname,'./public/client.html')); });

httpServer.listen(HTTP_PORT,()=>{ console.log(`HTTP server starting on ${HTTP_PORT}`); });