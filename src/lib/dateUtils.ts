import { DateTime } from 'luxon';

export const formatDate = (dateString: string, format = DateTime.DATETIME_MED): string => {
  if (!dateString) return '';
  return DateTime.fromISO(dateString).toLocaleString(format);
};

export const formatTimestamp = (timestamp: number | string, format = DateTime.DATETIME_MED): string => {
  if (!timestamp) return 'Date not available';
  
  if (typeof timestamp === 'string') {
    try {
      return DateTime.fromISO(timestamp).toLocaleString(format);
    } catch (e) {
      // If ISO parsing fails, just return the string as-is
      return timestamp;
    }
  }
  
  try {
    return DateTime.fromMillis(timestamp).toLocaleString(format);
  } catch (e) {
    return 'Date not available';
  }
};

// Add more date utility functions as needed 