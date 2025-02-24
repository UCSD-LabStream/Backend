const ws = new WebSocket('ws://localhost:8555');

var peer = new Peer();
let viewerId;

peer.on('open', function(id) {
	viewerId = id;
});

peer.on('call', function(call) {
	call.answer();
	call.on('stream', (stream) => {
		let hostVideo = document.getElementById('video');
    	hostVideo.srcObject = stream;
	})
  });

ws.addEventListener('open', async (event) => {
    await new Promise(resolve => {
        const checkViewerId = setInterval(() => {
            if (typeof viewerId !== 'undefined') {
                clearInterval(checkViewerId);
                resolve();
            }
        }, 100);
    });

    ws.send(JSON.stringify({
        'client': '8555',
        'operation': 'connecting',
        'viewerId': viewerId
    }));
});