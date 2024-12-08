import { SortableIDGenerator } from '../src/sortable-id';

async function runExamples() {
    // Example 1: Basic usage
    console.log('\nExample 1: Basic Usage');
    const basicGenerator = new SortableIDGenerator();
    const basicId = await basicGenerator.generate();
    console.log('Basic ID:', basicId);
    const decoded = basicGenerator.decode(basicId);
    console.log('Decoded:', decoded);
    basicGenerator.printInfo();

    // Example 2: Custom alphabet and length
    console.log('\nExample 2: Custom Alphabet and Length');
    const hexGenerator = new SortableIDGenerator({
        alphabet: '0123456789ABCDEF',
        totalLength: 20,
        timestampLength: 10
    });
    const hexId = await hexGenerator.generate();
    console.log('Hex ID:', hexId);
    console.log('Decoded:', hexGenerator.decode(hexId));
    console.log('Max supported date:', hexGenerator.getMaxDate());
    hexGenerator.printInfo();

    // Example 3: Custom timespan
    console.log('\nExample 3: Custom Timespan');
    const futureGenerator = new SortableIDGenerator({
        timestampStart: new Date(2024, 0, 1),
        timestampEnd: new Date(2124, 0, 1), // 100 years
        timestampLevel: 'day'
    });
    const futureId = await futureGenerator.generate();
    console.log('Future-proof ID:', futureId);
    console.log('Decoded:', futureGenerator.decode(futureId));
    futureGenerator.printInfo();

    // Example 4: High precision timestamp
    console.log('\nExample 4: High Precision');
    const preciseGenerator = new SortableIDGenerator({
        timestampLevel: 'nanosecond',
        timestampLength: 11
    });
    const preciseId = await preciseGenerator.generate();
    console.log('High-precision ID:', preciseId);
    console.log('Decoded:', preciseGenerator.decode(preciseId));
    preciseGenerator.printInfo();

    // Example 5: Short IDs
    console.log('\nExample 5: Short IDs');
    const shortGenerator = new SortableIDGenerator({
        totalLength: 12,
        timestampLength: 6,
        timestampLevel: 'minute'
    });
    const shortId = await shortGenerator.generate();
    console.log('Short ID:', shortId);
    console.log('Decoded:', shortGenerator.decode(shortId));
    shortGenerator.printInfo();

    // Example 6: Collision handling
    console.log('\nExample 6: Collision Handling');
    const collisionGenerator = new SortableIDGenerator({
        totalLength: 16,
        timestampLength: 8
    });
    
    // Generate multiple IDs quickly to demonstrate collision handling
    const ids = await Promise.all(
        Array.from({ length: 5 }, () => collisionGenerator.generate())
    );
    console.log('Multiple IDs generated quickly:');
    ids.forEach(id => console.log(id));
}

// Run examples
runExamples().catch(console.error);



