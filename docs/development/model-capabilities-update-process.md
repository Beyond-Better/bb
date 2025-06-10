# Model Capabilities Update Process

## Overview

This document provides a systematic process for updating BB's model capabilities data to ensure accurate pricing and feature information for customer billing. This process should be repeated quarterly or when major model updates are announced.

## ⚠️ Critical Business Importance

**BB charges customers based on token usage, making pricing accuracy business-critical.** Incorrect pricing can result in:
- Revenue loss from undercharging customers  
- Customer dissatisfaction from overcharging
- Billing disputes and support overhead

## Update Frequency

- **Quarterly**: Routine comprehensive update
- **As-needed**: When providers announce major model releases or pricing changes
- **Emergency**: When pricing discrepancies are discovered

## Two-Step Process

1. **Update JSON Data**: Generate updated `modelCapabilities.json` with latest model information
2. **Sync to LLM-Proxy**: Deploy changes to staging and production llm-proxy instances

This separation allows updating the data once and deploying to multiple environments separately.

## Directory Structure

```
api/src/data/
├── modelCapabilities.json          # Final output used by BB API
├── model_sources/                  # Source data from research
│   ├── anthropic_models.json       # Anthropic research data
│   ├── openai_models.json          # OpenAI research data  
│   ├── google_models.json          # Google/Gemini research data
│   ├── deepseek_models.json        # DeepSeek research data
│   ├── groq_models.json            # Groq research data
│   └── ollama_models.json          # Ollama local models data
└── schemas/
    └── model_schema.json           # JSON schema for validation
```

## Research Process

### Step 1: Delegate Research Tasks

Use the delegate_tasks tool to gather comprehensive information from official sources:

```typescript
await delegate_tasks({
  sync: true,
  tasks: [
    {
      title: "Research [Provider] Models and Pricing",
      background: "BB needs accurate model capabilities and pricing data for billing purposes. Current data may be outdated. Focus on current/latest text and multimodal LLMs, especially those supporting function calling/tools.",
      instructions: "Research [Provider]'s official documentation and extract comprehensive model information focusing on: 1) All current models 2) Context windows, max output tokens 3) Pricing per token (input/output/cached) 4) Supported features 5) Release dates, training cutoffs 6) Speed/cost/intelligence ratings 7) Any deprecated models. Be extremely accurate with pricing as BB bills customers based on this.",
      capabilities: ["web_search", "content_analysis"],
      resources: [
        { type: "url", uri: "[Official docs URL]" },
        { type: "url", uri: "[Pricing page URL]" }
      ],
      requirements: {
        type: "object",
        properties: {
          models: { type: "array", items: { /* model schema */ } },
          pricingNotes: { type: "string" },
          notes: { type: "string" }
        }
      }
    }
  ]
});
```

### Step 2: Key Information to Gather

For each provider, extract:

#### **Model Metadata**
- Model ID (API name)
- Display name  
- Model family/series
- Context window (tokens)
- Max output tokens
- Release date
- Training data cutoff
- Deprecation status

#### **Pricing (Critical)**
- Input token price
- Output token price  
- Cached token price (if applicable)
- Currency
- Effective date
- Per-token vs per-million-token rates

#### **Capabilities**
- Function calling/tool use
- Vision/multimodal support
- Streaming
- JSON mode
- Prompt caching
- Extended thinking/reasoning

#### **Performance Characteristics**
- Speed rating (fast/medium/slow)
- Cost rating (low/medium/high/very-high)
- Intelligence rating (medium/high/very-high)
- Modality (text/text-and-vision/multimodal)

### Step 3: Provider-Specific Sources

#### Anthropic
- **Main**: https://docs.anthropic.com/en/docs/about-claude/models/overview
- **API**: https://docs.anthropic.com/en/api/messages
- **Pricing**: https://docs.anthropic.com/en/api/pricing

#### OpenAI  
- **Models**: https://platform.openai.com/docs/models
- **Pricing**: https://openai.com/api/pricing/
- **Deprecations**: https://platform.openai.com/docs/deprecations

#### Google (Gemini)
- **Models**: https://ai.google.dev/gemini-api/docs/models
- **Pricing**: https://ai.google.dev/pricing
- **Features**: https://ai.google.dev/gemini-api/docs/function-calling

#### DeepSeek
- **Models**: https://api-docs.deepseek.com/api/list-models/
- **Pricing**: https://api-docs.deepseek.com/quick_start/pricing
- **Updates**: https://api-docs.deepseek.com/news/

#### Groq
- **Models**: https://console.groq.com/docs/models
- **Pricing**: https://groq.com/pricing/
- **Speed**: https://groq.com/speed/

#### Ollama
- **Tool Models**: https://ollama.com/search?c=tools
- **Library**: https://ollama.com/library
- **Performance**: Community benchmarks

## Data Processing

### Step 4: Create Source JSON Files

Transform research data into structured JSON files:

