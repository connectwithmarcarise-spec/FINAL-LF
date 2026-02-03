import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { messagesAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Bell, Mail, MailOpen, CheckCheck, ThumbsUp, ThumbsDown } from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const NotificationsPage = () => {
  const { refreshUnread } = useOutletContext();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await messagesAPI.getMessages();
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (messageId) => {
    try {
      await messagesAPI.markAsRead(messageId);
      setMessages(messages.map(m => 
        m.id === messageId ? { ...m, is_read: true } : m
      ));
      refreshUnread?.();
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await messagesAPI.markAllRead();
      setMessages(messages.map(m => ({ ...m, is_read: true })));
      refreshUnread?.();
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleReact = async (messageId, reaction) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${BACKEND_URL}/api/messages/${messageId}/react?reaction=${reaction}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(reaction === 'thumbs_up' ? 'Reacted with 👍' : 'Reacted with 👎');
      setMessages(messages.map(m => 
        m.id === messageId ? { ...m, student_reaction: reaction } : m
      ));
    } catch (error) {
      toast.error('Failed to react');
    }
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in" data-testid="notifications-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleMarkAllRead}
            data-testid="mark-all-read-btn"
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">No notifications</h3>
            <p className="text-slate-500">You'll see messages from admin here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <Card 
              key={message.id}
              className={`transition-colors ${!message.is_read ? 'border-blue-200 bg-blue-50/50' : ''}`}
              data-testid={`notification-${message.id}`}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.is_read ? 'bg-slate-100' : 'bg-blue-100'
                  }`}>
                    {message.is_read ? (
                      <MailOpen className="w-5 h-5 text-slate-400" />
                    ) : (
                      <Mail className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-slate-900">{message.content}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {format(new Date(message.created_at), 'MMM d, yyyy • h:mm a')}
                        </p>
                      </div>
                      {!message.is_read && (
                        <Badge className="bg-blue-500 text-white text-xs">New</Badge>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-3">
                      {!message.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleMarkAsRead(message.id)}
                          data-testid={`mark-read-${message.id}`}
                        >
                          Mark as read
                        </Button>
                      )}
                      
                      {/* Student Reactions - Thumbs Up/Down ONLY */}
                      <div className="flex items-center gap-1 ml-auto">
                        <Button
                          variant={message.student_reaction === 'thumbs_up' ? 'default' : 'outline'}
                          size="sm"
                          className={`text-xs ${message.student_reaction === 'thumbs_up' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                          onClick={() => handleReact(message.id, 'thumbs_up')}
                        >
                          <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                          {message.student_reaction === 'thumbs_up' && 'Reacted'}
                        </Button>
                        <Button
                          variant={message.student_reaction === 'thumbs_down' ? 'default' : 'outline'}
                          size="sm"
                          className={`text-xs ${message.student_reaction === 'thumbs_down' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                          onClick={() => handleReact(message.id, 'thumbs_down')}
                        >
                          <ThumbsDown className="w-3.5 h-3.5 mr-1" />
                          {message.student_reaction === 'thumbs_down' && 'Reacted'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
