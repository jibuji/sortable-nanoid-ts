function calculateMaxDate(): Date {
    const MAX_NS = BigInt(2) ** BigInt(64);
    const NS_TO_MS = BigInt(1_000_000);
    
    // Convert to milliseconds (what Date can handle)
    const maxMs = Number(MAX_NS / NS_TO_MS);
    
    // Unix epoch start
    const epochStart = new Date(1970, 0, 1);
    const maxDate = new Date(epochStart.getTime() + maxMs);
    
    return maxDate;
}

const maxDate = calculateMaxDate();
console.log('Maximum date:', maxDate.toISOString());