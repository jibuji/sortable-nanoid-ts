# Sortable NanoID (Go Implementation)

A customizable, time-based, sortable ID generator that combines timestamps with chronological and random parts. Perfect for distributed systems where chronological ordering and high generation rates are important.

## Features

- ⚡ **Time-based Sorting**: Generated IDs are naturally sortable by creation time
- 🔧 **Highly Configurable**: Customize alphabet, length, timestamp precision, and generation rate
- 🌍 **Time Range Control**: Set start/end dates to optimize ID length for your needs
- 🔄 **Stable High-Rate Generation**: Guarantees stable, sortable IDs even at high generation rates
- 🔒 **Secure**: Uses cryptographically secure random number generation
- 📊 **Decodable**: Extract timestamp and chronological information from generated IDs
- 🔄 **Thread-Safe**: Safe for concurrent use

## Installation

```bash
go get github.com/jibuji/sortable-nanoid-go
```

## Quick Start

```go
package main

import (
    "fmt"
    sortablenano "github.com/jibuji/sortable-nanoid-go"
)

func main() {
    // Create a generator with default settings
    generator, err := sortablenano.New(sortablenano.DefaultConfig())
    if err != nil {
        panic(err)
    }

    // Generate a sortable ID
    id, err := generator.Generate()
    if err != nil {
        panic(err)
    }
    fmt.Printf("Generated ID: %s\n", id)

    // Decode the timestamp from an ID
    timestamp, chronoPart, randomPart, err := generator.Decode(id)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Timestamp: %v, Chrono Part: %s, Random Part: %s\n", timestamp, chronoPart, randomPart)
}
```

## Configuration

The generator can be customized with various options:

```go
config := sortablenano.Config{
    // Custom alphabet
    Alphabet: "0123456789ABCDEF",
    
    // Total length of generated IDs
    TotalLength: 20,
    
    // Start date for timestamp calculation
    TimestampStart: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
    
    // End date for timestamp calculation (optional, defaults to 10000 years after start)
    TimestampEnd: &endDate,
    
    // Timestamp precision level
    TimestampLevel: sortablenano.Millisecond,
    
    // Maximum generation rate at which IDs remain stable and sortable
    GenerationRate: sortablenano.MilliHigh,
}

generator, err := sortablenano.New(config)
```

### Generation Rates

Available generation rates (choose based on your requirements):
- `NanoHigh`: 10 generations per nanosecond
- `NanoNormal`: 1 generation per nanosecond
- `MicroHigh`: 100 generations per microsecond
- `MicroNormal`: 10 generations per microsecond
- `MicroLow`: 1 generation per microsecond
- `MilliHigh`: 10 generations per millisecond
- `MilliNormal`: 1 generation per millisecond
- `SecondHigh`: 100 generations per second
- `SecondNormal`: 10 generations per second

The generator will automatically calculate the required internal lengths to maintain stable, sortable IDs at the specified generation rate.

### Timestamp Levels

Available precision levels for timestamps:
- `Nanosecond`
- `Microsecond`
- `Millisecond`
- `Second`
- `Minute`
- `Hour`
- `Day`
- `Month`
- `Year`

## Examples

### Basic Usage with Default Settings

```go
generator, _ := sortablenano.New(sortablenano.DefaultConfig())
id, _ := generator.Generate()
```

### High-Rate Generation

```go
config := sortablenano.Config{
    TimestampLevel: sortablenano.Microsecond,
    GenerationRate: sortablenano.MicroHigh, // 100 IDs per microsecond
    TotalLength: 32,
}
generator, _ := sortablenano.New(config)
```

### Long-Term IDs

```go
endDate := time.Date(2124, 1, 1, 0, 0, 0, 0, time.UTC)
config := sortablenano.Config{
    TimestampStart: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
    TimestampEnd: &endDate,
    TimestampLevel: sortablenano.Day,
    GenerationRate: sortablenano.SecondHigh,
}
generator, _ := sortablenano.New(config)
```

### Short IDs

```go
config := sortablenano.Config{
    TotalLength: 16,
    TimestampLevel: sortablenano.Minute,
    GenerationRate: sortablenano.SecondNormal,
}
generator, _ := sortablenano.New(config)
```

## Best Practices

1. Choose an appropriate `TimestampLevel` based on your sorting needs:
   - Use `Millisecond` for general purposes
   - Use `Nanosecond` for high-precision timestamps
   - Use `Day` or `Month` for long-term identifiers

2. Set `GenerationRate` based on your maximum expected generation rate:
   - Higher rates require more space in the ID
   - Choose a rate that comfortably exceeds your peak requirements

3. Set appropriate `TimestampStart` and `TimestampEnd` dates to optimize ID length

4. Ensure `TotalLength` is sufficient for your chosen configuration

## Thread Safety

The generator is thread-safe and can be safely used concurrently from multiple goroutines.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 