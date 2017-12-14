let connectionSignalingBridgeMap = new Map();

function addConnectionSignalingBridgePair(connectionId, signalingBridge) {
    connectionSignalingBridgeMap.set(connectionId, signalingBridge);
}

function getSignalingBridge(connectionId) {
    return connectionSignalingBridgeMap.get(Number(connectionId));
}

module.exports = {
    addConnectionSignalingBridgePair,
    getSignalingBridge
};
