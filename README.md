# Sortable NanoID

A customizable, time-based, sortable ID generator that combines timestamps with chronological counters. Perfect for distributed systems where chronological ordering and high-frequency ID generation are important.

## Features

- ⚡ **Time-based Sorting**: Generated IDs are naturally sortable by creation time
- 🎯 **Configurable Generation Rate**: Set maximum generation rate from 10/nanosecond to 1/second
- 🔧 **Highly Customizable**: Configure alphabet, length, timestamp precision, and more
- 🌍 **200-Year Range**: Built-in support for 200 years from start date
- 🔄 **Chronological Counter**: Ensures uniqueness and sortability even at high generation rates
- 🔒 **Secure**: Uses cryptographically secure random number generation
- 📊 **Decodable**: Extract timestamp and counter information from generated IDs

## Installation

```bash
npm install sortable-nanoid
```

## Quick Start

```typescript
import { SortableIDGenerator, MaxSortableRate } from 'sortable-nanoid';

// Create a generator with default settings
const generator = new SortableIDGenerator();

// Generate a sortable ID
const id = generator.generate();
console.log('Generated ID:', id);

// Decode the timestamp from an ID
const decoded = generator.decode(id);
console.log('Timestamp:', decoded.timestamp);
console.log('Chrono Part:', decoded.chronoPart);
console.log('Machine ID:', decoded.machineId);
```

## Configuration

The generator can be customized with various options:

```typescript
const generator = new SortableIDGenerator({
    // Custom alphabet (must be sorted)
    alphabet: '0123456789ABCDEF',
    
    // Total length of generated IDs
    totalLength: 20,
    
    // Start date for timestamp calculation (default: 2024-01-01)
    timestampStart: new Date(2024, 0, 1),
    
    // Maximum generation rate
    maxSortableRate: MaxSortableRate.Micro100,
    
    // Timestamp precision level
    timestampLevel: 'millisecond'
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `alphabet` | string | `0-9a-zA-Z-_` | Characters used in ID generation |
| `totalLength` | number | 32 | Total length of generated IDs |
| `timestampStart` | Date | 2024-01-01 | Start date for timestamp calculation |
| `maxSortableRate` | MaxSortableRate | Micro1 | Maximum ID generation rate |
| `timestampLevel` | TimestampLevel | 'millisecond' | Timestamp precision |

### Generation Rates (MaxSortableRate)

Available generation rates:
- `Micro100`: 100 generations per microsecond
- `Micro1`: 1 generation per microsecond
- `Milli10`: 10 generations per millisecond
- `Second100`: 100 generations per second
- `Second1`: 1 generation per second

### Timestamp Levels

Available precision levels for timestamps:
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
const id = generator.generate();
```

### High-Frequency Generation

```typescript
const highFreqGenerator = new SortableIDGenerator({
    maxSortableRate: MaxSortableRate.Micro100,
    timestampLevel: 'millisecond'
});

// Generate IDs at high frequency
const id = highFreqGenerator.generate();
```

### Day-Level Timestamp with Low Rate

```typescript
const dayGenerator = new SortableIDGenerator({
    timestampLevel: 'day',
    maxSortableRate: MaxSortableRate.Second1
});

const id = dayGenerator.generate();
```

### Short IDs with Minute Precision

```typescript
const shortGenerator = new SortableIDGenerator({
    totalLength: 16,
    timestampLevel: 'minute',
    maxSortableRate: MaxSortableRate.Second1
});

const id = shortGenerator.generate();
```

### Custom Alphabet

```typescript
const hexGenerator = new SortableIDGenerator({
    alphabet: '0123456789ABCDEF',
    totalLength: 20,
    maxSortableRate: MaxSortableRate.Second100
});

const id = hexGenerator.generate();
```

## ID Structure

Each generated ID consists of three parts:
1. **Timestamp Part**: Encodes the time since `timestampStart`
2. **Chrono Part**: Counter that increments when multiple IDs are generated in the same timestamp
3. **Machine ID Part**: Random part that ensures uniqueness across different machines

The length of each part is automatically calculated based on your configuration:
- Timestamp length is determined by the time range (200 years) and timestamp level
- Chrono length is determined by the maxSortableRate
- Machine ID takes the remaining length

## Error Handling

The generator will throw errors in these cases:
- Generation rate exceeded (when generating IDs faster than configured rate)
- Current time exceeds maximum supported timestamp
- Invalid configuration (alphabet, length, etc.)

Example:
```typescript
try {
    const id = generator.generate();
} catch (error) {
    if (error.message.includes('Generation rate exceeded')) {
        // Handle rate limit error
    }
}
```

## Best Practices

1. Choose appropriate `maxSortableRate` based on your needs:
   - Use higher rates (`Micro100`) for high-frequency generation
   - Use lower rates (`Second1`, `Second100`) for normal applications
   - Higher rates require more characters for the chrono part

2. Select `timestampLevel` based on your precision requirements:
   - Use `millisecond` for high-precision timestamps
   - Use `minute` or `hour` for longer IDs with less precision
   - Lower precision levels result in shorter timestamp parts

3. Set appropriate `totalLength`:
   - Must be sufficient for timestamp + chrono + machine ID parts
   - Longer IDs allow for higher generation rates and longer time ranges
   - Consider your storage and bandwidth constraints

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
