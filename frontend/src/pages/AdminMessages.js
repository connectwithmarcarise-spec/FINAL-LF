import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { messagesAPI, studentsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { MessageSquare, Send, Mail, MailOpen, Users, Edit2, Trash2, ThumbsUp, ThumbsDown, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AdminMessages = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [messagesRes, studentsRes] = await Promise.all([
        messagesAPI.getMessages(),
        studentsAPI.getStudents()
      ]);
      setMessages(messagesRes.data);
      setStudents(studentsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedStudent || !messageContent.trim()) {
      toast.error('Please select a student and enter a message');
      return;
    }

    setSending(true);
    try {
      await messagesAPI.sendMessage(selectedStudent, 'student', messageContent);
      toast.success('Message sent successfully');
      setShowComposeDialog(false);
      setSelectedStudent('');
      setMessageContent('');
      fetchData();
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async () => {
    if (!editContent.trim()) {
      toast.error('Message content cannot be empty');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${BACKEND_URL}/api/messages/${editingMessage.id}?content=${encodeURIComponent(editContent)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Message updated successfully');
      setShowEditDialog(false);
      setEditingMessage(null);
      setEditContent('');
      fetchData();
    } catch (error) {
      toast.error('Failed to update message');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${BACKEND_URL}/api/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Message deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const groupedMessages = messages.reduce((acc, msg) => {
    const recipientId = msg.recipient_id;
    if (!acc[recipientId]) {
      acc[recipientId] = [];
    }
    acc[recipientId].push(msg);
    return acc;
  }, {});

  const getReactionIcon = (reaction) => {
    if (reaction === 'thumbs_up') return <ThumbsUp className="w-4 h-4 text-green-600" />;
    if (reaction === 'thumbs_down') return <ThumbsDown className="w-4 h-4 text-red-600" />;
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Back Button */}
      <button 
        onClick={() => navigate('/admin')}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-outfit flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            Messages
          </h1>
          <p className="text-slate-600 mt-1">Send and manage messages to students</p>
        </div>
        <Button onClick={() => setShowComposeDialog(true)}>
          <Send className="w-4 h-4 mr-2" />
          Compose Message
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : (
        <div className="grid gap-6">
          {Object.keys(groupedMessages).length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No messages yet</p>
              </CardContent>
            </Card>
          ) : (
            Object.keys(groupedMessages).map((recipientId) => {
              const recipientMessages = groupedMessages[recipientId];
              const firstMessage = recipientMessages[0];
              const recipient = firstMessage.recipient;

              return (
                <Card key={recipientId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        Conversation with {recipient?.full_name || 'Unknown Student'}
                      </CardTitle>
                      <Badge variant="outline">
                        {recipientMessages.length} message{recipientMessages.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recipientMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        {/* Message Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-slate-700">
                                From: {msg.sender?.full_name || msg.sender?.username || 'Admin'}
                              </span>
                              <span className="text-xs text-slate-500">→</span>
                              <span className="text-sm font-semibold text-slate-700">
                                To: {msg.recipient?.full_name || 'Student'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {format(new Date(msg.created_at), 'PPp')}
                              {msg.updated_at && ' (edited)'}
                            </p>
                          </div>
                          
                          {/* Admin Actions */}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingMessage(msg);
                                setEditContent(msg.content);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteMessage(msg.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>

                        {/* Message Content */}
                        <p className="text-sm text-slate-800 bg-slate-50 rounded p-3">
                          {msg.content}
                        </p>

                        {/* Message Status & Reactions */}
                        <div className="flex items-center gap-4 text-xs">
                          {/* Seen Status */}
                          <div className="flex items-center gap-1">
                            {msg.is_read ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-green-600" />
                                <span className="text-green-600 font-medium">Seen</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-slate-500">Not Seen</span>
                              </>
                            )}
                          </div>

                          {/* Student Reaction */}
                          {msg.student_reaction && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded">
                              <span className="text-slate-600">Student reacted:</span>
                              {getReactionIcon(msg.student_reaction)}
                              <span className="font-medium">
                                {msg.student_reaction === 'thumbs_up' ? 'Thumbs Up' : 'Thumbs Down'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Compose Dialog */}
      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compose Message</DialogTitle>
            <DialogDescription>Send a message to a student</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name} ({student.roll_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                placeholder="Type your message here..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComposeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendMessage} disabled={sending}>
              {sending ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
            <DialogDescription>Update the message content</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Message</Label>
              <Textarea
                placeholder="Type your message here..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditMessage}>
              Update Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMessages;