```bash
# Create source files from research
api/src/data/model_sources/anthropic_models.json
api/src/data/model_sources/openai_models.json  
api/src/data/model_sources/google_models.json
api/src/data/model_sources/deepseek_models.json
api/src/data/model_sources/groq_models.json
api/src/data/model_sources/ollama_models.json
```

### Step 5: Standardize Pricing Units

**Critical**: All pricing must use consistent units. The script converts to **per-token pricing** (not per-million-tokens) for internal consistency.

#### Pricing Conversion Function
```typescript
function convertPricingToPerToken(pricePerMillion: number): number {
  return pricePerMillion / 1_000_000;
}

// Example: $2.50 per 1M tokens → 0.0000025 per token
```

### Step 6: Run Update Script

```bash
cd api
deno run --allow-net --allow-read --allow-write --allow-env \
  scripts/update_model_capabilities.ts \
  --output=src/data/modelCapabilities.json \
  --providers=anthropic,openai,google,deepseek,groq,ollama \
  --validate-only=false
```

### Step 7: Validation Steps

1. **Schema Validation**: Ensure all required fields present
2. **Pricing Verification**: Cross-check pricing against source documentation  
3. **Feature Validation**: Verify feature flags match provider capabilities
4. **BB-Sass Integration**: Check against available models in llm-proxy
5. **Manual Spot Checks**: Test pricing calculations for high-volume models

## Quality Assurance

### Critical Checks

- [ ] Pricing accuracy verified against official sources
- [ ] All current models included
- [ ] Deprecated models properly marked
- [ ] Feature flags accurate (function calling, vision, etc.)
- [ ] Context windows and output limits correct
- [ ] Release dates and training cutoffs accurate

### Common Issues to Watch

1. **Pricing Unit Confusion**: Per-token vs per-million-token
2. **Model ID Changes**: Providers sometimes change API identifiers
3. **Feature Deprecation**: Models losing support for certain features
4. **Hidden Models**: Models not available in BB's llm-proxy service
5. **Cache Pricing**: Different rates for prompt caching

## Troubleshooting

### API Access Issues
- Ensure valid API keys for providers that require authentication
- Use `--use-cached` flag to continue with existing data on API failures
- Check rate limits if requests are being blocked

### Pricing Discrepancies  
- Always verify against multiple official sources
- Document any ambiguities in source JSON comments
- Flag unusual pricing changes for manual review

### Missing Models
- Check if models are preview/beta only
- Verify model availability in different regions
- Confirm models support required features (function calling, etc.)

## Version Control

- Commit source JSON files separately from generated capabilities
- Tag releases when major pricing updates occur
- Maintain changelog of significant model additions/removals
- Document llm-proxy sync deployments with environment and timestamp

## Emergency Updates

For urgent pricing corrections:

1. Update source JSON file directly
2. Run update script with single provider
3. Deploy immediately to production
4. Document change and schedule full review

## Automation Opportunities

Consider automating:
- Weekly pricing change detection
- Model availability monitoring  
- Rate limit and quota tracking
- BB-sass model synchronization

## LLM-Proxy Synchronization

After updating the model capabilities JSON, sync changes to llm-proxy instances:

### Two-Step Deployment Process

1. **Update JSON Data**: Generate updated `modelCapabilities.json` (this document)
2. **Sync to LLM-Proxy**: Deploy to staging and production separately

### Quick Sync Commands

```bash
# Preview changes (recommended first step)
deno run --allow-net --allow-read --allow-write --allow-env \
  api/scripts/sync_models_to_llm_proxy.ts \
  --environment=staging --dry-run

# Sync to staging
deno run --allow-net --allow-read --allow-write --allow-env \
  api/scripts/sync_models_to_llm_proxy.ts \
  --environment=staging

# Sync to production (after testing staging)
deno run --allow-net --allow-read --allow-write --allow-env \
  api/scripts/sync_models_to_llm_proxy.ts \
  --environment=production
```

### Environment Setup

Create environment-specific config files:

**.env.staging**
```bash
LLM_PROXY_AUTH_TOKEN=your_staging_service_token
SUPABASE_CONFIG_URL=https://staging.beyondbetter.dev/api/v1/config/supabase
```

**.env.production**
```bash
LLM_PROXY_AUTH_TOKEN=your_production_service_token
SUPABASE_CONFIG_URL=https://www.beyondbetter.dev/api/v1/config/supabase
```

### Sync Behavior

- ✅ **Includes**: All non-hidden models except Ollama
- ❌ **Excludes**: Ollama models (local) and models marked `hidden: true`
- 🔄 **Updates**: Models with pricing or capability changes
- 📊 **Reports**: Detailed progress and final results

**📚 Complete Documentation**: See `docs/development/model_sync_to_llm_proxy.md` for comprehensive sync process documentation, authentication setup, error handling, and troubleshooting.

---

**Remember**: Customer billing accuracy depends on this data. When in doubt, err on the side of caution and manually verify critical pricing information.