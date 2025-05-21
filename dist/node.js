import { CountingBloomFilter } from './bloomFilter.js';
export class P2PNode {
    constructor(id, position) {
        this.id = id;
        this.position = position;
        this.neighbors = new Set();
        this.ownHopLimitedBloomFilters = {};
        this.neighborBloomFiltersCache = new Map();
    }
    addNeighbor(neighborId) {
        this.neighbors.add(neighborId);
    }
    // Initialize own BF_H1
    initializeOwnBF_H1(filterSize, numHashes) {
        const bfH1 = new CountingBloomFilter(filterSize, numHashes);
        this.neighbors.forEach(neighborId => bfH1.add(neighborId));
        this.ownHopLimitedBloomFilters[1] = bfH1;
    }
    // Store a cached version of a neighbor's filters
    cacheNeighborFilters(neighborId, filters) {
        const copiedFilters = {};
        for (const tier in filters) {
            // Deep copy or deserialize to avoid shared references if filters are passed around
            copiedFilters[tier] = CountingBloomFilter.deserialize(filters[tier].serialize(), filters[tier]['numHashes']);
        }
        this.neighborBloomFiltersCache.set(neighborId, copiedFilters);
    }
}
