const { google } = require("@ai-sdk/google");
const { generateText } = require("ai");

/**
 * JSON Formatter Service using Gemini 2.5 Flash
 * Focuses exclusively on parsing, formatting, and optimizing JSON data
 * Takes raw search results and converts them to proper JSON format
 */
class JsonFormatterService {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is required in .env file');
        }

        // Initialize with Google provider for fast processing
        this.model = google("gemini-2.5-flash");

        // Performance tracking
        this.processingStats = {
            totalRequests: 0,
            averageProcessingTime: 0,
            successRate: 0
        };
    }

    /**
     * Parse and format raw search data into structured JSON
     * @param {Object} rawData - Raw search results from ModernGeminiService
     * @param {string} adminPrompt - Admin-specific formatting requirements
     * @param {Object} options - Formatting options
     * @returns {Object} Properly formatted JSON data
     */
    async formatToJson(rawData, adminPrompt = null, options = {}) {
        const startTime = Date.now();

        try {
            console.log(`🔧 JSON Formatter: Processing ${rawData?.hackathons?.length || 0} hackathons`);

            // Build formatting prompt based on admin requirements
            const formattingPrompt = this.buildFormattingPrompt(rawData, adminPrompt, options);

            // Process with Gemini 2.5 Flash for fast JSON formatting
            const { text: formattedJson } = await generateText({
                model: this.model,
                prompt: formattingPrompt
            });

            // Parse and validate the formatted JSON
            const parsedData = this.parseAndValidateJson(formattedJson, rawData);

            // Update processing stats
            this.updateProcessingStats(startTime, true);

            console.log(`✅ JSON Formatter: Successfully formatted ${parsedData.hackathons?.length || 0} hackathons`);

            return {
                success: true,
                data: parsedData,
                metadata: {
                    ...parsedData.metadata,
                    formattedBy: "JsonFormatterService",
                    formattingTime: new Date().toISOString(),
                    processingTimeMs: Date.now() - startTime
                }
            };

        } catch (error) {
            console.error('❌ JSON Formatter Error:', error);
            this.updateProcessingStats(startTime, false);

            // Return original data if formatting fails
            return {
                success: false,
                error: error.message,
                fallbackData: rawData,
                metadata: {
                    formattedBy: "JsonFormatterService",
                    formattingTime: new Date().toISOString(),
                    processingTimeMs: Date.now() - startTime,
                    fallbackUsed: true
                }
            };
        }
    }

    /**
     * Build the formatting prompt for Gemini 2.5 Flash
     */
    buildFormattingPrompt(rawData, adminPrompt, options) {
        const basePrompt = `
You are an expert JSON formatter using Gemini 2.5 Flash. Your ONLY job is to take raw hackathon data and format it into perfect, clean JSON.

RAW DATA TO FORMAT:
${JSON.stringify(rawData, null, 2)}

CRITICAL WEBSITE REQUIREMENT:
- EVERY hackathon MUST have a valid, accessible official website URL
- Reject any hackathon entries without valid website URLs
- Do not include placeholder URLs (example.com, not available, TBD, etc.)
- Only include hackathons with real, working website links

FORMATTING REQUIREMENTS:
1. Clean and standardize all data fields
2. VALIDATE all website URLs - must be real, accessible websites (not placeholders)
3. Ensure all website URLs are complete and properly formatted (add https:// if missing)
4. Standardize date formats to YYYY-MM-DD (convert any date format to this)
5. Remove any malformed or incomplete entries WITHOUT valid websites
6. Ensure all text fields are properly escaped and clean
7. Validate that required fields are present (name, website, organizer)
8. Convert any relative URLs to absolute URLs
9. Remove any duplicate entries within the dataset
10. Ensure consistent data types across all fields
11. Add proper confidence scores based on data completeness and website validity
5. Ensure all text fields are properly escaped and clean
6. Validate that required fields are present
7. Convert any relative URLs to absolute URLs
8. Remove any duplicate entries within the dataset
9. Ensure consistent data types across all fields
10. Add proper confidence scores based on data completeness

${adminPrompt ? `
ADMIN SPECIFIC FORMATTING REQUEST: ${adminPrompt}
Apply these admin requirements to the formatting process.
` : ''}

${options.includeMetadata ? `
INCLUDE METADATA:
- Add processing timestamps
- Include data quality scores
- Add validation status for each field
` : ''}

        ${options.strictValidation ? `
STRICT VALIDATION MODE:
- Remove any hackathons with missing critical data (name, website, dates)
- MANDATORY: Only include hackathons with valid, accessible website URLs
- Only include hackathons with confidence scores above 0.7
- Ensure all URLs are accessible and valid (not placeholder URLs)
` : `
WEBSITE VALIDATION:
- MANDATORY: Every hackathon must have a valid website URL
- Remove any hackathons without proper website links
- Do not include placeholder or example URLs
`}

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON (no markdown, no code blocks, no explanations)
- Maintain the exact structure of the input data
- All dates must be in ISO format or YYYY-MM-DD
- All URLs must be complete, valid, and properly formatted (NO placeholder URLs)
- All text must be clean and properly escaped
- Preserve all valid data while improving formatting
- CRITICAL: Only include hackathons with valid, accessible website URLs

Return the properly formatted JSON with ONLY hackathons that have valid websites:`; return basePrompt;
    }

    /**
     * Parse and validate the formatted JSON response
     */
    parseAndValidateJson(formattedJson, originalData) {
        try {
            // Clean the response (remove any markdown code blocks)
            const cleanJson = formattedJson
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            // Parse the JSON
            const parsedData = JSON.parse(cleanJson);

            // Validate structure
            if (!parsedData.hackathons || !Array.isArray(parsedData.hackathons)) {
                throw new Error('Invalid JSON structure: hackathons array not found');
            }

            // Ensure metadata exists
            if (!parsedData.metadata) {
                parsedData.metadata = originalData.metadata || {};
            }

            // Validate each hackathon entry and filter out invalid ones
            const validHackathons = [];
            for (const hackathon of parsedData.hackathons) {
                const validated = this.validateHackathonEntry(hackathon);
                if (validated) { // Only add if validation passes
                    validHackathons.push(validated);
                }
            }

            parsedData.hackathons = validHackathons;

            // Update metadata with filtering info
            parsedData.metadata.originalCount = originalData.hackathons?.length || 0;
            parsedData.metadata.validCount = validHackathons.length;
            parsedData.metadata.rejectedCount = (originalData.hackathons?.length || 0) - validHackathons.length;

            console.log(`🔍 Validated hackathons: ${validHackathons.length} valid, ${parsedData.metadata.rejectedCount} rejected for missing websites`);

            return parsedData;

        } catch (parseError) {
            console.warn('JSON parsing failed, attempting repair:', parseError.message);
            return this.repairAndParseJson(formattedJson, originalData);
        }
    }

    /**
     * Validate individual hackathon entry (returns null if invalid)
     */
    validateHackathonEntry(hackathon) {
        // First validate the website - this is mandatory
        const validatedWebsite = this.validateUrl(hackathon.website);
        if (!validatedWebsite) {
            console.log(`❌ Rejecting hackathon "${hackathon.title || hackathon.name || 'Unknown'}" - no valid website`);
            return null; // Reject hackathons without valid websites
        }

        // Ensure required fields exist
        const validated = {
            title: hackathon.title || hackathon.name || 'Untitled Hackathon',
            description: hackathon.description || '',
            website: validatedWebsite, // Use the validated website
            startDate: this.validateDate(hackathon.startDate),
            endDate: this.validateDate(hackathon.endDate),
            registrationDeadline: this.validateDate(hackathon.registrationDeadline),
            location: hackathon.location || { type: 'Virtual', venue: 'Online', city: 'N/A', country: 'N/A' },
            organizer: hackathon.organizer || { name: 'Unknown', contact: 'Not available' },
            themes: Array.isArray(hackathon.themes) ? hackathon.themes : [],
            prizes: hackathon.prizes || { totalPool: 'TBA', breakdown: [] },
            eligibility: hackathon.eligibility || 'Not specified',
            registrationFee: hackathon.registrationFee || 'Free',
            status: this.validateStatus(hackathon.status),
            confidence: this.validateConfidence(hackathon.confidence)
        };

        // Increase confidence score for having a valid website
        validated.confidence = Math.min(1.0, validated.confidence + 0.2);

        return validated;
    }

    /**
     * Validate and format URLs (strict validation - reject invalid/placeholder URLs)
     */
    validateUrl(url) {
        if (!url || url === 'Not available' || url === 'TBD' || url === 'TBA' || url.trim() === '') {
            return null; // Return null for invalid URLs
        }

        // Reject placeholder URLs
        const placeholderPatterns = [
            'example.com',
            'placeholder',
            'test.com',
            'demo.com',
            'hackathon-',
            'localhost',
            '127.0.0.1'
        ];

        const lowerUrl = url.toLowerCase();
        if (placeholderPatterns.some(pattern => lowerUrl.includes(pattern))) {
            return null; // Reject placeholder URLs
        }

        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        // Validate URL format
        try {
            const urlObj = new URL(url);

            // Additional validation - must have proper domain
            if (!urlObj.hostname || urlObj.hostname.length < 4) {
                return null;
            }

            // Must have a valid TLD
            if (!urlObj.hostname.includes('.')) {
                return null;
            }

            return url;
        } catch {
            return null; // Invalid URL format
        }
    }

    /**
     * Validate and format dates
     */
    validateDate(dateStr) {
        if (!dateStr || dateStr === 'Not available' || dateStr === 'TBD') {
            return 'Not available';
        }

        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return 'Not available';
            }
            return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
        } catch {
            return 'Not available';
        }
    }

    /**
     * Validate status field
     */
    validateStatus(status) {
        const validStatuses = ['upcoming', 'ongoing', 'completed'];
        return validStatuses.includes(status) ? status : 'upcoming';
    }

    /**
     * Validate confidence score
     */
    validateConfidence(confidence) {
        const score = parseFloat(confidence);
        return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    }

    /**
     * Attempt to repair malformed JSON
     */
    repairAndParseJson(malformedJson, originalData) {
        try {
            // Common JSON repair attempts
            let repairedJson = malformedJson
                .replace(/,\s*}/g, '}')  // Remove trailing commas
                .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
                .replace(/'/g, '"')      // Replace single quotes with double quotes
                .trim();

            // Try parsing again
            const parsedData = JSON.parse(repairedJson);

            if (parsedData.hackathons && Array.isArray(parsedData.hackathons)) {
                return parsedData;
            }
        } catch (repairError) {
            console.warn('JSON repair failed:', repairError.message);
        }

        // If all else fails, return original data with formatting flag
        return {
            ...originalData,
            formattingFailed: true,
            fallbackUsed: true
        };
    }

    /**
     * Optimize JSON for specific use cases
     */
    async optimizeForUseCase(jsonData, useCase = 'web') {
        try {
            const optimizationPrompt = `
Optimize this hackathon JSON data for ${useCase} usage:

${JSON.stringify(jsonData, null, 2)}

OPTIMIZATION REQUIREMENTS:
${this.getOptimizationRequirements(useCase)}

Return optimized JSON:`;

            const { text: optimizedJson } = await generateText({
                model: this.model,
                prompt: optimizationPrompt
            });

            return this.parseAndValidateJson(optimizedJson, jsonData);

        } catch (error) {
            console.error('Optimization failed:', error);
            return jsonData; // Return original if optimization fails
        }
    }

    /**
     * Get optimization requirements based on use case
     */
    getOptimizationRequirements(useCase) {
        const requirements = {
            'web': `
- Minimize data size for faster loading
- Ensure all URLs are web-accessible
- Format dates for display (readable format)
- Truncate long descriptions to 200 characters
- Include only essential fields`,

            'mobile': `
- Ultra-compact format for mobile bandwidth
- Remove non-essential metadata
- Compress text fields
- Optimize for touch interfaces
- Include offline-friendly data`,

            'api': `
- Include all data fields for completeness
- Maintain consistent data types
- Add comprehensive metadata
- Include validation status
- Format for programmatic access`,

            'database': `
- Format for database insertion
- Ensure all fields match schema
- Handle null values properly
- Add indexing hints
- Include relationship data`
        };

        return requirements[useCase] || requirements['web'];
    }

    /**
     * Update processing statistics
     */
    updateProcessingStats(startTime, success) {
        const processingTime = Date.now() - startTime;
        this.processingStats.totalRequests++;

        // Update average processing time
        this.processingStats.averageProcessingTime =
            (this.processingStats.averageProcessingTime + processingTime) / 2;

        // Update success rate
        const successCount = success ? 1 : 0;
        this.processingStats.successRate =
            ((this.processingStats.successRate * (this.processingStats.totalRequests - 1)) + successCount) /
            this.processingStats.totalRequests;
    }

    /**
     * Get processing statistics
     */
    getProcessingStats() {
        return {
            ...this.processingStats,
            averageProcessingTime: Math.round(this.processingStats.averageProcessingTime),
            successRate: Math.round(this.processingStats.successRate * 100) + '%'
        };
    }

    /**
     * Batch format multiple datasets
     */
    async batchFormat(datasets, adminPrompt = null, options = {}) {
        const results = [];

        for (const dataset of datasets) {
            const result = await this.formatToJson(dataset, adminPrompt, options);
            results.push(result);
        }

        return {
            success: true,
            results: results,
            batchSize: datasets.length,
            successCount: results.filter(r => r.success).length,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = JsonFormatterService;
