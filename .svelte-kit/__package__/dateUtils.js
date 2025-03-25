import { DateTime } from 'luxon';
export const formatDate = (dateString, format = DateTime.DATETIME_MED) => {
    if (!dateString)
        return '';
    return DateTime.fromISO(dateString).toLocaleString(format);
};
export const formatTimestamp = (timestamp, format = DateTime.DATETIME_MED) => {
    return DateTime.fromMillis(timestamp).toLocaleString(format);
};
// Add more date utility functions as needed 
