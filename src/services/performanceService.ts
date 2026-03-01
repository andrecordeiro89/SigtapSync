/**
 * ================================================================
 * PERFORMANCE OPTIMIZATION SERVICE
 * ================================================================
 * Provides caching, connection pooling, query optimization, and
 * background processing for improved application performance
 * ================================================================
 */

import { supabase } from '../lib/supabase';

// Cache interfaces
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
}

interface CacheConfig {
  ttl: number;
  maxSize: number;
  cleanupInterval: number;
}

// Connection pooling
interface ConnectionPool {
  maxConnections: number;
  currentConnections: number;
  queue: Array<() => void>;
  waitTime: number;
}

// Query optimization
interface QueryOptimizer {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  batchSize: number;
}

// Background processing
interface BackgroundTask {
  id: string;
  name: string;
  priority: number;
  execute: () => Promise<any>;
  retryCount: number;
  maxRetries: number;
}

class PerformanceService {
  // Cache management
  private cache: Map<string, CacheEntry> = new Map();
  private cacheConfig: CacheConfig = {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100,
    cleanupInterval: 60000 // 1 minute
  };
  private lruKeys: string[] = [];
  private cacheCleanupTimer?: ReturnType<typeof setInterval>;

  // Connection pooling
  private connectionPool: ConnectionPool = {
    maxConnections: 10,
    currentConnections: 0,
    queue: [],
    waitTime: 0
  };

