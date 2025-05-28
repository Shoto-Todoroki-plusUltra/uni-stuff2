import { CountingBloomFilter } from './bloomFilter.js';
export class P2PNode {
    constructor(id, position) {
        this.id = id;
        this.position = position;
        this.neighbors = new Set();
        this.ownHopLimitedInfo = {};
        this.neighborInfoCache = new Map();
    }
    addNeighbor(neighborId) {
        this.neighbors.add(neighborId);
    }
    // Initializes a specific tier k for ownHopLimitedInfo
    initializeHopTier(k, filterSize, numHashes) {
        if (!this.ownHopLimitedInfo[k]) {
            this.ownHopLimitedInfo[k] = {
                filter: new CountingBloomFilter(filterSize, numHashes),
                pathHints: new Map()
            };
        }
        else {
            this.ownHopLimitedInfo[k].filter = new CountingBloomFilter(filterSize, numHashes); // Reset filter
            this.ownHopLimitedInfo[k].pathHints.clear(); // Reset hints
        }
    }
    // Adds a path hint for a given destination at a specific hop tier
    addPathHint(hopTier, destinationId, nextHopToDest, timestamp) {
        if (!this.ownHopLimitedInfo[hopTier]) {
            // This should ideally be initialized before adding hints by initializeHopTier
            console.warn(`Hop tier ${hopTier} not initialized for node ${this.id} before adding hint.`);
            return;
        }
        // Add to pathHints map
        this.ownHopLimitedInfo[hopTier].pathHints.set(destinationId, {
            nextHop: nextHopToDest,
            lastUpdated: timestamp
        });
        // Add to the corresponding Bloom filter
        this.ownHopLimitedInfo[hopTier].filter.add(destinationId);
    }
    // Store a cached version of a neighbor's full info structure
    cacheNeighborInfo(neighborId, info) {
        const copiedInfo = {};
        for (const tier in info) {
            const originalTierInfo = info[tier];
            const newPathHints = new Map();
            originalTierInfo.pathHints.forEach((value, key) => {
                newPathHints.set(key, { ...value }); // Shallow copy of path hint entry
            });
            copiedInfo[tier] = {
                filter: CountingBloomFilter.deserialize(originalTierInfo.filter.serialize(), originalTierInfo.filter.numHashes), // Now accessible
                pathHints: newPathHints
            };
        }
        this.neighborInfoCache.set(neighborId, copiedInfo);
    }
    pruneStaleEntriesAndRebuildFilters(staleThresholdMs, filterSize, numHashes) {
        const now = Date.now();
        Object.values(this.ownHopLimitedInfo).forEach(tierInfo => {
            const newPathHints = new Map();
            const newFilter = new CountingBloomFilter(filterSize, numHashes);
            tierInfo.pathHints.forEach((hint, destId) => {
                if (now - hint.lastUpdated <= staleThresholdMs) {
                    newPathHints.set(destId, hint); // Keep non-stale hint
                    newFilter.add(destId); // Add to new filter
                }
            });
            tierInfo.pathHints = newPathHints;
            tierInfo.filter = newFilter;
        });
    }
}
