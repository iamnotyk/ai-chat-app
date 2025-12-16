import React from 'react';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatSession } from '@/lib/types';

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  isOpen,
  onToggle
}: ChatSidebarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed md:relative z-30 flex flex-col w-64 h-full bg-gray-50 border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Chat History</h2>
        </div>

        <div className="p-4">
          <button
            onClick={onCreateSession}
            className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors",
                currentSessionId === session.id
                  ? "bg-white shadow-sm border border-gray-200"
                  : "hover:bg-gray-100"
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare className={cn(
                    "w-5 h-5 flex-shrink-0",
                    currentSessionId === session.id ? "text-blue-600" : "text-gray-400"
                )} />
                <span className={cn(
                    "text-sm truncate",
                     currentSessionId === session.id ? "font-medium text-gray-900" : "text-gray-600"
                )}>
                  {session.title || 'New Chat'}
                </span>
              </div>
              
              <button
                onClick={(e) => onDeleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                title="Delete Chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          {sessions.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              <p>No chats yet.</p>
              <p>Start a new one!</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
