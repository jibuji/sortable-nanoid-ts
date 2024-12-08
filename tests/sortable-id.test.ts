import { jest } from '@jest/globals';
import { SortableIDGenerator } from '../src/sortable-id';

describe('SortableIDGenerator', () => {
    it('should generate sortable IDs', async () => {
        const generator = new SortableIDGenerator();
        const ids = await Promise.all(
            Array.from({ length: 10 }, () => generator.generate())
        );
        const sortedIds = [...ids].sort();
        expect(ids).toEqual(sortedIds);
    });

    it('should decode timestamps correctly', async () => {
        const generator = new SortableIDGenerator();
        const id = await generator.generate();
        const decoded = generator.decode(id);
        expect(decoded.timestamp).toBeInstanceOf(Date);
        expect(Math.abs(decoded.timestamp.getTime() - new Date().getTime())).toBeLessThan(1000);
    });

    it('should respect custom alphabet', async () => {
        const generator = new SortableIDGenerator({
            alphabet: '0123456789',
            totalLength: 30,
            timestampLength: 15
        });
        const id = await generator.generate();
        expect(id).toMatch(/^[0-9]+$/);
        expect(id.length).toBe(30);
    });

    it('should handle custom timestamp levels', async () => {
        const generator = new SortableIDGenerator({
            timestampLevel: 'day'
        });
        const [id1, id2] = await Promise.all([
            generator.generate(),
            generator.generate()
        ]);
        expect(id1.slice(0, generator['timestampLength']))
            .toBe(id2.slice(0, generator['timestampLength']));
    });

    it('should generate sortable IDs even with same timestamp', async () => {
        const generator = new SortableIDGenerator({
            timestampLength: 8,
            totalLength: 16
        });

        // Mock Date to ensure same timestamp
        const fixedDate = new Date('2024-02-20T12:00:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(fixedDate);

        // Generate multiple IDs at the same timestamp
        const ids = await Promise.all(
            Array.from({ length: 100 }, () => generator.generate())
        );

        // Verify they're sorted
        const sortedIds = [...ids].sort();
        expect(ids).toEqual(sortedIds);

        // Verify all timestamps are the same but IDs are different
        const timestampPart = ids[0].slice(0, 8);
        expect(ids.every(id => id.slice(0, 8) === timestampPart)).toBe(true);
        expect(new Set(ids).size).toBe(ids.length);

        jest.useRealTimers();
    });

    it('should handle rapid sequential generation correctly', async () => {
        const generator = new SortableIDGenerator();
        const id1 = await generator.generate();
        const id2 = await generator.generate();
        const id3 = await generator.generate();

        expect(id1 < id2).toBe(true);
        expect(id2 < id3).toBe(true);
    });

    it('should handle concurrent generation correctly', async () => {
        const generator = new SortableIDGenerator();
        const results = await Promise.all([
            generator.generate(),
            generator.generate(),
            generator.generate(),
            generator.generate(),
            generator.generate()
        ]);

        // Check if array is sorted
        const isSorted = results.every((id, i) => 
            i === 0 || results[i-1] < id
        );
        expect(isSorted).toBe(true);
    });

    it('should handle timestamp collisions by incrementing random part', async () => {
        const generator = new SortableIDGenerator({
            timestampLength: 8,
            totalLength: 16
        });

        // Mock Date to ensure same timestamp
        const fixedDate = new Date('2024-02-20T12:00:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(fixedDate);

        // Generate two IDs at exactly the same timestamp
        const id1 = await generator.generate();
        const id2 = await generator.generate();

        // Verify timestamp parts are identical
        expect(id1.slice(0, 8)).toBe(id2.slice(0, 8));
        
        // Verify second ID is greater than first
        expect(id2 > id1).toBe(true);

        // Verify they differ only in the random part
        expect(id1.slice(8)).not.toBe(id2.slice(8));

        jest.useRealTimers();
    });

    it('should handle random part overflow correctly', async () => {
        const generator = new SortableIDGenerator({
            alphabet: '01',  // Binary alphabet for easier testing
            totalLength: 43,
            timestampLength: 40,
        });

        // Mock Date
        const fixedDate = new Date('2024-02-20T12:00:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(fixedDate);

        // Generate enough IDs to cause overflow
        const ids = [];
        for (let i = 0; i < 5; i++) {
            ids.push(await generator.generate());
        }

        // Verify all IDs are unique and sorted
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
        expect([...ids].sort()).toEqual(ids);
        console.log(ids);
        jest.useRealTimers();
    });

 

    it('should handle dates beyond JavaScript max date', () => {
        const generator = new SortableIDGenerator({
            timestampStart: new Date(2024, 0, 1),
            totalLength: 48,
            timestampLength: 32,  // Very large timestamp length to force overflow
            timestampLevel: 'year'
        });

        const maxDate = generator.getMaxDate();
        expect(maxDate.getTime()).toBe(8640000000000000);
        expect(maxDate.toISOString()).toBe('+275760-09-13T00:00:00.000Z');
    });

    it('should return correct max date for normal ranges', () => {
        const generator = new SortableIDGenerator({
            timestampStart: new Date(2024, 0, 1),
            timestampEnd: new Date(2124, 0, 1),  // 100 years
            timestampLevel: 'day'
        });

        const maxDate = generator.getMaxDate();
        expect(maxDate.getTime()).toBeLessThan(8640000000000000);
        expect(maxDate.getFullYear()).toBe(2124);
    });
});