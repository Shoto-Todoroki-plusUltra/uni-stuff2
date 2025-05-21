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

    // BF_Hk: Bloom filter for nodes k hops away from THIS node
    public ownHopLimitedBloomFilters: { [hopLimit: number]: CountingBloomFilter };

    // Cache of neighbors' Bloom Filters
    // Key: Neighbor ID, Value: Their set of hop-limited filters
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

    // Initialize own BF_H1
    initializeOwnBF_H1(filterSize: number, numHashes: number): void {
        const bfH1 = new CountingBloomFilter(filterSize, numHashes);
        this.neighbors.forEach(neighborId => bfH1.add(neighborId));
        this.ownHopLimitedBloomFilters[1] = bfH1;
    }

    // Store a cached version of a neighbor's filters
    cacheNeighborFilters(neighborId: NodeId, filters: { [hopLimit: number]: CountingBloomFilter }): void {
        const copiedFilters: { [hopLimit: number]: CountingBloomFilter } = {};
        for (const tier in filters) {
            // Deep copy or deserialize to avoid shared references if filters are passed around
            copiedFilters[tier] = CountingBloomFilter.deserialize(filters[tier].serialize(), filters[tier]['numHashes']);
        }
        this.neighborBloomFiltersCache.set(neighborId, copiedFilters);
    }
}
