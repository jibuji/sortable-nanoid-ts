package sortablenano

import (
	"sort"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestGenerateSortableIDs(t *testing.T) {
	generator, err := New(DefaultConfig())
	if err != nil {
		t.Fatalf("Failed to create generator: %v", err)
	}

	// Generate multiple IDs
	ids := make([]string, 10)
	for i := range ids {
		id, err := generator.Generate()
		if err != nil {
			t.Fatalf("Failed to generate ID: %v", err)
		}
		ids[i] = id
	}

	// Verify they are sorted
	sortedIds := make([]string, len(ids))
	copy(sortedIds, ids)
	sort.Strings(sortedIds)

	for i := range ids {
		if ids[i] != sortedIds[i] {
			t.Errorf("IDs are not naturally sorted. Expected %v, got %v", sortedIds, ids)
			break
		}
	}
}

func TestDecodeTimestamp(t *testing.T) {
	generator, err := New(DefaultConfig())
	if err != nil {
		t.Fatalf("Failed to create generator: %v", err)
	}

	id, err := generator.Generate()
	if err != nil {
		t.Fatalf("Failed to generate ID: %v", err)
	}

	timestamp, _, _, err := generator.Decode(id)
	if err != nil {
		t.Fatalf("Failed to decode ID: %v", err)
	}

	// Verify timestamp is recent
	now := time.Now()
	diff := now.Sub(timestamp)
	if diff > time.Second {
		t.Errorf("Decoded timestamp is too old: %v", diff)
	}
}

func TestCustomAlphabet(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Alphabet = "0123456789"
	cfg.TotalLength = 30
	cfg.TimestampLevel = Second
	cfg.MaxSortableRate = Second100

	generator, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create generator: %v", err)
	}

	id, err := generator.Generate()
	if err != nil {
		t.Fatalf("Failed to generate ID: %v", err)
	}

	// Verify only numbers are used
	for _, c := range id {
		if c < '0' || c > '9' {
			t.Errorf("ID contains non-numeric character: %c", c)
		}
	}
}

func TestTimestampCollision(t *testing.T) {
	cfg := DefaultConfig()
	cfg.TotalLength = 16
	cfg.TimestampLevel = Millisecond
	cfg.MaxSortableRate = Milli10 // 10 IDs per millisecond

	generator, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create generator: %v", err)
	}

	// Generate multiple IDs quickly
	ids := make([]string, 100)
	var wg sync.WaitGroup
	var mu sync.Mutex

	for i := range ids {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			id, err := generator.Generate()
			if err != nil {
				t.Errorf("Failed to generate ID: %v", err)
				return
			}
			mu.Lock()
			ids[index] = id
			mu.Unlock()
		}(i)
	}

	wg.Wait()

	// Verify all IDs are unique
	seen := make(map[string]bool)
	for _, id := range ids {
		if seen[id] {
			t.Errorf("Duplicate ID found: %s", id)
		}
		seen[id] = true
	}
}

func TestInvalidConfigurations(t *testing.T) {
	tests := []struct {
		name        string
		config      Config
		expectError bool
	}{
		{
			name: "Empty alphabet",
			config: Config{
				Alphabet:    "",
				TotalLength: 20,
			},
			expectError: false, // Should use default alphabet
		},
		{
			name: "Single character alphabet",
			config: Config{
				Alphabet:    "a",
				TotalLength: 20,
			},
			expectError: true,
		},
		{
			name: "Duplicate characters in alphabet",
			config: Config{
				Alphabet:    "aabbcc",
				TotalLength: 20,
			},
			expectError: true,
		},
		{
			name: "TimestampLength greater than TotalLength",
			config: Config{
				Alphabet:        "0123456789",
				TotalLength:     10,
				TimestampLevel:  Day,
				MaxSortableRate: Second100,
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := New(tt.config)
			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}

func TestCustomTimestampLevel(t *testing.T) {
	cfg := DefaultConfig()
	cfg.TimestampLevel = Day

	generator, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create generator: %v", err)
	}

	// Generate two IDs in quick succession
	id1, err := generator.Generate()
	if err != nil {
		t.Fatalf("Failed to generate first ID: %v", err)
	}

	id2, err := generator.Generate()
	if err != nil {
		t.Fatalf("Failed to generate second ID: %v", err)
	}

	// Verify timestamp parts are identical (same day)
	if id1[:generator.timestampLength] != id2[:generator.timestampLength] {
		t.Errorf("Expected same timestamp part for IDs generated on same day")
	}
}

func TestRandomPartIncrement(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Alphabet = "01" // Binary alphabet for easier testing
	cfg.TotalLength = 35
	cfg.TimestampLevel = Day
	cfg.MaxSortableRate = Second1

	generator, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create generator: %v", err)
	}

	// Test incrementing random part
	testCases := []struct {
		input    string
		expected string
	}{
		{"0000", "0001"},
		{"0001", "0010"},
		{"0111", "1000"},
		{"1111", strings.Repeat("0", 4)}, // Should overflow
	}

	for _, tc := range testCases {
		result := generator.incrementSymbols(tc.input)
		if result != tc.expected {
			t.Errorf("incrementSymbols(%s) = %s; want %s", tc.input, result, tc.expected)
		}
	}
}

func TestMaxDate(t *testing.T) {
	cfg := DefaultConfig()
	cfg.TimestampStart = time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	cfg.TotalLength = 89
	cfg.TimestampLevel = Year

	generator, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create generator: %v", err)
	}

	maxDate := generator.GetMaxDate()
	if maxDate.Before(time.Now()) {
		t.Errorf("MaxDate is in the past: %v, current time: %v", maxDate, time.Now())
	}

	// Test with a configuration that would exceed max int64
	generator, err = New(cfg)
	if err != nil {
		t.Fatalf("Failed to create generator: %v", err)
	}

	maxDate = generator.GetMaxDate()
	if maxDate.After(generator.maxAllowedTime) {
		t.Error("MaxDate exceeds maximum allowed time.Time value")
	}
}
