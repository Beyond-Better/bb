-- Feature System Seed Data Functions
-- This file contains functions to initialize feature definitions and plan mappings
-- Uses proper UUID generation and error handling

-- Function to seed subscription plans
create or replace function abi_core.seed_subscription_plans()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_basic_plan_id uuid;
    v_advanced_plan_id uuid;
    v_professional_plan_id uuid;
    v_enterprise_plan_id uuid;
begin
    -- Generate consistent plan IDs for reference
    v_basic_plan_id := gen_random_uuid();
    v_advanced_plan_id := gen_random_uuid();
    v_professional_plan_id := gen_random_uuid();
    v_enterprise_plan_id := gen_random_uuid();
    
    -- Insert or update subscription plans
    insert into abi_billing.subscription_plans (
        plan_id, plan_name, plan_type, plan_price_monthly_cents_usd, plan_price_yearly_cents_usd, plan_active
    ) values 
        (v_basic_plan_id, 'Base', 'free', 0, 0, true),
        (v_advanced_plan_id, 'Build', 'usage', 1900, 20400, true),
        (v_professional_plan_id, 'Beyond', 'usage', 5900, 63600, true),
        (v_enterprise_plan_id, 'Enterprise', 'usage', null, null, true)
    on conflict (plan_name) do update set
        plan_type = excluded.plan_type,
        plan_price_monthly_cents_usd = excluded.plan_price_monthly_cents_usd,
        plan_price_yearly_cents_usd = excluded.plan_price_yearly_cents_usd,
        plan_active = excluded.plan_active,
        updated_at = now();
    
    -- Store plan IDs for use in feature seeding
    perform abi_core.store_seed_plan_ids(v_basic_plan_id, v_advanced_plan_id, v_professional_plan_id, v_enterprise_plan_id);
end;
$$;

