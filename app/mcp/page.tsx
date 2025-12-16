'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Server, 
  Plus, 
  ChevronLeft, 
  Download, 
  Upload,
  RefreshCw,
  X
} from 'lucide-react';
import { useMCP } from '@/contexts/mcp-context';
import { ServerForm } from '@/components/mcp/server-form';
import { ServerList } from '@/components/mcp/server-list';
import { CapabilityTabs } from '@/components/mcp/capability-tabs';
import type { MCPServerConfig } from '@/lib/mcp/types';

export default function MCPPage() {
  const { 
    servers, 
    addServer, 
    refreshStatus, 
    exportConfig, 
    importConfig 
  } = useMCP();
  
  const [showForm, setShowForm] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedServer = servers.find(
    (s) => s.config.id === selectedServerId && s.status === 'connected'
  );

  const handleAddServer = (config: MCPServerConfig) => {
    addServer(config);
    setShowForm(false);
  };

  const handleExport = () => {
    const json = exportConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-servers-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      const success = importConfig(json);
      if (success) {
        alert('설정을 성공적으로 가져왔습니다.');
      } else {
        alert('설정 가져오기에 실패했습니다. JSON 형식을 확인해주세요.');
      }
    };
    reader.readAsText(file);

    // 같은 파일 다시 선택 가능하도록 초기화
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">채팅으로 돌아가기</span>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Server className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">MCP 서버 관리</h1>
              </div>
            </div>
            
            {/* 액션 버튼들 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => refreshStatus()}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="상태 새로고침"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={handleExport}
                disabled={servers.length === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">내보내기</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">가져오기</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 좌측: 서버 목록 */}
          <div className="space-y-4">
            {/* 서버 추가 버튼 */}
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                새 MCP 서버 추가
              </button>
            )}

            {/* 서버 추가 폼 */}
            {showForm && (
              <ServerForm
                onSubmit={handleAddServer}
                onCancel={() => setShowForm(false)}
              />
            )}

            {/* 서버 목록 */}
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Server className="w-4 h-4" />
                등록된 서버
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                  {servers.length}
                </span>
              </h2>
              <ServerList
                onSelectServer={setSelectedServerId}
                selectedServerId={selectedServerId}
              />
            </div>

            {/* 안내 메시지 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>보안 알림:</strong> MCP 서버 설정은 브라우저의 localStorage에 저장됩니다. 
                공용 또는 공유 PC에서는 민감한 정보가 포함된 설정 저장에 주의하세요.
              </p>
            </div>
          </div>

          {/* 우측: 서버 상세 (Capabilities) */}
          <div className="bg-white rounded-lg border min-h-[400px]">
            {selectedServer ? (
              <>
                <div className="flex items-center justify-between p-4 border-b">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {selectedServer.config.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      서버 기능 조회 및 테스트
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedServerId(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <CapabilityTabs serverId={selectedServer.config.id} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                <Server className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">서버를 선택하세요</p>
                <p className="text-sm mt-1">
                  연결된 서버를 클릭하면 Tools, Prompts, Resources를 확인할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
