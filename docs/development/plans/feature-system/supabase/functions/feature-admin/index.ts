// Edge Function for Feature System Admin Operations
// Use for bulk operations, complex business logic, and admin tasks

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Check if user has admin privileges
    const { data: userProfile, error: profileError } = await supabase
      .from('abi_auth.user_profiles')
      .select('profile_id, role')
      .eq('profile_id', user.id)
      .single()

    if (profileError || !userProfile || userProfile.role !== 'admin') {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    const { operation, ...params } = await req.json()

    switch (operation) {
      case 'bulk_check_access':
        return await handleBulkCheckAccess(supabase, params)
      
      case 'bulk_create_overrides':
        return await handleBulkCreateOverrides(supabase, params)
      
      case 'bulk_remove_overrides':
        return await handleBulkRemoveOverrides(supabase, params)
      
      case 'get_user_analytics':
        return await handleUserAnalytics(supabase, params)
      
      case 'refresh_all_caches':
        return await handleRefreshAllCaches(supabase, params)
      
      default:
        return new Response('Unknown operation', { status: 400, headers: corsHeaders })
    }

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders })
  }
})

// Bulk check access for multiple users and features
async function handleBulkCheckAccess(supabase: any, params: any) {
  const { userIds, featureKeys } = params
  
  const results = []
  
  for (const userId of userIds) {
    const userResults = []
    
    for (const featureKey of featureKeys) {
      const { data, error } = await supabase
        .rpc('check_feature_access_cached', {
          user_id_param: userId,
          feature_key_param: featureKey
        })
      
      userResults.push({
        userId,
        featureKey,
        access: data?.[0] || { access_granted: false, access_reason: 'error' }
      })
    }
    
    results.push({ userId, features: userResults })
  }
  
  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Bulk create overrides for multiple users
async function handleBulkCreateOverrides(supabase: any, params: any) {
  const { userIds, featureKey, overrideValue, overrideReason, expiresAt } = params
  
  const results = []
  
  for (const userId of userIds) {
    const { data, error } = await supabase
      .rpc('create_feature_override', {
        user_id_param: userId,
        feature_key_param: featureKey,
        override_value_param: overrideValue,
        override_reason_param: overrideReason,
        expires_at_param: expiresAt,
        created_by_param: params.adminUserId
      })
    
    results.push({
      userId,
      success: !error,
      overrideId: data,
      error: error?.message
    })
  }
  
  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Bulk remove overrides for multiple users
async function handleBulkRemoveOverrides(supabase: any, params: any) {
  const { userIds, featureKey } = params
  
  const results = []
  
  for (const userId of userIds) {
    const { data, error } = await supabase
      .rpc('remove_feature_override', {
        user_id_param: userId,
        feature_key_param: featureKey
      })
    
    results.push({
      userId,
      success: !error,
      removed: data,
      error: error?.message
    })
  }
  
  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Get analytics for feature usage
async function handleUserAnalytics(supabase: any, params: any) {
  const { daysBack = 7, featureKeys = [] } = params
  
  let query = supabase
    .from('abi_core.feature_usage_log')
    .select(`
      feature_key,
      access_granted,
      access_reason,
      created_at,
      user_id
    `)
    .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
  
  if (featureKeys.length > 0) {
    query = query.in('feature_key', featureKeys)
  }
  
  const { data, error } = await query
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  // Process analytics data
  const analytics = data.reduce((acc: any, log: any) => {
    const key = log.feature_key
    if (!acc[key]) {
      acc[key] = {
        feature_key: key,
        total_requests: 0,
        granted_requests: 0,
        denied_requests: 0,
        unique_users: new Set()
      }
    }
    
    acc[key].total_requests++
    acc[key].unique_users.add(log.user_id)
    
    if (log.access_granted) {
      acc[key].granted_requests++
    } else {
      acc[key].denied_requests++
    }
    
    return acc
  }, {})
  
  // Convert Set to count and calculate percentages
  const results = Object.values(analytics).map((item: any) => ({
    feature_key: item.feature_key,
    total_requests: item.total_requests,
    granted_requests: item.granted_requests,
    denied_requests: item.denied_requests,
    unique_users: item.unique_users.size,
    grant_rate: ((item.granted_requests / item.total_requests) * 100).toFixed(2)
  }))
  
  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Refresh caches for all users or specific users
async function handleRefreshAllCaches(supabase: any, params: any) {
  const { userIds = [] } = params
  
  if (userIds.length === 0) {
    // Clear all caches
    const { data, error } = await supabase
      .from('abi_core.feature_access_cache')
      .delete()
      .neq('user_id', '00000000-0000-0000-0000-000000000000') // Delete all
    
    return new Response(JSON.stringify({ 
      success: !error,
      message: 'All caches cleared',
      error: error?.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  // Clear specific user caches
  const results = []
  
  for (const userId of userIds) {
    const { data, error } = await supabase
      .rpc('refresh_feature_cache', {
        user_id_param: userId
      })
    
    results.push({
      userId,
      success: !error,
      entriesCleared: data,
      error: error?.message
    })
  }
  
  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}