const socket = io("https://labstream.ucsd.edu/api/", {
	path: 'camera/socket.io',
});

var peer = new Peer();
let viewerId;

peer.on('open', function(id) {
	viewerId = id;
});

peer.on('call', function(call) {
	call.answer();
	call.on('stream', (stream) => {
		let videoTracks = stream.getVideoTracks();
		for (let i = 0; i < videoTracks.length; i++) {
			if (!document.getElementById(`video${i}`)) {
				document.getElementById('main-page').innerHTML += `<video playsinline autoplay id='video${i}'></video>`;
			}
			document.getElementById(`video${i}`).srcObject = new MediaStream([videoTracks[i]]);
		}
	})
  });

socket.on('connect', async (event) => {
    await new Promise(resolve => {
        const checkViewerId = setInterval(() => {
            if (typeof viewerId !== 'undefined') {
                clearInterval(checkViewerId);
                resolve();
            }
        }, 100);
    });

    socket.emit("stream_view", JSON.stringify({
        'client': '8555',
        'operation': 'connecting',
        'viewerId': viewerId
    }));
});
