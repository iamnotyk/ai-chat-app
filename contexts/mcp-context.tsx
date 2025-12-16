'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type {
  MCPServerConfig,
  MCPConnectionStatus,
  MCPServerState,
  MCPExportConfig,
  MCPCapabilities,
} from '@/lib/mcp/types';

const STORAGE_KEY = 'mcp_servers';
const CONNECTION_STATE_KEY = 'mcp_connection_states';
const EXPORT_VERSION = '1.0.0';
const MAX_RETRY_COUNT = 3;

interface ConnectionState {
  wasConnected: boolean;
  retryCount: number;
}

interface MCPContextValue {
  // 서버 상태
  servers: MCPServerState[];
  
  // 서버 관리
  addServer: (config: MCPServerConfig) => void;
  updateServer: (id: string, config: Partial<MCPServerConfig>) => void;
  removeServer: (id: string) => void;
  
  // 연결 관리
  connectServer: (id: string) => Promise<void>;
  disconnectServer: (id: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  
  // Capabilities
  getCapabilities: (serverId: string) => Promise<MCPCapabilities>;
  
  // Import/Export
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  
  // 로딩 상태
  isLoading: boolean;
  isReconnecting: boolean;
}

const MCPContext = createContext<MCPContextValue | null>(null);

export function MCPProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<MCPServerState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const reconnectingRef = useRef(false);

