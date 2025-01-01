// DO NOT EDIT. This file is generated by Fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import * as $_404 from './routes/_404.tsx';
import * as $_500 from './routes/_500.tsx';
import * as $_app from './routes/_app.tsx';
import * as $_middleware from './routes/_middleware.ts';
import * as $api_config_supabase from './routes/api/config/supabase.ts';
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
import * as $auth_forgot_password from './routes/auth/forgot-password.tsx';
import * as $auth_login_index from './routes/auth/login/index.tsx';
import * as $auth_logout_index from './routes/auth/logout/index.tsx';
import * as $auth_signup_index from './routes/auth/signup/index.tsx';
import * as $auth_verify_index from './routes/auth/verify/index.tsx';
import * as $doctor from './routes/doctor.tsx';
import * as $index from './routes/index.tsx';
import * as $Chat from './islands/Chat.tsx';
import * as $Home from './islands/Home.tsx';
import * as $LandingHero from './islands/LandingHero.tsx';
import * as $ProjectManager from './islands/ProjectManager.tsx';
import * as $Settings from './islands/Settings.tsx';
import * as $SideNav from './islands/SideNav.tsx';
import * as $auth_LoginContent from './islands/auth/LoginContent.tsx';
import * as $auth_LoginForm from './islands/auth/LoginForm.tsx';
import * as $auth_SignupContent from './islands/auth/SignupContent.tsx';
import * as $auth_SignupForm from './islands/auth/SignupForm.tsx';
import * as $auth_VerifyContent from './islands/auth/VerifyContent.tsx';
import * as $metadata_ProjectManagerMetadata from './islands/metadata/ProjectManagerMetadata.tsx';
import * as $metadata_ProjectMetadata from './islands/metadata/ProjectMetadata.tsx';
import * as $metadata_SettingsMetadata from './islands/metadata/SettingsMetadata.tsx';
import * as $metadata_index from './islands/metadata/index.ts';
import type { Manifest } from '$fresh/server.ts';

const manifest = {
	routes: {
		'./routes/_404.tsx': $_404,
		'./routes/_500.tsx': $_500,
		'./routes/_app.tsx': $_app,
		'./routes/_middleware.ts': $_middleware,
		'./routes/api/config/supabase.ts': $api_config_supabase,
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
		'./routes/auth/forgot-password.tsx': $auth_forgot_password,
		'./routes/auth/login/index.tsx': $auth_login_index,
		'./routes/auth/logout/index.tsx': $auth_logout_index,
		'./routes/auth/signup/index.tsx': $auth_signup_index,
		'./routes/auth/verify/index.tsx': $auth_verify_index,
		'./routes/doctor.tsx': $doctor,
		'./routes/index.tsx': $index,
	},
	islands: {
		'./islands/Chat.tsx': $Chat,
		'./islands/Home.tsx': $Home,
		'./islands/LandingHero.tsx': $LandingHero,
		'./islands/ProjectManager.tsx': $ProjectManager,
		'./islands/Settings.tsx': $Settings,
		'./islands/SideNav.tsx': $SideNav,
		'./islands/auth/LoginContent.tsx': $auth_LoginContent,
		'./islands/auth/LoginForm.tsx': $auth_LoginForm,
		'./islands/auth/SignupContent.tsx': $auth_SignupContent,
		'./islands/auth/SignupForm.tsx': $auth_SignupForm,
		'./islands/auth/VerifyContent.tsx': $auth_VerifyContent,
		'./islands/metadata/ProjectManagerMetadata.tsx': $metadata_ProjectManagerMetadata,
		'./islands/metadata/ProjectMetadata.tsx': $metadata_ProjectMetadata,
		'./islands/metadata/SettingsMetadata.tsx': $metadata_SettingsMetadata,
		'./islands/metadata/index.ts': $metadata_index,
	},
	baseUrl: import.meta.url,
} satisfies Manifest;

export default manifest;
