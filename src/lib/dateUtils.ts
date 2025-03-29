import { DateTime } from 'luxon';

export const formatDate = (dateString: string, format = DateTime.DATETIME_MED): string => {
  if (!dateString) return '';
  return DateTime.fromISO(dateString).toLocaleString(format);
};

export const formatTimestamp = (timestamp: number | string, format = DateTime.DATETIME_MED): string => {
  if (typeof timestamp === 'string') {
    return DateTime.fromISO(timestamp).toLocaleString(format);
  }
  return DateTime.fromMillis(timestamp).toLocaleString(format);
};

// Add more date utility functions as needed 