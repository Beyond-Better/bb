import { ComponentChildren } from "preact";
import { Head } from "$fresh/runtime.ts";
import SideNav from "../islands/SideNav.tsx";
import MetadataBar from "./MetadataBar.tsx";
import AppStateProvider from "../islands/AppStateProvider.tsx";
import { getApiHostname, getApiPort, getApiUseTls, getApiUrl, getWsUrl } from "../utils/url.utils.ts";

interface LayoutProps {
  children: ComponentChildren;
  title?: string;
  currentPath?: string;
  metadata?: ComponentChildren; // Metadata content specific to each route
}

export function Layout({ 
  children, 
  title = "BB - Beyond Better", 
  currentPath = "/",
  metadata,
}: LayoutProps) {
  // Initialize API URLs
  const apiHostname = getApiHostname();
  const apiPort = getApiPort();
  const apiUseTls = getApiUseTls();

  const apiUrl = getApiUrl(apiHostname, apiPort, apiUseTls);
  const wsUrl = getWsUrl(apiHostname, apiPort, apiUseTls);

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div class="flex h-screen bg-gray-50">
        {/* Initialize app state before any components that need it */}
        <AppStateProvider 
          wsUrl={wsUrl}
          apiUrl={apiUrl}
        />

        {/* Side Navigation */}
        <SideNav currentPath={currentPath} />

        {/* Main Content */}
        <div class="flex-1 flex flex-col overflow-hidden">
          {/* Metadata Bar */}
          <MetadataBar currentPath={currentPath}>
            {metadata}
          </MetadataBar>

          {/* Main content area */}
          <main class="flex-1 overflow-hidden">
            <div class="h-full">
                {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}