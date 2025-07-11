-- Feature System Migration
-- This migration creates the feature management system for BB
-- Supports hierarchical features with inheritance and dynamic configuration

-- Feature definitions table - master list of all features
CREATE TABLE IF NOT EXISTS "abi_billing"."feature_definitions" (
    "feature_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "feature_key" "text" NOT NULL, -- e.g., "models.claude.opus", "datasources.github.write"
    "feature_name" "text" NOT NULL, -- human-readable name
    "feature_description" "text",
    "feature_type" "text" NOT NULL, -- 'access', 'limit', 'configuration'
    "parent_feature_id" "uuid", -- for hierarchical inheritance
    "feature_category" "text", -- 'models', 'datasources', 'tools', 'limits'
    "default_value" "jsonb", -- default configuration/limit values
    "value_schema" "jsonb", -- JSON schema for validation
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    
    CONSTRAINT "feature_definitions_pkey" PRIMARY KEY ("feature_id"),
    CONSTRAINT "feature_definitions_feature_key_key" UNIQUE ("feature_key"),
    CONSTRAINT "feature_definitions_feature_type_check" CHECK (
        "feature_type" = ANY (ARRAY['access'::"text", 'limit'::"text", 'configuration'::"text"])
    ),
    CONSTRAINT "feature_definitions_feature_category_check" CHECK (
        "feature_category" = ANY (ARRAY['models'::"text", 'datasources'::"text", 'tools'::"text", 'limits'::"text", 'ui'::"text"])
    ),
    CONSTRAINT "feature_definitions_parent_feature_id_fkey" FOREIGN KEY ("parent_feature_id") 
        REFERENCES "abi_billing"."feature_definitions"("feature_id") ON DELETE CASCADE
);

-- Plan features table - defines what features each plan includes
CREATE TABLE IF NOT EXISTS "abi_billing"."plan_features" (
    "plan_feature_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "feature_id" "uuid" NOT NULL,
    "feature_value" "jsonb" NOT NULL, -- the actual value/configuration for this plan
    "is_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    
    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("plan_feature_id"),
    CONSTRAINT "plan_features_plan_id_feature_id_key" UNIQUE ("plan_id", "feature_id"),
    CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") 
        REFERENCES "abi_billing"."subscription_plans"("plan_id") ON DELETE CASCADE,
    CONSTRAINT "plan_features_feature_id_fkey" FOREIGN KEY ("feature_id") 
        REFERENCES "abi_billing"."feature_definitions"("feature_id") ON DELETE CASCADE
);

-- User feature overrides table - for custom plans or temporary overrides
CREATE TABLE IF NOT EXISTS "abi_billing"."user_feature_overrides" (
    "override_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_id" "uuid" NOT NULL,
    "override_value" "jsonb" NOT NULL,
    "override_reason" "text", -- 'custom_plan', 'temporary_access', 'support_override'
    "expires_at" timestamp with time zone, -- for temporary overrides
    "created_by" "uuid", -- admin who created the override
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    
    CONSTRAINT "user_feature_overrides_pkey" PRIMARY KEY ("override_id"),
    CONSTRAINT "user_feature_overrides_user_id_feature_id_key" UNIQUE ("user_id", "feature_id"),
    CONSTRAINT "user_feature_overrides_user_id_fkey" FOREIGN KEY ("user_id") 
        REFERENCES "abi_auth"."user_profiles"("profile_id") ON DELETE CASCADE,
    CONSTRAINT "user_feature_overrides_feature_id_fkey" FOREIGN KEY ("feature_id") 
        REFERENCES "abi_billing"."feature_definitions"("feature_id") ON DELETE CASCADE,
    CONSTRAINT "user_feature_overrides_created_by_fkey" FOREIGN KEY ("created_by") 
        REFERENCES "abi_auth"."user_profiles"("profile_id") ON DELETE SET NULL
);

-- Feature access cache table - for performance optimization
CREATE TABLE IF NOT EXISTS "abi_billing"."feature_access_cache" (
    "cache_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "access_granted" boolean NOT NULL,
    "feature_value" "jsonb",
    "cache_expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    
    CONSTRAINT "feature_access_cache_pkey" PRIMARY KEY ("cache_id"),
    CONSTRAINT "feature_access_cache_user_id_feature_key_key" UNIQUE ("user_id", "feature_key"),
    CONSTRAINT "feature_access_cache_user_id_fkey" FOREIGN KEY ("user_id") 
        REFERENCES "abi_auth"."user_profiles"("profile_id") ON DELETE CASCADE
);

