import { P2PNode, NodeId } from './node.js';
import { CountingBloomFilter } from './bloomFilter.js';

export class Network {
    public nodes: Map<NodeId, P2PNode>;
    public maxHopsForBF: number; // Max k for BF_Hk
    private bloomFilterSize: number;
    private bloomFilterNumHashes: number;

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

    // This is a crucial step: building all filters.
    initializeAllBloomFilters(): void {
        // 1. Each node initializes its BF_H1 (nodes 1 hop away)
        this.nodes.forEach(node => {
            node.initializeOwnBF_H1(this.bloomFilterSize, this.bloomFilterNumHashes);
        });

        // 2. Iteratively build BF_Hk for k > 1
        // BF_A_Hk = Union ( BF_N_H(k-1) ) for all neighbors N of A
        for (let k = 2; k <= this.maxHopsForBF; k++) {
            this.nodes.forEach(currentNode => { // For each node 'A' (currentNode)
                let combinedBfForTierK = new CountingBloomFilter(this.bloomFilterSize, this.bloomFilterNumHashes);
                currentNode.neighbors.forEach(neighborId => {
                    const neighborNode = this.nodes.get(neighborId);
                    if (neighborNode) {
                        const neighborsBfForTierK_minus_1 = neighborNode.ownHopLimitedBloomFilters[k - 1];
                        if (neighborsBfForTierK_minus_1) {
                            combinedBfForTierK = combinedBfForTierK.union(neighborsBfForTierK_minus_1);
                        }
                    }
                });
                // Remove direct neighbors and self from higher tier filters to keep tiers distinct in purpose
                // (Though mathematically, the routing logic of checking tiers handles this implicitly)
                // For this prototype, we'll keep it simple; the routing logic prioritizes lower explicit tiers.
                currentNode.ownHopLimitedBloomFilters[k] = combinedBfForTierK;
            });
        }

        // 3. Distribute/Cache Filters: Each node gets copies of its neighbors' fully formed filters
        this.nodes.forEach(node => {
            node.neighbors.forEach(neighborId => {
                const neighborNode = this.nodes.get(neighborId);
                if (neighborNode) {
                    node.cacheNeighborFilters(neighborId, neighborNode.ownHopLimitedBloomFilters);
                }
            });
        });
        console.log("Bloom filters initialized and distributed.");
    }

    getNode(id: NodeId): P2PNode | undefined {
        return this.nodes.get(id);
    }

    resetNetwork(): void {
        this.nodes.forEach(node => {
            node.ownHopLimitedBloomFilters = {};
            node.neighborBloomFiltersCache.clear();
        });
        // Re-initialize after reset. You might want to clear neighbors too if topology changes.
        this.initializeAllBloomFilters();
    }
}
