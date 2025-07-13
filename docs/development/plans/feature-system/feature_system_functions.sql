-- Feature System Database Functions
-- Core functions for checking feature access, inheritance, and cache management

-- Function to check if a user has access to a specific feature
-- Returns detailed access information including inheritance chain
create or replace function abi_core.check_feature_access(
    p_user_id uuid,
    p_feature_key text
)
returns table (
    access_granted boolean,
    access_reason text,
    feature_value jsonb,
    inheritance_chain text[]
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
    v_user_subscription_plan_id uuid;
    v_feature_definition_record record;
    v_plan_feature_record record;
    v_override_record record;
    v_access_granted boolean := false;
    v_access_reason text := 'denied';
    v_feature_value jsonb := null;
    v_inheritance_chain text[] := array[]::text[];
    v_current_feature_key text;
    v_parent_feature_id uuid;
begin
    -- Validate inputs
    if p_user_id is null or p_feature_key is null then
        return query select false, 'invalid_input', null::jsonb, array[]::text[];
        return;
    end if;
    
    -- Get user's current subscription plan
    select us.plan_id into v_user_subscription_plan_id
    from abi_billing.user_subscriptions us
    join abi_auth.user_profiles up on us.user_id = up.profile_id
    where up.profile_id = p_user_id 
    and us.subscription_status = 'ACTIVE'
    order by us.created_at desc
    limit 1;
    
    if v_user_subscription_plan_id is null then
        return query select false, 'no_active_subscription', null::jsonb, array[]::text[];
        return;
    end if;
    
    -- Check for user-specific override first
    select * into v_override_record
    from abi_core.user_feature_overrides ufo
    join abi_core.feature_definitions fd on ufo.feature_id = fd.feature_id
    where ufo.user_id = p_user_id
    and fd.feature_key = p_feature_key
    and (ufo.expires_at is null or ufo.expires_at > now());
    
    if found then
        return query select true, 'user_override', v_override_record.override_value, array[p_feature_key];
        return;
    end if;
    
    -- Get feature definition
    select * into v_feature_definition_record
    from abi_core.feature_definitions fd
    where fd.feature_key = p_feature_key
    and fd.is_active = true;
    
    if not found then
        return query select false, 'feature_not_found', null::jsonb, array[]::text[];
        return;
    end if;
    
    -- Check direct plan feature access
    select * into v_plan_feature_record
    from abi_core.plan_features pf
    where pf.plan_id = v_user_subscription_plan_id
    and pf.feature_id = v_feature_definition_record.feature_id
    and pf.is_enabled = true
    and coalesce((pf.feature_value->>'enabled')::boolean, false) = true;
    
    if found then
        return query select true, 'direct_plan_access', v_plan_feature_record.feature_value, array[p_feature_key];
        return;
    end if;
    
    -- Check inheritance chain
    v_current_feature_key := p_feature_key;
    v_parent_feature_id := v_feature_definition_record.parent_feature_id;
    v_inheritance_chain := array[p_feature_key];
    
    while v_parent_feature_id is not null loop
        -- Get parent feature details
        select * into v_feature_definition_record
        from abi_core.feature_definitions fd
        where fd.feature_id = v_parent_feature_id
        and fd.is_active = true;
        
        if not found then
            exit;
        end if;
        
        -- Add to inheritance chain
        v_inheritance_chain := v_inheritance_chain || v_feature_definition_record.feature_key;
        
        -- Check if plan has access to parent feature
        select * into v_plan_feature_record
        from abi_core.plan_features pf
        where pf.plan_id = v_user_subscription_plan_id
        and pf.feature_id = v_feature_definition_record.feature_id
        and pf.is_enabled = true
        and coalesce((pf.feature_value->>'enabled')::boolean, false) = true;
        
        if found then
            return query select true, 'inherited_access', v_plan_feature_record.feature_value, v_inheritance_chain;
            return;
        end if;
        
        -- Move up the chain
        v_parent_feature_id := v_feature_definition_record.parent_feature_id;
    end loop;
    
    -- No access found
    return query select false, 'plan_restriction', null::jsonb, v_inheritance_chain;
end;
$$;

-- Function to check feature access with caching
create or replace function abi_core.check_feature_access_cached(
    p_user_id uuid,
    p_feature_key text
)
returns table (
    access_granted boolean,
    access_reason text,
    feature_value jsonb,
    from_cache boolean
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
    v_cache_record record;
    v_access_result record;
    v_cache_ttl interval := '1 hour';
begin
    -- Check cache first
    select * into v_cache_record
    from abi_core.feature_access_cache fac
    where fac.user_id = p_user_id
    and fac.feature_key = p_feature_key
    and fac.cache_expires_at > now();
    
    if found then
        return query select 
            v_cache_record.access_granted,
            'cache_hit',
            v_cache_record.feature_value,
            true;
        return;
    end if;
    
    -- Cache miss - check actual access
    select * into v_access_result
    from abi_core.check_feature_access(p_user_id, p_feature_key)
    limit 1;
    
    -- Store in cache
    insert into abi_core.feature_access_cache (
        user_id, feature_key, access_granted, feature_value, cache_expires_at
    ) values (
        p_user_id, p_feature_key, v_access_result.access_granted, 
        v_access_result.feature_value, now() + v_cache_ttl
    )
    on conflict (user_id, feature_key) do update set
        access_granted = excluded.access_granted,
        feature_value = excluded.feature_value,
        cache_expires_at = excluded.cache_expires_at,
        created_at = now();
    
    return query select 
        v_access_result.access_granted,
        v_access_result.access_reason,
        v_access_result.feature_value,
        false;
end;
$$;

-- Function to get all features for a user with their access status
create or replace function abi_core.get_user_features(
    p_user_id uuid
)
returns table (
    feature_key text,
    feature_name text,
    feature_description text,
    feature_type text,
    feature_category text,
    access_granted boolean,
    access_reason text,
    feature_value jsonb
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
    v_feature_record record;
    v_access_result record;
begin
    -- Loop through all active features
    for v_feature_record in 
        select fd.feature_key, fd.feature_name, fd.feature_description, fd.feature_type, fd.feature_category
        from abi_core.feature_definitions fd
        where fd.is_active = true
        order by fd.feature_category, fd.feature_key
    loop
        -- Check access for each feature
        select * into v_access_result
        from abi_core.check_feature_access_cached(p_user_id, v_feature_record.feature_key)
        limit 1;
        
        return query select
            v_feature_record.feature_key,
            v_feature_record.feature_name,
            v_feature_record.feature_description,
            v_feature_record.feature_type,
            v_feature_record.feature_category,
            v_access_result.access_granted,
            v_access_result.access_reason,
            v_access_result.feature_value;
    end loop;
end;
$$;

-- Function to create a feature override
create or replace function abi_core.create_feature_override(
    p_user_id uuid,
    p_feature_key text,
    p_override_value jsonb,
    p_override_reason text default 'support_override',
    p_expires_at timestamptz default null,
    p_created_by uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_feature_id uuid;
    v_override_id uuid;
begin
    -- Validate inputs
    if p_user_id is null or p_feature_key is null or p_override_value is null then
        raise exception 'user_id, feature_key, and override_value are required';
    end if;
    
    if p_override_reason not in ('custom_plan', 'temporary_access', 'support_override') then
        raise exception 'Invalid override_reason. Must be one of: custom_plan, temporary_access, support_override';
    end if;
    
    -- Get feature ID
    select fd.feature_id into v_feature_id
    from abi_core.feature_definitions fd
    where fd.feature_key = p_feature_key
    and fd.is_active = true;
    
    if v_feature_id is null then
        raise exception 'Feature not found: %', p_feature_key;
    end if;
    
    -- Create override
    insert into abi_core.user_feature_overrides (
        user_id, feature_id, override_value, override_reason, expires_at, created_by
    ) values (
        p_user_id, v_feature_id, p_override_value, p_override_reason, p_expires_at, p_created_by
    )
    on conflict (user_id, feature_id) do update set
        override_value = excluded.override_value,
        override_reason = excluded.override_reason,
        expires_at = excluded.expires_at,
        created_by = excluded.created_by,
        updated_at = now()
    returning override_id into v_override_id;
    
    -- Clear cache for this user and feature
    delete from abi_core.feature_access_cache 
    where user_id = p_user_id and feature_key = p_feature_key;
    
    return v_override_id;
end;
$$;

-- Function to remove a feature override
create or replace function abi_core.remove_feature_override(
    p_user_id uuid,
    p_feature_key text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_deleted_count integer;
begin
    -- Delete the override
    delete from abi_core.user_feature_overrides ufo
    using abi_core.feature_definitions fd
    where ufo.feature_id = fd.feature_id
    and ufo.user_id = p_user_id
    and fd.feature_key = p_feature_key;
    
    get diagnostics v_deleted_count = row_count;
    
    if v_deleted_count > 0 then
        -- Clear cache for this user and feature
        delete from abi_core.feature_access_cache 
        where user_id = p_user_id and feature_key = p_feature_key;
        
        return true;
    end if;
    
    return false;
end;
$$;

-- Function to refresh feature cache for a user
create or replace function abi_core.refresh_feature_cache(
    p_user_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_deleted_count integer;
begin
    -- Clear all cache entries for the user
    delete from abi_core.feature_access_cache 
    where user_id = p_user_id;
    
    get diagnostics v_deleted_count = row_count;
    
    return v_deleted_count;
end;
$$;

-- Function to clean up expired cache entries
create or replace function abi_core.cleanup_expired_cache()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_deleted_count integer;
begin
    -- Delete expired cache entries
    delete from abi_core.feature_access_cache 
    where cache_expires_at <= now();
    
    get diagnostics v_deleted_count = row_count;
    
    return v_deleted_count;
end;
$$;

-- Function to clean up expired overrides
create or replace function abi_core.cleanup_expired_overrides()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_deleted_count integer;
begin
    -- Delete expired overrides
    delete from abi_core.user_feature_overrides 
    where expires_at is not null and expires_at <= now();
    
    get diagnostics v_deleted_count = row_count;
    
    return v_deleted_count;
end;
$$;

-- Function to log feature access attempts
create or replace function abi_core.log_feature_access(
    p_user_id uuid,
    p_feature_key text,
    p_access_granted boolean,
    p_access_reason text,
    p_request_context jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
    -- Insert log entry
    insert into abi_core.feature_usage_log (
        user_id, feature_key, access_granted, access_reason, request_context
    ) values (
        p_user_id, p_feature_key, p_access_granted, p_access_reason, p_request_context
    );
end;
$$;

-- Helper function to check if user has model access
create or replace function abi_core.has_model_access(
    p_user_id uuid,
    p_model_key text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
    v_feature_key text;
    v_access_result record;
begin
    -- Construct feature key
    v_feature_key := 'models.' || p_model_key;
    
    -- Check access
    select * into v_access_result
    from abi_core.check_feature_access_cached(p_user_id, v_feature_key)
    limit 1;
    
    return coalesce(v_access_result.access_granted, false);
end;
$$;

-- Helper function to check if user has datasource access
create or replace function abi_core.has_datasource_access(
    p_user_id uuid,
    p_datasource_key text,
    p_access_type text default 'read'
)
returns boolean
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
    v_feature_key text;
    v_access_result record;
    v_feature_value jsonb;
begin
    -- Construct feature key
    v_feature_key := 'datasources.' || p_datasource_key;
    
    -- Check access
    select * into v_access_result
    from abi_core.check_feature_access_cached(p_user_id, v_feature_key)
    limit 1;
    
    if not coalesce(v_access_result.access_granted, false) then
        return false;
    end if;
    
    -- Check specific access type
    v_feature_value := v_access_result.feature_value;
    
    if p_access_type = 'read' then
        return coalesce((v_feature_value ->> 'read')::boolean, false);
    elsif p_access_type = 'write' then
        return coalesce((v_feature_value ->> 'write')::boolean, false);
    else
        return coalesce((v_feature_value ->> 'enabled')::boolean, false);
    end if;
end;
$$;

-- Helper function to get user's rate limit
create or replace function abi_core.get_rate_limit(
    p_user_id uuid,
    p_limit_type text
)
returns integer
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
    v_feature_key text;
    v_access_result record;
    v_limit_value integer;
begin
    -- Construct feature key
    v_feature_key := 'limits.' || p_limit_type;
    
    -- Check access
    select * into v_access_result
    from abi_core.check_feature_access_cached(p_user_id, v_feature_key)
    limit 1;
    
    if not coalesce(v_access_result.access_granted, false) then
        return 0;
    end if;
    
    -- Extract limit value
    v_limit_value := coalesce((v_access_result.feature_value ->> 'limit')::integer, 0);
    
    return v_limit_value;
end;
$$;

-- Function to get feature analytics
create or replace function abi_core.get_feature_analytics(
    p_days_back integer default 7
)
returns table (
    feature_key text,
    total_requests bigint,
    granted_requests bigint,
    denied_requests bigint,
    grant_rate numeric(5,2)
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
begin
    return query
    select 
        ful.feature_key,
        count(*)::bigint as total_requests,
        count(case when ful.access_granted then 1 end)::bigint as granted_requests,
        count(case when not ful.access_granted then 1 end)::bigint as denied_requests,
        round(
            (count(case when ful.access_granted then 1 end) * 100.0 / count(*))::numeric, 
            2
        ) as grant_rate
    from abi_core.feature_usage_log ful
    where ful.created_at >= now() - (p_days_back || ' days')::interval
    group by ful.feature_key
    order by total_requests desc;
end;
$$;

-- Grant execute permissions on functions
grant execute on function abi_core.check_feature_access(uuid, text) to authenticated, service_role;
grant execute on function abi_core.check_feature_access_cached(uuid, text) to authenticated, service_role;
grant execute on function abi_core.get_user_features(uuid) to authenticated, service_role;
grant execute on function abi_core.create_feature_override(uuid, text, jsonb, text, timestamptz, uuid) to service_role;
grant execute on function abi_core.remove_feature_override(uuid, text) to service_role;
grant execute on function abi_core.refresh_feature_cache(uuid) to authenticated, service_role;
grant execute on function abi_core.cleanup_expired_cache() to service_role;
grant execute on function abi_core.cleanup_expired_overrides() to service_role;
grant execute on function abi_core.log_feature_access(uuid, text, boolean, text, jsonb) to authenticated, service_role;
grant execute on function abi_core.has_model_access(uuid, text) to authenticated, service_role;
grant execute on function abi_core.has_datasource_access(uuid, text, text) to authenticated, service_role;
grant execute on function abi_core.get_rate_limit(uuid, text) to authenticated, service_role;
grant execute on function abi_core.get_feature_analytics(integer) to service_role;

-- Add function comments
comment on function abi_core.check_feature_access(uuid, text) is 'Check if user has access to a feature with full inheritance chain analysis';
comment on function abi_core.check_feature_access_cached(uuid, text) is 'Check feature access with caching for performance optimization';
comment on function abi_core.get_user_features(uuid) is 'Get all features for a user with their access status';
comment on function abi_core.create_feature_override(uuid, text, jsonb, text, timestamptz, uuid) is 'Create or update a feature override for a user';
comment on function abi_core.remove_feature_override(uuid, text) is 'Remove a feature override for a user';
comment on function abi_core.refresh_feature_cache(uuid) is 'Clear all cached feature access results for a user';
comment on function abi_core.cleanup_expired_cache() is 'Remove expired cache entries - run periodically';
comment on function abi_core.cleanup_expired_overrides() is 'Remove expired feature overrides - run periodically';
comment on function abi_core.log_feature_access(uuid, text, boolean, text, jsonb) is 'Log feature access attempts for analytics';
comment on function abi_core.has_model_access(uuid, text) is 'Helper function to check model access';
comment on function abi_core.has_datasource_access(uuid, text, text) is 'Helper function to check datasource access with read/write permissions';
comment on function abi_core.get_rate_limit(uuid, text) is 'Helper function to get user rate limits';
comment on function abi_core.get_feature_analytics(integer) is 'Get feature usage analytics for the specified number of days';