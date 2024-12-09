package main

import (
	"fmt"
	"time"

	sortablenano "github.com/jibuji/sortable-nanoid-go"
)

func main() {
	// Example 1: Basic usage with default settings
	fmt.Println("\nExample 1: Basic Usage")
	generator, err := sortablenano.New(sortablenano.DefaultConfig())
	if err != nil {
		panic(err)
	}

	id, err := generator.Generate()
	if err != nil {
		panic(err)
	}
	fmt.Printf("Generated ID: %s\n", id)

	timestamp, chronoPart, randomPart, err := generator.Decode(id)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Decoded - Timestamp: %v, Chrono Part: %s, Random Part: %s\n", timestamp, chronoPart, randomPart)

	// Print generator configuration
	generator.PrintInfo()

	// Example 2: Custom alphabet and length
	fmt.Println("\nExample 2: Custom Alphabet and Length")
	hexConfig := sortablenano.Config{
		Alphabet:        "0123456789ABCDEFabcdef",
		TotalLength:     30,
		TimestampLevel:  sortablenano.Second,
		MaxSortableRate: sortablenano.Second100, // 100 IDs per second
	}
	hexGenerator, err := sortablenano.New(hexConfig)
	if err != nil {
		panic(err)
	}

	hexId, err := hexGenerator.Generate()
	if err != nil {
		panic(err)
	}
	fmt.Printf("Hex ID: %s\n", hexId)

	// Print hex generator configuration
	hexGenerator.PrintInfo()

	// Example 3: Future-proof IDs
	fmt.Println("\nExample 3: Future-proof IDs")
	futureConfig := sortablenano.Config{
		TimestampStart: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		TimestampLevel: sortablenano.Day,
		TotalLength:    24,
	}
	// Create the end date properly
	endDate := time.Date(2124, 1, 1, 0, 0, 0, 0, time.UTC) // 100 years
	futureConfig.TimestampEnd = &endDate

	futureGenerator, err := sortablenano.New(futureConfig)
	if err != nil {
		panic(err)
	}

	futureId, err := futureGenerator.Generate()
	if err != nil {
		panic(err)
	}
	fmt.Printf("Future-proof ID: %s\n", futureId)

	// Print future generator configuration
	futureGenerator.PrintInfo()

	// Example 4: High-precision timestamps
	fmt.Println("\nExample 4: High-precision Timestamps")
	preciseConfig := sortablenano.Config{
		TimestampLevel:  sortablenano.Nanosecond,
		TotalLength:     24,
		MaxSortableRate: sortablenano.Second100,
	}
	preciseGenerator, err := sortablenano.New(preciseConfig)
	if err != nil {
		panic(err)
	}

	preciseId, err := preciseGenerator.Generate()
	if err != nil {
		panic(err)
	}
	fmt.Printf("High-precision ID: %s\n", preciseId)

	// Print precise generator configuration
	preciseGenerator.PrintInfo()

	// Example 5: Short IDs
	fmt.Println("\nExample 5: Short IDs")
	shortConfig := sortablenano.Config{
		TotalLength:    12,
		TimestampLevel: sortablenano.Minute,
	}
	shortGenerator, err := sortablenano.New(shortConfig)
	if err != nil {
		panic(err)
	}

	shortId, err := shortGenerator.Generate()
	if err != nil {
		panic(err)
	}
	fmt.Printf("Short ID: %s\n", shortId)

	// Print short generator configuration
	shortGenerator.PrintInfo()

	// Example 6: Collision handling
	fmt.Println("\nExample 6: Collision Handling")
	collisionConfig := sortablenano.Config{
		TotalLength: 16,
	}
	collisionGenerator, err := sortablenano.New(collisionConfig)
	if err != nil {
		panic(err)
	}

	// Generate multiple IDs quickly to demonstrate collision handling
	ids := make([]string, 5)
	for i := range ids {
		id, err := collisionGenerator.Generate()
		if err != nil {
			panic(err)
		}
		ids[i] = id
	}
	fmt.Println("Multiple IDs generated quickly:")
	for _, id := range ids {
		fmt.Printf("  %s\n", id)
	}

	// Print collision generator configuration
	collisionGenerator.PrintInfo()
}
