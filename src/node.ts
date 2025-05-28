import { CountingBloomFilter } from './bloomFilter.js';

export interface NodePosition {
    x: number;
    y: number;
}

export type NodeId = string;

export interface PathHintEntry {
    nextHop: NodeId;    // The direct neighbor to take to reach the destination
    lastUpdated: number; // Timestamp of when this hint was created/refreshed
}

export class P2PNode {
    public id: NodeId;
    public position: NodePosition;
    public neighbors: Set<NodeId>;

    // ownHopLimitedInfo[k] contains info about nodes k hops away from THIS node
    public ownHopLimitedInfo: {
        [hopLimit: number]: {
            filter: CountingBloomFilter;      // Probabilistic set of destination IDs k hops away
            pathHints: Map<NodeId, PathHintEntry>; // Map: DestinationID -> PathHintEntry
        }
    };

    // Cache of neighbors' full "ownHopLimitedInfo" - needed for building our own.
    // This structure might become large. For a prototype, it's okay.
    // Key: Neighbor ID, Value: Their complete ownHopLimitedInfo structure
    public neighborInfoCache: Map<NodeId, {
        [hopLimit: number]: {
            filter: CountingBloomFilter; // Just the filter part for quick checks if needed
            pathHints: Map<NodeId, PathHintEntry>; // Or the full hints
        }
    }>;


    constructor(id: NodeId, position: NodePosition) {
        this.id = id;
        this.position = position;
        this.neighbors = new Set();
        this.ownHopLimitedInfo = {};
        this.neighborInfoCache = new Map();
    }

    addNeighbor(neighborId: NodeId): void {
        this.neighbors.add(neighborId);
    }

    // Initializes a specific tier k for ownHopLimitedInfo
    initializeHopTier(k: number, filterSize: number, numHashes: number): void {
        if (!this.ownHopLimitedInfo[k]) {
            this.ownHopLimitedInfo[k] = {
                filter: new CountingBloomFilter(filterSize, numHashes),
                pathHints: new Map<NodeId, PathHintEntry>()
            };
        } else {
            this.ownHopLimitedInfo[k].filter = new CountingBloomFilter(filterSize, numHashes); // Reset filter
            this.ownHopLimitedInfo[k].pathHints.clear(); // Reset hints
        }
    }

    // Adds a path hint for a given destination at a specific hop tier
    addPathHint(
        hopTier: number,
        destinationId: NodeId,
        nextHopToDest: NodeId,
        timestamp: number
    ): void {
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
    cacheNeighborInfo(
        neighborId: NodeId,
        info: { [hopLimit: number]: { filter: CountingBloomFilter; pathHints: Map<NodeId, PathHintEntry> } }
    ): void {
        const copiedInfo: { [hopLimit: number]: { filter: CountingBloomFilter; pathHints: Map<NodeId, PathHintEntry> } } = {};
        for (const tier in info) {
            const originalTierInfo = info[tier];
            const newPathHints = new Map<NodeId, PathHintEntry>();
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

    pruneStaleEntriesAndRebuildFilters(staleThresholdMs: number, filterSize: number, numHashes: number): void {
        const now = Date.now();
        Object.values(this.ownHopLimitedInfo).forEach(tierInfo => {
            const newPathHints = new Map<NodeId, PathHintEntry>();
            const newFilter = new CountingBloomFilter(filterSize, numHashes);

            tierInfo.pathHints.forEach((hint, destId) => {
                if (now - hint.lastUpdated <= staleThresholdMs) {
                    newPathHints.set(destId, hint); // Keep non-stale hint
                    newFilter.add(destId);         // Add to new filter
                }
            });
            tierInfo.pathHints = newPathHints;
            tierInfo.filter = newFilter;
        });
    }
}
