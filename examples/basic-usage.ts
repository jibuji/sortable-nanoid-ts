import { SortableIDGenerator, MaxSortableRate } from '../src/sortable-id';

function runExamples() {
    try {
        // Example 1: Basic usage
        console.log('\nExample 1: Basic Usage');
        const basicGenerator = new SortableIDGenerator();
        const basicId = basicGenerator.generate();
        console.log('Basic ID:', basicId);
        const decoded = basicGenerator.decode(basicId);
        console.log('Decoded:', decoded);
        basicGenerator.printInfo();

        // Example 2: Custom alphabet and high generation rate
        console.log('\nExample 2: Custom Alphabet and High Generation Rate');
        const hexGenerator = new SortableIDGenerator({
            alphabet: '0123456789ABCDEF',
            totalLength: 20,
            maxSortableRate: MaxSortableRate.Micro100
        });
        const hexId = hexGenerator.generate();
        console.log('Hex ID:', hexId);
        console.log('Decoded:', hexGenerator.decode(hexId));
        hexGenerator.printInfo();

        // Example 3: Day-level timestamp with low rate
        console.log('\nExample 3: Day-level Timestamp');
        const dayGenerator = new SortableIDGenerator({
            timestampLevel: 'day',
            maxSortableRate: MaxSortableRate.Second1
        });
        const dayId = dayGenerator.generate();
        console.log('Day-level ID:', dayId);
        console.log('Decoded:', dayGenerator.decode(dayId));
        dayGenerator.printInfo();

        // Example 4: High precision with nano-level rate
        console.log('\nExample 4: High Precision');
        const preciseGenerator = new SortableIDGenerator({
            timestampLevel: 'millisecond',
            maxSortableRate: MaxSortableRate.Micro100
        });
        const preciseId = preciseGenerator.generate();
        console.log('High-precision ID:', preciseId);
        console.log('Decoded:', preciseGenerator.decode(preciseId));
        preciseGenerator.printInfo();

        // Example 5: Short IDs with minute-level precision
        console.log('\nExample 5: Short IDs');
        const shortGenerator = new SortableIDGenerator({
            totalLength: 16,
            timestampLevel: 'minute',
            maxSortableRate: MaxSortableRate.Second1
        });
        const shortId = shortGenerator.generate();
        console.log('Short ID:', shortId);
        console.log('Decoded:', shortGenerator.decode(shortId));
        shortGenerator.printInfo();

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

runExamples();



