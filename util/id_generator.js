let id = 1;
let streamId = 1;
let peerConnectionId = 1;

function getId() {
    if(!Number.isFinite(id)) {
        id = 1;
    }
    return id++;
}

function getStreamId() {
    if(!Number.isFinite(streamId)) {
        streamId = 1;
    }
    return streamId++;
}

function getPeerConnectionId() {
    if(!Number.isFinite(peerConnectionId)) {
        peerConnectionId = 1;
    }
    return peerConnectionId++;
}

module.exports = {
    getId,
    getStreamId,
    getPeerConnectionId
};
