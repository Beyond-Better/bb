CREATE OR REPLACE FUNCTION abi_billing.check_balance(p_user_id uuid, p_amount_needed DECIMAL(10, 2) DEFAULT NULL)
    RETURNS TABLE(
        remaining_balance DECIMAL(10, 2),
        has_sufficient_balance boolean,
        subscription_allowance DECIMAL(10, 2),
        subscription_used DECIMAL(10, 2),
        purchased_allowance DECIMAL(10, 2),
        purchased_used DECIMAL(10, 2),
        total_used DECIMAL(10, 2),
        total_allowance DECIMAL(10, 2)
    )
    AS $$
BEGIN
    -- first try to use the user_balance view (primary path)
    RETURN QUERY WITH current_plan AS(
        SELECT
            us.user_id,
            (sp.plan_limits -> 'quota_limits' ->> 'base_cost_monthly')::decimal AS subscription_allowance
        FROM
            abi_billing.user_subscriptions us
            JOIN abi_billing.subscription_plans sp ON us.plan_id = sp.plan_id
        WHERE
            us.user_id = p_user_id
            AND us.subscription_status = 'ACTIVE'
),
current_purchases AS(
    -- get purchased allowance for current period using batches table
    SELECT
        ba.user_id,
        SUM(ba.purchased_allowance) + SUM(ba.previous_balance) AS purchase_amount
    FROM
        abi_billing.batches_allowance ba
    WHERE
        ba.user_id = p_user_id
        AND ba.period_start = date_trunc('month', CURRENT_TIMESTAMP)
        AND ba.status = 'completed'
    GROUP BY
        ba.user_id
    UNION ALL
    -- include any unbatched purchases from current period
    SELECT
        tp.user_id,
        SUM(tp.amount_usd) AS purchase_amount
    FROM
        abi_billing.token_purchases tp
    WHERE
        tp.user_id = p_user_id
        AND tp.purchase_status = 'completed'
        AND tp.created_at >= date_trunc('month', CURRENT_TIMESTAMP)
        AND tp.created_at <= CURRENT_TIMESTAMP
        AND tp.batch_id IS NULL
    GROUP BY
        tp.user_id
),
-- Get all unbatched usage as additional verification
additional_usage AS(
    -- Get raw token usage not yet rolled up
    SELECT
        tu.user_id,
        SUM(tu.cost_usd) AS additional_cost
    FROM
        abi_llm.token_usage tu
    WHERE
        tu.user_id = p_user_id
        AND tu.request_timestamp >= date_trunc('month', CURRENT_TIMESTAMP)
        AND tu.request_timestamp <= CURRENT_TIMESTAMP
        AND tu.rollup_id IS NULL
    GROUP BY
        tu.user_id
    UNION ALL
    -- Get rolled up usage not yet batched
    SELECT
        tud.user_id,
        SUM(tud.cost_usd) AS additional_cost
    FROM
        abi_llm.token_usage_daily tud
    WHERE
        tud.user_id = p_user_id
        AND tud.usage_date >= date_trunc('month', CURRENT_TIMESTAMP)::date
        AND tud.usage_date <= CURRENT_DATE
        AND tud.batch_id IS NULL
    GROUP BY
        tud.user_id
)
SELECT
    GREATEST(COALESCE(cp.subscription_allowance, 0) - LEAST(COALESCE(bs.subscription_used, 0) + COALESCE(au.total_additional_cost, 0), COALESCE(cp.subscription_allowance, 0)) + COALESCE(cpu.purchase_total, 0) - GREATEST(COALESCE(bs.purchased_used, 0) + COALESCE(au.total_additional_cost, 0) - LEAST(COALESCE(bs.subscription_used, 0) + COALESCE(au.total_additional_cost, 0), COALESCE(cp.subscription_allowance, 0)), 0), 0) AS remaining_balance,
    CASE WHEN p_amount_needed IS NULL THEN
        TRUE
    ELSE
        (COALESCE(cp.subscription_allowance, 0) - LEAST(COALESCE(bs.subscription_used, 0) + COALESCE(au.total_additional_cost, 0), COALESCE(cp.subscription_allowance, 0)) + COALESCE(cpu.purchase_total, 0) - GREATEST(COALESCE(bs.purchased_used, 0) + COALESCE(au.total_additional_cost, 0) - LEAST(COALESCE(bs.subscription_used, 0) + COALESCE(au.total_additional_cost, 0), COALESCE(cp.subscription_allowance, 0)), 0)) >= p_amount_needed
    END AS has_sufficient_balance,
    COALESCE(cp.subscription_allowance, 0) AS subscription_allowance,
    LEAST(COALESCE(bs.subscription_used, 0) + COALESCE(au.total_additional_cost, 0), COALESCE(cp.subscription_allowance, 0)) AS subscription_used,
    COALESCE(cpu.purchase_total, 0) AS purchased_allowance,
    GREATEST(COALESCE(bs.purchased_used, 0) + COALESCE(au.total_additional_cost, 0) - LEAST(COALESCE(bs.subscription_used, 0) + COALESCE(au.total_additional_cost, 0), COALESCE(cp.subscription_allowance, 0)), 0) AS purchased_used,
    COALESCE(bs.total_used, 0) + COALESCE(au.total_additional_cost, 0) AS total_used,
    COALESCE(cp.subscription_allowance, 0) + COALESCE(cpu.purchase_total, 0) AS total_allowance
