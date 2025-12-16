import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  MCPServerConfig,
  MCPCapabilities,
  MCPTool,
  MCPPrompt,
  MCPResource,
} from './types';

interface ClientEntry {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
}

/**
 * MCP Client Manager - 싱글톤 패턴 (Global)
 * 여러 MCP 서버 연결을 관리합니다.
 * Next.js 개발 환경에서 hot reload 시 연결 유지를 위해 globalThis를 사용합니다.
 */
class MCPClientManager {
  private clients: Map<string, ClientEntry> = new Map();

  constructor() {
    // globalThis에 이미 저장된 clients가 있다면 복원하지 않음 (새 인스턴스 생성 시 초기화)
    // 하지만 이 클래스는 싱글톤으로 사용되므로 외부에서 인스턴스를 관리함.
  }

  /**
   * MCP 서버에 연결
   */
  async connect(config: MCPServerConfig): Promise<void> {
    // 이미 연결된 경우 기존 연결 해제
    if (this.clients.has(config.id)) {
      await this.disconnect(config.id);
    }

    const client = new Client({
      name: 'mcp-host-client',
      version: '1.0.0',
    });

    let transport: StdioClientTransport | StreamableHTTPClientTransport;

    if (config.type === 'stdio') {
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });
    } else {
      transport = new StreamableHTTPClientTransport(
        new URL(config.url),
        {
          requestInit: config.headers
            ? { headers: config.headers }
            : undefined,
        }
      );
    }

    await client.connect(transport);
    this.clients.set(config.id, { client, transport });
  }

  /**
   * MCP 서버 연결 해제
   */
  async disconnect(serverId: string): Promise<void> {
    const entry = this.clients.get(serverId);
    if (entry) {
      try {
        await entry.client.close();
      } catch (error) {
        console.error(`Error closing client ${serverId}:`, error);
      }
      this.clients.delete(serverId);
    }
  }

  /**
   * 연결된 서버 목록 조회
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * 서버 연결 여부 확인
   */
  isConnected(serverId: string): boolean {
    return this.clients.has(serverId);
  }

  /**
   * 특정 서버의 Client 가져오기
   */
  getClient(serverId: string): Client | undefined {
    return this.clients.get(serverId)?.client;
  }

  /**
   * Tools 목록 조회
   */
  async listTools(serverId: string): Promise<MCPTool[]> {
    const client = this.getClient(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
    }));
  }

  /**
   * Tool 실행
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown[]> {
    const client = this.getClient(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    return result.content as unknown[];
  }

  /**
   * Prompts 목록 조회
   */
  async listPrompts(serverId: string): Promise<MCPPrompt[]> {
    const client = this.getClient(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.listPrompts();
    return result.prompts.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments?.map((arg) => ({
        name: arg.name,
        description: arg.description,
        required: arg.required,
      })),
    }));
  }

  /**
   * Prompt 가져오기
   */
  async getPrompt(
    serverId: string,
    promptName: string,
    args?: Record<string, string>
  ): Promise<unknown[]> {
    const client = this.getClient(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.getPrompt({
      name: promptName,
      arguments: args,
    });

    return result.messages as unknown[];
  }

  /**
   * Resources 목록 조회
   */
  async listResources(serverId: string): Promise<MCPResource[]> {
    const client = this.getClient(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.listResources();
    return result.resources.map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }));
  }

  /**
   * Resource 읽기
   */
  async readResource(serverId: string, uri: string): Promise<unknown[]> {
    const client = this.getClient(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.readResource({ uri });
    return result.contents as unknown[];
  }

  /**
   * 모든 Capabilities 조회
   */
  async getCapabilities(serverId: string): Promise<MCPCapabilities> {
    const [tools, prompts, resources] = await Promise.all([
      this.listTools(serverId).catch(() => []),
      this.listPrompts(serverId).catch(() => []),
      this.listResources(serverId).catch(() => []),
    ]);

    return { tools, prompts, resources };
  }

  /**
   * 모든 연결 해제
   */
  async disconnectAll(): Promise<void> {
    const serverIds = this.getConnectedServers();
    await Promise.all(serverIds.map((id) => this.disconnect(id)));
  }
}

// Global scope type extension
const globalForMCP = globalThis as unknown as {
  mcpClientManager: MCPClientManager | undefined;
};

// Singleton instance management
export const mcpClientManager = globalForMCP.mcpClientManager ?? new MCPClientManager();

if (process.env.NODE_ENV !== 'production') {
  globalForMCP.mcpClientManager = mcpClientManager;
}

export default mcpClientManager;
