import { customAlphabet } from 'nanoid';

// Types for configuration
export type TimestampLevel =  'millisecond' | 'second' | 
                     'minute' | 'hour' | 'day' | 'month' | 'year';

export enum MaxSortableRate {
    Micro100 = "100_per_microsecond", // 100 generations per microsecond
    Micro1 = "1_per_microsecond",   // 1 generation per microsecond
    Milli10 = "10_per_millisecond",  // 10 generations per millisecond
    Second100 = "100_per_second",      // 100 generations per second
    Second1 = "1_per_second"        // 1 generation per second
}

export interface IDGeneratorConfig {
    alphabet?: string;
    totalLength?: number;
    timestampStart?: Date;
    timestampEnd?: Date;
    timestampLength?: number;
    timestampLevel?: TimestampLevel;
    maxSortableRate?: MaxSortableRate;
}

export class SortableIDGenerator {
    private readonly DEFAULT_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
    private readonly LEVEL_TO_MS: Record<TimestampLevel, number> = {
        millisecond: 1,
        second: 1_000,
        minute: 60_000,
        hour: 3_600_000,
        day: 86_400_000,
        month: 2_592_000_000,
        year: 31_536_000_000
    };

    private lastTimeSpan: number = 0;
    private lastId: string = '';
    private alphabet: string;
    private base: number;
    private totalLength: number;
    private timestampStart: Date;
    private timestampLength: number;
    private chronoLength: number = 0;
    private timestampLevel: TimestampLevel;
    private maxTimestamp: number;
    private maxSortableRate: MaxSortableRate;
    private lastChronoPart: string = '';
    private readonly BUILTIN_TIMESTAMP_END_YEARS = 200;
    private readonly POOL_SIZE = 128;  // Size of the character pool
    private charPool: string[] = [];
    private poolOffset: number = 0;
    private genRandomPart: () => string;
    private readonly minChronoPart: string;  // Stores alphabet[0].repeat(chronoLength)
    private readonly minMachineIdPart: string;  // Stores alphabet[0].repeat(machineIdLength)

    private calculateChronoLength(base: number, rate: MaxSortableRate, level: TimestampLevel): number {
        let idsPerSecond: number;

        // First determine base IDs per unit from generation rate
        switch (rate) {
            case MaxSortableRate.Micro100:
                idsPerSecond = 100 * 1000 * 1000;
                break;
            case MaxSortableRate.Micro1:
                idsPerSecond = 1 * 1000 * 1000;
                break;
            case MaxSortableRate.Milli10:
                idsPerSecond = 10 * 1000;
                break;
            case MaxSortableRate.Second100:
                idsPerSecond = 100;
                break;
            case MaxSortableRate.Second1:
                idsPerSecond = 1;
                break;
            default:
                idsPerSecond = 1 * 1000 * 1000; // Default to Micro1
        }

        // Then adjust based on timestamp level
        let multiplier: number;
        switch (level) {
            case 'year':
                multiplier = 365 * 24 * 60 * 60; // seconds in a year
                break;
            case 'month':
                multiplier = 31 * 24 * 60 * 60; // seconds in a month
                break;
            case 'day':
                multiplier = 24 * 60 * 60; // seconds in a day
                break;
            case 'hour':
                multiplier = 60 * 60; // seconds in an hour
                break;
            case 'minute':
                multiplier = 60; // seconds in a minute
                break;
            case 'second':
                multiplier = 1; // seconds in a second
                break;
            case 'millisecond':
                multiplier = 0.001; // milliseconds in a second
                break;
            default:
                multiplier = 1; // default to second
        }

        // Calculate total IDs needed for this time unit
        const totalIds = Math.ceil(idsPerSecond * multiplier);

        // Calculate required length to represent totalIds in the given base
        let length = 1;
        let b = base;
        //integer division
        while (((totalIds / b) >> 0) > 0) {
            length++;
            b *= base;
        }
        return length;
    }

