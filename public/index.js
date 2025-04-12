const socket = io.connect('https://labstream.ucsd.edu/api/', {
	path: '/api/camera',
});

console.log('is socket connected? ', socket.connected);

var peer = new Peer();
let viewerIds = [];
let call;
let hostId;
let streams;

async function init() {
	// need to first getUserMedia in order to use enumerateDevices
	const testing = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
	const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
	streams = [];
	for (let i = 0; i < videoDevices.length; i++) {
		// stream = await navigator.mediaDevices.getUserMedia({video: {deviceId: videoDevices[i].deviceId}, audio: false});
		streams.push(await navigator.mediaDevices.getUserMedia({video: {deviceId: videoDevices[i].deviceId}, audio: false}));
		document.getElementById('main-page').innerHTML += `<video autoplay playsinline id='video${i}'></video>`;
		document.getElementById(`video${i}`).srcObject = streams[i];

		if (i != 0) {
			streams[0].addTrack(streams[i].getVideoTracks()[0]);
		}
	}
	if (streams.length > 0) {
		document.getElementById('video0').srcObject = streams[0];
	}
}

peer.on('open', function(id) {
    hostId = id;
});

socket.on('connect', async (event) => {
	console.log('Connected to server!');
    await new Promise(resolve => {
        const checkHostId = setInterval(() => {
            if (typeof hostId !== 'undefined') {
                clearInterval(checkHostId);
                resolve();
            }
        }, 100);
    });

    socket.emit('stream_start',  JSON.stringify({
        'client': '8555',
        'operation': 'connecting',
        'hostId': hostId
    }));
});

socket.on('viewer_join', (event) => {
    call = peer.call(event, streams[0])
    let exampleText = document.getElementById('example-text')
    exampleText.innerHTML = event;
})

init();

