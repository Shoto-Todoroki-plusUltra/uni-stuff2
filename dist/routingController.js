export class RoutingController {
    constructor(network, visualizer, statusCb, pathCb, tryingCb) {
        this.startNodeId = null;
        this.endNodeId = null;
        this.currentNodeId = null;
        this.pathTaken = [];
        this.isPaused = true;
        this._isPlaying = false;
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
        this.reset(); // Full reset before new route
        this.startNodeId = startId;
        this.endNodeId = endId;
        this.currentNodeId = startId;
        this.pathTaken = [startId];
        this.isPaused = true;
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
        if (this.currentNodeId === this.endNodeId && this.activeDataPacket && !this.activeDataPacket.isMoving) {
            this.updateStatusCallback(`Destination ${this.endNodeId} already reached. Reset to start a new route.`);
            this._isPlaying = false;
            this.isPaused = true;
            return;
        }
        this.isPaused = !this.isPaused;
        this._isPlaying = !this.isPaused;
        if (this._isPlaying) {
            this.updateStatusCallback("Routing...");
            if (this.activeDataPacket && !this.activeDataPacket.isMoving) {
                // If we were paused and the packet was not moving, start a new step
                this.performStep();
            }
            else if (this.activeDataPacket && this.activeDataPacket.isMoving) {
                // If paused mid-animation, just resume animation
                this.animatePacketMovement(() => this.stepPostAnimation());
            }
        }
        else { // Pausing
            this.updateStatusCallback("Paused.");
            // Animation will naturally stop if _isPlaying is false in its loop condition
            // Or if we want immediate stop:
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            // Visual update to show paused state even if mid-transit (packet might appear static)
            this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, this.endNodeId ?? undefined, this.activeDataPacket);
        }
    }
    stepPostAnimation() {
        // This function is called after a packet visually arrives at an intermediate node
        if (this.activeDataPacket)
            this.activeDataPacket.isMoving = false;
        if (this.currentNodeId === this.endNodeId) {
            this.updateStatusCallback(`Destination ${this.endNodeId} reached!`);
            this.isPaused = true;
            this._isPlaying = false;
        }
        else if (this._isPlaying) {
            this.performStep(); // If still in "play" mode, continue to next logical step
        }
        else { // Paused after step
            this.isPaused = true;
            this.updateStatusCallback(`Paused at ${this.currentNodeId}. Press Play to continue.`);
        }
        this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, this.endNodeId ?? undefined, this.activeDataPacket);
    }
    async performStep() {
        if (!this.currentNodeId || !this.endNodeId || !this.startNodeId || !this._isPlaying) {
            if (!this._isPlaying && this.currentNodeId !== this.endNodeId) {
                // Do nothing if paused and not at destination
            }
            else if (!this.currentNodeId || !this.endNodeId || !this.startNodeId) {
                this.isPaused = true;
                this._isPlaying = false;
                return;
            }
        }
        if (!this.currentNodeId) { // Add this check
            this.updateStatusCallback("Error: Current node ID is null, cannot proceed.");
            this.isPaused = true;
            this._isPlaying = false;
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
        let chosenHopTier = -1; // k-hop distance from current node
        // New routing logic using ownHopLimitedInfo with path hints
        for (let k = 1; k <= this.network.maxHopsForBF; k++) {
            const tierInfo = currentNode.ownHopLimitedInfo[k];
            if (tierInfo) {
                if (!this.endNodeId) { // Add this check
                    // Should not happen if route is initialized, but good for type safety
                    this.updateStatusCallback("Error: End node ID is null.");
                    this.isPaused = true;
                    this._isPlaying = false;
                    return;
                }
                // Check the Bloom filter first for probabilistic presence (optional optimization)
                // if (tierInfo.filter.has(this.endNodeId)) {
                const hintEntry = tierInfo.pathHints.get(this.endNodeId);
                if (hintEntry) {
                    // Check for time decay
                    if ((Date.now() - hintEntry.lastUpdated) > this.network.STALE_THRESHOLD_MS) {
                        this.updateStatusCallback(`Hint for ${this.endNodeId} via ${hintEntry.nextHop} from tier H${k} is stale. Ignoring.`);
                        // Optionally, trigger pruning for this specific hint here or mark for later pruning
                        // For now, we just ignore it for this step.
                        continue; // Check next tier or rely on global pruning.
                    }
                    nextHop = hintEntry.nextHop;
                    chosenHopTier = k;
                    this.updateTryingNeighborCallback(nextHop, `H${k} (Path Hint)`);
                    break; // Found a path hint in the lowest possible k-tier
                }
                // }
            }
        }
        if (nextHop) {
            const nextNodeObj = this.network.getNode(nextHop);
            if (nextNodeObj && this.activeDataPacket) {
                this.activeDataPacket.targetPosition = { ...nextNodeObj.position };
                this.activeDataPacket.currentPosition = { ...currentNode.position };
                this.activeDataPacket.progress = 0;
                this.activeDataPacket.isMoving = true;
                this.pathTaken.push(nextHop);
                this.updatePathTakenCallback(this.pathTaken.join(' -> '));
                this.updateStatusCallback(`Routing to ${nextHop} (destination is ${chosenHopTier} hops away)...`);
                const previousNodeId = this.currentNodeId; // for rendering path highlight during animation
                this.currentNodeId = nextHop; // Logically move to next hop
                this.animatePacketMovement(() => this.stepPostAnimation());
            }
            else {
                this.updateStatusCallback(`Error: Next hop node ${nextHop} not found!`);
                this.isPaused = true;
                this._isPlaying = false;
            }
        }
        else {
            this.updateStatusCallback(`No fresh path hint found from ${this.currentNodeId} to ${this.endNodeId}. Routing stuck.`);
            this.isPaused = true;
            this._isPlaying = false;
            this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, this.endNodeId ?? undefined, this.activeDataPacket);
        }
    }
    animatePacketMovement(onArrival) {
        if (!this.activeDataPacket || !this.activeDataPacket.isMoving) {
            // if somehow called when not supposed to be moving, or if paused externally
            if (this.activeDataPacket && this.activeDataPacket.progress >= 1) { // Already arrived
                onArrival();
            }
            return;
        }
        const animationSpeed = 0.05;
        this.activeDataPacket.progress += animationSpeed;
        // Determine node to highlight as "current" during animation (the one packet is leaving)
        const RENDER_PREVIOUS_NODE_AS_CURRENT = this.pathTaken[this.pathTaken.length - 2] || this.startNodeId;
        this.visualizer.render(this.pathTaken, (this.activeDataPacket.progress < 1 ? RENDER_PREVIOUS_NODE_AS_CURRENT : this.currentNodeId) ?? undefined, this.endNodeId ?? undefined, this.activeDataPacket);
        if (this.activeDataPacket.progress < 1) {
            if (this._isPlaying || this.isPaused && this.activeDataPacket.isMoving) { // Continue animation if playing, or if paused but mid-transit
                this.animationFrameId = requestAnimationFrame(() => this.animatePacketMovement(onArrival));
            }
        }
        else {
            this.activeDataPacket.progress = 1;
            // this.activeDataPacket.isMoving = false; // This will be set in stepPostAnimation
            this.activeDataPacket.currentPosition = { ...this.activeDataPacket.targetPosition };
            // Final render at exact arrival spot, current node is now the actual current node
            this.visualizer.render(this.pathTaken, this.currentNodeId ?? undefined, this.endNodeId ?? undefined, this.activeDataPacket);
            onArrival();
        }
    }
    reset() {
        // Stop any ongoing animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.startNodeId = null;
        this.endNodeId = null;
        this.currentNodeId = null;
        this.pathTaken = [];
        this.isPaused = true;
        this._isPlaying = false;
        this.activeDataPacket = null;
        this.updateStatusCallback("Idle. Initialize a new route.");
        this.updatePathTakenCallback("");
        this.updateTryingNeighborCallback("N/A", "N/A");
        this.visualizer.render(); // Clear canvas
    }
}
