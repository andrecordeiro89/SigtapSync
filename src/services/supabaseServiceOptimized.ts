/**
 * ================================================================
 * OPTIMIZED SUPABASE SERVICE
 * ================================================================
 * Provides connection pooling, query optimization, and performance
 * monitoring for Supabase operations
 * ================================================================
 */

import { supabase } from '../lib/supabase';
import { performanceService } from './performanceService';

// Connection pool configuration
interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface QueryMetrics {
  executionTime: number;
  rowsReturned: number;
  query: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

interface ConnectionInfo {
  id: string;
  createdAt: number;
  lastUsed: number;
  active: boolean;
  queryCount: number;
}

class OptimizedSupabaseService {
  private connectionPool: ConnectionInfo[] = [];
  private activeConnections = 0;
  private queryMetrics: QueryMetrics[] = [];
  private isShuttingDown = false;
  
  private config: ConnectionPoolConfig = {
    maxConnections: 10,
    idleTimeout: 300000, // 5 minutes
    connectionTimeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000
  };

  constructor() {
    this.initializeConnectionPool();
    this.startConnectionMonitoring();
  }

  // 🚀 CONNECTION POOL MANAGEMENT
  private initializeConnectionPool(): void {
    console.log('🔧 Initializing Supabase connection pool...');
    
    // Pre-create connections
    for (let i = 0; i < this.config.maxConnections; i++) {
      this.connectionPool.push({
        id: `conn-${i}-${Date.now()}`,
        createdAt: Date.now(),
        lastUsed: 0,
        active: false,
        queryCount: 0
      });
    }
    
    console.log(`✅ Connection pool initialized with ${this.connectionPool.length} connections`);
  }

  private async acquireConnection(): Promise<ConnectionInfo> {
    if (this.isShuttingDown) {
      throw new Error('Service is shutting down');
    }

    // Find available connection
    let connection = this.connectionPool.find(conn => !conn.active);
    
    if (!connection && this.activeConnections < this.config.maxConnections) {
      // Create new connection if pool allows
      connection = {
        id: `conn-dynamic-${Date.now()}-${Math.random()}`,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        active: true,
        queryCount: 0
      };
      this.connectionPool.push(connection);
    }
    
    if (!connection) {
      // Wait for available connection
      console.log(`⏳ Connection pool full (${this.activeConnections}/${this.config.maxConnections}). Waiting...`);
      await this.waitForAvailableConnection();
      return this.acquireConnection();
    }
    
    connection.active = true;
    connection.lastUsed = Date.now();
    this.activeConnections++;
    
    console.log(`🔌 Acquired connection: ${connection.id} (active: ${this.activeConnections})`);
    return connection;
  }

  private releaseConnection(connection: ConnectionInfo): void {
    connection.active = false;
    connection.queryCount++;
    this.activeConnections--;
    
    console.log(`🔓 Released connection: ${connection.id} (active: ${this.activeConnections})`);
  }

  private async waitForAvailableConnection(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const availableConnection = this.connectionPool.find(conn => !conn.active);
        if (availableConnection || this.activeConnections < this.config.maxConnections) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout after connection timeout
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, this.config.connectionTimeout);
    });
  }

  // 🚀 QUERY OPTIMIZATION
  async executeQuery<T>(
    table: string,
    operation: (connection: ConnectionInfo) => Promise<any>,
    options?: {
      retryAttempts?: number;
      timeout?: number;
      cacheKey?: string;
      cacheTTL?: number;
    }
  ): Promise<T> {
    const startTime = Date.now();

    const run = async () => {
      const connection = await this.acquireConnection();
      try {
        return await this.executeWithRetry(
          () => operation(connection),
          options?.retryAttempts || this.config.retryAttempts
        );
      } finally {
        this.releaseConnection(connection);
      }
    };

    try {
      const result = options?.cacheKey
        ? await performanceService.getCached(options.cacheKey, run, options.cacheTTL)
        : await run();

      this.recordQueryMetrics({
        executionTime: Date.now() - startTime,
        rowsReturned: Array.isArray(result) ? result.length : 1,
        query: table,
        timestamp: Date.now(),
        success: true
      });

      return result;
    } catch (error: any) {
      this.recordQueryMetrics({
        executionTime: Date.now() - startTime,
        rowsReturned: 0,
        query: table,
        timestamp: Date.now(),
        success: false,
        error: error.message
      });

      throw error;
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        if (attempt === maxRetries) {
          console.error(`❌ Max retries (${maxRetries}) exceeded. Final error:`, error.message);
          throw error;
        }
        
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after ${delay}ms. Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  // 🚀 OPTIMIZED BATCH OPERATIONS
  async batchInsert<T>(
    table: string,
    data: T[],
    batchSize: number = 100
  ): Promise<void> {
    console.log(`🔄 Starting batch insert for ${table}: ${data.length} records in batches of ${batchSize}`);
    
    const batches = Math.ceil(data.length / batchSize);
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`🔄 Processing batch ${batchNumber}/${batches} (${batch.length} records)`);
      
      await this.executeQuery(
        `${table}_batch_${batchNumber}`,
        async () => {
          const { error } = await supabase.from(table).insert(batch);
          if (error) throw error;
        },
        { 
          retryAttempts: 2,
          timeout: 30000
        }
      );
      
      // Small delay between batches to prevent overwhelming the database
      if (i + batchSize < data.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`✅ Batch insert completed for ${table}: ${data.length} records`);
  }

  async batchUpdate<T>(
    table: string,
    updates: { id: string; data: Partial<T> }[],
    batchSize: number = 50
  ): Promise<void> {
    console.log(`🔄 Starting batch update for ${table}: ${updates.length} records`);
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async ({ id, data }) => {
          const { error } = await supabase.from(table).update(data).eq('id', id);
          if (error) throw error;
        })
      );
      
      // Small delay between batches
      if (i + batchSize < updates.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`✅ Batch update completed for ${table}: ${updates.length} records`);
  }

  // 🚀 PAGINATION OPTIMIZATION
  async paginatedQuery<T>(
    table: string,
    select: string[],
    filters: Record<string, any>,
    page: number,
    pageSize: number,
    orderBy?: { column: string; ascending: boolean }
  ): Promise<{ data: T[]; total: number; hasMore: boolean }> {
    const offset = (page - 1) * pageSize;
    
    return await this.executeQuery(
      `${table}_page_${page}`,
      async () => {
        let query = supabase.from(table).select(select.join(','), { count: 'exact' });
        
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
        
        // Apply pagination
        query = query.range(offset, offset + pageSize - 1);
        
        // Apply ordering
        if (orderBy) {
          query = query.order(orderBy.column, { ascending: orderBy.ascending });
        }
        
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        return {
          data: data || [],
          total: count || 0,
          hasMore: (offset + pageSize) < (count || 0)
        };
      },
      {
        cacheKey: `${table}_page_${page}_${pageSize}_${JSON.stringify(filters)}`,
        cacheTTL: 300000 // 5 minutes
      }
    );
  }

  // 🚀 CONNECTION MONITORING
  private startConnectionMonitoring(): void {
    setInterval(() => {
      const activeConnections = this.connectionPool.filter(conn => conn.active).length;
      const idleConnections = this.connectionPool.filter(conn => !conn.active).length;
      const totalQueries = this.connectionPool.reduce((sum, conn) => sum + conn.queryCount, 0);
      
      console.log(`📊 Connection Pool Status - Active: ${activeConnections}, Idle: ${idleConnections}, Total Queries: ${totalQueries}`);
      
      // Clean up idle connections
      const now = Date.now();
      const expiredConnections = this.connectionPool.filter(
        conn => !conn.active && (now - conn.lastUsed) > this.config.idleTimeout
      );
      
      if (expiredConnections.length > 0) {
        console.log(`🧹 Cleaning up ${expiredConnections.length} expired connections`);
        this.connectionPool = this.connectionPool.filter(
          conn => !expiredConnections.includes(conn)
        );
      }
    }, 60000); // Check every minute
  }

  // 🚀 QUERY METRICS
  private recordQueryMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);
    
    // Keep only last 1000 metrics
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }
    
    // Log slow queries
    if (metrics.executionTime > 5000) { // 5 seconds
      console.warn(`🐌 Slow query detected: ${metrics.query} took ${metrics.executionTime}ms`);
    }
  }

  getQueryMetrics(): QueryMetrics[] {
    return this.queryMetrics.slice(-100); // Last 100 queries
  }

  getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    queueSize: number;
    averageQueryTime: number;
  } {
    const activeConnections = this.connectionPool.filter(conn => conn.active).length;
    const idleConnections = this.connectionPool.filter(conn => !conn.active).length;
    
    const recentMetrics = this.queryMetrics.slice(-50);
    const averageQueryTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length 
      : 0;

    return {
      totalConnections: this.connectionPool.length,
      activeConnections,
      idleConnections,
      queueSize: this.connectionPool.filter(conn => conn.active).length - this.activeConnections,
      averageQueryTime
    };
  }

  // 🚀 SHUTDOWN
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down OptimizedSupabaseService...');
    this.isShuttingDown = true;
    
    // Wait for active connections to complete
    while (this.activeConnections > 0) {
      console.log(`⏳ Waiting for ${this.activeConnections} active connections to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ OptimizedSupabaseService shutdown complete');
  }
}

// Export singleton instance
export const optimizedSupabaseService = new OptimizedSupabaseService();
export default optimizedSupabaseService;
