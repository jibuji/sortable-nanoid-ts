package sortablenano

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// TimestampLevel represents the precision level for timestamps
type TimestampLevel string

const (
	Nanosecond  TimestampLevel = "nanosecond"
	Microsecond TimestampLevel = "microsecond"
	Millisecond TimestampLevel = "millisecond"
	Second      TimestampLevel = "second"
	Minute      TimestampLevel = "minute"
	Hour        TimestampLevel = "hour"
	Day         TimestampLevel = "day"
	Month       TimestampLevel = "month"
	Year        TimestampLevel = "year"
)

// MaxSortableRate represents how many IDs can be generated in a time unit
type MaxSortableRate string

const (
	Nano10    MaxSortableRate = "10_per_nanosecond"   // 10 generations per nanosecond
	Micro100  MaxSortableRate = "100_per_microsecond" // 100 generations per microsecond
	Micro1    MaxSortableRate = "1_per_microsecond"   // 1 generation per microsecond
	Milli10   MaxSortableRate = "10_per_millisecond"  // 10 generations per millisecond
	Second100 MaxSortableRate = "100_per_second"      // 100 generations per second
	Second1   MaxSortableRate = "1_per_second"        // 1 generation per second
)

// Config represents the configuration for the ID generator
type Config struct {
	Alphabet        string
	TotalLength     int
	TimestampStart  time.Time
	TimestampEnd    *time.Time
	TimestampLevel  TimestampLevel
	MaxSortableRate MaxSortableRate
}

// Generator represents a sortable ID generator
type Generator struct {
	alphabet               string
	base                   int
	totalLength            int
	timestampStart         time.Time
	timestampLength        int
	timestampLevel         TimestampLevel
	chronoLength           int
	maxTimestamp           int64
	maxAllowedTime         time.Time
	maxSortableRate        MaxSortableRate
	mu                     sync.Mutex
	lastTimeSpan           int64
	lastID                 string
	lastChronoPart         string
	overflowedChronoRandom string
	overflowedChrono       string

	// Character pool for random part generation
	charPool   []byte
	poolOffset int
	poolSize   int
	mask       byte
}

// GeneratorInfo contains the configuration information of the generator
type GeneratorInfo struct {
	TimestampLength int
	StartDate       time.Time
	EndDate         time.Time
	TimestampLevel  TimestampLevel
	Alphabet        string
	TotalLength     int
	ChronoLength    int
	MachineIDLength int
	MaxSortableRate MaxSortableRate
}

// DefaultConfig returns the default configuration
func DefaultConfig() Config {
	return Config{
		Alphabet:        "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_",
		TotalLength:     32,
		TimestampStart:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		TimestampLevel:  Microsecond,
		MaxSortableRate: Micro100,
	}
}

// New creates a new Generator with the given configuration
func New(cfg Config) (*Generator, error) {
	if cfg.Alphabet == "" {
		cfg.Alphabet = DefaultConfig().Alphabet
	}
	if len(cfg.Alphabet) > 255 {
		return nil, errors.New("alphabet must contain no more than 255 chars")
	}
	if cfg.TotalLength == 0 {
		cfg.TotalLength = DefaultConfig().TotalLength
	}
	if cfg.TimestampStart.IsZero() {
		cfg.TimestampStart = DefaultConfig().TimestampStart
	}
	if cfg.TimestampLevel == "" {
		cfg.TimestampLevel = DefaultConfig().TimestampLevel
	}
	if cfg.MaxSortableRate == "" {
		cfg.MaxSortableRate = DefaultConfig().MaxSortableRate
	}
	// Validate configuration
	if err := validateConfig(cfg); err != nil {
		return nil, err
	}

	// If TimestampEnd not specified, use 10000 years after start
	if cfg.TimestampEnd == nil {
		end := cfg.TimestampStart.AddDate(10000, 0, 0)
		cfg.TimestampEnd = &end
	}

	fmt.Println("cfg.Alphabet:", cfg.Alphabet)
	// Calculate required lengths
	timestampLength := calculateTimestampLength(len(cfg.Alphabet), cfg.TimestampStart, *cfg.TimestampEnd, cfg.TimestampLevel)
	chronoLength := calculateChronoLength(len(cfg.Alphabet), cfg.MaxSortableRate, cfg.TimestampLevel)

	// Validate total length is sufficient
	requiredLength := timestampLength + chronoLength + 1 // At least 1 char for random part
	if cfg.TotalLength < requiredLength {
		return nil, fmt.Errorf("total length must be at least %d (timestamp: %d, chrono: %d, minimum random: 1)",
			requiredLength, timestampLength, chronoLength)
	}
	// sort alphabet
	alphabet := sortAlphabet(cfg.Alphabet)
	g := &Generator{
		alphabet:        alphabet,
		base:            len(alphabet),
		totalLength:     cfg.TotalLength,
		timestampStart:  cfg.TimestampStart,
		timestampLength: timestampLength,
		timestampLevel:  cfg.TimestampLevel,
		chronoLength:    chronoLength,
		poolSize:        1024,
		maxSortableRate: cfg.MaxSortableRate,
	}

	// Initialize overflow strings
	g.overflowedChrono = strings.Repeat(string(g.alphabet[0]), g.chronoLength)
	g.overflowedChronoRandom = strings.Repeat(string(g.alphabet[0]),
		g.totalLength-g.timestampLength)

	// Calculate max timestamp
	g.maxTimestamp = g.calculateMaxTimestamp()

	// Initialize character pool
	g.charPool = make([]byte, g.poolSize)
	g.mask = getMask(len(g.alphabet))
	g.fillCharPool()
	g.maxAllowedTime = time.Unix(1<<62, 0)
	return g, nil
}

