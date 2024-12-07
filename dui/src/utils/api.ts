import { invoke } from '@tauri-apps/api/core';
import { ApiStartResult, ApiStatus, ApiConfig } from '../types/api';

export async function startApi(): Promise<ApiStartResult> {
  return invoke('start_api');
}

export async function stopApi(): Promise<boolean> {
  return invoke('stop_api');
}

export async function checkApiStatus(): Promise<ApiStatus> {
  return invoke('check_api_status');
}

export async function getApiConfig(): Promise<ApiConfig> {
  return invoke('get_api_config');
}