  // localStorage에서 연결 상태 로드
  const loadConnectionStates = useCallback((): Record<string, ConnectionState> => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(CONNECTION_STATE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, []);

  // localStorage에 연결 상태 저장
  const saveConnectionStates = useCallback((states: Record<string, ConnectionState>) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CONNECTION_STATE_KEY, JSON.stringify(states));
  }, []);

  // 특정 서버의 연결 상태 업데이트
  const updateConnectionState = useCallback((serverId: string, update: Partial<ConnectionState>) => {
    const states = loadConnectionStates();
    states[serverId] = { ...states[serverId], ...update };
    saveConnectionStates(states);
  }, [loadConnectionStates, saveConnectionStates]);

  // localStorage에서 서버 설정 로드
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const saved = localStorage.getItem(STORAGE_KEY);
    const connectionStates = loadConnectionStates();
    
    if (saved) {
      try {
        const configs: MCPServerConfig[] = JSON.parse(saved);
        setServers(
          configs.map((config) => ({
            config,
            status: 'disconnected' as MCPConnectionStatus,
            wasConnected: connectionStates[config.id]?.wasConnected || false,
            retryCount: 0,
          }))
        );
      } catch (error) {
        console.error('Failed to parse saved MCP servers:', error);
      }
    }
    setInitialized(true);
  }, [loadConnectionStates]);

  // 서버 설정 변경 시 localStorage에 저장
  useEffect(() => {
    if (!initialized || typeof window === 'undefined') return;
    
    const configs = servers.map((s) => s.config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  }, [servers, initialized]);

  // 서버 연결 (내부 함수 - 재연결 시 사용)
  const connectServerInternal = useCallback(async (
    server: MCPServerState
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: server.config }),
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error(`Failed to connect ${server.config.name}:`, error);
      return false;
    }
  }, []);

  // 자동 재연결 수행
  const performAutoReconnect = useCallback(async (
    serversToReconnect: MCPServerState[]
  ) => {
    if (serversToReconnect.length === 0) return;
    
    setIsReconnecting(true);
    console.log(`자동 재연결 시도: ${serversToReconnect.map(s => s.config.name).join(', ')}`);

    for (const server of serversToReconnect) {
      const currentRetry = server.retryCount || 0;
      
      if (currentRetry >= MAX_RETRY_COUNT) {
        console.log(`${server.config.name}: 최대 재시도 횟수 초과`);
        setServers((prev) =>
          prev.map((s) =>
            s.config.id === server.config.id
              ? { ...s, status: 'error', error: '자동 재연결 실패 (최대 재시도 초과)', wasConnected: false }
              : s
          )
        );
        updateConnectionState(server.config.id, { wasConnected: false, retryCount: 0 });
        continue;
      }

      // 연결 중 상태로 변경
      setServers((prev) =>
        prev.map((s) =>
          s.config.id === server.config.id
            ? { ...s, status: 'connecting', retryCount: currentRetry + 1 }
            : s
        )
      );

      const success = await connectServerInternal(server);

      if (success) {
        console.log(`${server.config.name}: 재연결 성공`);
        setServers((prev) =>
          prev.map((s) =>
            s.config.id === server.config.id
              ? { ...s, status: 'connected', error: undefined, wasConnected: true, retryCount: 0 }
              : s
          )
        );
        updateConnectionState(server.config.id, { wasConnected: true, retryCount: 0 });
      } else {
        console.log(`${server.config.name}: 재연결 실패 (시도 ${currentRetry + 1}/${MAX_RETRY_COUNT})`);
        setServers((prev) =>
          prev.map((s) =>
            s.config.id === server.config.id
              ? { ...s, status: 'error', error: `재연결 실패 (${currentRetry + 1}/${MAX_RETRY_COUNT})`, retryCount: currentRetry + 1 }
              : s
          )
        );
      }
    }

    setIsReconnecting(false);
  }, [connectServerInternal, updateConnectionState]);

  // 서버 연결 상태 동기화 및 자동 재연결
  const refreshStatus = useCallback(async () => {
    if (reconnectingRef.current) return;
    
    try {
      const response = await fetch('/api/mcp/status');
      const data = await response.json();
      const connectedIds = new Set<string>(data.connectedServers || []);

      // 현재 서버 상태 스냅샷
      const currentServers = [...servers];
      
      // 재연결 대상 찾기
      const serversToReconnect = currentServers.filter((server) => {
        const isActuallyConnected = connectedIds.has(server.config.id);
        
        // 이전에 연결됐었는데 지금 끊어진 경우 -> 재연결 대상
        if (server.wasConnected && !isActuallyConnected && server.status !== 'connecting') {
          return true;
        }
        
        // autoConnect가 true인데 연결 안된 경우 -> 재연결 대상
        if (server.config.autoConnect && !isActuallyConnected && server.status !== 'connecting' && !server.wasConnected) {
          return true;
        }
        
        return false;
      });

      // 상태 업데이트
      setServers((prev) =>
        prev.map((server) => {
          const isActuallyConnected = connectedIds.has(server.config.id);
          return {
            ...server,
            status: isActuallyConnected ? 'connected' : (server.status === 'connecting' ? 'connecting' : 'disconnected'),
            error: isActuallyConnected ? undefined : server.error,
          } as MCPServerState;
        })
      );

      // 재연결 수행
      if (serversToReconnect.length > 0 && !reconnectingRef.current) {
        reconnectingRef.current = true;
        await performAutoReconnect(serversToReconnect);
        reconnectingRef.current = false;
      }
    } catch (error) {
      console.error('Failed to refresh MCP status:', error);
    }
  }, [servers, performAutoReconnect]);

  // 초기화 후 상태 동기화 (한 번만 실행)
  useEffect(() => {
    if (initialized && servers.length > 0) {
      refreshStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]); // 의도적으로 초기화 시 한 번만 실행

  // 서버 추가
  const addServer = useCallback((config: MCPServerConfig) => {
    setServers((prev) => {
      // 중복 ID 방지
      if (prev.some((s) => s.config.id === config.id)) {
        return prev;
      }
      return [...prev, { config, status: 'disconnected', wasConnected: false, retryCount: 0 }];
    });
  }, []);

  // 서버 설정 업데이트
  const updateServer = useCallback((id: string, updates: Partial<MCPServerConfig>) => {
    setServers((prev) =>
      prev.map((server) =>
        server.config.id === id
          ? { ...server, config: { ...server.config, ...updates } as MCPServerConfig }
          : server
      )
    );
  }, []);

  // 서버 삭제
  const removeServer = useCallback(async (id: string) => {
    // 연결된 서버는 먼저 연결 해제
    const server = servers.find((s) => s.config.id === id);
    if (server?.status === 'connected') {
      try {
        await fetch('/api/mcp/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serverId: id }),
        });
      } catch (error) {
        console.error('Failed to disconnect before removing:', error);
      }
    }
    
    // 연결 상태도 제거
    const states = loadConnectionStates();
    delete states[id];
    saveConnectionStates(states);
    
    setServers((prev) => prev.filter((s) => s.config.id !== id));
  }, [servers, loadConnectionStates, saveConnectionStates]);

  // 서버 연결 (수동)
  const connectServer = useCallback(async (id: string) => {
    const server = servers.find((s) => s.config.id === id);
    if (!server) return;

    setServers((prev) =>
      prev.map((s) =>
        s.config.id === id ? { ...s, status: 'connecting', error: undefined, retryCount: 0 } : s
      )
    );

    try {
      const response = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: server.config }),
      });

      const data = await response.json();

      if (data.success) {
        setServers((prev) =>
          prev.map((s) =>
            s.config.id === id ? { ...s, status: 'connected', error: undefined, wasConnected: true } : s
          )
        );
        // 연결 성공 시 상태 저장
        updateConnectionState(id, { wasConnected: true, retryCount: 0 });
      } else {
        setServers((prev) =>
          prev.map((s) =>
            s.config.id === id ? { ...s, status: 'error', error: data.error } : s
          )
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '연결에 실패했습니다.';
      setServers((prev) =>
        prev.map((s) =>
          s.config.id === id ? { ...s, status: 'error', error: message } : s
        )
      );
    }
  }, [servers, updateConnectionState]);

  // 서버 연결 해제 (수동)
  const disconnectServer = useCallback(async (id: string) => {
    try {
      await fetch('/api/mcp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: id }),
      });

      setServers((prev) =>
        prev.map((s) =>
          s.config.id === id ? { ...s, status: 'disconnected', error: undefined, wasConnected: false } : s
        )
      );
      // 수동 연결 해제 시 자동 재연결 방지
      updateConnectionState(id, { wasConnected: false, retryCount: 0 });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }, [updateConnectionState]);

  // Capabilities 조회
  const getCapabilities = useCallback(async (serverId: string): Promise<MCPCapabilities> => {
    setIsLoading(true);
    try {
      const [toolsRes, promptsRes, resourcesRes] = await Promise.all([
        fetch(`/api/mcp/tools?serverId=${serverId}`),
        fetch(`/api/mcp/prompts?serverId=${serverId}`),
        fetch(`/api/mcp/resources?serverId=${serverId}`),
      ]);

      const [toolsData, promptsData, resourcesData] = await Promise.all([
        toolsRes.json(),
        promptsRes.json(),
        resourcesRes.json(),
      ]);

      return {
        tools: toolsData.success ? toolsData.tools : [],
        prompts: promptsData.success ? promptsData.prompts : [],
        resources: resourcesData.success ? resourcesData.resources : [],
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 설정 내보내기
  const exportConfig = useCallback((): string => {
    const exportData: MCPExportConfig = {
      version: EXPORT_VERSION,
      servers: servers.map((s) => s.config),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(exportData, null, 2);
  }, [servers]);

  // 설정 가져오기
  const importConfig = useCallback((json: string): boolean => {
    try {
      const data: MCPExportConfig = JSON.parse(json);
      
      if (!data.servers || !Array.isArray(data.servers)) {
        return false;
      }

      // 기존 서버와 병합 (같은 ID는 덮어씀)
      setServers((prev) => {
        const existingIds = new Set(prev.map((s) => s.config.id));
        const newServers = data.servers
          .filter((config) => !existingIds.has(config.id))
          .map((config) => ({ 
            config, 
            status: 'disconnected' as MCPConnectionStatus,
            wasConnected: false,
            retryCount: 0,
          }));
        
        const updatedServers = prev.map((server) => {
          const imported = data.servers.find((c) => c.id === server.config.id);
          if (imported) {
            return { ...server, config: imported };
          }
          return server;
        });

        return [...updatedServers, ...newServers];
      });

      return true;
    } catch (error) {
      console.error('Failed to import config:', error);
      return false;
    }
  }, []);

  const value: MCPContextValue = {
    servers,
    addServer,
    updateServer,
    removeServer,
    connectServer,
    disconnectServer,
    refreshStatus,
    getCapabilities,
    exportConfig,
    importConfig,
    isLoading,
    isReconnecting,
  };

  return <MCPContext.Provider value={value}>{children}</MCPContext.Provider>;
}

export function useMCP() {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within an MCPProvider');
  }
  return context;
}