func sortAlphabet(alphabet string) string {
	chars := []rune(alphabet)
	sort.Slice(chars, func(i, j int) bool {
		return chars[i] < chars[j]
	})
	return string(chars)
}

func validateConfig(cfg Config) error {
	if len(cfg.Alphabet) < 2 {
		return errors.New("alphabet must contain at least 2 characters")
	}

	// Check for duplicate characters
	seen := make(map[rune]bool)
	for _, r := range cfg.Alphabet {
		if seen[r] {
			return errors.New("alphabet must contain unique characters")
		}
		seen[r] = true
	}

	if cfg.TimestampEnd != nil && cfg.TimestampEnd.Before(cfg.TimestampStart) {
		return errors.New("end date cannot be before start date")
	}

	if cfg.MaxSortableRate == "" {
		cfg.MaxSortableRate = DefaultConfig().MaxSortableRate
	}

	return nil
}

// Generate generates a new sortable ID
func (g *Generator) Generate() (string, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now()
	timespan := g.getTimespan(now)

	if timespan >= g.maxTimestamp {
		return "", errors.New("current time exceeds maximum supported timestamp, \n" +
			"please increase the timestamp length or use a different timestamp level, \n" +
			"current timestamp length: " + strconv.Itoa(g.timestampLength) + ", \n" +
			"current timestamp level: " + string(g.timestampLevel))
	}

	if timespan == g.lastTimeSpan {
		// Try incrementing chrono part first
		if g.lastChronoPart == "" {
			g.lastChronoPart = strings.Repeat(string(g.alphabet[0]), g.chronoLength)
		}

		chronoPart := g.incrementSymbols(g.lastChronoPart)
		if chronoPart != g.overflowedChrono {
			// Chrono part increment successful
			g.lastChronoPart = chronoPart
			randomPart := g.generateRandomPart()
			g.lastID = g.lastID[:g.timestampLength] + chronoPart + randomPart
			return g.lastID, nil
		}

		// Chrono part overflowed, try incrementing ( chrono part + random part )
		chronoRandomPart := g.lastID[g.timestampLength:]
		incremented := g.incrementSymbols(chronoRandomPart)
		if incremented != g.overflowedChronoRandom {
			g.lastID = g.lastID[:g.timestampLength] + incremented
			return g.lastID, nil
		}

		// If we've overflowed both parts, wait for next timestamp
		return "", errors.New("too many ids generated in a short period of time, \n" +
			"please slow down the generation rate, increase the chrono length, decrease the timestamp level or increase the total length, \n" +
			"current timestamp level: " + string(g.timestampLevel) + ", \n" +
			"current total length: " + strconv.Itoa(g.totalLength))
	}

	// New timestamp
	g.lastTimeSpan = timespan
	timestampPart := g.encodeTimestamp(timespan)
	g.lastChronoPart = g.overflowedChrono
	randomPart := g.generateRandomPart()
	g.lastID = timestampPart + g.lastChronoPart + randomPart

	return g.lastID, nil
}

