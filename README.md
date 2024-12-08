# Sortable NanoID

A customizable, time-based, sortable ID generator that combines timestamps with random strings. Perfect for distributed systems where chronological ordering is important.

## Features

- ⚡ **Time-based Sorting**: Generated IDs are naturally sortable by creation time
- 🔧 **Highly Configurable**: Customize alphabet, length, timestamp precision, and more
- 🌍 **Time Range Control**: Set start/end dates to optimize ID length for your needs
- 🔄 **Collision Handling**: Guarantees unique IDs even when generated in the same timestamp
- 🔒 **Secure**: Uses cryptographically secure random number generation
- 📊 **Decodable**: Extract timestamp information from generated IDs

## Installation

```bash
npm install sortable-nanoid
```

## Quick Start

```typescript
import { SortableIDGenerator } from 'sortable-nanoid';

// Create a generator with default settings
const generator = new SortableIDGenerator();

// Generate a sortable ID
const id = await generator.generate();
console.log('Generated ID:', id);

// Decode the timestamp from an ID
const decoded = generator.decode(id);
console.log('Timestamp:', decoded.timestamp);
```

## Configuration

The generator can be customized with various options:

```typescript
const generator = new SortableIDGenerator({
    // Custom alphabet (must be sorted)
    alphabet: '0123456789ABCDEF',
    
    // Total length of generated IDs
    totalLength: 20,
    
    // Length of timestamp portion
    timestampLength: 10,
    
    // Start date for timestamp calculation
    timestampStart: new Date(2024, 0, 1),
    
    // End date for timestamp calculation
    timestampEnd: new Date(2124, 0, 1),
    
    // Timestamp precision level
    timestampLevel: 'millisecond'
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `alphabet` | string | `0-9a-zA-Z-_` | Characters used in ID generation |
| `totalLength` | number | 31 | Total length of generated IDs |
| `timestampLength` | number | 10 | Length of timestamp portion |
| `timestampStart` | Date | 2024-01-01 | Start date for timestamp calculation |
| `timestampEnd` | Date | - | End date for timestamp calculation |
| `timestampLevel` | TimestampLevel | 'millisecond' | Timestamp precision |

### Timestamp Levels

Available precision levels for timestamps:
- `nanosecond`
- `microsecond`
- `millisecond`
- `second`
- `minute`
- `hour`
- `day`
- `month`
- `year`

## Examples

### Basic Usage with Default Settings

```typescript
const generator = new SortableIDGenerator();
const id = await generator.generate();
```

### Custom Alphabet and Length

```typescript
const hexGenerator = new SortableIDGenerator({
    alphabet: '0123456789ABCDEF',
    totalLength: 20,
    timestampLength: 10
});
```

### Future-Proof IDs

```typescript
const futureGenerator = new SortableIDGenerator({
    timestampStart: new Date(2024, 0, 1),
    timestampEnd: new Date(2124, 0, 1), // 100 years
    timestampLevel: 'day'
});
```

### High-Precision Timestamps

```typescript
const preciseGenerator = new SortableIDGenerator({
    timestampLevel: 'nanosecond',
    timestampLength: 12
});
```

### Short IDs

```typescript
const shortGenerator = new SortableIDGenerator({
    totalLength: 12,
    timestampLength: 6,
    timestampLevel: 'minute'
});
```

## API Reference

### `generate()`

Generates a new sortable ID.

```typescript
const id = await generator.generate();
```

### `decode(id: string)`

Decodes a generated ID back into its timestamp and random components.

```typescript
const { timestamp, random } = generator.decode(id);
```

### `getMaxDate()`

Returns the maximum date supported by the current configuration.

```typescript
const maxDate = generator.getMaxDate();
```

### `printInfo()`

Prints and returns the current configuration details.

```typescript
const info = generator.printInfo();
```

## Best Practices

1. Choose an appropriate `timestampLevel` based on your needs:
   - Use `millisecond` for general purposes
   - Use `nanosecond` for high-frequency ID generation
   - Use `day` or `month` for long-term identifiers

2. Set appropriate `timestampStart` and `timestampEnd` dates to optimize ID length

3. Ensure `totalLength` is sufficient for your random portion needs

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