-- Feature usage tracking table - for analytics and debugging
CREATE TABLE IF NOT EXISTS "abi_billing"."feature_usage_log" (
    "log_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "access_granted" boolean NOT NULL,
    "access_reason" "text", -- 'plan_access', 'override', 'inheritance', 'denied'
    "request_context" "jsonb", -- API endpoint, CLI command, etc.
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    
    CONSTRAINT "feature_usage_log_pkey" PRIMARY KEY ("log_id"),
    CONSTRAINT "feature_usage_log_user_id_fkey" FOREIGN KEY ("user_id") 
        REFERENCES "abi_auth"."user_profiles"("profile_id") ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX "idx_feature_definitions_parent_feature_id" ON "abi_billing"."feature_definitions" USING "btree" ("parent_feature_id");
CREATE INDEX "idx_feature_definitions_feature_key" ON "abi_billing"."feature_definitions" USING "btree" ("feature_key");
CREATE INDEX "idx_feature_definitions_feature_category" ON "abi_billing"."feature_definitions" USING "btree" ("feature_category");

CREATE INDEX "idx_plan_features_plan_id" ON "abi_billing"."plan_features" USING "btree" ("plan_id");
CREATE INDEX "idx_plan_features_feature_id" ON "abi_billing"."plan_features" USING "btree" ("feature_id");

CREATE INDEX "idx_user_feature_overrides_user_id" ON "abi_billing"."user_feature_overrides" USING "btree" ("user_id");
CREATE INDEX "idx_user_feature_overrides_expires_at" ON "abi_billing"."user_feature_overrides" USING "btree" ("expires_at");

CREATE INDEX "idx_feature_access_cache_user_id" ON "abi_billing"."feature_access_cache" USING "btree" ("user_id");
CREATE INDEX "idx_feature_access_cache_expires_at" ON "abi_billing"."feature_access_cache" USING "btree" ("cache_expires_at");

CREATE INDEX "idx_feature_usage_log_user_id" ON "abi_billing"."feature_usage_log" USING "btree" ("user_id");
CREATE INDEX "idx_feature_usage_log_created_at" ON "abi_billing"."feature_usage_log" USING "btree" ("created_at");
CREATE INDEX "idx_feature_usage_log_feature_key" ON "abi_billing"."feature_usage_log" USING "btree" ("feature_key");

-- Add comments
COMMENT ON TABLE "abi_billing"."feature_definitions" IS 'Master list of all features with hierarchical structure';
COMMENT ON TABLE "abi_billing"."plan_features" IS 'Features included in each subscription plan';
COMMENT ON TABLE "abi_billing"."user_feature_overrides" IS 'Custom feature overrides for individual users';
COMMENT ON TABLE "abi_billing"."feature_access_cache" IS 'Cached feature access results for performance';
COMMENT ON TABLE "abi_billing"."feature_usage_log" IS 'Analytics and debugging log for feature access';

COMMENT ON COLUMN "abi_billing"."feature_definitions"."feature_key" IS 'Hierarchical feature key (e.g., models.claude.opus)';
COMMENT ON COLUMN "abi_billing"."feature_definitions"."feature_type" IS 'Type of feature: access (boolean), limit (numeric), configuration (complex)';
COMMENT ON COLUMN "abi_billing"."feature_definitions"."parent_feature_id" IS 'Parent feature for inheritance (models.claude.opus inherits from models.claude)';
COMMENT ON COLUMN "abi_billing"."feature_definitions"."default_value" IS 'Default value when feature is not explicitly configured';
COMMENT ON COLUMN "abi_billing"."feature_definitions"."value_schema" IS 'JSON schema for validating feature_value configurations';

COMMENT ON COLUMN "abi_billing"."plan_features"."feature_value" IS 'The actual value/configuration for this feature in this plan';
COMMENT ON COLUMN "abi_billing"."user_feature_overrides"."override_reason" IS 'Why this override exists: custom_plan, temporary_access, support_override';
COMMENT ON COLUMN "abi_billing"."user_feature_overrides"."expires_at" IS 'When this override expires (null for permanent overrides)';