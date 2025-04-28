const path = require('path');
const express = require('express');
const { createServer } = require('https');
const cors = require('cors');
const WebSocket = require('ws');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const fs = require("fs");
const mqtt = require('mqtt');

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
    imageMotorH: "stop",
    imageMotorV: "stop",
    filterMotorH: "stop",
    filterMotorV: "stop",
    lastAdjusted: null
};

const client = mqtt.connect('wss://labstream.ucsd.edu/mqtt');

client.on('connect', () => {
    console.log('Connected to MQTT broker!');
    client.subscribe('filter_motor_H');
    client.subscribe('filter_motor_V');
    client.subscribe('image_motor_H');
    client.subscribe('image_motor_V');
});

client.on('message', (topic, message) => {
    if (topic === 'filter_motor_H' && message.toString() === '3') {
        socket.emit('filter_motor_H_done');
    } else if (topic === 'filter_motor_V' && message.toString() === '3') {
        socket.emit('filter_motor_V_done');
    } else if (topic === 'image_motor_H' && message.toString() === '3') {
        socket.emit('image_motor_H_done');
    } else if (topic === 'image_motor_V' && message.toString() === '3') {
        socket.emit('image_motor_V_done');
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Front-end connected');

    socket.on('adjust', (data) => {
        const { gear, value } = data;

        switch(gear) {
            case 1:
                state.filterMotorH = value;
                client.publish("filter_motor_H", String(value));
                break;
	    case 2:
                state.filterMotorV = value;
                client.publish("filter_motor_V", String(value));
                break;
            case 3:
                state.imageMotorH = value;
                client.publish("image_motor_H", String(value));
                break;
	    case 4:
                state.imageMotorV = value;
                client.publish("image_motor_V", String(value));
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
        state.filterMotorH = "stop";
	state.filterMotorV = "stop";
        state.imageMotorH = "stop";
	state.imageMotorV = "stop";
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
        <p>Filter motor H state: ${state.filterMotorH}</p>
	<p>Filter motor V state: ${state.filterMotorV}</p>
        <p>Image motor H state: ${state.imageMotorH}</p>
	<p>Image motor V state: ${state.imageMotorV}</p>
        <p>To change the gear value, please visit our front end.</p>
        </body>
        </html>
    `);
});

app.get('/get_gears/:gear', (req, res) => {
    var value;
    if (req.params.gear === "1") {
      value = state.filterMotorH;
    } else if (req.params.gear === "2") {
      value = state.filterMotorV
    } else if (req.params.gear === "3") {
      value = state.imageMotorH
    } else if (req.params.gear === "4") {
      value = state.imageMotorV
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
	path: '/camera',
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

httpServer.listen(HTTP_PORT,()=>{ console.log(`HTTP server starting on ${HTTP_PORT}`); });
