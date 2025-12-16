'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Send, Bot, Menu, Server, CheckCircle2, Settings2, Wrench } from 'lucide-react';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { ChatSidebar } from '@/components/chat-sidebar';
import { useMCP } from '@/contexts/mcp-context';
import { cn } from '@/lib/utils';
import { Message, ChatSession } from '@/lib/types';

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeServerIds, setActiveServerIds] = useState<Set<string>>(new Set());
  const [showToolSelector, setShowToolSelector] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { servers, refreshStatus } = useMCP();
  const connectedServers = servers.filter((s) => s.status === 'connected');
  const connectedCount = connectedServers.length;

  // Initialize active servers
  useEffect(() => {
    // When connected servers change, enable new ones by default if we haven't set preferences
    // Or just keep it simple: enable all connected by default?
    // Let's enable all connected by default for now, unless user unchecked them (if we tracked that).
    // For MVP, let's sync activeServerIds with connectedServers initially.
    const ids = new Set(connectedServers.map(s => s.config.id));
    setActiveServerIds(ids);
  }, [connectedCount]); // Only re-sync when count changes to avoid resetting user selection too often

  const generateId = () => {
    return typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 15);
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Initialize (same as before)
  useEffect(() => {
    // Check global MCP status on mount to ensure we have correct connected count
    refreshStatus();

    const savedSessions = localStorage.getItem('chat_sessions');
    const savedCurrentId = localStorage.getItem('current_session_id');

    if (savedSessions) {
      try {
        const parsedSessions = JSON.parse(savedSessions);
        setSessions(parsedSessions);
        if (savedCurrentId && parsedSessions.some((s: ChatSession) => s.id === savedCurrentId)) {
          setCurrentSessionId(savedCurrentId);
        } else if (parsedSessions.length > 0) {
          setCurrentSessionId(parsedSessions[0].id);
        } else {
           const newSession: ChatSession = {
              id: generateId(),
              title: 'New Chat',
              messages: [],
              createdAt: Date.now(),
            };
            setSessions([newSession]);
            setCurrentSessionId(newSession.id);
        }
      } catch (e) {
        console.error('Failed to parse sessions', e);
         const newSession: ChatSession = {
              id: generateId(),
              title: 'New Chat',
              messages: [],
              createdAt: Date.now(),
            };
            setSessions([newSession]);
            setCurrentSessionId(newSession.id);
      }
    } else {
         const newSession: ChatSession = {
              id: generateId(),
              title: 'New Chat',
              messages: [],
              createdAt: Date.now(),
            };
            setSessions([newSession]);
            setCurrentSessionId(newSession.id);
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('chat_sessions', JSON.stringify(sessions));
    }
    if (currentSessionId) {
      localStorage.setItem('current_session_id', currentSessionId);
    }
  }, [sessions, currentSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [sessions, currentSessionId]);

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('이 채팅방을 삭제하시겠습니까?')) return;
      
      const newSessions = sessions.filter(s => s.id !== id);
      
      if (newSessions.length === 0) {
          const newSession = {
              id: generateId(),
              title: 'New Chat',
              messages: [],
              createdAt: Date.now(),
          };
          setSessions([newSession]);
          setCurrentSessionId(newSession.id);
      } else {
          setSessions(newSessions);
          if (currentSessionId === id) {
              setCurrentSessionId(newSessions[0].id);
          }
      }
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleServer = (serverId: string) => {
    const newSet = new Set(activeServerIds);
    if (newSet.has(serverId)) {
      newSet.delete(serverId);
    } else {
      newSet.add(serverId);
    }
    setActiveServerIds(newSet);
  };

  const handleSend = async () => {
    const inputValue = inputRef.current?.value ?? '';
    if (!inputValue.trim() || isLoading || !currentSessionId) return;

    const userText = inputValue.trim();
    const userMessage: Message = { role: 'user', text: userText };
    
    setSessions((prev) => prev.map(session => {
        if (session.id === currentSessionId) {
            const isFirstMessage = session.messages.length === 0;
            return {
                ...session,
                title: isFirstMessage ? userText.slice(0, 30) : session.title,
                messages: [...session.messages, userMessage]
            };
        }
        return session;
    }));
    
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setInput('');
    setIsLoading(true);

    try {
      const latestSession = sessions.find((s) => s.id === currentSessionId);
      const latestMessages = latestSession?.messages || [];
      
      // Add empty model message
      setSessions((prev) => prev.map(session => {
        if (session.id === currentSessionId) {
            return {
                ...session,
                messages: [...session.messages, { role: 'model', text: '' }]
            };
        }
        return session;
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          history: latestMessages,
          activeServerIds: Array.from(activeServerIds),
        }),
      });

      if (!response.ok) throw new Error(response.statusText);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'text') {
              accumulatedText += data.content;
            } else if (data.type === 'call') {
              const toolName = data.tool;
              const args = JSON.stringify(data.args, null, 2);
              accumulatedText += `\n\n> 🛠️ **Tool Call**: \`${toolName}\`\n\`\`\`json\n${args}\n\`\`\`\n\n`;
            } else if (data.type === 'result') {
              const toolName = data.tool;
              const result = JSON.stringify(data.result, null, 2);
              // Limit result length for display
              const displayResult = result.length > 500 ? result.slice(0, 500) + '...' : result;
              accumulatedText += `\n> ✅ **Result** (${toolName}):\n\`\`\`json\n${displayResult}\n\`\`\`\n\n`;
            }

            // Update UI
            setSessions((prev) => prev.map(session => {
                if (session.id === currentSessionId) {
                    const newMessages = [...session.messages];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg && lastMsg.role === 'model') {
                        lastMsg.text = accumulatedText;
                    }
                    return { ...session, messages: newMessages };
                }
                return session;
            }));
          } catch (e) {
            console.error('Failed to parse chunk:', line, e);
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setSessions((prev) => prev.map(session => {
        if (session.id === currentSessionId) {
            const msgs = [...session.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'model' && !lastMsg.text) {
                // If we failed before getting any text, show error
                 msgs[msgs.length - 1].text = 'Error: Failed to get response.';
            } else {
                 // If we had some text, maybe append error? or just leave it.
            }
            return { ...session, messages: msgs };
        }
        return session;
      }));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={(id) => {
            setCurrentSessionId(id);
            setIsSidebarOpen(false);
        }}
        onCreateSession={createNewSession}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 flex flex-col h-full relative w-full">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
             <button 
                className="md:hidden p-2 -ml-2 text-gray-600"
                onClick={() => setIsSidebarOpen(true)}
             >
                <Menu className="w-6 h-6" />
             </button>
            <div className="bg-blue-600 p-2 rounded-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate max-w-[200px] md:max-w-none">
              {currentSession?.title || 'Gemini Chat'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Tool Selector */}
            {connectedCount > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowToolSelector(!showToolSelector)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border",
                    activeServerIds.size > 0 
                      ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" 
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <Wrench className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">Tools</span>
                  <span className="flex items-center justify-center w-5 h-5 text-xs bg-white bg-opacity-50 rounded-full">
                    {activeServerIds.size}
                  </span>
                </button>

                {showToolSelector && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowToolSelector(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20 p-2">
                      <div className="text-xs font-semibold text-gray-500 px-2 py-1 mb-1">
                        활성 MCP 서버 선택
                      </div>
                      {connectedServers.map(server => (
                        <button
                          key={server.config.id}
                          onClick={() => toggleServer(server.config.id)}
                          className="w-full flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-md text-left text-sm"
                        >
                          <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                            activeServerIds.has(server.config.id)
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-300"
                          )}>
                            {activeServerIds.has(server.config.id) && (
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <span className="truncate flex-1">{server.config.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* MCP 관리 링크 */}
            <Link
              href="/mcp"
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                connectedCount > 0
                  ? "bg-green-50 text-green-700 hover:bg-green-100"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">관리</span>
            </Link>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
              <Bot className="w-16 h-16 opacity-20" />
              <p className="text-lg">Gemini와 대화를 시작해보세요.</p>
              {connectedCount === 0 && (
                <p className="text-sm">
                  <Link href="/mcp" className="text-blue-600 hover:underline">
                    MCP 서버를 연결
                  </Link>
                  하여 더 많은 기능을 사용해보세요.
                </p>
              )}
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex w-full",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3 shadow-sm",
                    msg.role === 'user'
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white border border-gray-100 text-gray-800 rounded-bl-none"
                  )}
                >
                  <div className="leading-relaxed text-sm md:text-base w-full overflow-hidden">
                    <MarkdownRenderer content={msg.text} role={msg.role} />
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
             <div className="flex justify-start w-full">
               <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-5 py-3 shadow-sm flex items-center gap-2">
                 <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                 <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                 <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Input Area */}
        <footer className="p-4 bg-white border-t border-gray-200 shrink-0">
          <div className="max-w-4xl mx-auto relative flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={activeServerIds.size > 0 ? "Tools가 활성화되었습니다. 메시지를 입력하세요..." : "메시지를 입력하세요..."}
              disabled={isLoading || !currentSessionId}
              className="flex-1 bg-gray-100 text-gray-900 placeholder-gray-500 border-0 rounded-full px-6 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !currentSessionId}
              className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center mt-2 text-xs text-gray-400">
            Powered by Gemini 2.0 Flash
          </div>
        </footer>
      </div>
    </div>
  );
}
