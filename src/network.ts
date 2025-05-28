import { P2PNode, NodeId, PathHintEntry } from './node.js'; // Updated import
import { CountingBloomFilter } from './bloomFilter.js';

export class Network {
    public nodes: Map<NodeId, P2PNode>;
    public maxHopsForBF: number;
    private bloomFilterSize: number;
    private bloomFilterNumHashes: number;
    public STALE_THRESHOLD_MS: number = 60000; // Example: 1 minute for a hint to be stale

    constructor(maxHopsForBF: number = 3, bfSize: number = 50, bfNumHashes: number = 2) {
        this.nodes = new Map();
        this.maxHopsForBF = maxHopsForBF;
        this.bloomFilterSize = bfSize;
        this.bloomFilterNumHashes = bfNumHashes;
    }

    addNode(node: P2PNode): void {
        this.nodes.set(node.id, node);
    }

    connectNodes(nodeId1: NodeId, nodeId2: NodeId): void {
        const node1 = this.nodes.get(nodeId1);
        const node2 = this.nodes.get(nodeId2);
        if (node1 && node2) {
            node1.addNeighbor(nodeId2);
            node2.addNeighbor(nodeId1);
        }
    }

    // This is the core logic for building the hop-limited info with path hints
    initializeNetworkInfo(): void {
        const now = Date.now();

        // Initialize all hop tiers for all nodes first
        this.nodes.forEach(node => {
            for (let k = 1; k <= this.maxHopsForBF; k++) {
                node.initializeHopTier(k, this.bloomFilterSize, this.bloomFilterNumHashes);
            }
        });

        // 1. Each node initializes its H=1 info (direct neighbors are 1 hop away)
        this.nodes.forEach(node => {
            node.neighbors.forEach(neighborId => {
                // For destination 'neighborId', the nextHop is 'neighborId' itself (direct connection)
                node.addPathHint(1, neighborId, neighborId, now);
            });
        });

        // 2. Iteratively build H=k info from H=(k-1) info of neighbors
        // For node A, if neighbor N has destination D in N.ownHopLimitedInfo[k-1].pathHints,
        // then D is k hops away from A, via N.
        for (let k = 2; k <= this.maxHopsForBF; k++) {
            this.nodes.forEach(currentNodeA => { // For each node 'A'
                currentNodeA.neighbors.forEach(neighborIdN => { // For each neighbor 'N' of A
                    const neighborNodeN = this.nodes.get(neighborIdN);
                    if (neighborNodeN) {
                        const neighborsInfoForTierK_minus_1 = neighborNodeN.ownHopLimitedInfo[k - 1];
                        if (neighborsInfoForTierK_minus_1) {
                            neighborsInfoForTierK_minus_1.pathHints.forEach((hintEntry, destinationD) => {
                                // If destination D is not A itself, and not already a direct neighbor of A
                                // (to avoid trivial loops or redundant H=1 style paths in higher tiers for those neighbors)
                                if (destinationD !== currentNodeA.id && !currentNodeA.neighbors.has(destinationD)) {
                                    // Check if we already have a hint for D at tier k.
                                    // If not, or if this new path is somehow "better" (e.g. fresher, though not modeled here), add/update.
                                    // For simplicity, first one found or overwrite.
                                    // A more complex logic could handle multiple paths.
                                    const existingHintForD_atTierK = currentNodeA.ownHopLimitedInfo[k]?.pathHints.get(destinationD);
                                    if (!existingHintForD_atTierK || hintEntry.lastUpdated > existingHintForD_atTierK.lastUpdated) {
                                         currentNodeA.addPathHint(k, destinationD, neighborIdN, now); // N is the next hop from A to reach D
                                    }
                                }
                            });
                        }
                    }
                });
            });
        }

        // 3. Distribute/Cache Full Info: Each node gets copies of its neighbors' fully formed *ownHopLimitedInfo*
        // This step is for if a node needs to inspect a neighbor's detailed view,
        // but routing decisions will now primarily use the node's *own* precomputed `ownHopLimitedInfo`.
        // For the current routing logic, this direct caching might be less critical if `initializeNetworkInfo`
        // is called globally. However, for dynamic updates, nodes would exchange their `ownHopLimitedInfo`.
        this.nodes.forEach(node => {
            node.neighbors.forEach(neighborId => {
                const neighborNode = this.nodes.get(neighborId);
                if (neighborNode) {
                    node.cacheNeighborInfo(neighborId, neighborNode.ownHopLimitedInfo);
                }
            });
        });
        console.log("Network info (filters and path hints) initialized.");
    }

    getNode(id: NodeId): P2PNode | undefined {
        return this.nodes.get(id);
    }

    pruneAllNodes(staleThresholdMs: number): void {
        this.nodes.forEach(node => {
            node.pruneStaleEntriesAndRebuildFilters(staleThresholdMs, this.bloomFilterSize, this.bloomFilterNumHashes);
        });
        console.log("Pruned stale entries for all nodes.");
        // After pruning, it might be beneficial to re-run parts of initializeNetworkInfo
        // to let nodes rebuild higher-tier hints from potentially pruned lower-tier hints of neighbors.
        // For a prototype, a full re-initialization might be simpler after pruning.
        this.initializeNetworkInfo(); // Rebuild with fresh timestamps
    }

    resetNetwork(): void { // Renamed from initializeAllBloomFilters for clarity
        this.nodes.forEach(node => {
             for (let k = 1; k <= this.maxHopsForBF; k++) {
                node.initializeHopTier(k, this.bloomFilterSize, this.bloomFilterNumHashes);
            }
            node.neighborInfoCache.clear();
        });
        this.initializeNetworkInfo();
    }
}
