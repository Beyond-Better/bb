-- Feature System Migration - Complete Implementation
-- Migration: 20250711102800_create_feature_system.sql
-- Purpose: Create comprehensive feature management system with hierarchical features, plan mappings, and security
-- Affected: Creates new abi_core schema tables, functions, and security policies
-- Special considerations: Uses abi_core schema for core functionality, implements proper user reference architecture

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Create schema if it doesn't exist
create schema if not exists "abi_core";

-- Feature definitions table - master list of all features with hierarchical structure
create table if not exists "abi_core"."feature_definitions" (
    "feature_id" uuid default gen_random_uuid() not null,
    "feature_key" text not null, -- hierarchical key e.g., "models.claude.opus", "datasources.github.write"
    "feature_name" text not null, -- human-readable name
    "feature_description" text,
    "feature_type" text not null, -- 'access', 'limit', 'configuration'
    "parent_feature_id" uuid, -- for hierarchical inheritance
    "feature_category" text, -- 'models', 'datasources', 'tools', 'limits'
    "default_value" jsonb, -- default configuration/limit values
    "value_schema" jsonb, -- json schema for validation
    "is_active" boolean default true not null,
    "created_at" timestamptz default now() not null,
    "updated_at" timestamptz default now() not null,
    
    constraint "feature_definitions_pkey" primary key ("feature_id"),
    constraint "feature_definitions_feature_key_key" unique ("feature_key"),
    constraint "feature_definitions_feature_type_check" check (
        "feature_type" in ('access', 'limit', 'configuration')
    ),
    constraint "feature_definitions_feature_category_check" check (
        "feature_category" in ('models', 'datasources', 'tools', 'limits', 'ui', 'support', 'features')
    ),
    constraint "feature_definitions_parent_feature_id_fkey" foreign key ("parent_feature_id") 
        references "abi_core"."feature_definitions"("feature_id") on delete cascade
);

-- Plan features table - defines what features each plan includes
create table if not exists "abi_core"."plan_features" (
    "plan_feature_id" uuid default gen_random_uuid() not null,
    "plan_id" uuid not null,
    "feature_id" uuid not null,
    "feature_value" jsonb not null, -- the actual value/configuration for this plan
    "is_enabled" boolean default true not null,
    "created_at" timestamptz default now() not null,
    "updated_at" timestamptz default now() not null,
    
    constraint "plan_features_pkey" primary key ("plan_feature_id"),
    constraint "plan_features_plan_id_feature_id_key" unique ("plan_id", "feature_id"),
    constraint "plan_features_plan_id_fkey" foreign key ("plan_id") 
        references "abi_billing"."subscription_plans"("plan_id") on delete cascade,
    constraint "plan_features_feature_id_fkey" foreign key ("feature_id") 
        references "abi_core"."feature_definitions"("feature_id") on delete cascade
);

-- User feature overrides table - for custom plans or temporary overrides
create table if not exists "abi_core"."user_feature_overrides" (
    "override_id" uuid default gen_random_uuid() not null,
    "user_id" uuid not null,
    "feature_id" uuid not null,
    "override_value" jsonb not null,
    "override_reason" text, -- 'custom_plan', 'temporary_access', 'support_override'
    "expires_at" timestamptz, -- for temporary overrides
    "created_by" uuid, -- admin who created the override
    "created_at" timestamptz default now() not null,
    "updated_at" timestamptz default now() not null,
    
    constraint "user_feature_overrides_pkey" primary key ("override_id"),
    constraint "user_feature_overrides_user_id_feature_id_key" unique ("user_id", "feature_id"),
    constraint "user_feature_overrides_user_id_fkey" foreign key ("user_id") 
        references "abi_auth"."user_profiles"("profile_id") on delete cascade,
    constraint "user_feature_overrides_feature_id_fkey" foreign key ("feature_id") 
        references "abi_core"."feature_definitions"("feature_id") on delete cascade,
    constraint "user_feature_overrides_created_by_fkey" foreign key ("created_by") 
        references "abi_auth"."user_profiles"("profile_id") on delete set null,
    constraint "user_feature_overrides_override_reason_check" check (
        "override_reason" in ('custom_plan', 'temporary_access', 'support_override')
    )
);