    constructor(config: IDGeneratorConfig = {}) {
        // Set defaults and validate configuration
        this.alphabet = (config.alphabet || this.DEFAULT_ALPHABET).split('').sort().join('');
        this.base = this.alphabet.length;
        this.totalLength = config.totalLength || 32;
        this.timestampStart = config.timestampStart || new Date(2024, 0, 1);
        this.timestampLevel = config.timestampLevel || 'millisecond';
        this.maxSortableRate = config.maxSortableRate || MaxSortableRate.Micro1;

        // Validate alphabet
        if (this.alphabet.length < 2) {
            throw new Error('Alphabet must contain at least 2 characters');
        }
        if (new Set(this.alphabet).size !== this.alphabet.length) {
            throw new Error('Alphabet must contain unique characters');
        }

        // Calculate timestamp length based on built-in end date (200 years from start)
        const endDate = new Date(this.timestampStart);
        endDate.setFullYear(endDate.getFullYear() + this.BUILTIN_TIMESTAMP_END_YEARS);
        const timespan = this.getTimespan(endDate);
        this.timestampLength = this.calculateRequiredLength(timespan);
        this.maxTimestamp = timespan;

        // Calculate chrono length based on maxSortableRate
        this.chronoLength = this.calculateChronoLength(this.base, this.maxSortableRate, this.timestampLevel);

        // Validate total length
        const minRequiredLength = this.timestampLength + this.chronoLength + 1; // +1 for machine ID part
        if (this.totalLength < minRequiredLength) {
            throw new Error(`Total length must be at least ${minRequiredLength} (${this.timestampLength} for timestamp + ${this.chronoLength} for chrono + 1 for machine ID)`);
        }

        if (this.getMaxDate() < new Date()) {
            throw new Error('Max date is in the past, you may need to increase the timestamp length');
        }

        // Create the random generator for machine ID part
        const machineIdLength = this.totalLength - this.timestampLength - this.chronoLength;
        this.genRandomPart = customAlphabet(this.alphabet, machineIdLength);

        // Initialize repeated strings
        this.minChronoPart = this.alphabet[0].repeat(this.chronoLength);
        this.minMachineIdPart = this.alphabet[0].repeat(machineIdLength);
        this.lastChronoPart = this.minChronoPart;
    }

    private getTimespan(endDate: Date): number {
        const startMs = this.timestampStart.getTime();
        const endMs = endDate.getTime();
        const timespan = (endMs - startMs) / this.LEVEL_TO_MS[this.timestampLevel];
        
        if (timespan < 0) {
            throw new Error('End date cannot be before start date');
        }
        
        return timespan;
    }

    private calculateMaxTimestamp(length: number): number {
        return Math.pow(this.base, length);
    }

    private calculateRequiredLength(timespan: number): number {
        return Math.ceil(Math.log(timespan) / Math.log(this.base));
    }

    private encodeTimestamp(timestamp: number): string {
        let result = '';
        let remaining = Math.floor(timestamp);

        // Handle zero case
        if (remaining === 0) {
            return this.alphabet[0].repeat(this.timestampLength);
        }

        while (remaining > 0) {
            result = this.alphabet[remaining % this.base] + result;
            remaining = Math.floor(remaining / this.base);
        }

        return result.padStart(this.timestampLength, this.alphabet[0]);
    }

    private fillCharPool(): void {
        // Create a new pool of random characters
        const bytes = new Uint8Array(this.POOL_SIZE);
        crypto.getRandomValues(bytes);
        
        this.charPool = Array.from({ length: this.POOL_SIZE }, (_, i) => {
            // Use modulo to map random bytes to alphabet indices, excluding the last char
            return this.alphabet[bytes[i] % (this.alphabet.length - 1)];
        });
        this.poolOffset = 0;
    }

    private getRandomChar(): string {
        if (this.poolOffset >= this.charPool.length) {
            this.fillCharPool();
        }
        return this.charPool[this.poolOffset++];
    }

    private incrementStringPart(value: string): string {
        const len = value.length;
        const chars = [...value];
        
        // Start from the end
        for (let i = len - 1; i >= 0; i--) {
            const currentChar = chars[i];
            const currentIndex = this.alphabet.indexOf(currentChar);
            
            // If not at max value, increment and return
            if (currentIndex < this.alphabet.length - 1) {
                chars[i] = this.alphabet[currentIndex + 1];
                return chars.join('');
            }
            
            // If at max value, reset to first char and continue to next position
            chars[i] = this.alphabet[0];
        }
        
        // If we get here, we've overflowed
        return value.length === this.chronoLength ? this.minChronoPart : this.minMachineIdPart;
    }

    private isMaxValue(value: string): boolean {
        return [...value].every(char => char === this.alphabet[this.alphabet.length - 1]);
    }

    public generate(): string {
        const now = new Date();
        const timespan = this.getTimespan(now);
        
        if (timespan >= this.maxTimestamp) {
            throw new Error('Current time exceeds maximum supported timestamp');
        }

        if (timespan === this.lastTimeSpan) {
            // Increment chrono part first
            const newChronoPart = this.incrementStringPart(this.lastChronoPart);
            
            if (newChronoPart === this.minChronoPart) {
                // If chrono part is exhausted, reset it and increment machine ID part
                this.lastChronoPart = this.minChronoPart;
                const lastMachineId = this.lastId.slice(this.timestampLength + this.chronoLength);
                const newMachineId = this.incrementStringPart(lastMachineId);
                
                if (newMachineId === this.minMachineIdPart) {
                    // If both chrono and machine ID are exhausted, throw error
                    throw new Error('Generation rate exceeded. Please wait for next timestamp or increase maxSortableRate');
                }

                this.lastId = this.encodeTimestamp(timespan) + this.lastChronoPart + newMachineId;
                return this.lastId;
            }

            this.lastChronoPart = newChronoPart;
            this.lastId = this.encodeTimestamp(timespan) + this.lastChronoPart + 
                         this.lastId.slice(this.timestampLength + this.chronoLength);
            return this.lastId;
        }

        // New timestamp, reset chrono value
        this.lastTimeSpan = timespan;
        this.lastChronoPart = this.minChronoPart;
        const timestampPart = this.encodeTimestamp(timespan);
        const machineIdPart = this.genRandomPart();
        this.lastId = timestampPart + this.lastChronoPart + machineIdPart;
        return this.lastId;
    }

    public getMaxDate(): Date {
        const maxTimespan = this.maxTimestamp * this.LEVEL_TO_MS[this.timestampLevel];
        const calculatedTime = this.timestampStart.getTime() + maxTimespan;
        
        // JavaScript's maximum date value: 8640000000000000 (milliseconds)
        const MAX_JS_DATE = 8640000000000000;
        
        // If calculated time exceeds JavaScript's max date, return max date
        if (calculatedTime > MAX_JS_DATE) {
            return new Date(MAX_JS_DATE);
        }
        
        return new Date(calculatedTime);
    }

    public decode(id: string): { timestamp: Date, chronoPart: string, machineId: string } {
        if (!id || id.length !== this.totalLength) {
            throw new Error(`ID must be exactly ${this.totalLength} characters long`);
        }

        const timestampPart = id.slice(0, this.timestampLength);
        const chronoPart = id.slice(this.timestampLength, this.timestampLength + this.chronoLength);
        const machineIdPart = id.slice(this.timestampLength + this.chronoLength);

        // Validate characters
        if ([...id].some(char => !this.alphabet.includes(char))) {
            throw new Error('ID contains invalid characters');
        }

        let timestamp = 0;
        for (let i = 0; i < timestampPart.length; i++) {
            timestamp = timestamp * this.base + this.alphabet.indexOf(timestampPart[i]);
        }

        const date = new Date(
            this.timestampStart.getTime() + 
            timestamp * this.LEVEL_TO_MS[this.timestampLevel]
        );

        return { timestamp: date, chronoPart, machineId: machineIdPart };
    }

    public printInfo(): {
        timestampLength: number;
        chronoLength: number;
        startDate: Date;
        endDate: Date;
        timestampLevel: TimestampLevel;
        maxSortableRate: MaxSortableRate;
        alphabet: string;
        totalLength: number;
    } {
        const info = {
            timestampLength: this.timestampLength,
            chronoLength: this.chronoLength,
            startDate: this.timestampStart,
            endDate: this.getMaxDate(),
            timestampLevel: this.timestampLevel,
            maxSortableRate: this.maxSortableRate,
            alphabet: this.alphabet,
            totalLength: this.totalLength
        };

        console.log('\nID Generator Configuration:');
        console.log(`Timestamp Length: ${info.timestampLength} symbols`);
        console.log(`Chrono Length: ${info.chronoLength} symbols`);
        console.log(`Start Date: ${info.startDate.toISOString()}`);
        console.log(`End Date: ${info.endDate.toISOString()}`);
        console.log(`Timestamp Level: ${info.timestampLevel}`);
        console.log(`Max Sortable Rate: ${info.maxSortableRate}`);
        console.log(`Alphabet (${info.alphabet.length} chars): ${info.alphabet}`);
        console.log(`Total ID Length: ${info.totalLength} symbols`);
        
        return info;
    }
}