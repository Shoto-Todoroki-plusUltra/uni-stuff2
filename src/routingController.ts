import { Network } from './network.js';
import { P2PNode, NodeId, NodePosition } from './node.js';
import { Visualizer, DataPacket } from './visualizer.js';

export class RoutingController {
    private network: Network;
    private visualizer: Visualizer;
    private startNodeId: NodeId | null = null;
    private endNodeId: NodeId | null = null;
    public currentNodeId: NodeId | null = null;
    public pathTaken: NodeId[] = [];
    public isPaused: boolean = true;
    private _isPlaying: boolean = false;

    private activeDataPacket: DataPacket | null = null;
    private animationFrameId: number | null = null;

    private updateStatusCallback: (status: string) => void;
    private updatePathTakenCallback: (path: string) => void;
    private updateTryingNeighborCallback: (neighbor: string, tier: string) => void;


    constructor(
        network: Network,
        visualizer: Visualizer,
        statusCb: (s: string) => void,
        pathCb: (p: string) => void,
        tryingCb: (n: string, t: string) => void
    ) {
        this.network = network;
        this.visualizer = visualizer;
        this.updateStatusCallback = statusCb;
        this.updatePathTakenCallback = pathCb;
        this.updateTryingNeighborCallback = tryingCb;
    }

    initializeRoute(startId: NodeId, endId: NodeId): boolean {
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
        this.visualizer.render(
          this.pathTaken,
          this.currentNodeId ?? undefined, 
          this.endNodeId ?? undefined, 
          this.activeDataPacket
        );
        return true;
    }

    playPause(): void {
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
        } else {
            this.updateStatusCallback("Paused.");
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            if (this.activeDataPacket) this.activeDataPacket.isMoving = false;
            this.visualizer.render(
              this.pathTaken,
              this.currentNodeId ?? undefined,
              this.endNodeId ?? undefined,
              this.activeDataPacket
            );
        }
    }


    private async performStep(): Promise<void> {
        if (!this.currentNodeId || !this.endNodeId || !this.startNodeId ) {
            this.isPaused = true; this._isPlaying = false; return;
        }
        if (this.currentNodeId === this.endNodeId) {
            this.updateStatusCallback(`Destination ${this.endNodeId} reached!`);
            this.updatePathTakenCallback(this.pathTaken.join(' -> '));
            this.isPaused = true; this._isPlaying = false;
            if (this.activeDataPacket) this.activeDataPacket.isMoving = false;
            this.visualizer.render(
              this.pathTaken,
              this.currentNodeId ?? undefined,
              this.endNodeId ?? undefined,
              this.activeDataPacket
            );
            return;
        }

        const currentNode = this.network.getNode(this.currentNodeId);
        if (!currentNode) {
            this.updateStatusCallback("Error: Current node vanished!");
            this.isPaused = true; this._isPlaying = false; return;
        }

        let nextHop: NodeId | null = null;
        let chosenTier = -1;

        if (currentNode.neighbors.has(this.endNodeId)) {
            nextHop = this.endNodeId;
            chosenTier = 0;
            this.updateTryingNeighborCallback(this.endNodeId, "Direct (H0)");
        } else {
            let bestK = Infinity;
            const sortedNeighbors = Array.from(currentNode.neighbors).sort();

            for (const neighborId of sortedNeighbors) {
                const neighborCachedFilters = currentNode.neighborBloomFiltersCache.get(neighborId);
                if (!neighborCachedFilters) continue;

                for (let k_tier = 1; k_tier <= this.network.maxHopsForBF; k_tier++) {
                    if (k_tier < bestK) {
                        const neighborsBfForTierK = neighborCachedFilters[k_tier];
                        if (neighborsBfForTierK && neighborsBfForTierK.has(this.endNodeId)) {
                            bestK = k_tier;
                            nextHop = neighborId;
                            chosenTier = k_tier;
                            this.updateTryingNeighborCallback(neighborId, `H${k_tier}`);
                        }
                    } else
                        break;
                }
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
                this.updateStatusCallback(`Moving data from ${this.currentNodeId} to ${nextHop}...`);

                const previousNodeId = this.currentNodeId;
                this.currentNodeId = nextHop;


                this.animatePacketMovement(() => {
                    if (this.activeDataPacket) this.activeDataPacket.isMoving = false;

                    if (this.currentNodeId === this.endNodeId) {
                        this.updateStatusCallback(`Destination ${this.endNodeId} reached!`);
                        this.isPaused = true;
                        this._isPlaying = false;
                        this.visualizer.render(
                          this.pathTaken,
                          this.currentNodeId ?? undefined,
                          this.endNodeId ?? undefined,
                          this.activeDataPacket
                        );
                    } else if (this._isPlaying)
                        this.performStep();
                    else {
                        this.isPaused = true;
                        this.updateStatusCallback(`Paused at ${this.currentNodeId}. Press Play to continue.`);
                        this.visualizer.render(
                          this.pathTaken,
                          this.currentNodeId ?? undefined,
                          this.endNodeId ?? undefined,
                          this.activeDataPacket
                        );
                    }
                });
            }
        } else {
            this.updateStatusCallback(`No route found from ${this.currentNodeId} via Bloom Filters. Stuck.`);
            this.isPaused = true; this._isPlaying = false;
            this.visualizer.render(
              this.pathTaken,
              this.currentNodeId ?? undefined,
              this.endNodeId ?? undefined,
              this.activeDataPacket
            );
        }
    }

    private animatePacketMovement(onArrival: () => void): void {
        if (!this.activeDataPacket || !this.activeDataPacket.isMoving) {
            onArrival();
            return;
        }

        const animationSpeed = 0.05;
        this.activeDataPacket.progress += animationSpeed;

        this.visualizer.render(
          this.pathTaken,
          this.currentNodeId ?? undefined,
          this.endNodeId ?? undefined,
          this.activeDataPacket
        );

        if (this.activeDataPacket.progress < 1) {
            if (this._isPlaying || this.activeDataPacket.isMoving )
                 this.animationFrameId = requestAnimationFrame(() => this.animatePacketMovement(onArrival));
        } else {
            this.activeDataPacket.progress = 1;
            this.activeDataPacket.isMoving = false;
            this.activeDataPacket.currentPosition = { ...this.activeDataPacket.targetPosition };
            this.visualizer.render(
              this.pathTaken,
              this.currentNodeId ?? undefined,
              this.endNodeId ?? undefined,
              this.activeDataPacket
            );

            onArrival();
        }
    }

    reset(): void {
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
        this.visualizer.render();
    }
}
