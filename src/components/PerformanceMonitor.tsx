import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle, Clock, Database, Zap, RefreshCw } from 'lucide-react';
import { performanceService } from '../services/performanceService';
import { optimizedSupabaseService } from '../services/supabaseServiceOptimized';

interface PerformanceMetrics {
  cache: {
    size: number;
    hitRate: number;
    memoryUsage: number;
  };
  connectionPool: {
    activeConnections: number;
    queueSize: number;
    waitTime: number;
  };
  backgroundQueue: {
    pendingTasks: number;
    isProcessing: boolean;
  };
  queryMetrics: {
    averageQueryTime: number;
    totalQueries: number;
    slowQueries: number;
  };
}

interface PerformanceMonitorProps {
  isMinimized?: boolean;
  onRefresh?: () => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  isMinimized = false,
  onRefresh,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    cache: { size: 0, hitRate: 0, memoryUsage: 0 },
    connectionPool: { activeConnections: 0, queueSize: 0, waitTime: 0 },
    backgroundQueue: { pendingTasks: 0, isProcessing: false },
    queryMetrics: { averageQueryTime: 0, totalQueries: 0, slowQueries: 0 }
  });
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch performance metrics
  const fetchMetrics = useCallback(async () => {
    try {
      setIsRefreshing(true);
      
      // Get metrics from performance service
      const perfMetrics = performanceService.getPerformanceMetrics();
      const connStats = optimizedSupabaseService.getConnectionStats();
      
      // Calculate query metrics
      const recentQueries = optimizedSupabaseService.getQueryMetrics().slice(-100);
      const avgQueryTime = recentQueries.length > 0 
        ? recentQueries.reduce((sum, q) => sum + q.executionTime, 0) / recentQueries.length 
        : 0;
      const slowQueries = recentQueries.filter(q => q.executionTime > 5000).length;
      
      setMetrics({
        cache: perfMetrics.cache,
        connectionPool: {
          activeConnections: connStats.activeConnections,
          queueSize: connStats.queueSize,
          waitTime: connStats.averageQueryTime
        },
        backgroundQueue: perfMetrics.backgroundQueue,
        queryMetrics: {
          averageQueryTime: avgQueryTime,
          totalQueries: recentQueries.length,
          slowQueries
        }
      });
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('❌ Error fetching performance metrics:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchMetrics]);

  // Manual refresh handler
  const handleRefresh = async () => {
    await fetchMetrics();
    if (onRefresh) {
      onRefresh();
    }
  };

  // Clear cache handler
  const handleClearCache = async () => {
    try {
      performanceService.invalidateCache();
      await fetchMetrics();
      console.log('🗑️ Cache cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  };

  // Format memory usage
  const formatMemoryUsage = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format time
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Get performance status
  const getPerformanceStatus = (): { status: 'good' | 'warning' | 'critical'; message: string } => {
    const { cache, connectionPool, queryMetrics } = metrics;
    
    if (queryMetrics.averageQueryTime > 10000 || connectionPool.queueSize > 10) {
      return { status: 'critical', message: 'Performance issues detected' };
    }
    
    if (queryMetrics.averageQueryTime > 5000 || cache.hitRate < 50 || connectionPool.activeConnections > 8) {
      return { status: 'warning', message: 'Performance degradation detected' };
    }
    
    return { status: 'good', message: 'System performance optimal' };
  };

  const performanceStatus = getPerformanceStatus();

  if (isMinimized) {
    return (
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Performance</span>
              <Badge 
                variant={performanceStatus.status === 'good' ? 'default' : performanceStatus.status === 'warning' ? 'secondary' : 'destructive'}
                className="text-xs"
              >
                {performanceStatus.status === 'good' ? 'Good' : performanceStatus.status === 'warning' ? 'Warning' : 'Critical'}
              </Badge>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <span className="text-xs text-gray-500">
                {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-blue-900 flex items-center space-x-2">
            <Zap className="h-5 w-5 text-blue-600" />
            <span>Performance Monitor</span>
            <Badge 
              variant={performanceStatus.status === 'good' ? 'default' : performanceStatus.status === 'warning' ? 'secondary' : 'destructive'}
            >
              {performanceStatus.status === 'good' ? (
                <><CheckCircle className="h-3 w-3 mr-1" />Optimal</>
              ) : performanceStatus.status === 'warning' ? (
                <><AlertCircle className="h-3 w-3 mr-1" />Warning</>
              ) : (
                <><AlertCircle className="h-3 w-3 mr-1" />Critical</>
              )}
            </Badge>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              className="text-xs"
            >
              <Database className="h-3 w-3 mr-1" />
              Clear Cache
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        <p className="text-sm text-blue-700">{performanceStatus.message}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Cache Performance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-3 border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Cache</h4>
              <Database className="h-4 w-4 text-blue-500" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Size:</span>
                <span className="font-medium">{metrics.cache.size}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Hit Rate:</span>
                <span className="font-medium">{metrics.cache.hitRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Memory:</span>
                <span className="font-medium">{formatMemoryUsage(metrics.cache.memoryUsage)}</span>
              </div>
            </div>
          </div>

          {/* Connection Pool */}
          <div className="bg-white rounded-lg p-3 border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Connections</h4>
              <Zap className="h-4 w-4 text-green-500" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Active:</span>
                <span className="font-medium">{metrics.connectionPool.activeConnections}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Queue:</span>
                <span className="font-medium">{metrics.connectionPool.queueSize}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Wait Time:</span>
                <span className="font-medium">{formatTime(metrics.connectionPool.waitTime)}</span>
              </div>
            </div>
          </div>

          {/* Query Performance */}
          <div className="bg-white rounded-lg p-3 border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Queries</h4>
              <Clock className="h-4 w-4 text-purple-500" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Avg Time:</span>
                <span className="font-medium">{formatTime(metrics.queryMetrics.averageQueryTime)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Total:</span>
                <span className="font-medium">{metrics.queryMetrics.totalQueries}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Slow:</span>
                <span className="font-medium text-red-600">{metrics.queryMetrics.slowQueries}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Background Tasks */}
        <div className="bg-white rounded-lg p-3 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Background Tasks</h4>
            <div className="flex items-center space-x-2">
              {metrics.backgroundQueue.isProcessing && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              )}
              <Badge variant={metrics.backgroundQueue.pendingTasks > 0 ? 'secondary' : 'outline'}>
                {metrics.backgroundQueue.pendingTasks} pending
              </Badge>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            {metrics.backgroundQueue.isProcessing ? 'Processing tasks...' : 'Idle'}
          </div>
        </div>

        {/* Last Update */}
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Last updated: {lastUpdate.toLocaleString()}</span>
          <span>Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceMonitor;
