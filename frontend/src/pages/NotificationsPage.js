import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { messagesAPI } from '../services/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Bell, Mail, MailOpen, ThumbsUp, ThumbsDown, Eye } from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * NotificationsPage
 * FIX B: Messages are automatically marked as "seen" when viewed.
 * No manual "Mark as Read" button - just like real messaging apps.
 */
const NotificationsPage = () => {
  const { refreshUnread } = useOutletContext();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      // FIX B: When this API is called, backend auto-marks messages as seen
      const response = await messagesAPI.getMessages();
      setMessages(response.data);
      
      // Refresh unread count in header (should now be 0)
      refreshUnread?.();
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
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

  // FIX B: All messages are now "seen" after viewing this page
  // Show recently seen vs older messages instead
  const recentMessages = messages.filter(m => {
    const seenAt = m.seen_at ? new Date(m.seen_at) : null;
    const now = new Date();
    return seenAt && (now - seenAt) < 60000; // Seen within last minute = "just viewed"
  });

  return (
    <div className="max-w-2xl mx-auto animate-fade-in" data-testid="notifications-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500">
            {messages.length > 0 ? `${messages.length} messages` : 'No messages yet'}
          </p>
        </div>
        
        {/* FIX B: Show "All Seen" indicator instead of manual button */}
        {messages.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
            <Eye className="w-4 h-4" />
            <span>All messages viewed</span>
          </div>
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
              className="transition-colors"
              data-testid={`notification-${message.id}`}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100">
                    <MailOpen className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-slate-900">{message.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-slate-500">
                            {format(new Date(message.created_at), 'MMM d, yyyy • h:mm a')}
                          </p>
                          {/* FIX B: Show "Seen" timestamp */}
                          {message.seen_at && (
                            <span className="text-xs text-green-600">
                              • Viewed {format(new Date(message.seen_at), 'h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* FIX B: Show "Viewed" badge instead of "New" */}
                      <Badge variant="outline" className="text-xs text-slate-500">
                        Viewed
                      </Badge>
                    </div>

                    {/* Student Reactions - Thumbs Up/Down */}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-slate-500">React:</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant={message.student_reaction === 'thumbs_up' ? 'default' : 'outline'}
                          size="sm"
                          className={`text-xs h-7 ${message.student_reaction === 'thumbs_up' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                          onClick={() => handleReact(message.id, 'thumbs_up')}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {message.student_reaction === 'thumbs_up' && <span className="ml-1">Done</span>}
                        </Button>
                        <Button
                          variant={message.student_reaction === 'thumbs_down' ? 'default' : 'outline'}
                          size="sm"
                          className={`text-xs h-7 ${message.student_reaction === 'thumbs_down' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                          onClick={() => handleReact(message.id, 'thumbs_down')}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          {message.student_reaction === 'thumbs_down' && <span className="ml-1">Done</span>}
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
