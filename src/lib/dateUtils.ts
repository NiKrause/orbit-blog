import { DateTime } from 'luxon';

export const formatDate = (dateString: string, format = DateTime.DATETIME_MED): string => {
  if (!dateString) return '';
  return DateTime.fromISO(dateString).toLocaleString(format);
};

export const formatTimestamp = (timestamp: number, format = DateTime.DATETIME_MED): string => {
  return DateTime.fromMillis(timestamp).toLocaleString(format);
};

// Add more date utility functions as needed 