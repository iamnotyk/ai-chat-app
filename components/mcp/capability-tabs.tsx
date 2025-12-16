'use client';

import { useState, useEffect } from 'react';
import { 
  Wrench, 
  MessageSquare, 
  FileText, 
  Play, 
  ChevronDown, 
  ChevronRight,
  Loader2,
  Code
} from 'lucide-react';
import { useMCP } from '@/contexts/mcp-context';
import type { MCPCapabilities, MCPTool, MCPPrompt, MCPResource } from '@/lib/mcp/types';
import { cn } from '@/lib/utils';

type TabType = 'tools' | 'prompts' | 'resources';

interface CapabilityTabsProps {
  serverId: string;
}

export function CapabilityTabs({ serverId }: CapabilityTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('tools');
  const [capabilities, setCapabilities] = useState<MCPCapabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const { getCapabilities } = useMCP();

  useEffect(() => {
    const loadCapabilities = async () => {
      setLoading(true);
      try {
        const caps = await getCapabilities(serverId);
        setCapabilities(caps);
      } catch (error) {
        console.error('Failed to load capabilities:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCapabilities();
  }, [serverId, getCapabilities]);

  const tabs = [
    { id: 'tools' as TabType, label: 'Tools', Icon: Wrench, count: capabilities?.tools.length || 0 },
    { id: 'prompts' as TabType, label: 'Prompts', Icon: MessageSquare, count: capabilities?.prompts.length || 0 },
    { id: 'resources' as TabType, label: 'Resources', Icon: FileText, count: capabilities?.resources.length || 0 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div>
      {/* 탭 헤더 */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <tab.Icon className="w-4 h-4" />
            {tab.label}
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="p-4">
        {activeTab === 'tools' && (
          <ToolsList tools={capabilities?.tools || []} serverId={serverId} />
        )}
        {activeTab === 'prompts' && (
          <PromptsList prompts={capabilities?.prompts || []} serverId={serverId} />
        )}
        {activeTab === 'resources' && (
          <ResourcesList resources={capabilities?.resources || []} serverId={serverId} />
        )}
      </div>
    </div>
  );
}

// Tools 목록
function ToolsList({ tools, serverId }: { tools: MCPTool[]; serverId: string }) {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  if (tools.length === 0) {
    return <EmptyState message="등록된 Tool이 없습니다." />;
  }

  return (
    <div className="space-y-2">
      {tools.map((tool) => (
        <ToolItem
          key={tool.name}
          tool={tool}
          serverId={serverId}
          isExpanded={expandedTool === tool.name}
          onToggle={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
        />
      ))}
    </div>
  );
}

// inputSchema에서 필드 정보 추출
interface SchemaField {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  enum?: string[];
  default?: unknown;
}

function extractSchemaFields(inputSchema: Record<string, unknown> | undefined): SchemaField[] {
  if (!inputSchema) return [];
  
  const properties = inputSchema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) return [];
  
  const required = (inputSchema.required as string[]) || [];
  
  return Object.entries(properties).map(([name, prop]) => ({
    name,
    type: (prop.type as string) || 'string',
    description: prop.description as string | undefined,
    required: required.includes(name),
    enum: prop.enum as string[] | undefined,
    default: prop.default,
  }));
}

function ToolItem({
  tool,
  serverId,
  isExpanded,
  onToggle,
}: {
  tool: MCPTool;
  serverId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [rawJson, setRawJson] = useState('{}');
  const [useRawJson, setUseRawJson] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const schemaFields = extractSchemaFields(tool.inputSchema);
  const hasFields = schemaFields.length > 0;

  const handleFieldChange = (name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  const buildArguments = (): Record<string, unknown> => {
    if (useRawJson || !hasFields) {
      return JSON.parse(rawJson);
    }

    const args: Record<string, unknown> = {};
    for (const field of schemaFields) {
      const value = fieldValues[field.name];
      if (value === undefined || value === '') continue;

      // 타입에 따라 변환
      switch (field.type) {
        case 'number':
        case 'integer':
          args[field.name] = Number(value);
          break;
        case 'boolean':
          args[field.name] = value === 'true';
          break;
        case 'array':
          try {
            args[field.name] = JSON.parse(value);
          } catch {
            args[field.name] = value.split(',').map((s) => s.trim());
          }
          break;
        case 'object':
          try {
            args[field.name] = JSON.parse(value);
          } catch {
            args[field.name] = value;
          }
          break;
        default:
          args[field.name] = value;
      }
    }
    return args;
  };

  const handleExecute = async () => {
    setExecuting(true);
    setResult(null);
    try {
      const parsedArgs = buildArguments();
      const response = await fetch('/api/mcp/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          toolName: tool.name,
          arguments: parsedArgs,
        }),
      });
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Error executing tool');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Wrench className="w-4 h-4 text-blue-500" />
          <div className="text-left">
            <span className="font-medium text-gray-900">{tool.name}</span>
            {tool.description && (
              <p className="text-sm text-gray-500 mt-0.5">{tool.description}</p>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t p-3 bg-gray-50 space-y-3">
          {/* 입력 모드 토글 */}
          {hasFields && (
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setUseRawJson(false)}
                className={cn(
                  'px-2 py-1 rounded transition-colors',
                  !useRawJson ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                필드 입력
              </button>
              <button
                onClick={() => setUseRawJson(true)}
                className={cn(
                  'px-2 py-1 rounded transition-colors',
                  useRawJson ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                JSON 직접 입력
              </button>
            </div>
          )}

          {/* 필드 기반 입력 */}
          {hasFields && !useRawJson && (
            <div className="space-y-3">
              {schemaFields.map((field) => (
                <div key={field.name}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {field.name}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                    <span className="text-gray-400 ml-2 font-normal">({field.type})</span>
                  </label>
                  {field.description && (
                    <p className="text-xs text-gray-500 mb-1">{field.description}</p>
                  )}
                  {field.enum ? (
                    <select
                      value={fieldValues[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="">선택하세요</option>
                      {field.enum.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'boolean' ? (
                    <select
                      value={fieldValues[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="">선택하세요</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : field.type === 'object' || field.type === 'array' ? (
                    <textarea
                      value={fieldValues[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      placeholder={field.type === 'array' ? '["item1", "item2"] 또는 item1, item2' : '{"key": "value"}'}
                      className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      rows={2}
                    />
                  ) : (
                    <input
                      type={field.type === 'number' || field.type === 'integer' ? 'number' : 'text'}
                      value={fieldValues[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      placeholder={field.default !== undefined ? `기본값: ${field.default}` : ''}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* JSON 직접 입력 */}
          {(!hasFields || useRawJson) && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                인자 (JSON)
              </label>
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                rows={4}
                placeholder='{}'
              />
            </div>
          )}

          {/* 스키마 정보 (접힌 상태) */}
          {tool.inputSchema && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                입력 스키마 보기
              </summary>
              <pre className="mt-2 bg-white p-2 rounded border overflow-auto max-h-32">
                {JSON.stringify(tool.inputSchema, null, 2)}
              </pre>
            </details>
          )}

          <button
            onClick={handleExecute}
            disabled={executing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {executing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            실행
          </button>

          {result && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                결과
              </label>
              <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-48 whitespace-pre-wrap">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Prompts 목록
function PromptsList({ prompts, serverId }: { prompts: MCPPrompt[]; serverId: string }) {
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  if (prompts.length === 0) {
    return <EmptyState message="등록된 Prompt가 없습니다." />;
  }

  return (
    <div className="space-y-2">
      {prompts.map((prompt) => (
        <PromptItem
          key={prompt.name}
          prompt={prompt}
          serverId={serverId}
          isExpanded={expandedPrompt === prompt.name}
          onToggle={() => setExpandedPrompt(expandedPrompt === prompt.name ? null : prompt.name)}
        />
      ))}
    </div>
  );
}

function PromptItem({
  prompt,
  serverId,
  isExpanded,
  onToggle,
}: {
  prompt: MCPPrompt;
  serverId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const handleExecute = async () => {
    setExecuting(true);
    setResult(null);
    try {
      const response = await fetch('/api/mcp/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          promptName: prompt.name,
          arguments: args,
        }),
      });
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Error getting prompt');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MessageSquare className="w-4 h-4 text-purple-500" />
          <div className="text-left">
            <span className="font-medium text-gray-900">{prompt.name}</span>
            {prompt.description && (
              <p className="text-sm text-gray-500 mt-0.5">{prompt.description}</p>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t p-3 bg-gray-50 space-y-3">
          {prompt.arguments && prompt.arguments.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">
                인자
              </label>
              {prompt.arguments.map((arg) => (
                <div key={arg.name}>
                  <label className="block text-xs text-gray-600 mb-1">
                    {arg.name}
                    {arg.required && <span className="text-red-500 ml-1">*</span>}
                    {arg.description && (
                      <span className="text-gray-400 ml-2">- {arg.description}</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={args[arg.name] || ''}
                    onChange={(e) => setArgs({ ...args, [arg.name]: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleExecute}
            disabled={executing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
          >
            {executing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Code className="w-4 h-4" />
            )}
            가져오기
          </button>

          {result && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                결과
              </label>
              <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-48">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Resources 목록
function ResourcesList({ resources, serverId }: { resources: MCPResource[]; serverId: string }) {
  const [expandedResource, setExpandedResource] = useState<string | null>(null);

  if (resources.length === 0) {
    return <EmptyState message="등록된 Resource가 없습니다." />;
  }

  return (
    <div className="space-y-2">
      {resources.map((resource) => (
        <ResourceItem
          key={resource.uri}
          resource={resource}
          serverId={serverId}
          isExpanded={expandedResource === resource.uri}
          onToggle={() => setExpandedResource(expandedResource === resource.uri ? null : resource.uri)}
        />
      ))}
    </div>
  );
}

function ResourceItem({
  resource,
  serverId,
  isExpanded,
  onToggle,
}: {
  resource: MCPResource;
  serverId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const handleRead = async () => {
    setExecuting(true);
    setResult(null);
    try {
      const response = await fetch('/api/mcp/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          uri: resource.uri,
        }),
      });
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Error reading resource');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-green-500" />
          <div className="text-left">
            <span className="font-medium text-gray-900">{resource.name}</span>
            <p className="text-xs text-gray-400 font-mono">{resource.uri}</p>
            {resource.description && (
              <p className="text-sm text-gray-500 mt-0.5">{resource.description}</p>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t p-3 bg-gray-50 space-y-3">
          {resource.mimeType && (
            <p className="text-xs text-gray-500">
              MIME Type: <code className="bg-gray-200 px-1 rounded">{resource.mimeType}</code>
            </p>
          )}

          <button
            onClick={handleRead}
            disabled={executing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            {executing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            읽기
          </button>

          {result && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                내용
              </label>
              <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-48">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-gray-500">
      <p>{message}</p>
    </div>
  );
}
