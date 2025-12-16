// MCP 서버 설정 타입
export type MCPTransportType = 'stdio' | 'streamable-http';

export interface MCPServerConfigBase {
  id: string;
  name: string;
  type: MCPTransportType;
  autoConnect?: boolean; // 페이지 로드 시 자동 연결 여부
}

export interface MCPStdioServerConfig extends MCPServerConfigBase {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPHttpServerConfig extends MCPServerConfigBase {
  type: 'streamable-http';
  url: string;
  headers?: Record<string, string>;
}

export type MCPServerConfig = MCPStdioServerConfig | MCPHttpServerConfig;

// 서버 연결 상태
export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MCPServerState {
  config: MCPServerConfig;
  status: MCPConnectionStatus;
  error?: string;
  wasConnected?: boolean; // 이전에 연결됐었는지 (자동 재연결 판단용)
  retryCount?: number; // 재연결 시도 횟수
}

// MCP Capabilities
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPCapabilities {
  tools: MCPTool[];
  prompts: MCPPrompt[];
  resources: MCPResource[];
}

// API 요청/응답 타입
export interface ConnectRequest {
  config: MCPServerConfig;
}

export interface ConnectResponse {
  success: boolean;
  serverId: string;
  error?: string;
}

export interface DisconnectRequest {
  serverId: string;
}

export interface DisconnectResponse {
  success: boolean;
  error?: string;
}

export interface StatusResponse {
  connectedServers: string[];
}

export interface ToolCallRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResponse {
  success: boolean;
  content?: unknown[];
  error?: string;
}

export interface PromptGetRequest {
  serverId: string;
  promptName: string;
  arguments?: Record<string, string>;
}

export interface PromptGetResponse {
  success: boolean;
  messages?: unknown[];
  error?: string;
}

export interface ResourceReadRequest {
  serverId: string;
  uri: string;
}

export interface ResourceReadResponse {
  success: boolean;
  contents?: unknown[];
  error?: string;
}

// 설정 내보내기/가져오기 형식
export interface MCPExportConfig {
  version: string;
  servers: MCPServerConfig[];
  exportedAt: string;
}
