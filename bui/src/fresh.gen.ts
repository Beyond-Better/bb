// DO NOT EDIT. This file is generated by Fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import * as $_404 from './routes/_404.tsx';
import * as $_500 from './routes/_500.tsx';
import * as $_app from './routes/_app.tsx';
import * as $_middleware from './routes/_middleware.ts';
import * as $api_v1_config_supabase from './routes/api/v1/config/supabase.ts';
import * as $api_v1_status from './routes/api/v1/status.ts';
import * as $app_chat_index from './routes/app/chat/index.tsx';
import * as $app_chat_partial from './routes/app/chat/partial.tsx';
import * as $app_home_index from './routes/app/home/index.tsx';
import * as $app_home_partial from './routes/app/home/partial.tsx';
import * as $app_projects_index from './routes/app/projects/index.tsx';
import * as $app_projects_partial from './routes/app/projects/partial.tsx';
import * as $app_settings_index from './routes/app/settings/index.tsx';
import * as $app_settings_partial from './routes/app/settings/partial.tsx';
import * as $auth_check_email_index from './routes/auth/check-email/index.tsx';
import * as $auth_error from './routes/auth/error.tsx';
import * as $auth_forgot_password_index from './routes/auth/forgot-password/index.tsx';
import * as $auth_login_index from './routes/auth/login/index.tsx';
import * as $auth_logout_index from './routes/auth/logout/index.tsx';
import * as $auth_signup_index from './routes/auth/signup/index.tsx';
import * as $auth_update_password_index from './routes/auth/update-password/index.tsx';
import * as $auth_verify_index from './routes/auth/verify/index.tsx';
import * as $doctor from './routes/doctor.tsx';
import * as $index from './routes/index.tsx';
import * as $AppSettings from './islands/AppSettings.tsx';
import * as $AppSettings_AppearanceSettings from './islands/AppSettings/AppearanceSettings.tsx';
import * as $AppSettings_DefaultProjectSettings from './islands/AppSettings/DefaultProjectSettings.tsx';
import * as $AppSettings_MCPServerItem from './islands/AppSettings/MCPServerItem.tsx';
import * as $AppSettings_MCPServersSection from './islands/AppSettings/MCPServersSection.tsx';
import * as $AppSettings_NotificationSettings from './islands/AppSettings/NotificationSettings.tsx';
import * as $AppSettings_PlansAndCreditsTab from './islands/AppSettings/PlansAndCreditsTab.tsx';
import * as $AppSettings_UsageAndHistoryTab from './islands/AppSettings/UsageAndHistoryTab.tsx';
import * as $AuthContext from './islands/AuthContext.tsx';
import * as $Chat from './islands/Chat.tsx';
import * as $Context_appConfig from './islands/Context/appConfig.tsx';
import * as $Home from './islands/Home.tsx';
import * as $LandingHero from './islands/LandingHero.tsx';
import * as $NewPaymentMethodForm from './islands/NewPaymentMethodForm.tsx';
import * as $ProjectManager from './islands/ProjectManager.tsx';
import * as $SideNav from './islands/SideNav.tsx';
import * as $ThemeManager from './islands/ThemeManager.tsx';
import * as $auth_AuthError from './islands/auth/AuthError.tsx';
import * as $auth_ForgotPasswordContent from './islands/auth/ForgotPasswordContent.tsx';
import * as $auth_ForgotPasswordForm from './islands/auth/ForgotPasswordForm.tsx';
import * as $auth_LoginContent from './islands/auth/LoginContent.tsx';
import * as $auth_LoginForm from './islands/auth/LoginForm.tsx';
import * as $auth_ResendVerificationEmail from './islands/auth/ResendVerificationEmail.tsx';
import * as $auth_SignupContent from './islands/auth/SignupContent.tsx';
import * as $auth_SignupForm from './islands/auth/SignupForm.tsx';
import * as $auth_UpdatePasswordContent from './islands/auth/UpdatePasswordContent.tsx';
import * as $auth_UpdatePasswordForm from './islands/auth/UpdatePasswordForm.tsx';
import * as $auth_VerifyContent from './islands/auth/VerifyContent.tsx';
import * as $metadata_AppSettingsMetadata from './islands/metadata/AppSettingsMetadata.tsx';
import * as $metadata_ProjectManagerMetadata from './islands/metadata/ProjectManagerMetadata.tsx';
import * as $metadata_ProjectMetadata from './islands/metadata/ProjectMetadata.tsx';
import * as $metadata_index from './islands/metadata/index.ts';
import type { Manifest } from '$fresh/server.ts';