FROM
    current_plan cp
    LEFT JOIN abi_billing.user_balance bs ON cp.user_id = bs.user_id
    LEFT JOIN(
        -- aggregate purchases across all subqueries
        SELECT
            cp_inner.user_id,
            SUM(cp_inner.purchase_amount) AS purchase_total
        FROM
            current_purchases cp_inner
        GROUP BY
            cp_inner.user_id) cpu ON cp.user_id = cpu.user_id
    LEFT JOIN(
        -- aggregate all unbatched usage
        SELECT
            au_inner.user_id,
            SUM(au_inner.additional_cost) AS total_additional_cost
        FROM
            additional_usage au_inner
        GROUP BY
            au_inner.user_id) au ON cp.user_id = au.user_id;
    -- if no results, use batch tables directly as fallback
    IF NOT FOUND THEN
        RETURN QUERY WITH current_subscription AS(
            -- get current active subscription details
            SELECT
                us.user_id,
                (sp.plan_limits -> 'quota_limits' ->> 'base_cost_monthly')::decimal AS subscription_allowance
            FROM
                abi_billing.user_subscriptions us
                JOIN abi_billing.subscription_plans sp ON us.plan_id = sp.plan_id
            WHERE
                us.user_id = p_user_id
                AND us.subscription_status = 'ACTIVE'
                AND us.subscription_period_start <= CURRENT_TIMESTAMP
                AND us.subscription_period_end >= CURRENT_TIMESTAMP
),
current_period_allowance AS(
    -- get allowance details from batches
    SELECT
        ba.user_id,
        ba.subscription_allowance AS sub_allowance,
        ba.purchased_allowance AS purch_allowance,
        ba.previous_balance AS prev_balance,
        ba.total_allowance
    FROM
        abi_billing.batches_allowance ba
    WHERE
        ba.user_id = p_user_id
        AND ba.period_start = date_trunc('month', CURRENT_TIMESTAMP)
        AND ba.status = 'completed'
),
unbatched_purchases AS(
    -- get any unbatched purchases from current period
    SELECT
        tp.user_id,
        SUM(tp.amount_usd) AS new_purchases
    FROM
        abi_billing.token_purchases tp
    WHERE
        tp.user_id = p_user_id
        AND tp.purchase_status = 'completed'
        AND tp.created_at >= date_trunc('month', CURRENT_TIMESTAMP)
        AND tp.created_at <= CURRENT_TIMESTAMP
        AND tp.batch_id IS NULL
    GROUP BY
        tp.user_id
),
current_period_usage AS(
    -- get batched usage
    SELECT
        bu.user_id,
        bu.subscription_used,
        bu.purchased_used,
        bu.total_used_usd AS total_used
    FROM
        abi_billing.batches_usage bu
    WHERE
        bu.user_id = p_user_id
        AND bu.period_start = date_trunc('month', CURRENT_TIMESTAMP)
        AND bu.status = 'completed'
    UNION ALL
    -- add unbatched raw usage
    SELECT
        tu.user_id,
        0 AS subscription_used, -- attribution will happen in query
        0 AS purchased_used, -- attribution will happen in query
        SUM(tu.cost_usd) AS total_used
    FROM
        abi_llm.token_usage tu
    WHERE
        tu.user_id = p_user_id
        AND tu.request_timestamp >= date_trunc('month', CURRENT_TIMESTAMP)
        AND tu.request_timestamp <= CURRENT_TIMESTAMP
        AND tu.rollup_id IS NULL
    GROUP BY
        tu.user_id
    UNION ALL
    -- add unbatched rolled-up usage (critical addition)
    SELECT
        tud.user_id,
        0 AS subscription_used, -- attribution will happen in query
        0 AS purchased_used, -- attribution will happen in query
        SUM(tud.cost_usd) AS total_used
    FROM
        abi_llm.token_usage_daily tud
    WHERE
        tud.user_id = p_user_id
        AND tud.usage_date >= date_trunc('month', CURRENT_TIMESTAMP)::date
        AND tud.usage_date <= CURRENT_DATE
        AND tud.batch_id IS NULL
    GROUP BY
        tud.user_id
),
usage_with_attribution AS(
    -- calculate total usage with proper attribution
    SELECT
        cpu_inner.user_id,
        SUM(cpu_inner.subscription_used) AS batched_subscription_used,
        SUM(cpu_inner.purchased_used) AS batched_purchased_used,
        SUM(cpu_inner.total_used) AS total_used
    FROM
        current_period_usage cpu_inner
    GROUP BY
        cpu_inner.user_id
)
SELECT
    -- calculate remaining balance with proper attribution
    GREATEST(COALESCE(cs.subscription_allowance, 0) - CASE
    -- when we have both batched and unbatched usage
    WHEN COALESCE(ua.total_used, 0) > COALESCE(ua.batched_subscription_used, 0) + COALESCE(ua.batched_purchased_used, 0) THEN
        -- calculate unbatched usage
        LEAST(COALESCE(cs.subscription_allowance, 0), -- can't use more than available
            COALESCE(ua.batched_subscription_used, 0) + (COALESCE(ua.total_used, 0) - COALESCE(ua.batched_subscription_used, 0) - COALESCE(ua.batched_purchased_used, 0)))
    ELSE
        COALESCE(ua.batched_subscription_used, 0) -- just use batched amount
    END + COALESCE(cpa.purch_allowance, 0) + COALESCE(cpa.prev_balance, 0) + COALESCE(up.new_purchases, 0) - CASE
    -- when we have both batched and unbatched usage
    WHEN COALESCE(ua.total_used, 0) > COALESCE(ua.batched_subscription_used, 0) + COALESCE(ua.batched_purchased_used, 0) THEN
        -- calculate unbatched usage attribution to purchases
        COALESCE(ua.batched_purchased_used, 0) + (COALESCE(ua.total_used, 0) - COALESCE(ua.batched_subscription_used, 0) - COALESCE(ua.batched_purchased_used, 0) - LEAST(COALESCE(cs.subscription_allowance, 0) - COALESCE(ua.batched_subscription_used, 0), COALESCE(ua.total_used, 0) - COALESCE(ua.batched_subscription_used, 0) - COALESCE(ua.batched_purchased_used, 0)))
    ELSE
        COALESCE(ua.batched_purchased_used, 0) -- just use batched amount
    END, 0) AS remaining_balance,
    CASE WHEN p_amount_needed IS NULL THEN
        TRUE
    ELSE
        (COALESCE(cs.subscription_allowance, 0) - CASE WHEN COALESCE(ua.total_used, 0) > COALESCE(ua.batched_subscription_used, 0) + COALESCE(ua.batched_purchased_used, 0) THEN
                LEAST(COALESCE(cs.subscription_allowance, 0), COALESCE(ua.batched_subscription_used, 0) + (COALESCE(ua.total_used, 0) - COALESCE(ua.batched_subscription_used, 0) - COALESCE(ua.batched_purchased_used, 0)))
            ELSE
                COALESCE(ua.batched_subscription_used, 0)
            END + COALESCE(cpa.purch_allowance, 0) + COALESCE(cpa.prev_balance, 0) + COALESCE(up.new_purchases, 0) - CASE WHEN COALESCE(ua.total_used, 0) > COALESCE(ua.batched_subscription_used, 0) + COALESCE(ua.batched_purchased_used, 0) THEN
                COALESCE(ua.batched_purchased_used, 0) + (COALESCE(ua.total_used, 0) - COALESCE(ua.batched_subscription_used, 0) - COALESCE(ua.batched_purchased_used, 0) - LEAST(COALESCE(cs.subscription_allowance, 0) - COALESCE(ua.batched_subscription_used, 0), COALESCE(ua.total_used, 0) - COALESCE(ua.batched_subscription_used, 0) - COALESCE(ua.batched_purchased_used, 0)))
            ELSE
                COALESCE(ua.batched_purchased_used, 0)
            END) >= p_amount_needed
    END AS has_sufficient_balance,
    COALESCE(cs.subscription_allowance, 0) AS subscription_allowance,
    CASE WHEN COALESCE(ua.total_used, 0) > COALESCE(ua.batched_subscription_used, 0) + COALESCE(ua.batched_purchased_used, 0) THEN
        LEAST(COALESCE(cs.subscription_allowance, 0), COALESCE(ua.batched_subscription_used, 0) + (COALESCE(ua.total_used, 0) - COALESCE(ua.batched_subscription_used, 0) - COALESCE(ua.batched_purchased_used, 0)))
    ELSE
        COALESCE(ua.batched_subscription_used, 0)
    END AS subscription_used,
    (COALESCE(cpa.purch_allowance, 0) + COALESCE(cpa.prev_balance, 0) + COALESCE(up.new_purchases, 0)) AS purchased_allowance,
    CASE WHEN COALESCE(ua.total_used, 0) > COALESCE(ua.batched_subscription_used, 0) + COALESCE(ua.batched_purchased_used, 0) THEN
        COALESCE(ua.batched_purchased_used, 0) + (COALESCE(ua.total_used, 0) - COALESCE(ua.batched_subscription_used, 0) - COALESCE(ua.batched_purchased_used, 0) - LEAST(COALESCE(cs.subscription_allowance, 0) - COALESCE(ua.batched_subscription_used, 0), COALESCE(ua.total_used, 0) - COALESCE(ua.batched_subscription_used, 0) - COALESCE(ua.batched_purchased_used, 0)))
    ELSE
        COALESCE(ua.batched_purchased_used, 0)
    END AS purchased_used,
    COALESCE(ua.total_used, 0) AS total_used,
    (COALESCE(cs.subscription_allowance, 0) + COALESCE(cpa.purch_allowance, 0) + COALESCE(cpa.prev_balance, 0) + COALESCE(up.new_purchases, 0)) AS total_allowance
FROM
    current_subscription cs
    LEFT JOIN current_period_allowance cpa ON cs.user_id = cpa.user_id
    LEFT JOIN unbatched_purchases up ON cs.user_id = up.user_id
    LEFT JOIN usage_with_attribution ua ON cs.user_id = ua.user_id;
    END IF;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = '';