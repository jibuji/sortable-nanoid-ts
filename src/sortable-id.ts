import { customAlphabet } from 'nanoid';

// Types for configuration
export type TimestampLevel = 'nanosecond' | 'microsecond' | 'millisecond' | 'second' | 
                     'minute' | 'hour' | 'day' | 'month' | 'year';

export interface IDGeneratorConfig {
    alphabet?: string;
    totalLength?: number;
    timestampStart?: Date;
    timestampEnd?: Date;
    timestampLength?: number;
    timestampLevel?: TimestampLevel;
}

export class SortableIDGenerator {
    private readonly DEFAULT_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
    private readonly LEVEL_TO_MS: Record<TimestampLevel, number> = {
        nanosecond: 1 / 1_000_000,
        microsecond: 1 / 1_000,
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
    private timestampLevel: TimestampLevel;
    private maxTimestamp: number;
    private overflowedRandomPart: string = '';
    private readonly POOL_SIZE = 128;  // Size of the character pool
    private charPool: string[] = [];
    private poolOffset: number = 0;
    private genRandomPart: () => string;

    constructor(config: IDGeneratorConfig = {}) {
        // Set defaults and validate configuration
        this.alphabet = (config.alphabet || this.DEFAULT_ALPHABET).split('').sort().join('');
        this.base = this.alphabet.length;
        this.totalLength = config.totalLength || 32;
        this.timestampStart = config.timestampStart || new Date(2024, 0, 1);
        this.timestampLevel = config.timestampLevel || 'millisecond';

        // Validate alphabet
        if (this.alphabet.length < 2) {
            throw new Error('Alphabet must contain at least 2 characters');
        }
        if (new Set(this.alphabet).size !== this.alphabet.length) {
            throw new Error('Alphabet must contain unique characters');
        }

        // Calculate timestamp length or end date
        if (config.timestampLength) {
            this.timestampLength = config.timestampLength;
            this.maxTimestamp = this.calculateMaxTimestamp(config.timestampLength);
        } else if (config.timestampEnd) {
            const timespan = this.getTimespan(config.timestampEnd);
            this.timestampLength = this.calculateRequiredLength(timespan);
            this.maxTimestamp = timespan;
        } else {
            this.timestampLength = 11; // Default timestamp length
            this.maxTimestamp = this.calculateMaxTimestamp(11);
        }
        
        // Validate total length
        if (this.totalLength <= this.timestampLength) {
            throw new Error('Total length must be greater than timestamp length');
        }

        if ( this.totalLength <= this.timestampLength * 2) {
            console.warn('Total length must be greater than twice the timestamp length, otherwise you will not have enough characters for the random part,\
                 thus reducing the uniqueness of the generated IDs');
        }


        if (config.timestampEnd && config.timestampEnd < this.timestampStart) {
            throw new Error('End date cannot be before start date');
        }

        // Validate that timestampStart is not in the future if not explicitly set
        if (!config.timestampStart && this.timestampStart > new Date()) {
            throw new Error('Default start date cannot be in the future');
        }

        if (this.getMaxDate() < new Date()) {
            throw new Error('Max date is in the past, you may need to increase the timestamp length, current length is ' + this.timestampLength);
        }
        // Create the random generator once
        this.genRandomPart = customAlphabet(this.alphabet, this.totalLength - this.timestampLength - 1);

        this.overflowedRandomPart = this.alphabet[0].repeat(this.totalLength - this.timestampLength);
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

    public async generate(): Promise<string> {
        const now = new Date();
        const timespan = this.getTimespan(now);
        
        if (timespan >= this.maxTimestamp) {
            console.error('timespan', timespan, 'maxTimestamp', this.maxTimestamp);
            throw new Error('Current time exceeds maximum supported timestamp');
        }
        if (timespan === this.lastTimeSpan) {
            const lastRandomPart = this.lastId.slice(this.timestampLength);
            const randomPart = this.incrementRandomPart(lastRandomPart);
            if (randomPart !== this.overflowedRandomPart) {
                this.lastId = this.lastId.slice(0, this.timestampLength) + randomPart;
                return this.lastId;
            }
            
            // We've overflowed the random part, so we need to increment the timestamp
            await new Promise(resolve => setTimeout(resolve, 1));
            return await this.generate();
        }
        this.lastTimeSpan = timespan;
        const timestampPart = this.encodeTimestamp(timespan);
        const randomPart = this.genRandomPart();
        this.lastId = timestampPart + this.getRandomChar() + randomPart;
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

    public decode(id: string): { timestamp: Date, random: string } {
        if (!id || id.length !== this.totalLength) {
            throw new Error(`ID must be exactly ${this.totalLength} characters long`);
        }

        const timestampPart = id.slice(0, this.timestampLength);
        const randomPart = id.slice(this.timestampLength);

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

        return { timestamp: date, random: randomPart };
    }

    public printInfo(): {
        timestampLength: number;
        startDate: Date;
        endDate: Date;
        timestampLevel: TimestampLevel;
        alphabet: string;
        totalLength: number;
    } {
        const info = {
            timestampLength: this.timestampLength,
            startDate: this.timestampStart,
            endDate: this.getMaxDate(),
            timestampLevel: this.timestampLevel,
            alphabet: this.alphabet,
            totalLength: this.totalLength
        };

        console.log('\nID Generator Configuration:');
        console.log(`Timestamp Length: ${info.timestampLength} symbols`);
        console.log(`Start Date: ${info.startDate.toISOString()}`);
        console.log(`End Date: ${info.endDate.toISOString()}`);
        console.log(`Timestamp Level: ${info.timestampLevel}`);
        console.log(`Alphabet (${info.alphabet.length} chars): ${info.alphabet}`);
        console.log(`Total ID Length: ${info.totalLength} symbols`);
        
        return info;
    }


    private incrementRandomPart(randomPart: string): string {
        const len = randomPart.length;
        const chars = [...randomPart];
        
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
        return this.overflowedRandomPart;
    }
}