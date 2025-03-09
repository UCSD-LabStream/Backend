const path = require('path');
const express = require('express');
const { createServer } = require('https');
const cors = require('cors');
const WebSocket = require('ws');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const fs = require("fs");

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

const options = {
    key: fs.readFileSync("/etc/ssl/private/privkey.pem"),
    cert: fs.readFileSync("/etc/ssl/certs/fullchain.pem"),
};

const httpServer = createServer(options, app);
const io = new Server(httpServer, {
    path: '/labstream/socket.io',
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// State management
let state = {
    imageMotor: 0,
    filterMotor: 0,
    lastAdjusted: null
};


// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Front-end connected');

    socket.on('adjust', (data) => {
        const { gear, value } = data;

        switch(gear) {
            case 1:
                state.filterMotor = value;
                break;
            case 2:
                state.imageMotor = value;
                break;
        }

        state.lastAdjusted = new Date().toISOString().replace('T', ' ').substring(0, 19);

        // io.emit('gear', {
        //     imageMotor: state.imageMotor,
        //     filterMotor: state.filterMotor,
        //     last_adjusted: state.lastAdjusted
        // });
    });

    socket.on('gear_state', () => {
        state.filterMotor = 0;
        state.imageMotor = 0;
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
        <p>Filter motor state: ${state.filterMotor}</p>
        <p>Image motor state: ${state.imageMotor}</p>
        <p>To change the gear value, please visit our front end.</p>
        </body>
        </html>
    `);
});

app.get('/get_gears/:gear', (req, res) => {
    var value;
    if (req.params.gear === "1") {
      value = state.filterMotor;
    } else if (req.params.gear === "2") {
      value = state.imageMotor
    }
    res.json(value);
});
  
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

const cameraServer = new Server(httpServer, {
	path: '/camera/socket.io',
	cors: {
		origin: '*',
		methods: ['GET', 'POST']
	}
});

let hostSocket;
let viewerPeerIds = [];
let hostPeerId;

cameraServer.on('connection', (socket) => {
	console.log("Viewer or streamer joined");
	clients.push(socket);
	socket.on('stream_start', (data) => {
		data = JSON.parse(data);
		console.log(data);
		hostPeerId = data.hostId;
		hostSocket = socket;
	});
	socket.on('stream_view', (data) => {
		data = JSON.parse(data);
		console.log(data);
		viewerPeerIds.push(data.viewerId);
		hostSocket.emit('viewer_join', data.viewerId);
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