const manifest = {
	routes: {
		'./routes/_404.tsx': $_404,
		'./routes/_500.tsx': $_500,
		'./routes/_app.tsx': $_app,
		'./routes/_middleware.ts': $_middleware,
		'./routes/api/v1/config/supabase.ts': $api_v1_config_supabase,
		'./routes/api/v1/status.ts': $api_v1_status,
		'./routes/app/chat/index.tsx': $app_chat_index,
		'./routes/app/chat/partial.tsx': $app_chat_partial,
		'./routes/app/home/index.tsx': $app_home_index,
		'./routes/app/home/partial.tsx': $app_home_partial,
		'./routes/app/projects/index.tsx': $app_projects_index,
		'./routes/app/projects/partial.tsx': $app_projects_partial,
		'./routes/app/settings/index.tsx': $app_settings_index,
		'./routes/app/settings/partial.tsx': $app_settings_partial,
		'./routes/auth/check-email/index.tsx': $auth_check_email_index,
		'./routes/auth/error.tsx': $auth_error,
		'./routes/auth/forgot-password/index.tsx': $auth_forgot_password_index,
		'./routes/auth/login/index.tsx': $auth_login_index,
		'./routes/auth/logout/index.tsx': $auth_logout_index,
		'./routes/auth/signup/index.tsx': $auth_signup_index,
		'./routes/auth/update-password/index.tsx': $auth_update_password_index,
		'./routes/auth/verify/index.tsx': $auth_verify_index,
		'./routes/doctor.tsx': $doctor,
		'./routes/index.tsx': $index,
	},
	islands: {
		'./islands/AppSettings.tsx': $AppSettings,
		'./islands/AppSettings/AppearanceSettings.tsx': $AppSettings_AppearanceSettings,
		'./islands/AppSettings/DefaultProjectSettings.tsx': $AppSettings_DefaultProjectSettings,
		'./islands/AppSettings/MCPServerItem.tsx': $AppSettings_MCPServerItem,
		'./islands/AppSettings/MCPServersSection.tsx': $AppSettings_MCPServersSection,
		'./islands/AppSettings/NotificationSettings.tsx': $AppSettings_NotificationSettings,
		'./islands/AppSettings/PlansAndCreditsTab.tsx': $AppSettings_PlansAndCreditsTab,
		'./islands/AppSettings/UsageAndHistoryTab.tsx': $AppSettings_UsageAndHistoryTab,
		'./islands/AuthContext.tsx': $AuthContext,
		'./islands/Chat.tsx': $Chat,
		'./islands/Context/appConfig.tsx': $Context_appConfig,
		'./islands/Home.tsx': $Home,
		'./islands/LandingHero.tsx': $LandingHero,
		'./islands/NewPaymentMethodForm.tsx': $NewPaymentMethodForm,
		'./islands/ProjectManager.tsx': $ProjectManager,
		'./islands/SideNav.tsx': $SideNav,
		'./islands/ThemeManager.tsx': $ThemeManager,
		'./islands/auth/AuthError.tsx': $auth_AuthError,
		'./islands/auth/ForgotPasswordContent.tsx': $auth_ForgotPasswordContent,
		'./islands/auth/ForgotPasswordForm.tsx': $auth_ForgotPasswordForm,
		'./islands/auth/LoginContent.tsx': $auth_LoginContent,
		'./islands/auth/LoginForm.tsx': $auth_LoginForm,
		'./islands/auth/ResendVerificationEmail.tsx': $auth_ResendVerificationEmail,
		'./islands/auth/SignupContent.tsx': $auth_SignupContent,
		'./islands/auth/SignupForm.tsx': $auth_SignupForm,
		'./islands/auth/UpdatePasswordContent.tsx': $auth_UpdatePasswordContent,
		'./islands/auth/UpdatePasswordForm.tsx': $auth_UpdatePasswordForm,
		'./islands/auth/VerifyContent.tsx': $auth_VerifyContent,
		'./islands/metadata/AppSettingsMetadata.tsx': $metadata_AppSettingsMetadata,
		'./islands/metadata/ProjectManagerMetadata.tsx': $metadata_ProjectManagerMetadata,
		'./islands/metadata/ProjectMetadata.tsx': $metadata_ProjectMetadata,
		'./islands/metadata/index.ts': $metadata_index,
	},
	baseUrl: import.meta.url,
} satisfies Manifest;

export default manifest;
