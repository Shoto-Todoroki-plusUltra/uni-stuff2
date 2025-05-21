export class RoutingController {
    constructor(network, visualizer, statusCb, pathCb, tryingCb) {
        this.startNodeId = null;
        this.endNodeId = null;
        this.currentNodeId = null;
        this.pathTaken = [];
        this.isPaused = true;
        this._isPlaying = false; // To control continuous play vs single step
        this.activeDataPacket = null;
        this.animationFrameId = null;
        this.network = network;
        this.visualizer = visualizer;
        this.updateStatusCallback = statusCb;
        this.updatePathTakenCallback = pathCb;
        this.updateTryingNeighborCallback = tryingCb;
    }
    initializeRoute(startId, endId) {
        const startNode = this.network.getNode(startId);
        const endNode = this.network.getNode(endId);
        if (!startNode || !endNode) {
            this.updateStatusCallback("Error: Start or End node ID is invalid.");
            return false;
        }
        if (startId === endId) {
            this.updateStatusCallback("Error: Start and End node cannot be the same.");
            return false;
        }
        this.reset();
        this.startNodeId = startId;
        this.endNodeId = endId;
        this.currentNodeId = startId;
        this.pathTaken = [startId];
        this.isPaused = true; // Start paused
        this._isPlaying = false;
        this.activeDataPacket = {
            currentPosition: { ...startNode.position },
            targetPosition: { ...startNode.position },
            isMoving: false,
            progress: 0,
            color: 'red'
        };
        this.updateStatusCallback(`Route initialized: ${startId} to ${endId}. Press Play.`);
        this.updatePathTakenCallback(this.pathTaken.join(' -> '));
        this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, this.endNodeId ?? undefined, this.activeDataPacket);
        return true;
    }
    playPause() {
        if (!this.startNodeId || !this.endNodeId) {
            this.updateStatusCallback("Initialize route first.");
            return;
        }
        if (this.currentNodeId === this.endNodeId) {
            this.updateStatusCallback(`Destination ${this.endNodeId} already reached. Reset to start a new route.`);
            this._isPlaying = false;
            this.isPaused = true;
            return;
        }
        this.isPaused = !this.isPaused;
        this._isPlaying = !this.isPaused;
        if (this._isPlaying) {
            this.updateStatusCallback("Routing...");
            this.performStep();
        }
        else {
            this.updateStatusCallback("Paused.");
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            // Ensure packet stops moving visually if paused mid-transit
            if (this.activeDataPacket)
                this.activeDataPacket.isMoving = false;
            this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, // Convert null to undefined
            this.endNodeId ?? undefined, // Convert null to undefined
            this.activeDataPacket);
        }
    }
    async performStep() {
        if (!this.currentNodeId || !this.endNodeId || !this.startNodeId) {
            this.isPaused = true;
            this._isPlaying = false;
            return;
        }
        if (this.currentNodeId === this.endNodeId) {
            this.updateStatusCallback(`Destination ${this.endNodeId} reached!`);
            this.updatePathTakenCallback(this.pathTaken.join(' -> '));
            this.isPaused = true;
            this._isPlaying = false;
            if (this.activeDataPacket)
                this.activeDataPacket.isMoving = false;
            this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, // Convert null to undefined
            this.endNodeId ?? undefined, // Convert null to undefined
            this.activeDataPacket);
            return;
        }
        const currentNode = this.network.getNode(this.currentNodeId);
        if (!currentNode) {
            this.updateStatusCallback("Error: Current node vanished!");
            this.isPaused = true;
            this._isPlaying = false;
            return;
        }
        let nextHop = null;
        let chosenTier = -1;
        // 1. Check direct connection to endNodeId (effectively H0 for routingController)
        if (currentNode.neighbors.has(this.endNodeId)) {
            nextHop = this.endNodeId;
            chosenTier = 0; // Signifies direct connection
            this.updateTryingNeighborCallback(this.endNodeId, "Direct (H0)");
        }
        else {
            // 2. Check neighbors' Bloom Filters (cached by current node)
            // We want the neighbor N such that D is in N's BF_Hk for the smallest k
            let bestK = Infinity;
            // Sort neighbors for deterministic behavior if multiple provide same best k
            const sortedNeighbors = Array.from(currentNode.neighbors).sort();
            for (const neighborId of sortedNeighbors) {
                const neighborCachedFilters = currentNode.neighborBloomFiltersCache.get(neighborId);
                if (!neighborCachedFilters)
                    continue;
                for (let k_tier = 1; k_tier <= this.network.maxHopsForBF; k_tier++) {
                    if (k_tier < bestK) { // Only proceed if this tier could be better
                        const neighborsBfForTierK = neighborCachedFilters[k_tier];
                        if (neighborsBfForTierK && neighborsBfForTierK.has(this.endNodeId)) {
                            bestK = k_tier;
                            nextHop = neighborId; // Tentatively choose this neighbor
                            chosenTier = k_tier;
                            this.updateTryingNeighborCallback(neighborId, `H${k_tier}`);
                            // No break here, another neighbor might offer same bestK, sorted order handles tie.
                            // Or, if we want first found for a given K: break;
                        }
                    }
                    else {
                        // If current k_tier is not better than bestK found so far for *any* neighbor,
                        // no need to check higher tiers for *this* neighbor.
                        break;
                    }
                }
            }
        }
        if (nextHop) {
            const nextNodeObj = this.network.getNode(nextHop);
            if (nextNodeObj && this.activeDataPacket) {
                this.activeDataPacket.targetPosition = { ...nextNodeObj.position };
                this.activeDataPacket.currentPosition = { ...currentNode.position }; // Reset start for animation
                this.activeDataPacket.progress = 0;
                this.activeDataPacket.isMoving = true;
                this.pathTaken.push(nextHop);
                this.updatePathTakenCallback(this.pathTaken.join(' -> '));
                this.updateStatusCallback(`Moving data from ${this.currentNodeId} to ${nextHop}...`);
                // Store next logical hop, animation will handle visual
                const previousNodeId = this.currentNodeId;
                this.currentNodeId = nextHop;
                this.animatePacketMovement(() => {
                    // This callback is executed when packet visually arrives
                    if (this.activeDataPacket)
                        this.activeDataPacket.isMoving = false;
                    if (this.currentNodeId === this.endNodeId) {
                        this.updateStatusCallback(`Destination ${this.endNodeId} reached!`);
                        this.isPaused = true;
                        this._isPlaying = false;
                        this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, // Convert null to undefined
                        this.endNodeId ?? undefined, // Convert null to undefined
                        this.activeDataPacket);
                    }
                    else if (this._isPlaying) { // If still in "play" mode, continue to next step
                        this.performStep();
                    }
                    else { // Paused after step
                        this.isPaused = true;
                        this.updateStatusCallback(`Paused at ${this.currentNodeId}. Press Play to continue.`);
                        this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, // Convert null to undefined
                        this.endNodeId ?? undefined, // Convert null to undefined
                        this.activeDataPacket);
                    }
                });
            }
        }
        else {
            this.updateStatusCallback(`No route found from ${this.currentNodeId} via Bloom Filters. Stuck.`);
            this.isPaused = true;
            this._isPlaying = false;
            this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, // Convert null to undefined
            this.endNodeId ?? undefined, // Convert null to undefined
            this.activeDataPacket);
        }
    }
    animatePacketMovement(onArrival) {
        if (!this.activeDataPacket || !this.activeDataPacket.isMoving) {
            onArrival(); // Should not happen if logic is correct
            return;
        }
        const animationSpeed = 0.05; // Adjust for speed
        this.activeDataPacket.progress += animationSpeed;
        this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, // Convert null to undefined
        this.endNodeId ?? undefined, // Convert null to undefined
        this.activeDataPacket);
        if (this.activeDataPacket.progress < 1) {
            if (this._isPlaying || this.activeDataPacket.isMoving) { // continue if playing or if just finishing current move while pausing
                this.animationFrameId = requestAnimationFrame(() => this.animatePacketMovement(onArrival));
            }
        }
        else {
            this.activeDataPacket.progress = 1; // Snap to end
            this.activeDataPacket.isMoving = false; // Stop logical movement marker
            // Update current position to be the target for next step
            this.activeDataPacket.currentPosition = { ...this.activeDataPacket.targetPosition };
            this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, // Convert null to undefined
            this.endNodeId ?? undefined, // Convert null to undefined
            this.activeDataPacket);
            onArrival();
        }
    }
    reset() {
        this.startNodeId = null;
        this.endNodeId = null;
        this.currentNodeId = null;
        this.pathTaken = [];
        this.isPaused = true;
        this._isPlaying = false;
        this.activeDataPacket = null;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.updateStatusCallback("Idle. Initialize a new route.");
        this.updatePathTakenCallback("");
        this.updateTryingNeighborCallback("N/A", "N/A");
        this.visualizer.render(); // Clear canvas
    }
}
