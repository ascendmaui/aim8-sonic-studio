import { useState, useEffect, useCallback } from 'react';

/**
 * useNetworkStatus — detects online/offline state changes
 *
 * Returns:
 * - isOnline: current network status
 * - wasOffline: true if the user was offline at any point during this session
 *   (useful for showing "back online" toasts)
 */
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => {
            setIsOnline(false);
            setWasOffline(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const clearWasOffline = useCallback(() => setWasOffline(false), []);

    return { isOnline, wasOffline, clearWasOffline };
}