-- Function to store plan IDs in a temporary table for other functions
create or replace function abi_core.store_seed_plan_ids(
    p_basic_plan_id uuid,
    p_advanced_plan_id uuid,
    p_professional_plan_id uuid,
    p_enterprise_plan_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
    -- Create temporary table to store plan IDs
    create temp table if not exists temp_plan_ids (
        plan_name text primary key,
        plan_id uuid not null
    );
    
    -- Clear existing data
    delete from temp_plan_ids;
    
    -- Insert plan IDs
    insert into temp_plan_ids (plan_name, plan_id) values
        ('Base', p_basic_plan_id),
        ('Build', p_advanced_plan_id),
        ('Beyond', p_professional_plan_id),
        ('Enterprise', p_enterprise_plan_id);
end;
$$;

-- Function to seed feature definitions with hierarchical structure
create or replace function abi_core.seed_feature_definitions()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_models_root_id uuid;
    v_claude_models_id uuid;
    v_openai_models_id uuid;
    v_datasources_root_id uuid;
    v_tools_root_id uuid;
begin
    -- Insert root level features and capture IDs
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('models', 'Model Access', 'Access to LLM models', 'access', null, 'models', 
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        updated_at = now()
    returning feature_id into v_models_root_id;
    
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('datasources', 'Data Sources', 'Access to data sources', 'access', null, 'datasources',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        updated_at = now()
    returning feature_id into v_datasources_root_id;
    
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('tools', 'Tools Access', 'Access to tools and integrations', 'access', null, 'tools',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        updated_at = now()
    returning feature_id into v_tools_root_id;
    
    -- Insert claude model hierarchy
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('models.claude', 'Claude Models', 'Access to Claude models', 'access', v_models_root_id, 'models',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        parent_feature_id = excluded.parent_feature_id,
        updated_at = now()
    returning feature_id into v_claude_models_id;
    
    -- Insert specific claude models
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('models.claude.sonnet', 'Claude Sonnet', 'Access to Claude Sonnet models', 'access', v_claude_models_id, 'models',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('models.claude.opus', 'Claude Opus', 'Access to Claude Opus models', 'access', v_claude_models_id, 'models',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('models.claude.haiku', 'Claude Haiku', 'Access to Claude Haiku models', 'access', v_claude_models_id, 'models',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        parent_feature_id = excluded.parent_feature_id,
        updated_at = now();
    
    -- Insert openai model hierarchy
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('models.openai', 'OpenAI Models', 'Access to OpenAI models', 'access', v_models_root_id, 'models',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        parent_feature_id = excluded.parent_feature_id,
        updated_at = now()
    returning feature_id into v_openai_models_id;
    
    -- Insert specific openai models
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('models.openai.gpt4', 'GPT-4 Models', 'Access to GPT-4 models', 'access', v_openai_models_id, 'models',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('models.openai.gpt3', 'GPT-3.5 Models', 'Access to GPT-3.5 models', 'access', v_openai_models_id, 'models',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        parent_feature_id = excluded.parent_feature_id,
        updated_at = now();
    
    -- Insert Google Gemini models
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('models.gemini', 'Google Gemini Models', 'Access to Google Gemini models', 'access', v_models_root_id, 'models',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        parent_feature_id = excluded.parent_feature_id,
        updated_at = now();
    
    -- Insert Groq models
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('models.groq', 'Groq Models', 'Access to Groq open-source models', 'access', v_models_root_id, 'models',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        parent_feature_id = excluded.parent_feature_id,
        updated_at = now();
    
    -- Insert Ollama models
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('models.ollama', 'Ollama Models', 'Access to local Ollama models', 'access', v_models_root_id, 'models',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        parent_feature_id = excluded.parent_feature_id,
        updated_at = now();
    
    -- Insert datasource features
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('datasources.filesystem', 'Filesystem Access', 'Access to filesystem datasource', 'access', v_datasources_root_id, 'datasources',
         '{"enabled": false, "read": false, "write": false}', 
         '{"type": "object", "properties": {"enabled": {"type": "boolean"}, "read": {"type": "boolean"}, "write": {"type": "boolean"}}}'),
        ('datasources.github', 'GitHub Integration', 'Access to GitHub datasource', 'access', v_datasources_root_id, 'datasources',
         '{"enabled": false, "read": false, "write": false}', 
         '{"type": "object", "properties": {"enabled": {"type": "boolean"}, "read": {"type": "boolean"}, "write": {"type": "boolean"}}}'),
        ('datasources.notion', 'Notion Integration', 'Access to Notion datasource', 'access', v_datasources_root_id, 'datasources',
         '{"enabled": false, "read": false, "write": false}', 
         '{"type": "object", "properties": {"enabled": {"type": "boolean"}, "read": {"type": "boolean"}, "write": {"type": "boolean"}}}'),
        ('datasources.supabase', 'Supabase Integration', 'Access to Supabase datasource', 'access', v_datasources_root_id, 'datasources',
         '{"enabled": false, "read": false, "write": false}', 
         '{"type": "object", "properties": {"enabled": {"type": "boolean"}, "read": {"type": "boolean"}, "write": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        parent_feature_id = excluded.parent_feature_id,
        updated_at = now();
    
    -- Insert tools features
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('tools.builtin', 'Built-in Tools', 'Access to built-in tools', 'access', v_tools_root_id, 'tools',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('tools.external', 'External Tools (MCP)', 'Access to external MCP tools', 'access', v_tools_root_id, 'tools',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        parent_feature_id = excluded.parent_feature_id,
        updated_at = now();
    
    -- Insert limit features
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('limits.tokens_per_minute', 'Token Rate Limit', 'Tokens per minute rate limit', 'limit', null, 'limits',
         '{"limit": 1000}', '{"type": "object", "properties": {"limit": {"type": "integer", "minimum": 0}}}'),
        ('limits.requests_per_minute', 'Request Rate Limit', 'Requests per minute rate limit', 'limit', null, 'limits',
         '{"limit": 5}', '{"type": "object", "properties": {"limit": {"type": "integer", "minimum": 0}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        updated_at = now();
    
    -- Insert support and premium features
    insert into abi_core.feature_definitions (
        feature_key, feature_name, feature_description, feature_type, parent_feature_id, feature_category, default_value, value_schema
    ) values 
        ('support.community', 'Community Support', 'Access to community support', 'access', null, 'support',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('support.email', 'Email Support', 'Access to priority email support', 'access', null, 'support',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('support.priority_queue', 'Priority Queue', 'Access to priority processing queue', 'access', null, 'support',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('features.early_access', 'Early Access Features', 'Access to early access features', 'access', null, 'features',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('features.workspace_isolation', 'SOC-2 Workspace Isolation', 'SOC-2 compliant workspace isolation', 'access', null, 'features',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('features.sso', 'Single Sign-On', 'SSO integration', 'access', null, 'features',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('features.dedicated_csm', 'Dedicated CSM', 'Dedicated Customer Success Manager', 'access', null, 'features',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}'),
        ('features.on_prem', 'On-Premises Option', 'On-premises deployment option', 'access', null, 'features',
         '{"enabled": false}', '{"type": "object", "properties": {"enabled": {"type": "boolean"}}}')
    on conflict (feature_key) do update set
        feature_name = excluded.feature_name,
        feature_description = excluded.feature_description,
        updated_at = now();
end;
$$;

-- Function to seed plan features for Base plan
create or replace function abi_core.seed_base_plan_features()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_plan_id uuid;
begin
    -- Get plan ID
    select plan_id into v_plan_id from temp_plan_ids where plan_name = 'Base';
    
    if v_plan_id is null then
        raise exception 'Base plan ID not found. Run seed_subscription_plans first.';
    end if;
    
    -- Base plan features: Claude (Sonnet + Haiku), Filesystem r/w + External read-only, Built-in tools, 300K tok/min, 15 req/min
    insert into abi_core.plan_features (plan_id, feature_id, feature_value, is_enabled)
    select 
        v_plan_id,
        fd.feature_id,
        case fd.feature_key
            when 'models' then '{"enabled": true}'
            when 'models.claude' then '{"enabled": true}'
            when 'models.claude.sonnet' then '{"enabled": true}'
            when 'models.claude.haiku' then '{"enabled": true}'
            when 'models.openai' then '{"enabled": true}'
            when 'models.openai.gpt4' then '{"enabled": true}'
            when 'models.openai.gpt3' then '{"enabled": true}'
            when 'models.gemini' then '{"enabled": true}'
            when 'models.groq' then '{"enabled": true}'
            when 'models.ollama' then '{"enabled": true}'
            when 'datasources' then '{"enabled": true}'
            when 'datasources.filesystem' then '{"enabled": true, "read": true, "write": true}'
            when 'datasources.github' then '{"enabled": true, "read": true, "write": true}'
            when 'datasources.notion' then '{"enabled": true, "read": true, "write": true}'
            when 'datasources.supabase' then '{"enabled": true, "read": true, "write": true}'
            when 'tools' then '{"enabled": true}'
            when 'tools.builtin' then '{"enabled": true}'
            when 'limits.tokens_per_minute' then '{"enabled": true, "limit": 300000}'
            when 'limits.requests_per_minute' then '{"enabled": true, "limit": 15}'
            when 'support.community' then '{"enabled": true}'
        end as feature_value,
        true
    from abi_core.feature_definitions fd
    where fd.feature_key in (
        'models', 'models.claude', 'models.claude.sonnet', 'models.claude.haiku',
        'datasources', 'datasources.filesystem', 'datasources.github', 'datasources.notion', 'datasources.supabase',
        'tools', 'tools.builtin', 'limits.tokens_per_minute', 'limits.requests_per_minute', 'support.community'
    )
    on conflict (plan_id, feature_id) do update set
        feature_value = excluded.feature_value,
        is_enabled = excluded.is_enabled,
        updated_at = now();
end;
$$;

-- Function to seed plan features for Build plan
create or replace function abi_core.seed_build_plan_features()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_plan_id uuid;
begin
    -- Get plan ID
    select plan_id into v_plan_id from temp_plan_ids where plan_name = 'Build';
    
    if v_plan_id is null then
        raise exception 'Build plan ID not found. Run seed_subscription_plans first.';
    end if;
    
    -- Build plan features: Claude (Sonnet + Haiku), All datasources read-write, Built-in tools, 1M tok/min, 50 req/min
    insert into abi_core.plan_features (plan_id, feature_id, feature_value, is_enabled)
    select 
        v_plan_id,
        fd.feature_id,
        case fd.feature_key
            when 'models' then '{"enabled": true}'
            when 'models.claude' then '{"enabled": true}'
            when 'models.claude.sonnet' then '{"enabled": true}'
            when 'models.claude.haiku' then '{"enabled": true}'
            when 'datasources' then '{"enabled": true}'
            when 'datasources.filesystem' then '{"enabled": true, "read": true, "write": true}'
            when 'datasources.github' then '{"enabled": true, "read": true, "write": false}'
            when 'datasources.notion' then '{"enabled": true, "read": true, "write": false}'
            when 'datasources.supabase' then '{"enabled": true, "read": true, "write": false}'
            when 'tools' then '{"enabled": true}'
            when 'tools.builtin' then '{"enabled": true}'
            when 'limits.tokens_per_minute' then '{"enabled": true, "limit": 1000000}'
            when 'limits.requests_per_minute' then '{"enabled": true, "limit": 50}'
            when 'support.email' then '{"enabled": true}'
            when 'features.early_access' then '{"enabled": true}'
        end as feature_value,
        true
    from abi_core.feature_definitions fd
    where fd.feature_key in (
        'models', 'models.claude', 'models.claude.sonnet', 'models.claude.haiku',
        'datasources', 'datasources.filesystem', 'datasources.github', 'datasources.notion', 'datasources.supabase',
        'tools', 'tools.builtin', 'limits.tokens_per_minute', 'limits.requests_per_minute',
        'support.email', 'features.early_access'
    )
    on conflict (plan_id, feature_id) do update set
        feature_value = excluded.feature_value,
        is_enabled = excluded.is_enabled,
        updated_at = now();
end;
$$;

-- Function to seed plan features for Beyond plan
create or replace function abi_core.seed_beyond_plan_features()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_plan_id uuid;
begin
    -- Get plan ID
    select plan_id into v_plan_id from temp_plan_ids where plan_name = 'Beyond';
    
    if v_plan_id is null then
        raise exception 'Beyond plan ID not found. Run seed_subscription_plans first.';
    end if;
    
    -- Beyond plan features: All models (including Gemini, Groq, Ollama), All datasources r/w, External tools, 3M tok/min, 150 req/min
    insert into abi_core.plan_features (plan_id, feature_id, feature_value, is_enabled)
    select 
        v_plan_id,
        fd.feature_id,
        case fd.feature_key
            when 'models' then '{"enabled": true}'
            when 'models.claude' then '{"enabled": true}'
            when 'models.claude.sonnet' then '{"enabled": true}'
            when 'models.claude.opus' then '{"enabled": true}'
            when 'models.claude.haiku' then '{"enabled": true}'
            when 'models.openai' then '{"enabled": true}'
            when 'models.openai.gpt4' then '{"enabled": true}'
            when 'models.openai.gpt3' then '{"enabled": true}'
            when 'datasources' then '{"enabled": true}'
            when 'datasources.filesystem' then '{"enabled": true, "read": true, "write": true}'
            when 'datasources.github' then '{"enabled": true, "read": true, "write": true}'
            when 'datasources.notion' then '{"enabled": true, "read": true, "write": true}'
            when 'datasources.supabase' then '{"enabled": true, "read": true, "write": true}'
            when 'tools' then '{"enabled": true}'
            when 'tools.builtin' then '{"enabled": true}'
            when 'tools.external' then '{"enabled": true}'
            when 'limits.tokens_per_minute' then '{"limit": 3000000}'
            when 'limits.requests_per_minute' then '{"limit": 150}'
            when 'support.email' then '{"enabled": true}'
            when 'support.priority_queue' then '{"enabled": true}'
            when 'features.early_access' then '{"enabled": true}'
            when 'features.workspace_isolation' then '{"enabled": true}'
        end as feature_value,
        true
    from abi_core.feature_definitions fd
    where fd.feature_key in (
        'models', 'models.claude', 'models.claude.sonnet', 'models.claude.opus', 'models.claude.haiku',
        'models.openai', 'models.openai.gpt4', 'models.openai.gpt3',
        'models.gemini', 'models.groq', 'models.ollama',
        'datasources', 'datasources.filesystem', 'datasources.github', 'datasources.notion', 'datasources.supabase',
        'tools', 'tools.builtin', 'tools.external', 'limits.tokens_per_minute', 'limits.requests_per_minute',
        'support.email', 'support.priority_queue', 'features.early_access', 'features.workspace_isolation'
    )
    on conflict (plan_id, feature_id) do update set
        feature_value = excluded.feature_value,
        is_enabled = excluded.is_enabled,
        updated_at = now();
end;
$$;

-- Function to seed plan features for Enterprise plan
create or replace function abi_core.seed_enterprise_plan_features()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_plan_id uuid;
begin
    -- Get plan ID
    select plan_id into v_plan_id from temp_plan_ids where plan_name = 'Enterprise';
    
    if v_plan_id is null then
        raise exception 'Enterprise plan ID not found. Run seed_subscription_plans first.';
    end if;
    
    -- Enterprise plan features: Everything enabled with high limits
    insert into abi_core.plan_features (plan_id, feature_id, feature_value, is_enabled)
    select 
        v_plan_id,
        fd.feature_id,
        case fd.feature_key
            when 'models' then '{"enabled": true}'
            when 'models.claude' then '{"enabled": true}'
            when 'models.claude.sonnet' then '{"enabled": true}'
            when 'models.claude.opus' then '{"enabled": true}'
            when 'models.claude.haiku' then '{"enabled": true}'
            when 'models.openai' then '{"enabled": true}'
            when 'models.openai.gpt4' then '{"enabled": true}'
            when 'models.openai.gpt3' then '{"enabled": true}'
            when 'models.gemini' then '{"enabled": true}'
            when 'models.groq' then '{"enabled": true}'
            when 'models.ollama' then '{"enabled": true}'
            when 'datasources' then '{"enabled": true}'
            when 'datasources.filesystem' then '{"enabled": true, "read": true, "write": true}'
            when 'datasources.github' then '{"enabled": true, "read": true, "write": true}'
            when 'datasources.notion' then '{"enabled": true, "read": true, "write": true}'
            when 'datasources.supabase' then '{"enabled": true, "read": true, "write": true}'
            when 'tools' then '{"enabled": true}'
            when 'tools.builtin' then '{"enabled": true}'
            when 'tools.external' then '{"enabled": true}'
            when 'limits.tokens_per_minute' then '{"limit": 10000000}'
            when 'limits.requests_per_minute' then '{"limit": 1000}'
            when 'support.email' then '{"enabled": true}'
            when 'support.priority_queue' then '{"enabled": true}'
            when 'features.early_access' then '{"enabled": true}'
            when 'features.workspace_isolation' then '{"enabled": true}'
            when 'features.sso' then '{"enabled": true}'
            when 'features.dedicated_csm' then '{"enabled": true}'
            when 'features.on_prem' then '{"enabled": true}'
        end as feature_value,
        true
    from abi_core.feature_definitions fd
    where fd.feature_key in (
        'models', 'models.claude', 'models.claude.sonnet', 'models.claude.opus', 'models.claude.haiku',
        'models.openai', 'models.openai.gpt4', 'models.openai.gpt3',
        'models.gemini', 'models.groq', 'models.ollama',
        'datasources', 'datasources.filesystem', 'datasources.github', 'datasources.notion', 'datasources.supabase',
        'tools', 'tools.builtin', 'tools.external', 'limits.tokens_per_minute', 'limits.requests_per_minute',
        'support.email', 'support.priority_queue', 'features.early_access', 'features.workspace_isolation',
        'features.sso', 'features.dedicated_csm', 'features.on_prem'
    )
    on conflict (plan_id, feature_id) do update set
        feature_value = excluded.feature_value,
        is_enabled = excluded.is_enabled,
        updated_at = now();
end;
$$;

-- Main seeding function that orchestrates the entire process
create or replace function abi_core.seed_all_feature_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
    -- Seed subscription plans first
    perform abi_core.seed_subscription_plans();
    
    -- Seed feature definitions
    perform abi_core.seed_feature_definitions();
    
    -- Seed plan features for each plan
    perform abi_core.seed_base_plan_features();
    perform abi_core.seed_build_plan_features();
    perform abi_core.seed_beyond_plan_features();
    perform abi_core.seed_enterprise_plan_features();
    
    -- Clean up temporary table
    drop table if exists temp_plan_ids;
    
    raise notice 'Feature system seeding completed successfully';
end;
$$;

-- Grant execute permissions on functions
grant execute on function abi_core.seed_subscription_plans() to service_role;
grant execute on function abi_core.store_seed_plan_ids(uuid, uuid, uuid, uuid) to service_role;
grant execute on function abi_core.seed_feature_definitions() to service_role;
grant execute on function abi_core.seed_base_plan_features() to service_role;
grant execute on function abi_core.seed_build_plan_features() to service_role;
grant execute on function abi_core.seed_beyond_plan_features() to service_role;
grant execute on function abi_core.seed_enterprise_plan_features() to service_role;
grant execute on function abi_core.seed_all_feature_data() to service_role;

-- Usage:
-- select abi_core.seed_all_feature_data();