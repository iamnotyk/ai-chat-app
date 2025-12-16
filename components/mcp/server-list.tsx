'use client';

import { 
  Server, 
  Plug, 
  PlugZap, 
  Trash2, 
  Terminal, 
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useMCP } from '@/contexts/mcp-context';
import type { MCPServerState } from '@/lib/mcp/types';
import { cn } from '@/lib/utils';

interface ServerListProps {
  onSelectServer: (serverId: string) => void;
  selectedServerId: string | null;
}

export function ServerList({ onSelectServer, selectedServerId }: ServerListProps) {
  const { servers, connectServer, disconnectServer, removeServer, isReconnecting } = useMCP();

  if (servers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>등록된 MCP 서버가 없습니다.</p>
        <p className="text-sm mt-1">위에서 새 서버를 추가해보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 자동 재연결 중 표시 */}
      {isReconnecting && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>서버 자동 재연결 중...</span>
        </div>
      )}
      
      {servers.map((server) => (
        <ServerItem
          key={server.config.id}
          server={server}
          isSelected={server.config.id === selectedServerId}
          onSelect={() => onSelectServer(server.config.id)}
          onConnect={() => connectServer(server.config.id)}
          onDisconnect={() => disconnectServer(server.config.id)}
          onRemove={() => removeServer(server.config.id)}
        />
      ))}
    </div>
  );
}

interface ServerItemProps {
  server: MCPServerState;
  isSelected: boolean;
  onSelect: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}

function ServerItem({
  server,
  isSelected,
  onSelect,
  onConnect,
  onDisconnect,
  onRemove,
}: ServerItemProps) {
  const { config, status, error } = server;
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isError = status === 'error';

  const handleConnectionToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnected) {
      onDisconnect();
    } else if (!isConnecting) {
      onConnect();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`"${config.name}" 서버를 삭제하시겠습니까?`)) {
      onRemove();
    }
  };

  return (
    <div
      onClick={isConnected ? onSelect : undefined}
      className={cn(
        'p-3 rounded-lg border transition-all',
        isSelected && isConnected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white',
        isConnected && 'cursor-pointer hover:border-blue-300',
        !isConnected && 'opacity-75'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* 아이콘 */}
          <div
            className={cn(
              'p-2 rounded-md',
              isConnected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
            )}
          >
            {config.type === 'stdio' ? (
              <Terminal className="w-4 h-4" />
            ) : (
              <Globe className="w-4 h-4" />
            )}
          </div>

          {/* 서버 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 truncate">
                {config.name}
              </span>
              <StatusBadge status={status} />
              {config.autoConnect && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600">
                  <RefreshCw className="w-2.5 h-2.5" />
                  자동
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {config.type === 'stdio'
                ? `${config.command} ${config.args?.join(' ') || ''}`
                : config.url}
            </p>
            {isError && error && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={handleConnectionToggle}
            disabled={isConnecting}
            className={cn(
              'p-2 rounded-md transition-colors',
              isConnected
                ? 'text-green-600 hover:bg-green-100'
                : 'text-gray-500 hover:bg-gray-100',
              isConnecting && 'cursor-not-allowed'
            )}
            title={isConnected ? '연결 해제' : '연결'}
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isConnected ? (
              <PlugZap className="w-4 h-4" />
            ) : (
              <Plug className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleRemove}
            className="p-2 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: MCPServerState['status'] }) {
  const config = {
    disconnected: {
      label: '연결 안됨',
      className: 'bg-gray-100 text-gray-600',
      Icon: null,
    },
    connecting: {
      label: '연결 중...',
      className: 'bg-yellow-100 text-yellow-700',
      Icon: Loader2,
    },
    connected: {
      label: '연결됨',
      className: 'bg-green-100 text-green-700',
      Icon: CheckCircle2,
    },
    error: {
      label: '오류',
      className: 'bg-red-100 text-red-700',
      Icon: AlertCircle,
    },
  }[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {config.Icon && (
        <config.Icon
          className={cn('w-3 h-3', status === 'connecting' && 'animate-spin')}
        />
      )}
      {config.label}
    </span>
  );
}
