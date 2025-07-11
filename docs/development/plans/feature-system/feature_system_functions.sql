-- Feature System Database Functions
-- These functions provide the core logic for feature access resolution with inheritance

-- Function to get user's current subscription plan
CREATE OR REPLACE FUNCTION "abi_billing"."get_user_plan"(user_id_param UUID)
RETURNS TABLE(
    plan_id UUID,
    plan_name TEXT,
    plan_type TEXT,
    subscription_status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.plan_id,
        sp.plan_name,
        sp.plan_type,
        us.subscription_status::TEXT
    FROM abi_billing.user_subscriptions us
    JOIN abi_billing.subscription_plans sp ON us.plan_id = sp.plan_id
    WHERE us.user_id = user_id_param
    AND us.subscription_status = 'ACTIVE'
    AND (us.subscription_period_end IS NULL OR us.subscription_period_end > NOW())
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$;

-- Function to resolve feature inheritance hierarchy
CREATE OR REPLACE FUNCTION "abi_billing"."get_feature_hierarchy"(feature_key_param TEXT)
RETURNS TABLE(
    feature_id UUID,
    feature_key TEXT,
    feature_name TEXT,
    feature_type TEXT,
    parent_feature_id UUID,
    level INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE feature_tree AS (
        -- Base case: find the specific feature
        SELECT 
            fd.feature_id,
            fd.feature_key,
            fd.feature_name,
            fd.feature_type,
            fd.parent_feature_id,
            0 as level
        FROM abi_billing.feature_definitions fd
        WHERE fd.feature_key = feature_key_param
        AND fd.is_active = true
        
        UNION ALL
        
        -- Recursive case: find parent features
        SELECT 
            fd.feature_id,
            fd.feature_key,
            fd.feature_name,
            fd.feature_type,
            fd.parent_feature_id,
            ft.level + 1 as level
        FROM abi_billing.feature_definitions fd
        JOIN feature_tree ft ON fd.feature_id = ft.parent_feature_id
        WHERE fd.is_active = true
    )
    SELECT * FROM feature_tree
    ORDER BY level ASC;
END;
$$;

-- Function to check feature access for a user with inheritance
CREATE OR REPLACE FUNCTION "abi_billing"."check_feature_access"(
    user_id_param UUID,
    feature_key_param TEXT
)
RETURNS TABLE(
    access_granted BOOLEAN,
    feature_value JSONB,
    access_reason TEXT,
    resolved_from TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_plan_info RECORD;
    feature_hierarchy RECORD;
    override_record RECORD;
    plan_feature_record RECORD;
    current_access BOOLEAN := false;
    current_value JSONB := null;
    current_reason TEXT := 'denied';
    current_resolved_from TEXT := 'default';
BEGIN
    -- Get user's current plan
    SELECT * INTO user_plan_info FROM abi_billing.get_user_plan(user_id_param) LIMIT 1;
    
    IF user_plan_info IS NULL THEN
        RETURN QUERY SELECT false, null::JSONB, 'no_active_plan'::TEXT, 'system'::TEXT;
        RETURN;
    END IF;
    
    -- Check for user-specific overrides first
    SELECT * INTO override_record
    FROM abi_billing.user_feature_overrides ufo
    JOIN abi_billing.feature_definitions fd ON ufo.feature_id = fd.feature_id
    WHERE ufo.user_id = user_id_param
    AND fd.feature_key = feature_key_param
    AND (ufo.expires_at IS NULL OR ufo.expires_at > NOW())
    ORDER BY ufo.created_at DESC
    LIMIT 1;
    
    IF override_record IS NOT NULL THEN
        RETURN QUERY SELECT 
            true, 
            override_record.override_value, 
            COALESCE(override_record.override_reason, 'user_override')::TEXT,
            'override'::TEXT;
        RETURN;
    END IF;
    
    -- Check feature hierarchy for plan-based access (with inheritance)
    FOR feature_hierarchy IN 
        SELECT * FROM abi_billing.get_feature_hierarchy(feature_key_param)
        ORDER BY level ASC
    LOOP
        -- Check if this feature is explicitly granted in the user's plan
        SELECT * INTO plan_feature_record
        FROM abi_billing.plan_features pf
        WHERE pf.plan_id = user_plan_info.plan_id
        AND pf.feature_id = feature_hierarchy.feature_id
        AND pf.is_enabled = true;
        
        IF plan_feature_record IS NOT NULL THEN
            -- Check if this is an access feature
            IF feature_hierarchy.feature_type = 'access' THEN
                IF (plan_feature_record.feature_value->>'enabled')::BOOLEAN = true THEN
                    current_access := true;
                    current_value := plan_feature_record.feature_value;
                    current_reason := 'plan_access';
                    current_resolved_from := 'plan';
                    EXIT; -- Found access, stop looking
                END IF;
            ELSE
                -- For limit/configuration features, use the value directly
                current_access := true;
                current_value := plan_feature_record.feature_value;
                current_reason := 'plan_access';
                current_resolved_from := 'plan';
                EXIT; -- Found configuration, stop looking
            END IF;
        END IF;
    END LOOP;
    
    -- If no access granted through plan, check if feature has inheritance
    IF NOT current_access THEN
        -- Check if any parent feature grants access
        FOR feature_hierarchy IN 
            SELECT * FROM abi_billing.get_feature_hierarchy(feature_key_param)
            WHERE level > 0
            ORDER BY level ASC
        LOOP
            SELECT * INTO plan_feature_record
            FROM abi_billing.plan_features pf
            WHERE pf.plan_id = user_plan_info.plan_id
            AND pf.feature_id = feature_hierarchy.feature_id
            AND pf.is_enabled = true;
            
            IF plan_feature_record IS NOT NULL THEN
                IF feature_hierarchy.feature_type = 'access' THEN
                    IF (plan_feature_record.feature_value->>'enabled')::BOOLEAN = true THEN
                        current_access := true;
                        current_value := plan_feature_record.feature_value;
                        current_reason := 'inherited_access';
                        current_resolved_from := 'inheritance';
                        EXIT; -- Found inherited access, stop looking
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    -- Return the result
    RETURN QUERY SELECT 
        current_access, 
        current_value, 
        current_reason, 
        current_resolved_from;
END;
$$;

-- Function to get all features for a user (for admin/debugging)
CREATE OR REPLACE FUNCTION "abi_billing"."get_user_features"(user_id_param UUID)
RETURNS TABLE(
    feature_key TEXT,
    feature_name TEXT,
    feature_type TEXT,
    access_granted BOOLEAN,
    feature_value JSONB,
    access_reason TEXT,
    resolved_from TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    feature_record RECORD;
    access_result RECORD;
BEGIN
    -- Get all active features
    FOR feature_record IN 
        SELECT fd.feature_key, fd.feature_name, fd.feature_type
        FROM abi_billing.feature_definitions fd
        WHERE fd.is_active = true
        ORDER BY fd.feature_key
    LOOP
        -- Check access for each feature
        SELECT * INTO access_result
        FROM abi_billing.check_feature_access(user_id_param, feature_record.feature_key)
        LIMIT 1;
        
        RETURN QUERY SELECT 
            feature_record.feature_key,
            feature_record.feature_name,
            feature_record.feature_type,
            access_result.access_granted,
            access_result.feature_value,
            access_result.access_reason,
            access_result.resolved_from;
    END LOOP;
END;
$$;

-- Function to refresh feature cache for a user
CREATE OR REPLACE FUNCTION "abi_billing"."refresh_feature_cache"(user_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    feature_record RECORD;
    access_result RECORD;
    cache_duration INTERVAL := '1 hour';
    rows_affected INTEGER := 0;
BEGIN
    -- Clear existing cache for user
    DELETE FROM abi_billing.feature_access_cache 
    WHERE user_id = user_id_param;
    
    -- Rebuild cache for all features
    FOR feature_record IN 
        SELECT fd.feature_key
        FROM abi_billing.feature_definitions fd
        WHERE fd.is_active = true
    LOOP
        -- Get access result
        SELECT * INTO access_result
        FROM abi_billing.check_feature_access(user_id_param, feature_record.feature_key)
        LIMIT 1;
        
        -- Insert into cache
        INSERT INTO abi_billing.feature_access_cache (
            user_id, 
            feature_key, 
            access_granted, 
            feature_value, 
            cache_expires_at
        ) VALUES (
            user_id_param,
            feature_record.feature_key,
            access_result.access_granted,
            access_result.feature_value,
            NOW() + cache_duration
        );
        
        rows_affected := rows_affected + 1;
    END LOOP;
    
    RETURN rows_affected;
END;
$$;

-- Function to get cached feature access (with fallback to live check)
CREATE OR REPLACE FUNCTION "abi_billing"."get_cached_feature_access"(
    user_id_param UUID,
    feature_key_param TEXT
)
RETURNS TABLE(
    access_granted BOOLEAN,
    feature_value JSONB,
    from_cache BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cache_record RECORD;
    access_result RECORD;
BEGIN
    -- Try to get from cache first
    SELECT * INTO cache_record
    FROM abi_billing.feature_access_cache
    WHERE user_id = user_id_param
    AND feature_key = feature_key_param
    AND cache_expires_at > NOW();
    
    IF cache_record IS NOT NULL THEN
        RETURN QUERY SELECT 
            cache_record.access_granted,
            cache_record.feature_value,
            true;
        RETURN;
    END IF;
    
    -- Cache miss - get live result
    SELECT * INTO access_result
    FROM abi_billing.check_feature_access(user_id_param, feature_key_param)
    LIMIT 1;
    
    -- Update cache
    INSERT INTO abi_billing.feature_access_cache (
        user_id, 
        feature_key, 
        access_granted, 
        feature_value, 
        cache_expires_at
    ) VALUES (
        user_id_param,
        feature_key_param,
        access_result.access_granted,
        access_result.feature_value,
        NOW() + INTERVAL '1 hour'
    )
    ON CONFLICT (user_id, feature_key) DO UPDATE SET
        access_granted = EXCLUDED.access_granted,
        feature_value = EXCLUDED.feature_value,
        cache_expires_at = EXCLUDED.cache_expires_at,
        created_at = NOW();
    
    RETURN QUERY SELECT 
        access_result.access_granted,
        access_result.feature_value,
        false;
END;
$$;

-- Function to clear cache when subscription changes
CREATE OR REPLACE FUNCTION "abi_billing"."clear_user_feature_cache"(user_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rows_deleted INTEGER;
BEGIN
    DELETE FROM abi_billing.feature_access_cache 
    WHERE user_id = user_id_param;
    
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RETURN rows_deleted;
END;
$$;

-- Function to log feature access for analytics
CREATE OR REPLACE FUNCTION "abi_billing"."log_feature_access"(
    user_id_param UUID,
    feature_key_param TEXT,
    access_granted_param BOOLEAN,
    access_reason_param TEXT,
    request_context_param JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO abi_billing.feature_usage_log (
        user_id,
        feature_key,
        access_granted,
        access_reason,
        request_context
    ) VALUES (
        user_id_param,
        feature_key_param,
        access_granted_param,
        access_reason_param,
        request_context_param
    );
END;
$$;

-- Add comments
COMMENT ON FUNCTION "abi_billing"."get_user_plan"(UUID) IS 'Get current active subscription plan for a user';
COMMENT ON FUNCTION "abi_billing"."get_feature_hierarchy"(TEXT) IS 'Get hierarchical feature tree for inheritance resolution';
COMMENT ON FUNCTION "abi_billing"."check_feature_access"(UUID, TEXT) IS 'Check if user has access to a feature with inheritance and override support';
COMMENT ON FUNCTION "abi_billing"."get_user_features"(UUID) IS 'Get all feature access results for a user (admin/debugging)';
COMMENT ON FUNCTION "abi_billing"."refresh_feature_cache"(UUID) IS 'Refresh all cached feature access for a user';
COMMENT ON FUNCTION "abi_billing"."get_cached_feature_access"(UUID, TEXT) IS 'Get feature access from cache with fallback to live check';
COMMENT ON FUNCTION "abi_billing"."clear_user_feature_cache"(UUID) IS 'Clear feature cache when subscription changes';
COMMENT ON FUNCTION "abi_billing"."log_feature_access"(UUID, TEXT, BOOLEAN, TEXT, JSONB) IS 'Log feature access for analytics and debugging';