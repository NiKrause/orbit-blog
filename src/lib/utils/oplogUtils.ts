/**
 * Utility functions for monitoring OrbitDB oplog size and health
 */

export interface OplogStats {
  length: number;
  status: 'healthy' | 'warning' | 'concerning' | 'critical';
  color: string;
  message: string;
  recommendCompaction: boolean;
}

/**
 * Get the oplog length for a given OrbitDB database
 * @param db - OrbitDB database instance
 * @returns The number of entries in the oplog
 */
export async function getOplogLength(db: any): Promise<number> {
  if (!db?.log) {
    return 0;
  }
  
  try {
    // Try to get length directly
    if (typeof db.log.length === 'number') {
      return db.log.length;
    }
    
    // Otherwise traverse the oplog to count entries
    const entries = db.log.traverse();
    let count = 0;
    for await (const _ of entries) {
      count++;
    }
    return count;
  } catch (error) {
    console.error('Error getting oplog length:', error);
    return 0;
  }
}

/**
 * Analyze oplog health based on entry count
 * @param oplogLength - Number of entries in the oplog
 * @returns OplogStats object with status and recommendations
 */
export function analyzeOplogHealth(oplogLength: number): OplogStats {
  if (oplogLength < 1000) {
    return {
      length: oplogLength,
      status: 'healthy',
      color: 'green',
      message: 'Oplog is healthy. Fast replication expected.',
      recommendCompaction: false
    };
  } else if (oplogLength < 5000) {
    return {
      length: oplogLength,
      status: 'warning',
      color: 'yellow',
      message: 'Oplog is growing. Replication may take longer.',
      recommendCompaction: false
    };
  } else if (oplogLength < 10000) {
    return {
      length: oplogLength,
      status: 'concerning',
      color: 'orange',
      message: 'Oplog is large. Consider compaction soon.',
      recommendCompaction: true
    };
  } else {
    return {
      length: oplogLength,
      status: 'critical',
      color: 'red',
      message: 'Oplog is critical! Compaction strongly recommended.',
      recommendCompaction: true
    };
  }
}

/**
 * Get color classes for Tailwind CSS based on status
 * @param color - Color identifier (green, yellow, orange, red)
 * @returns Object with Tailwind CSS classes
 */
export function getStatusColorClasses(color: string) {
  switch (color) {
    case 'green':
      return {
        bg: 'bg-green-100 dark:bg-green-800',
        text: 'text-green-800 dark:text-green-100',
        border: 'border-green-300 dark:border-green-600',
        indicator: 'bg-green-500'
      };
    case 'yellow':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-800',
        text: 'text-yellow-800 dark:text-yellow-100',
        border: 'border-yellow-300 dark:border-yellow-600',
        indicator: 'bg-yellow-500'
      };
    case 'orange':
      return {
        bg: 'bg-orange-100 dark:bg-orange-800',
        text: 'text-orange-800 dark:text-orange-100',
        border: 'border-orange-300 dark:border-orange-600',
        indicator: 'bg-orange-500'
      };
    case 'red':
      return {
        bg: 'bg-red-100 dark:bg-red-800',
        text: 'text-red-800 dark:text-red-100',
        border: 'border-red-300 dark:border-red-600',
        indicator: 'bg-red-500'
      };
    default:
      return {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-800 dark:text-gray-100',
        border: 'border-gray-300 dark:border-gray-600',
        indicator: 'bg-gray-500'
      };
  }
}

/**
 * Format oplog length for display
 * @param length - Oplog length
 * @returns Formatted string with K suffix if applicable
 */
export function formatOplogLength(length: number): string {
  if (length >= 1000) {
    return `${(length / 1000).toFixed(1)}K`;
  }
  return length.toString();
}
