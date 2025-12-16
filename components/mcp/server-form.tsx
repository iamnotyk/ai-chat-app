'use client';

import { useState } from 'react';
import { Plus, Terminal, Globe } from 'lucide-react';
import type { MCPServerConfig, MCPTransportType } from '@/lib/mcp/types';
import { cn } from '@/lib/utils';

interface ServerFormProps {
  onSubmit: (config: MCPServerConfig) => void;
  onCancel?: () => void;
}

export function ServerForm({ onSubmit, onCancel }: ServerFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<MCPTransportType>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [autoConnect, setAutoConnect] = useState(true);

  const generateId = () => {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const baseConfig = {
      id: generateId(),
      name: name.trim(),
      autoConnect,
    };

    if (type === 'stdio') {
      if (!command.trim()) return;
      onSubmit({
        ...baseConfig,
        type: 'stdio',
        command: command.trim(),
        args: args.trim() ? args.split(' ').filter(Boolean) : undefined,
      });
    } else {
      if (!url.trim()) return;
      onSubmit({
        ...baseConfig,
        type: 'streamable-http',
        url: url.trim(),
      });
    }

    // 폼 초기화
    setName('');
    setCommand('');
    setArgs('');
    setUrl('');
    setAutoConnect(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-lg border">
      <h3 className="font-semibold text-gray-900">새 MCP 서버 추가</h3>

      {/* 서버 이름 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          서버 이름
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My MCP Server"
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          required
        />
      </div>

      {/* 전송 타입 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          연결 방식
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('stdio')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md border transition-colors',
              type === 'stdio'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            )}
          >
            <Terminal className="w-4 h-4" />
            STDIO
          </button>
          <button
            type="button"
            onClick={() => setType('streamable-http')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md border transition-colors',
              type === 'streamable-http'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            )}
          >
            <Globe className="w-4 h-4" />
            HTTP
          </button>
        </div>
      </div>

      {/* STDIO 설정 */}
      {type === 'stdio' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              실행 명령어
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npx, node, python 등"
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              인자 (공백으로 구분)
            </label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="-y @modelcontextprotocol/server-everything"
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </>
      )}

      {/* HTTP 설정 */}
      {type === 'streamable-http' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            서버 URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:3001/mcp"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            required
          />
        </div>
      )}

      {/* 자동 연결 옵션 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="autoConnect"
          checked={autoConnect}
          onChange={(e) => setAutoConnect(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <label htmlFor="autoConnect" className="text-sm text-gray-700">
          페이지 로드 시 자동 연결 (서버 재시작 후에도 자동 재연결)
        </label>
      </div>

      {/* 버튼 */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          추가
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
        )}
      </div>
    </form>
  );
}