// Decode decodes a generated ID back into its timestamp and random components
func (g *Generator) Decode(id string) (time.Time, string, string, error) {
	if len(id) != g.totalLength {
		return time.Time{}, "", "", errors.New("invalid ID length")
	}

	// Validate characters
	for _, c := range id {
		if !strings.ContainsRune(g.alphabet, c) {
			return time.Time{}, "", "", errors.New("ID contains invalid characters")
		}
	}

	timestampPart := id[:g.timestampLength]
	chronoPart := id[g.timestampLength : g.timestampLength+g.chronoLength]
	randomPart := id[g.timestampLength+g.chronoLength:]

	var timestamp int64
	for _, c := range timestampPart {
		timestamp = timestamp*int64(g.base) + int64(strings.IndexRune(g.alphabet, c))
	}

	date := g.timestampStart.Add(g.getTimestampDuration() * time.Duration(timestamp))
	return date, chronoPart, randomPart, nil
}

func (g *Generator) getTimespan(t time.Time) int64 {
	duration := t.Sub(g.timestampStart)
	return int64(duration / g.getTimestampDuration())
}

func (g *Generator) getTimestampDuration() time.Duration {
	switch g.timestampLevel {
	case Nanosecond:
		return time.Nanosecond
	case Microsecond:
		return time.Microsecond
	case Millisecond:
		return time.Millisecond
	case Second:
		return time.Second
	case Minute:
		return time.Minute
	case Hour:
		return time.Hour
	case Day:
		return 24 * time.Hour
	case Month:
		return 30 * 24 * time.Hour // Approximate
	case Year:
		return 365 * 24 * time.Hour // Approximate
	default:
		return time.Nanosecond
	}
}

func (g *Generator) calculateMaxTimestamp() int64 {
	return int64(math.Pow(float64(g.base), float64(g.timestampLength)))
}

func (g *Generator) encodeTimestamp(timestamp int64) string {
	if timestamp == 0 {
		return strings.Repeat(string(g.alphabet[0]), g.timestampLength)
	}

	var result strings.Builder
	result.Grow(g.timestampLength)

	// Convert to base-N
	remaining := timestamp
	for i := 0; i < g.timestampLength; i++ {
		idx := remaining % int64(g.base)
		result.WriteByte(g.alphabet[idx])
		remaining /= int64(g.base)
	}

	// Reverse the string
	runes := []rune(result.String())
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}

	return string(runes)
}

func (g *Generator) fillCharPool() {
	_, err := rand.Read(g.charPool)
	if err != nil {
		// Fallback to less secure but still usable random
		for i := range g.charPool {
			g.charPool[i] = g.alphabet[time.Now().UnixNano()%int64(len(g.alphabet))]
		}
	}
	g.poolOffset = 0
}

func (g *Generator) getRandomChar() byte {
	g.poolOffset++
	if g.poolOffset >= len(g.charPool) {
		g.fillCharPool()
	}
	// Use modulo to map random bytes to alphabet indices, excluding the last char
	randomIndex := int(g.mask) & int(g.charPool[g.poolOffset])
	if randomIndex >= len(g.alphabet) {
		//try another random char
		return g.getRandomChar()
	}
	char := g.alphabet[randomIndex]
	return char
}

func (g *Generator) generateRandomPart() string {
	var result strings.Builder
	result.Grow(g.totalLength - g.timestampLength - g.chronoLength)

	for i := 0; i < g.totalLength-g.timestampLength-g.chronoLength; i++ {
		result.WriteByte(g.getRandomChar())
	}

	return result.String()
}

func (g *Generator) incrementSymbols(symbols string) string {
	chars := []byte(symbols)

	// Start from the end
	for i := len(chars) - 1; i >= 0; i-- {
		currentChar := chars[i]
		currentIndex := strings.IndexByte(g.alphabet, currentChar)

		// If not at max value, increment and return
		if currentIndex < len(g.alphabet)-1 {
			chars[i] = g.alphabet[currentIndex+1]
			return string(chars)
		}

		// If at max value, reset to first char and continue to next position
		chars[i] = g.alphabet[0]
	}

	// If we get here, we've overflowed
	return string(chars)
}

// GetMaxDate returns the maximum date supported by the current configuration
func (g *Generator) GetMaxDate() time.Time {
	duration := g.getTimestampDuration() * time.Duration(g.maxTimestamp)
	// check if duration is overflowed
	if duration < 0 {
		return g.maxAllowedTime
	}
	maxTime := g.timestampStart.Add(duration)

	// The maximum time that can be represented in Go, we don't use 1<<63-1 because it causes overflow in some golang versions
	if maxTime.After(g.maxAllowedTime) {
		return g.maxAllowedTime
	}

	return maxTime
}

