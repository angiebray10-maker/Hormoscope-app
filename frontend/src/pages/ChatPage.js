import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Send, Camera, Image as ImageIcon, X, User, Menu, Trash2, MessageCircle } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ChatPage() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load conversations list for sidebar
  useEffect(() => {
    loadConversationsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversationsList = useCallback(async () => {
    try {
      setLoadingConvos(true);
      const res = await axios.get(`${API}/chat/conversations?is_boyfriend_mode=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(res.data || []);
    } catch (err) {
      logger.error('Failed to load conversations:', err);
    } finally {
      setLoadingConvos(false);
    }
  }, [token]);

  const loadConversation = async (convId) => {
    try {
      const res = await axios.get(`${API}/chat/history?conversation_id=${convId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data && res.data.length > 0) {
        const formattedMessages = res.data.flatMap(msg => [
          { role: 'user', content: msg.user_message, hasImage: msg.has_image },
          { role: 'assistant', content: msg.ai_response }
        ]);
        setMessages(formattedMessages);
        setConversationId(convId);
      }
      setSidebarOpen(false);
    } catch (err) {
      logger.error('Failed to load conversation:', err);
    }
  };

  const deleteConversation = async (convId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    
    try {
      await axios.delete(`${API}/chat/conversations/${convId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // If deleting current conversation, clear it
      if (convId === conversationId) {
        setConversationId(null);
        setMessages([]);
      }
      
      // Refresh list
      loadConversationsList();
    } catch (err) {
      logger.error('Failed to delete:', err);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || loading) return;

    const userMessage = input.trim();
    const imageToSend = imagePreview;
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage || '📷 Sent a photo',
      imagePreview: imageToSend,
      hasImage: !!imageToSend
    }]);
    setInput('');
    clearSelectedImage();
    setLoading(true);

    try {
      const payload = {
        message: userMessage || 'Please analyze this image',
        is_boyfriend_mode: false,
        conversation_id: conversationId
      };
      
      if (imageToSend) payload.image_base64 = imageToSend;

      const res = await axios.post(`${API}/chat`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!conversationId && res.data.conversation_id) {
        setConversationId(res.data.conversation_id);
        loadConversationsList(); // Refresh sidebar
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: res.data.ai_response 
      }]);
    } catch (err) {
      logger.error('Chat error:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, I couldn't process that. Please try again." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-100px)] lg:h-[calc(100vh-20px)] lg:pl-64" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)' }}>
      
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Conversations Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-72 bg-[#12091a] border-r border-white/10 z-50 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:left-64 lg:w-64`}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white text-sm font-medium">Conversations</h3>
          <button
            onClick={startNewChat}
            className="text-xs text-[#ff8fab] hover:text-white px-2 py-1 rounded bg-[#ff8fab]/10 hover:bg-[#ff8fab]/20 transition-all"
          >
            + New
          </button>
        </div>
        
        <div className="overflow-y-auto h-[calc(100%-60px)] p-2">
          {loadingConvos ? (
            <p className="text-[#6c6c8a] text-xs text-center py-4">Loading...</p>
          ) : conversations.length === 0 ? (
            <p className="text-[#6c6c8a] text-xs text-center py-4">No conversations yet</p>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full text-left p-3 rounded-xl mb-1 transition-all group ${
                  conv.id === conversationId 
                    ? 'bg-[#ff8fab]/20 border border-[#ff8fab]/30' 
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs truncate">{conv.preview || 'Conversation'}</p>
                    <p className="text-[#6c6c8a] text-[10px] mt-1">
                      {new Date(conv.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-[#6c6c8a] hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Header */}
        <div className="p-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all lg:hidden"
            >
              <Menu className="w-5 h-5 text-[#b8b8d1]" />
            </button>
            <img 
              src="/logo192.png" 
              alt="horMoscope" 
              className="w-9 h-9 rounded-full flex-shrink-0 object-cover"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg text-[#c9b8f0] truncate" style={{ fontFamily: "'Poiret One', cursive", fontWeight: 400 }}>HORMOscope</h2>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <img 
                src="/logo192.png" 
                alt="horMoscope" 
                className="w-16 h-16 rounded-full mb-4 object-cover border-2 border-[#ff8fab]/30"
              />
              <h3 className="text-xl text-[#ff8fab] mb-1 font-script">Hormone Health Coach</h3>
              <p className="text-white text-base font-medium mb-2">
                Hello, {user?.name || 'Beautiful'}!
              </p>
              <p className="text-[#b8b8d1] text-sm max-w-xs leading-relaxed mb-3">
                Ask me about your cycle, hormones, nutrition, or wellness.
              </p>
              <div className="flex items-center gap-2 text-[#ff8fab]/80 text-xs bg-[#ff8fab]/10 px-3 py-1.5 rounded-full">
                <Camera className="w-3 h-3" />
                <span>Send photos for advice!</span>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={msg.id || `${msg.role}-${i}-${msg.created_at || ''}`} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'user' ? (
                  user?.profile_photo ? (
                    <img src={user.profile_photo} alt="You" className="w-6 h-6 rounded-full flex-shrink-0 object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full flex-shrink-0 bg-gradient-to-br from-[#ff8fab] to-[#ffc2d1] flex items-center justify-center">
                      <User className="w-3 h-3 text-[#1a1a2e]" />
                    </div>
                  )
                ) : (
                  <img src="/logo192.png" alt="horMoscope" className="w-6 h-6 rounded-full flex-shrink-0 object-cover" />
                )}
                
                <div className="max-w-[80%]">
                  <div className={`px-3 py-2 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-r from-[#ff8fab] to-[#ffc2d1] rounded-br-sm text-[#1a1a2e]' 
                      : 'bg-white/10 border border-white/10 rounded-bl-sm text-white'
                  }`}>
                    {msg.imagePreview && (
                      <img src={msg.imagePreview} alt="Sent" className="max-w-[160px] max-h-[160px] rounded-lg mb-2 object-cover" />
                    )}
                    {msg.hasImage && !msg.imagePreview && <p className="text-xs opacity-60 mb-1">📷 Photo</p>}
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex items-end gap-2">
              <img src="/logo192.png" alt="horMoscope" className="w-6 h-6 rounded-full flex-shrink-0 object-cover" />
              <div className="px-3 py-2 rounded-2xl bg-white/10 border border-white/10 rounded-bl-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff8fab] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff8fab] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff8fab] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Image Preview */}
        {imagePreview && (
          <div className="px-3 pb-1 flex-shrink-0">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-14 w-14 object-cover rounded-lg border-2 border-[#ff8fab]" />
              <button onClick={clearSelectedImage} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-2 pb-14 lg:pb-2 border-t border-white/10 flex-shrink-0 bg-[#1a1a2e]">
          <div className="flex items-center gap-1.5">
            <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" capture="environment" className="hidden" id="camera-input" />
            <input type="file" onChange={handleImageSelect} accept="image/*" className="hidden" id="gallery-input" />
            
            <label htmlFor="camera-input" className="w-8 h-8 rounded-full bg-[#ff8fab]/20 flex items-center justify-center cursor-pointer hover:bg-[#ff8fab]/30 transition-all flex-shrink-0">
              <Camera className="w-4 h-4 text-[#ff8fab]" />
            </label>
            
            <label htmlFor="gallery-input" className="w-8 h-8 rounded-full bg-[#ff8fab]/20 flex items-center justify-center cursor-pointer hover:bg-[#ff8fab]/30 transition-all flex-shrink-0">
              <ImageIcon className="w-4 h-4 text-[#ff8fab]" />
            </label>

            <input
              data-testid="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message..."
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-sm text-white placeholder-[#6c6c8a] focus:outline-none focus:border-[#ff8fab]"
              disabled={loading}
            />
            
            <Button
              data-testid="chat-send-btn"
              onClick={handleSend}
              disabled={(!input.trim() && !selectedImage) || loading}
              className="w-8 h-8 p-0 rounded-full bg-[#ff8fab] hover:bg-[#ff8fab]/80 transition-all flex-shrink-0"
            >
              <Send className="w-4 h-4 text-[#1a1a2e]" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
