import { CountingBloomFilter } from './bloomFilter.js';

export interface NodePosition {
    x: number;
    y: number;
}

export type NodeId = string;

export class P2PNode {
    public id: NodeId;
    public position: NodePosition;
    public neighbors: Set<NodeId>;

    public ownHopLimitedBloomFilters: { [hopLimit: number]: CountingBloomFilter };
    public neighborBloomFiltersCache: Map<NodeId, { [hopLimit: number]: CountingBloomFilter }>;

    constructor(id: NodeId, position: NodePosition) {
        this.id = id;
        this.position = position;
        this.neighbors = new Set();
        this.ownHopLimitedBloomFilters = {};
        this.neighborBloomFiltersCache = new Map();
    }

    addNeighbor(neighborId: NodeId): void {
        this.neighbors.add(neighborId);
    }

    initializeOwnBF_H1(filterSize: number, numHashes: number): void {
        const bfH1 = new CountingBloomFilter(filterSize, numHashes);
        this.neighbors.forEach(neighborId => bfH1.add(neighborId));
        this.ownHopLimitedBloomFilters[1] = bfH1;
    }

    cacheNeighborFilters(neighborId: NodeId, filters: { [hopLimit: number]: CountingBloomFilter }): void {
        const copiedFilters: { [hopLimit: number]: CountingBloomFilter } = {};
        for (const tier in filters)
            copiedFilters[tier] = CountingBloomFilter.deserialize(filters[tier].serialize(), filters[tier]['numHashes']);
        this.neighborBloomFiltersCache.set(neighborId, copiedFilters);
    }
}
