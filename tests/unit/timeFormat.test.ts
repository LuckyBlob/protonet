import { describe, it, expect } from 'vitest';
import * as TimeFormat from '@/lib/helper/timeFormat';

describe('formatRemainingTimeMs', () =>
{
    it('returns "0s" for zero milliseconds', () =>
    {
        expect(TimeFormat.formatRemainingTimeMs(0)).toBe('0s');
    });

    it('returns "0s" for negative milliseconds', () =>
    {
        expect(TimeFormat.formatRemainingTimeMs(-5000)).toBe('0s');
    });

    it('formats seconds only', () =>
    {
        expect(TimeFormat.formatRemainingTimeMs(30_000)).toBe('30s');
    });

    it('floors partial seconds', () =>
    {
        expect(TimeFormat.formatRemainingTimeMs(1_500)).toBe('1s');
    });

    it('formats minutes and seconds', () =>
    {
        const ms: number = (2 * 60 + 45) * 1000;
        expect(TimeFormat.formatRemainingTimeMs(ms)).toBe('2m 45s');
    });

    it('formats 0 seconds correctly within minutes', () =>
    {
        const ms: number = 3 * 60 * 1000;
        expect(TimeFormat.formatRemainingTimeMs(ms)).toBe('3m 0s');
    });

    it('formats hours, minutes, and seconds', () =>
    {
        const ms: number = (3 * 3600 + 15 * 60 + 5) * 1000;
        expect(TimeFormat.formatRemainingTimeMs(ms)).toBe('3h 15m 5s');
    });

    it('formats days, hours, minutes, and seconds', () =>
    {
        const ms: number = (2 * 86400 + 4 * 3600 + 30 * 60 + 10) * 1000;
        expect(TimeFormat.formatRemainingTimeMs(ms)).toBe('2d 4h 30m 10s');
    });

    it('formats 59 minutes 59 seconds without tipping into hours', () =>
    {
        const ms: number = (59 * 60 + 59) * 1000;
        expect(TimeFormat.formatRemainingTimeMs(ms)).toBe('59m 59s');
    });
});