// PrintInfo prints and returns the current configuration details
func (g *Generator) PrintInfo() GeneratorInfo {
	info := GeneratorInfo{
		TimestampLength: g.timestampLength,
		StartDate:       g.timestampStart,
		EndDate:         g.GetMaxDate(),
		TimestampLevel:  g.timestampLevel,
		Alphabet:        g.alphabet,
		TotalLength:     g.totalLength,
		ChronoLength:    g.chronoLength,
		MachineIDLength: g.totalLength - g.timestampLength - g.chronoLength,
		MaxSortableRate: g.maxSortableRate,
	}

	fmt.Println("\nID Generator Configuration:")
	fmt.Printf("Timestamp Length: %d symbols\n", info.TimestampLength)
	fmt.Printf("Start Date: %s\n", info.StartDate.Format(time.RFC3339))
	fmt.Printf("End Date: %s\n", info.EndDate.Format(time.RFC3339))
	fmt.Printf("Timestamp Level: %s\n", info.TimestampLevel)
	fmt.Printf("Chrono Length: %d symbols\n", info.ChronoLength)
	fmt.Printf("Machine ID Length: %d symbols\n", info.MachineIDLength)
	fmt.Printf("Alphabet (%d chars): %s\n", len(info.Alphabet), info.Alphabet)
	fmt.Printf("Total ID Length: %d symbols\n", info.TotalLength)
	fmt.Printf("Max Sortable Rate: %s\n", info.MaxSortableRate)
	return info
}

// getMask generates bit mask used to obtain bits from the random bytes that are used to get index of random character
// from the alphabet. Example: if the alphabet has 6 = (110)_2 characters it is sufficient to use mask 7 = (111)_2
func getMask(alphabetSize int) byte {
	for i := 1; i <= 8; i++ {
		mask := (2 << uint(i)) - 1
		if mask >= alphabetSize-1 {
			return byte(mask)
		}
	}
	return 0
}

func calculateChronoLength(base int, rate MaxSortableRate, level TimestampLevel) int {
	var idsPerSecond, multiplier float64

	// First determine base IDs per unit from generation rate
	switch rate {
	case Nano10:
		idsPerSecond = 10 * 1000 * 1000 * 1000
	case Micro100:
		idsPerSecond = 100 * 1000 * 1000
	case Micro1:
		idsPerSecond = 1 * 1000 * 1000
	case Milli10:
		idsPerSecond = 10 * 1000
	case Second100:
		idsPerSecond = 100
	case Second1:
		idsPerSecond = 1
	default:
		idsPerSecond = 1 * 1000 * 1000 // Default to MicroNormal
	}

	// Then adjust based on timestamp level
	switch level {
	case Year:
		multiplier = 365 * 24 * 60 * 60 // seconds in a year
	case Month:
		multiplier = 31 * 24 * 60 * 60 // seconds in a month
	case Day:
		multiplier = 24 * 60 * 60 // seconds in a day
	case Hour:
		multiplier = 60 * 60 // seconds in an hour
	case Minute:
		multiplier = 60 // seconds in a minute
	case Second:
		multiplier = 1 // seconds in a second
	case Millisecond:
		multiplier = 0.001 // milliseconds in a second
	case Microsecond:
		multiplier = 0.000001 // microseconds in a second
	case Nanosecond:
		multiplier = 0.000000001 // nanoseconds in a second
	default:
		multiplier = 1 // default to microsecond
	}

	// Calculate total IDs needed for this time unit
	totalIds := int64(idsPerSecond * multiplier)

	// Calculate required length to represent totalIds in the given base
	length := 1
	for b := base; totalIds/int64(b) > 0; b *= base {
		length++
	}
	return length
}

func calculateTimestampLength(base int, start time.Time, end time.Time, level TimestampLevel) int {
	duration := end.Sub(start)
	var units int64

	switch level {
	case Nanosecond:
		units = duration.Nanoseconds()
	case Microsecond:
		units = duration.Microseconds()
	case Millisecond:
		units = duration.Milliseconds()
	case Second:
		units = int64(duration.Seconds())
	case Minute:
		units = int64(duration.Minutes())
	case Hour:
		units = int64(duration.Hours())
	case Day:
		units = int64(duration.Hours() / 24)
	case Month:
		units = int64(duration.Hours() / 24 / 30) // Approximate
	case Year:
		units = int64(duration.Hours() / 24 / 365) // Approximate
	default:
		units = duration.Microseconds()
	}

	// Calculate required length to represent units in the given base
	length := 1
	baseInt64 := int64(base)

	// Use division to find the length, but protect against overflow
	remaining := units
	for remaining > 0 {
		remaining /= baseInt64
		if remaining > 0 {
			length++
		}
	}

	return length
}
