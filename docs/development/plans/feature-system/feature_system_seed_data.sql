-- Feature System Seed Data
-- This file contains the initial feature definitions and plan mappings
-- Based on the plan structure: Basic ($10), Advanced ($30), Professional ($99), Enterprise (Custom)

-- First, let's create the base subscription plans
INSERT INTO "abi_billing"."subscription_plans" (
    "plan_id", "plan_name", "plan_type", "plan_price_monthly_cents_usd", "plan_price_yearly_cents_usd", "plan_active"
) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Basic', 'basic', 1000, 10800, true),
    ('22222222-2222-2222-2222-222222222222', 'Advanced', 'usage', 3000, 32400, true),
    ('33333333-3333-3333-3333-333333333333', 'Professional', 'usage', 9900, 106920, true),
    ('44444444-4444-4444-4444-444444444444', 'Enterprise', 'usage', null, null, true)
ON CONFLICT (plan_id) DO UPDATE SET
    plan_name = EXCLUDED.plan_name,
    plan_price_monthly_cents_usd = EXCLUDED.plan_price_monthly_cents_usd,
    plan_price_yearly_cents_usd = EXCLUDED.plan_price_yearly_cents_usd,
    updated_at = now();

-- Feature Definitions - Hierarchical structure
INSERT INTO "abi_billing"."feature_definitions" (
    "feature_id", "feature_key", "feature_name", "feature_description", "feature_type", "parent_feature_id", "feature_category", "default_value", "value_schema"
) VALUES 
    -- Top-level model access
    ('f0000001-0000-0000-0000-000000000001', 'models', 'Model Access', 'Access to LLM models', 'access', null, 'models', 
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    
    -- Claude model hierarchy
    ('f0000002-0000-0000-0000-000000000002', 'models.claude', 'Claude Models', 'Access to Claude models', 'access', 'f0000001-0000-0000-0000-000000000001', 'models',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000003-0000-0000-0000-000000000003', 'models.claude.sonnet', 'Claude Sonnet', 'Access to Claude Sonnet', 'access', 'f0000002-0000-0000-0000-000000000002', 'models',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000004-0000-0000-0000-000000000004', 'models.claude.opus', 'Claude Opus', 'Access to Claude Opus', 'access', 'f0000002-0000-0000-0000-000000000002', 'models',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000005-0000-0000-0000-000000000005', 'models.claude.haiku', 'Claude Haiku', 'Access to Claude Haiku', 'access', 'f0000002-0000-0000-0000-000000000002', 'models',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    
    -- Other model providers
    ('f0000006-0000-0000-0000-000000000006', 'models.openai', 'OpenAI Models', 'Access to OpenAI models', 'access', 'f0000001-0000-0000-0000-000000000001', 'models',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000007-0000-0000-0000-000000000007', 'models.openai.gpt4', 'GPT-4 Models', 'Access to GPT-4 models', 'access', 'f0000006-0000-0000-0000-000000000006', 'models',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000008-0000-0000-0000-000000000008', 'models.openai.gpt3', 'GPT-3.5 Models', 'Access to GPT-3.5 models', 'access', 'f0000006-0000-0000-0000-000000000006', 'models',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    
    -- Datasource access
    ('f0000010-0000-0000-0000-000000000010', 'datasources', 'Data Sources', 'Access to data sources', 'access', null, 'datasources',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000011-0000-0000-0000-000000000011', 'datasources.filesystem', 'Filesystem Access', 'Access to filesystem datasource', 'access', 'f0000010-0000-0000-0000-000000000010', 'datasources',
     '{"enabled": false, "read": false, "write": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}, "read": {"type": "boolean"}, "write": {"type": "boolean"}}}'),
    ('f0000012-0000-0000-0000-000000000012', 'datasources.github', 'GitHub Integration', 'Access to GitHub datasource', 'access', 'f0000010-0000-0000-0000-000000000010', 'datasources',
     '{"enabled": false, "read": false, "write": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}, "read": {"type": "boolean"}, "write": {"type": "boolean"}}}'),
    ('f0000013-0000-0000-0000-000000000013', 'datasources.notion', 'Notion Integration', 'Access to Notion datasource', 'access', 'f0000010-0000-0000-0000-000000000010', 'datasources',
     '{"enabled": false, "read": false, "write": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}, "read": {"type": "boolean"}, "write": {"type": "boolean"}}}'),
    ('f0000014-0000-0000-0000-000000000014', 'datasources.supabase', 'Supabase Integration', 'Access to Supabase datasource', 'access', 'f0000010-0000-0000-0000-000000000010', 'datasources',
     '{"enabled": false, "read": false, "write": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}, "read": {"type": "boolean"}, "write": {"type": "boolean"}}}'),
    
    -- Tools access
    ('f0000020-0000-0000-0000-000000000020', 'tools', 'Tools Access', 'Access to tools and integrations', 'access', null, 'tools',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000021-0000-0000-0000-000000000021', 'tools.builtin', 'Built-in Tools', 'Access to built-in tools', 'access', 'f0000020-0000-0000-0000-000000000020', 'tools',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000022-0000-0000-0000-000000000022', 'tools.external', 'External Tools (MCP)', 'Access to external MCP tools', 'access', 'f0000020-0000-0000-0000-000000000020', 'tools',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    
    -- Rate limits
    ('f0000030-0000-0000-0000-000000000030', 'limits.tokens_per_minute', 'Token Rate Limit', 'Tokens per minute rate limit', 'limit', null, 'limits',
     '{"limit": 1000}', '{"type": "object", "properties": {"limit": {"type": "integer", "minimum": 0}}}'),
    ('f0000031-0000-0000-0000-000000000031', 'limits.requests_per_minute', 'Request Rate Limit', 'Requests per minute rate limit', 'limit', null, 'limits',
     '{"limit": 5}', '{"type": "object", "properties": {"limit": {"type": "integer", "minimum": 0}}}'),
    
    -- Support and features
    ('f0000040-0000-0000-0000-000000000040', 'support.community', 'Community Support', 'Access to community support', 'access', null, 'limits',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000041-0000-0000-0000-000000000041', 'support.email', 'Email Support', 'Access to priority email support', 'access', null, 'limits',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000042-0000-0000-0000-000000000042', 'support.priority_queue', 'Priority Queue', 'Access to priority processing queue', 'access', null, 'limits',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000043-0000-0000-0000-000000000043', 'features.early_access', 'Early Access Features', 'Access to early access features', 'access', null, 'limits',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000044-0000-0000-0000-000000000044', 'features.workspace_isolation', 'SOC-2 Workspace Isolation', 'SOC-2 compliant workspace isolation', 'access', null, 'limits',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000045-0000-0000-0000-000000000045', 'features.sso', 'Single Sign-On', 'SSO integration', 'access', null, 'limits',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000046-0000-0000-0000-000000000046', 'features.dedicated_csm', 'Dedicated CSM', 'Dedicated Customer Success Manager', 'access', null, 'limits',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
    ('f0000047-0000-0000-0000-000000000047', 'features.on_prem', 'On-Premises Option', 'On-premises deployment option', 'access', null, 'limits',
     '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
ON CONFLICT (feature_id) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    feature_description = EXCLUDED.feature_description,
    feature_type = EXCLUDED.feature_type,
    parent_feature_id = EXCLUDED.parent_feature_id,
    feature_category = EXCLUDED.feature_category,
    default_value = EXCLUDED.default_value,
    value_schema = EXCLUDED.value_schema,
    updated_at = now();

-- Plan Features - Map features to plans
-- Basic Plan ($10) - Claude only, Filesystem r/w, Built-in tools, 200K tok/min, 10 req/min
INSERT INTO "abi_billing"."plan_features" (
    "plan_id", "feature_id", "feature_value", "is_enabled"
) VALUES 
    -- Basic: Claude access only
    ('11111111-1111-1111-1111-111111111111', 'f0000001-0000-0000-0000-000000000001', '{"enabled": true}', true),
    ('11111111-1111-1111-1111-111111111111', 'f0000002-0000-0000-0000-000000000002', '{"enabled": true}', true),
    ('11111111-1111-1111-1111-111111111111', 'f0000003-0000-0000-0000-000000000003', '{"enabled": true}', true),
    ('11111111-1111-1111-1111-111111111111', 'f0000005-0000-0000-0000-000000000005', '{"enabled": true}', true), -- Haiku
    -- Basic: Filesystem r/w
    ('11111111-1111-1111-1111-111111111111', 'f0000010-0000-0000-0000-000000000010', '{"enabled": true}', true),
    ('11111111-1111-1111-1111-111111111111', 'f0000011-0000-0000-0000-000000000011', '{"enabled": true, "read": true, "write": true}', true),
    -- Basic: Built-in tools
    ('11111111-1111-1111-1111-111111111111', 'f0000020-0000-0000-0000-000000000020', '{"enabled": true}', true),
    ('11111111-1111-1111-1111-111111111111', 'f0000021-0000-0000-0000-000000000021', '{"enabled": true}', true),
    -- Basic: Rate limits
    ('11111111-1111-1111-1111-111111111111', 'f0000030-0000-0000-0000-000000000030', '{"limit": 200000}', true),
    ('11111111-1111-1111-1111-111111111111', 'f0000031-0000-0000-0000-000000000031', '{"limit": 10}', true),
    -- Basic: Community support
    ('11111111-1111-1111-1111-111111111111', 'f0000040-0000-0000-0000-000000000040', '{"enabled": true}', true),
    
    -- Advanced Plan ($30) - All models, Read-only datasources, 500K tok/min, 30 req/min
    ('22222222-2222-2222-2222-222222222222', 'f0000001-0000-0000-0000-000000000001', '{"enabled": true}', true),
    ('22222222-2222-2222-2222-222222222222', 'f0000002-0000-0000-0000-000000000002', '{"enabled": true}', true),
    ('22222222-2222-2222-2222-222222222222', 'f0000003-0000-0000-0000-000000000003', '{"enabled": true}', true),
    ('22222222-2222-2222-2222-222222222222', 'f0000004-0000-0000-0000-000000000004', '{"enabled": true}', true), -- Opus
    ('22222222-2222-2222-2222-222222222222', 'f0000005-0000-0000-0000-000000000005', '{"enabled": true}', true), -- Haiku
    ('22222222-2222-2222-2222-222222222222', 'f0000006-0000-0000-0000-000000000006', '{"enabled": true}', true), -- OpenAI
    ('22222222-2222-2222-2222-222222222222', 'f0000007-0000-0000-0000-000000000007', '{"enabled": true}', true), -- GPT-4
    ('22222222-2222-2222-2222-222222222222', 'f0000008-0000-0000-0000-000000000008', '{"enabled": true}', true), -- GPT-3.5
    -- Advanced: Read-only datasources
    ('22222222-2222-2222-2222-222222222222', 'f0000010-0000-0000-0000-000000000010', '{"enabled": true}', true),
    ('22222222-2222-2222-2222-222222222222', 'f0000011-0000-0000-0000-000000000011', '{"enabled": true, "read": true, "write": true}', true),
    ('22222222-2222-2222-2222-222222222222', 'f0000012-0000-0000-0000-000000000012', '{"enabled": true, "read": true, "write": false}', true),
    ('22222222-2222-2222-2222-222222222222', 'f0000013-0000-0000-0000-000000000013', '{"enabled": true, "read": true, "write": false}', true),
    ('22222222-2222-2222-2222-222222222222', 'f0000014-0000-0000-0000-000000000014', '{"enabled": true, "read": true, "write": false}', true),
    -- Advanced: Built-in tools
    ('22222222-2222-2222-2222-222222222222', 'f0000020-0000-0000-0000-000000000020', '{"enabled": true}', true),
    ('22222222-2222-2222-2222-222222222222', 'f0000021-0000-0000-0000-000000000021', '{"enabled": true}', true),
    -- Advanced: Rate limits
    ('22222222-2222-2222-2222-222222222222', 'f0000030-0000-0000-0000-000000000030', '{"limit": 500000}', true),
    ('22222222-2222-2222-2222-222222222222', 'f0000031-0000-0000-0000-000000000031', '{"limit": 30}', true),
    -- Advanced: Email support + early access
    ('22222222-2222-2222-2222-222222222222', 'f0000041-0000-0000-0000-000000000041', '{"enabled": true}', true),
    ('22222222-2222-2222-2222-222222222222', 'f0000043-0000-0000-0000-000000000043', '{"enabled": true}', true),
    
    -- Professional Plan ($99) - All models, All datasources r/w, External tools, 1.75M tok/min, 150 req/min
    ('33333333-3333-3333-3333-333333333333', 'f0000001-0000-0000-0000-000000000001', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000002-0000-0000-0000-000000000002', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000003-0000-0000-0000-000000000003', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000004-0000-0000-0000-000000000004', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000005-0000-0000-0000-000000000005', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000006-0000-0000-0000-000000000006', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000007-0000-0000-0000-000000000007', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000008-0000-0000-0000-000000000008', '{"enabled": true}', true),
    -- Professional: All datasources r/w
    ('33333333-3333-3333-3333-333333333333', 'f0000010-0000-0000-0000-000000000010', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000011-0000-0000-0000-000000000011', '{"enabled": true, "read": true, "write": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000012-0000-0000-0000-000000000012', '{"enabled": true, "read": true, "write": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000013-0000-0000-0000-000000000013', '{"enabled": true, "read": true, "write": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000014-0000-0000-0000-000000000014', '{"enabled": true, "read": true, "write": true}', true),
    -- Professional: All tools
    ('33333333-3333-3333-3333-333333333333', 'f0000020-0000-0000-0000-000000000020', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000021-0000-0000-0000-000000000021', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000022-0000-0000-0000-000000000022', '{"enabled": true}', true),
    -- Professional: Higher rate limits
    ('33333333-3333-3333-3333-333333333333', 'f0000030-0000-0000-0000-000000000030', '{"limit": 1750000}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000031-0000-0000-0000-000000000031', '{"limit": 150}', true),
    -- Professional: Priority queue, SOC-2 workspace isolation
    ('33333333-3333-3333-3333-333333333333', 'f0000041-0000-0000-0000-000000000041', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000042-0000-0000-0000-000000000042', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000043-0000-0000-0000-000000000043', '{"enabled": true}', true),
    ('33333333-3333-3333-3333-333333333333', 'f0000044-0000-0000-0000-000000000044', '{"enabled": true}', true),
    
    -- Enterprise Plan (Custom) - Everything enabled
    ('44444444-4444-4444-4444-444444444444', 'f0000001-0000-0000-0000-000000000001', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000002-0000-0000-0000-000000000002', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000003-0000-0000-0000-000000000003', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000004-0000-0000-0000-000000000004', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000005-0000-0000-0000-000000000005', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000006-0000-0000-0000-000000000006', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000007-0000-0000-0000-000000000007', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000008-0000-0000-0000-000000000008', '{"enabled": true}', true),
    -- Enterprise: All datasources r/w
    ('44444444-4444-4444-4444-444444444444', 'f0000010-0000-0000-0000-000000000010', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000011-0000-0000-0000-000000000011', '{"enabled": true, "read": true, "write": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000012-0000-0000-0000-000000000012', '{"enabled": true, "read": true, "write": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000013-0000-0000-0000-000000000013', '{"enabled": true, "read": true, "write": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000014-0000-0000-0000-000000000014', '{"enabled": true, "read": true, "write": true}', true),
    -- Enterprise: All tools
    ('44444444-4444-4444-4444-444444444444', 'f0000020-0000-0000-0000-000000000020', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000021-0000-0000-0000-000000000021', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000022-0000-0000-0000-000000000022', '{"enabled": true}', true),
    -- Enterprise: Custom limits (set high)
    ('44444444-4444-4444-4444-444444444444', 'f0000030-0000-0000-0000-000000000030', '{"limit": 10000000}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000031-0000-0000-0000-000000000031', '{"limit": 1000}', true),
    -- Enterprise: All premium features
    ('44444444-4444-4444-4444-444444444444', 'f0000041-0000-0000-0000-000000000041', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000042-0000-0000-0000-000000000042', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000043-0000-0000-0000-000000000043', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000044-0000-0000-0000-000000000044', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000045-0000-0000-0000-000000000045', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000046-0000-0000-0000-000000000046', '{"enabled": true}', true),
    ('44444444-4444-4444-4444-444444444444', 'f0000047-0000-0000-0000-000000000047', '{"enabled": true}', true)
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
    feature_value = EXCLUDED.feature_value,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now();