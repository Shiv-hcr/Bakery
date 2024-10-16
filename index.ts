type StorageType = "local" | "session" | "hashmap";
type StorageObject = IStorage;
type Bucket = [string, string][];

interface IStorage {
    setItem(key: string, value: string): void;
    getItem(key: string): string | null;
    removeItem(key: string): void;
    clear(): void;
    keyExists(key: string): boolean;
    keys(): string[];
}

class CentralisedStorage implements IStorage {

    #storage: StorageObject;
    #keyCache: Set<string> = new Set();

    constructor(type: StorageType) {
        this.#storage = this.#initialiseStorage(type);
    }

    #initialiseStorage(type: StorageType): StorageObject {
        switch (type) {
            case "local": 
                return new BrowserStorage(localStorage); // Need to fix type error here
            case "session":
                return new BrowserStorage(sessionStorage); // and here
            case "hashmap":
                return new Hashmap();
            default:
                console.warn(`Invalid storage type: "${type}". Defaulting to Hashmap`);
                return new Hashmap();
        }
    }

    setItem(key: string, value: string): void {
        this.#storage.setItem(key, value);
        this.#keyCache.add(key);
    }

    getItem(key: string): string | null {
        if (this.#keyCache.has(key)) {
            return this.#storage.getItem(key);
        }
        return null;
    }

    removeItem(key: string): void {
        if (this.#keyCache.has(key)) {
            this.#storage.removeItem(key);
            this.#keyCache.delete(key);
        }
    }

    clear(): void {
        this.#storage.clear();
        this.#keyCache.clear();
    }

    keyExists(key: string): boolean {
        return this.#keyCache.has(key);
    }

    keys(): string[] {
        return Array.from(this.#keyCache);
    }
}

class BrowserStorage implements IStorage {
    #storage: CentralisedStorage;

    constructor(storage: CentralisedStorage) {
        this.#storage = storage;
    }

    setItem(key: string, value: string): void {
        this.#storage.setItem(key, value);
    }

    getItem(key: string): string | null {
        return this.#storage.getItem(key);
    }

    removeItem(key: string): void {
        this.#storage.removeItem(key);
    }

    clear(): void {
        this.#storage.clear();
    }

    keyExists(key: string): boolean {
        return this.#storage.getItem(key) !== null;
    }

    keys(): string[] {
        return Object.keys(this.#storage);
    }
}

class Hashmap implements IStorage {
    #size: number;
    #buckets: Bucket[];
    #count: number = 0;
    #loadFactor: number = 0.7;
    #initialSize: number = 4;

    constructor(size?: number) {
        this.#size = size || this.#initialSize;
        this.#buckets = this.#new(this.#size);
    }

    #new(size: number): Bucket[] {
        this.#count = 0;
        return Array.from({ length: size }, () => []);
    }

    #resize(newSize: number): void {
        const oldBuckets = this.#buckets;
        this.#size = newSize;
        this.#buckets = this.#new(newSize);
        console.log(`Resizing hashmap to size ${newSize}...`);
        for (const bucket of oldBuckets) {
            for (const [key, value] of bucket) {
                this.setItem(key, value);
            }
        }
    }

    #checkLoadFactor(): void {
        const factorIncrease: number = 2;
        const currentLoadFactor: number = this.#count / this.#size;
        if (currentLoadFactor > this.#loadFactor) {
            this.#resize(this.#size * factorIncrease);
        }
    }

    #checkUnderLoadFactor(): void {
        const factorDecrease: number = 0.5;
        const underLoadFactor: number = 0.4;
        const currentLoadFactor: number = this.#count / this.#size;

        if (currentLoadFactor < underLoadFactor && this.#size > 10) {
            this.#resize(Math.ceil(this.#size * factorDecrease));
        }
    }

    #hash(key: string): number {
        const FNV_PRIME: number = 16777619;
        const FNV_OFFSET_BASIS: number = 2166136261;
        let hash: number = FNV_OFFSET_BASIS;

        for (let i = 0; i < key.length; i++) {
            hash ^= key.charCodeAt(i);
            hash *= FNV_PRIME;
            hash = hash >>> 0; // Convert to 32-bit int
        }
        
        return hash % this.#size;
    }
    
    #getBucket(key: string): Bucket {
        const bucketIndex: number = this.#hash(key);
        if (!this.#buckets[bucketIndex]) {
            this.#buckets[bucketIndex] = [];
        }
        return this.#buckets[bucketIndex];
    }

    setItem(keyName: string, keyValue: string): void {
        const bucket: Bucket = this.#getBucket(keyName);
        for (let i = 0; i < bucket.length; i++) {
            const [key] = bucket[i];
            if (key === keyName) {
                bucket[i] = [keyName, keyValue];
                return;
            }
        }
        bucket.push([keyName, keyValue]);
        this.#count++;
        this.#checkLoadFactor();
    }

    getItem(keyName: string): string | null {
        const bucket: Bucket = this.#getBucket(keyName);
        for (let i = 0; i < bucket.length; i++) {
            const [key, val] = bucket[i];
            if (key === keyName) return val;
        }
        return null;
    }

    removeItem(keyName: string): void {
        const bucket: Bucket = this.#getBucket(keyName);
        for (let i = 0; i < bucket.length; i++) {
            const [key] = bucket[i];
            if (key === keyName) {
                bucket.splice(i, 1);
                this.#count--;
                this.#checkUnderLoadFactor();
                return;
            }
        }
    }

    clear(): void {
        this.#buckets = this.#new(this.#initialSize);
    }

    keyExists(keyName: string): boolean {
        return this.getItem(keyName) !== null;
    }

    keys(): string[] {
        return this.#buckets.flat().map(([key]) => key);
    }
}

class Bakery {
    #storage: CentralisedStorage;

    constructor(storageType: StorageType) {
        this.#storage = new CentralisedStorage(storageType);
    }

    set(key: string, value: string): void {
        this.#storage.setItem(key, value);
    }

    get(key: string): string | null {
        return this.#storage.getItem(key);
    }

    remove(key: string): void {
        this.#storage.removeItem(key);
    }

    clear(): void {
        this.#storage.clear();
    }

    keys(): string[] {
        return this.#storage.keys();
    }
}
