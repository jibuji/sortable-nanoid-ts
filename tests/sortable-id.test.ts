import { jest } from '@jest/globals';
import { SortableIDGenerator, MaxSortableRate } from '../src/sortable-id';

describe('SortableIDGenerator', () => {
    it('should generate sortable IDs', () => {
        const generator = new SortableIDGenerator();
        const ids = Array.from({ length: 10 }, () => generator.generate());
        const sortedIds = [...ids].sort();
        expect(ids).toEqual(sortedIds);
    });

    it('should decode timestamps and chrono parts correctly', () => {
        const generator = new SortableIDGenerator();
        const id = generator.generate();
        const decoded = generator.decode(id);
        expect(decoded.timestamp).toBeInstanceOf(Date);
        expect(Math.abs(decoded.timestamp.getTime() - new Date().getTime())).toBeLessThan(1000);
        expect(decoded.chronoPart).toBeDefined();
        expect(decoded.chronoPart.length).toBeGreaterThan(0);
    });

    it('should respect custom alphabet', () => {
        const generator = new SortableIDGenerator({
            alphabet: '0123456789',
            totalLength: 30,
            maxSortableRate: MaxSortableRate.Second100
        });
        const id = generator.generate();
        expect(id).toMatch(/^[0-9]+$/);
        expect(id.length).toBe(30);
    });

    it('should handle custom timestamp levels', () => {
        const generator = new SortableIDGenerator({
            timestampLevel: 'day',
            maxSortableRate: MaxSortableRate.Second1
        });
        const id1 = generator.generate();
        const id2 = generator.generate();
        expect(id1.slice(0, generator['timestampLength']))
            .toBe(id2.slice(0, generator['timestampLength']));
    });

    it('should handle rapid sequential generation with chrono part', () => {
        const generator = new SortableIDGenerator({
            maxSortableRate: MaxSortableRate.Micro100
        });

        // Mock Date to ensure same timestamp
        const fixedDate = new Date('2024-02-20T12:00:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(fixedDate);

        // Generate multiple IDs at the same timestamp
        const ids: string[] = [];
        for (let i = 0; i < 100; i++) {
            ids.push(generator.generate());
        }

        // Verify they're sorted
        const sortedIds = [...ids].sort();
        expect(ids).toEqual(sortedIds);

        // Verify all timestamps are the same but chrono parts are different
        const timestampPart = ids[0].slice(0, generator['timestampLength']);
        expect(ids.every(id => id.slice(0, generator['timestampLength']) === timestampPart)).toBe(true);
        
        // Get all chrono parts
        const chronoParts = ids.map(id => 
            id.slice(generator['timestampLength'], generator['timestampLength'] + generator['chronoLength'])
        );
        
        // Verify chrono parts are unique and increasing
        const uniqueChronoParts = new Set(chronoParts);
        expect(uniqueChronoParts.size).toBe(chronoParts.length);
        expect([...chronoParts].sort()).toEqual(chronoParts);

        jest.useRealTimers();
    });

    it('should handle different MaxSortableRate values', () => {
        const rates = [
            MaxSortableRate.Micro100,
            MaxSortableRate.Micro1,
            MaxSortableRate.Milli10,
            MaxSortableRate.Second100,
            MaxSortableRate.Second1
        ];

        for (const rate of rates) {
            const generator = new SortableIDGenerator({
                maxSortableRate: rate,
                timestampLevel: 'millisecond'
            });

            // Generate a few IDs
            const ids: string[] = [];
            for (let i = 0; i < 5; i++) {
                ids.push(generator.generate());
            }

            // Verify they're sorted
            const sortedIds = [...ids].sort();
            expect(ids).toEqual(sortedIds);

            // Verify chrono length is appropriate for the rate
            const info = generator.printInfo();
            expect(info.chronoLength).toBeGreaterThan(0);
            expect(info.maxSortableRate).toBe(rate);
        }
    });
});