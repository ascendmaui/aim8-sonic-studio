/**
 * Analytics are disabled in the open-source BYOK build.
 * These no-op functions keep the call sites working without sending data anywhere.
 */

export type AnalyticsEvent = string;

export function initAnalytics(): void { /* disabled */ }

export function identifyUser(_userId: string, _traits?: Record<string, any>): void { /* disabled */ }

export function trackEvent(_event: AnalyticsEvent, _data?: Record<string, any>): void {
    if (import.meta.env.DEV) console.debug('[aim8:event]', _event, _data || {});
}