-- Feature access cache table - for performance optimization
create table if not exists "abi_core"."feature_access_cache" (
    "cache_id" uuid default gen_random_uuid() not null,
    "user_id" uuid not null,
    "feature_key" text not null,
    "access_granted" boolean not null,
    "feature_value" jsonb,
    "cache_expires_at" timestamptz not null,
    "created_at" timestamptz default now() not null,
    
    constraint "feature_access_cache_pkey" primary key ("cache_id"),
    constraint "feature_access_cache_user_id_feature_key_key" unique ("user_id", "feature_key"),
    constraint "feature_access_cache_user_id_fkey" foreign key ("user_id") 
        references "abi_auth"."user_profiles"("profile_id") on delete cascade
);

-- Feature usage tracking table - for analytics and debugging
create table if not exists "abi_core"."feature_usage_log" (
    "log_id" uuid default gen_random_uuid() not null,
    "user_id" uuid not null,
    "feature_key" text not null,
    "access_granted" boolean not null,
    "access_reason" text, -- 'plan_access', 'override', 'inheritance', 'denied'
    "request_context" jsonb, -- api endpoint, cli command, etc.
    "created_at" timestamptz default now() not null,
    
    constraint "feature_usage_log_pkey" primary key ("log_id"),
    constraint "feature_usage_log_user_id_fkey" foreign key ("user_id") 
        references "abi_auth"."user_profiles"("profile_id") on delete cascade,
    constraint "feature_usage_log_access_reason_check" check (
        "access_reason" in ('plan_access', 'override', 'inheritance', 'denied', 'cache_hit')
    )
);

-- Create indexes for performance
create index if not exists "idx_feature_definitions_parent_feature_id" 
    on "abi_core"."feature_definitions" using btree ("parent_feature_id");
create index if not exists "idx_feature_definitions_feature_key" 
    on "abi_core"."feature_definitions" using btree ("feature_key");
create index if not exists "idx_feature_definitions_feature_category" 
    on "abi_core"."feature_definitions" using btree ("feature_category");
create index if not exists "idx_feature_definitions_is_active" 
    on "abi_core"."feature_definitions" using btree ("is_active");

create index if not exists "idx_plan_features_plan_id" 
    on "abi_core"."plan_features" using btree ("plan_id");
create index if not exists "idx_plan_features_feature_id" 
    on "abi_core"."plan_features" using btree ("feature_id");
create index if not exists "idx_plan_features_is_enabled" 
    on "abi_core"."plan_features" using btree ("is_enabled");

create index if not exists "idx_user_feature_overrides_user_id" 
    on "abi_core"."user_feature_overrides" using btree ("user_id");
create index if not exists "idx_user_feature_overrides_expires_at" 
    on "abi_core"."user_feature_overrides" using btree ("expires_at");
create index if not exists "idx_user_feature_overrides_feature_id" 
    on "abi_core"."user_feature_overrides" using btree ("feature_id");

create index if not exists "idx_feature_access_cache_user_id" 
    on "abi_core"."feature_access_cache" using btree ("user_id");
create index if not exists "idx_feature_access_cache_expires_at" 
    on "abi_core"."feature_access_cache" using btree ("cache_expires_at");
create index if not exists "idx_feature_access_cache_feature_key" 
    on "abi_core"."feature_access_cache" using btree ("feature_key");

create index if not exists "idx_feature_usage_log_user_id" 
    on "abi_core"."feature_usage_log" using btree ("user_id");
create index if not exists "idx_feature_usage_log_created_at" 
    on "abi_core"."feature_usage_log" using btree ("created_at");
create index if not exists "idx_feature_usage_log_feature_key" 
    on "abi_core"."feature_usage_log" using btree ("feature_key");

-- Enable row level security on all tables
alter table "abi_core"."feature_definitions" enable row level security;
alter table "abi_core"."plan_features" enable row level security;
alter table "abi_core"."user_feature_overrides" enable row level security;
alter table "abi_core"."feature_access_cache" enable row level security;
alter table "abi_core"."feature_usage_log" enable row level security;