  // Query optimization
  private queryOptimizer: QueryOptimizer = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    batchSize: 50
  };

  // Background processing
  private backgroundQueue: BackgroundTask[] = [];
  private isProcessingQueue = false;
  private backgroundWorkers = 3;

  constructor() {
    this.startCacheCleanup();
    this.startBackgroundProcessing();
  }

  // 🚀 CACHE MANAGEMENT
  async getCached<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);
    
    if (cached && cached.expiresAt > now) {
      cached.accessCount++;
      this.updateLRU(key);
      console.log(`🚀 Cache hit for key: ${key} (access count: ${cached.accessCount})`);
      return cached.data;
    }

    console.log(`🚀 Cache miss for key: ${key}`);
    const data = await this.executeWithRetry(fetcher);
    
    this.setCache(key, data, ttl);
    return data;
  }

  private setCache(key: string, data: any, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.cacheConfig.ttl);
    
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.cacheConfig.maxSize && !this.cache.has(key)) {
      const oldestKey = this.lruKeys[0];
      this.cache.delete(oldestKey);
      this.lruKeys = this.lruKeys.slice(1);
      console.log(`🗑️ Evicted oldest cache entry: ${oldestKey}`);
    }

    this.cache.set(key, { 
      data, 
      timestamp: Date.now(), 
      expiresAt,
      accessCount: 1
    });
    this.updateLRU(key);
    
    console.log(`💾 Cached data for key: ${key} (cache size: ${this.cache.size})`);
  }

  private updateLRU(key: string): void {
    this.lruKeys = this.lruKeys.filter(k => k !== key);
    this.lruKeys.push(key);
  }

  private startCacheCleanup(): void {
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupExpiredCache();
    }, this.cacheConfig.cleanupInterval);
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        this.lruKeys = this.lruKeys.filter(k => k !== key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries (remaining: ${this.cache.size})`);
    }
  }

  // 🚀 CONNECTION POOLING
  private async executeWithConnectionPool<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        const startTime = Date.now();
        try {
          this.connectionPool.currentConnections++;
          const result = await operation();
          this.connectionPool.currentConnections--;
          this.connectionPool.waitTime = Date.now() - startTime;
          this.processQueue();
          resolve(result);
        } catch (error) {
          this.connectionPool.currentConnections--;
          this.connectionPool.waitTime = Date.now() - startTime;
          this.processQueue();
          reject(error);
        }
      };

      if (this.connectionPool.currentConnections < this.connectionPool.maxConnections) {
        execute();
      } else {
        this.connectionPool.queue.push(execute);
        console.log(`⏳ Connection pool full (${this.connectionPool.currentConnections}/${this.connectionPool.maxConnections}). Queued operation.`);
      }
    });
  }

  private processQueue(): void {
    if (this.connectionPool.queue.length > 0 && this.connectionPool.currentConnections < this.connectionPool.maxConnections) {
      const next = this.connectionPool.queue.shift();
      if (next) {
        console.log(`▶️ Processing queued operation (${this.connectionPool.queue.length} remaining in queue)`);
        next();
      }
    }
  }

  // 🚀 RETRY MECHANISM
  private async executeWithRetry<T>(operation: () => Promise<T>, retries?: number): Promise<T> {
    const maxRetries = retries || this.queryOptimizer.maxRetries;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeWithConnectionPool(operation);
      } catch (error: any) {
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        const delay = this.queryOptimizer.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`🔄 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  // 🚀 BATCH PROCESSING
  async processInBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize?: number,
    onProgress?: (processed: number, total: number) => void
  ): Promise<R[]> {
    const size = batchSize || this.queryOptimizer.batchSize;
    const results: R[] = [];
    const totalBatches = Math.ceil(items.length / size);
    
    console.log(`🔄 Starting batch processing: ${items.length} items in ${totalBatches} batches`);
    
    for (let i = 0; i < items.length; i += size) {
      const batch = items.slice(i, i + size);
      const batchNumber = Math.floor(i / size) + 1;
      
      console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);
      
      try {
        const batchResults = await this.executeWithRetry(() => processor(batch));
        results.push(...batchResults);
        
        if (onProgress) {
          onProgress(i + batch.length, items.length);
        }
        
        // Small delay between batches to prevent overwhelming the system
        if (i + size < items.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`❌ Batch ${batchNumber} failed:`, error);
        throw error;
      }
    }
    
    console.log(`✅ Batch processing completed: ${results.length} results`);
    return results;
  }

  // 🚀 BACKGROUND PROCESSING
  addBackgroundTask(name: string, execute: () => Promise<any>, priority: number = 1, maxRetries: number = 3): string {
    const task: BackgroundTask = {
      id: `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      priority,
      execute,
      retryCount: 0,
      maxRetries
    };

    this.backgroundQueue.push(task);
    this.backgroundQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
    
    console.log(`📋 Added background task: ${name} (priority: ${priority})`);
    return task.id;
  }

  private async startBackgroundProcessing(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    const processQueue = async () => {
      while (this.backgroundQueue.length > 0) {
        const task = this.backgroundQueue.shift();
        if (!task) continue;

        try {
          console.log(`🔄 Executing background task: ${task.name}`);
          await task.execute();
          console.log(`✅ Background task completed: ${task.name}`);
        } catch (error) {
          console.error(`❌ Background task failed: ${task.name}`, error);
          
          if (task.retryCount < task.maxRetries) {
            task.retryCount++;
            this.backgroundQueue.push(task);
            console.log(`🔄 Retrying background task: ${task.name} (attempt ${task.retryCount}/${task.maxRetries})`);
          }
        }

        // Small delay between tasks
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.isProcessingQueue = false;
    };

    // Start processing with multiple workers
    const workers = Array(this.backgroundWorkers).fill(null).map(() => processQueue());
    await Promise.all(workers);
  }

  // 🚀 QUERY OPTIMIZATION
  buildOptimizedQuery(table: string, select: string[], filters: Record<string, any>, options?: {
    limit?: number;
    offset?: number;
    orderBy?: { column: string; ascending: boolean };
    search?: { column: string; term: string };
  }) {
    let query = supabase.from(table).select(select.join(','));

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (typeof value === 'string' && value.includes('%')) {
          query = query.like(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    });

    // Apply search
    if (options?.search && options.search.term) {
      query = query.or(`${options.search.column}.ilike.%${options.search.term}%`);
    }

    // Apply options
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }
    
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending });
    }

    return query;
  }

  // 🚀 PERFORMANCE MONITORING
  getPerformanceMetrics(): {
    cache: { size: number; hitRate: number; memoryUsage: number };
    connectionPool: { activeConnections: number; queueSize: number; waitTime: number };
    backgroundQueue: { pendingTasks: number; isProcessing: boolean };
  } {
    const totalAccesses = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.accessCount, 0);
    const cacheHits = Array.from(this.cache.values()).filter(entry => entry.accessCount > 1).length;
    
    return {
      cache: {
        size: this.cache.size,
        hitRate: totalAccesses > 0 ? (cacheHits / totalAccesses) * 100 : 0,
        memoryUsage: JSON.stringify(Array.from(this.cache.entries())).length
      },
      connectionPool: {
        activeConnections: this.connectionPool.currentConnections,
        queueSize: this.connectionPool.queue.length,
        waitTime: this.connectionPool.waitTime
      },
      backgroundQueue: {
        pendingTasks: this.backgroundQueue.length,
        isProcessing: this.isProcessingQueue
      }
    };
  }

  // 🚀 CACHE INVALIDATION
  invalidateCache(pattern?: string): void {
    if (pattern) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(pattern));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.lruKeys = this.lruKeys.filter(k => k !== key);
      });
      console.log(`🗑️ Invalidated ${keysToDelete.length} cache entries for pattern: ${pattern}`);
    } else {
      this.cache.clear();
      this.lruKeys = [];
      console.log('🗑️ Cleared entire cache');
    }
  }

  // Cleanup
  destroy(): void {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }
    this.cache.clear();
    this.lruKeys = [];
    this.backgroundQueue = [];
    console.log('🧹 PerformanceService cleaned up');
  }
}

// Export singleton instance
export const performanceService = new PerformanceService();
export default performanceService;
