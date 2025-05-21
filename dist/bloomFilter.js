// A very simplified Counting Bloom Filter for prototype purposes
// In a real scenario, use a robust library or a more detailed implementation.
export class CountingBloomFilter {
    constructor(size = 100, numHashes = 3) {
        this.size = size;
        this.numHashes = numHashes;
        this.bitArray = new Array(size).fill(0);
    }
    // Simple string hashing (djb2)
    hash(str, seed) {
        let h = seed;
        for (let i = 0; i < str.length; i++) {
            h = (h * 33) ^ str.charCodeAt(i);
        }
        return Math.abs(h);
    }
    getIndices(item) {
        const indices = [];
        for (let i = 0; i < this.numHashes; i++) {
            indices.push(this.hash(item, i) % this.size);
        }
        return indices;
    }
    add(item) {
        const indices = this.getIndices(item);
        indices.forEach(index => {
            this.bitArray[index]++;
        });
    }
    remove(item) {
        const indices = this.getIndices(item);
        indices.forEach(index => {
            if (this.bitArray[index] > 0) {
                this.bitArray[index]--;
            }
        });
    }
    has(item) {
        const indices = this.getIndices(item);
        return indices.every(index => this.bitArray[index] > 0);
    }
    union(otherFilter) {
        if (this.size !== otherFilter.size || this.numHashes !== otherFilter.numHashes) {
            // For simplicity in prototype, assume compatible. Real world needs error handling or resizing.
            console.warn("Attempting to union Bloom filters of different configurations.");
            return this; // Or throw error
        }
        const newFilter = new CountingBloomFilter(this.size, this.numHashes);
        for (let i = 0; i < this.size; i++) {
            newFilter.bitArray[i] = Math.max(this.bitArray[i], otherFilter.bitArray[i]);
        }
        return newFilter;
    }
    // For visualization/debug
    serialize() {
        return [...this.bitArray];
    }
    static deserialize(data, numHashes = 3) {
        const filter = new CountingBloomFilter(data.length, numHashes);
        filter.bitArray = [...data];
        return filter;
    }
}