-- Grant permissions to roles
grant select, insert, update, delete on table "abi_core"."feature_definitions" to "authenticated", "service_role", "dashboard_user", "anon";
grant select, insert, update, delete on table "abi_core"."plan_features" to "authenticated", "service_role", "dashboard_user", "anon";
grant select, insert, update, delete on table "abi_core"."user_feature_overrides" to "authenticated", "service_role", "dashboard_user", "anon";
grant select, insert, update, delete on table "abi_core"."feature_access_cache" to "authenticated", "service_role", "dashboard_user", "anon";
grant select, insert, update, delete on table "abi_core"."feature_usage_log" to "authenticated", "service_role", "dashboard_user", "anon";

-- Grant usage on schema
grant usage on schema "abi_core" to "authenticated", "service_role", "dashboard_user", "anon";

-- RLS Policies

-- Feature definitions: Public read access, admin write access
create policy "Feature definitions are viewable by everyone"
    on "abi_core"."feature_definitions"
    for select
    to authenticated, anon
    using (true);

create policy "Feature definitions are manageable by service role"
    on "abi_core"."feature_definitions"
    for all
    to service_role
    using (true)
    with check (true);

-- Plan features: Public read access, admin write access
create policy "Plan features are viewable by everyone"
    on "abi_core"."plan_features"
    for select
    to authenticated, anon
    using (true);

create policy "Plan features are manageable by service role"
    on "abi_core"."plan_features"
    for all
    to service_role
    using (true)
    with check (true);

-- User feature overrides: Users can see their own, admins can manage all
create policy "Users can view their own feature overrides"
    on "abi_core"."user_feature_overrides"
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Service role can manage all feature overrides"
    on "abi_core"."user_feature_overrides"
    for all
    to service_role
    using (true)
    with check (true);

-- Feature access cache: Users can see their own, service role can manage all
create policy "Users can view their own feature access cache"
    on "abi_core"."feature_access_cache"
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Service role can manage all feature access cache"
    on "abi_core"."feature_access_cache"
    for all
    to service_role
    using (true)
    with check (true);

-- Feature usage log: Users can see their own, service role can manage all
create policy "Users can view their own feature usage log"
    on "abi_core"."feature_usage_log"
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Service role can manage all feature usage log"
    on "abi_core"."feature_usage_log"
    for all
    to service_role
    using (true)
    with check (true);

-- Add table comments
comment on table "abi_core"."feature_definitions" is 'Master list of all features with hierarchical structure supporting inheritance and dynamic configuration';
comment on table "abi_core"."plan_features" is 'Features included in each subscription plan with specific configuration values';
comment on table "abi_core"."user_feature_overrides" is 'Custom feature overrides for individual users, including temporary access grants';
comment on table "abi_core"."feature_access_cache" is 'Performance cache for feature access results to optimize frequent lookups';
comment on table "abi_core"."feature_usage_log" is 'Analytics and debugging log for all feature access attempts';

-- Add column comments
comment on column "abi_core"."feature_definitions"."feature_key" is 'Hierarchical feature key using dot notation (e.g., models.claude.opus, datasources.github.write)';
comment on column "abi_core"."feature_definitions"."feature_type" is 'Type of feature: access (boolean), limit (numeric), configuration (complex json)';
comment on column "abi_core"."feature_definitions"."parent_feature_id" is 'Parent feature for inheritance - child features inherit parent permissions when not explicitly defined';
comment on column "abi_core"."feature_definitions"."default_value" is 'Default value when feature is not explicitly configured in plans or overrides';
comment on column "abi_core"."feature_definitions"."value_schema" is 'JSON schema for validating feature_value configurations across plans and overrides';

comment on column "abi_core"."plan_features"."feature_value" is 'The actual value/configuration for this feature in this specific plan';
comment on column "abi_core"."user_feature_overrides"."override_reason" is 'Reason for override: custom_plan, temporary_access, support_override';
comment on column "abi_core"."user_feature_overrides"."expires_at" is 'Expiration timestamp for temporary overrides (null for permanent overrides)';
comment on column "abi_core"."feature_access_cache"."cache_expires_at" is 'Cache expiration timestamp - entries are automatically cleaned up after expiration';
comment on column "abi_core"."feature_usage_log"."access_reason" is 'Reason for access decision: plan_access, override, inheritance, denied, cache_hit';
comment on column "abi_core"."feature_usage_log"."request_context" is 'Context information about the request (api endpoint, cli command, etc.) for debugging';