import { useState, useEffect } from 'react';
import { messagesAPI, studentsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
import { MessageSquare, Send, Mail, MailOpen, Users } from 'lucide-react';
import { format } from 'date-fns';

const AdminMessages = () => {
  const [messages, setMessages] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [messageContent, setMessageContent] = useState('');
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

  const groupedMessages = messages.reduce((acc, msg) => {
    const recipientId = msg.recipient_id;
    if (!acc[recipientId]) {
      acc[recipientId] = [];
    }
    acc[recipientId].push(msg);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in" data-testid="admin-messages">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-slate-900">Messages</h1>
          <p className="text-slate-500">Send notifications to students</p>
        </div>
        <Button onClick={() => setShowComposeDialog(true)} data-testid="compose-message-btn">
          <Send className="w-4 h-4 mr-2" />
          Compose Message
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No messages sent yet</p>
            <Button 
              className="mt-4" 
              onClick={() => setShowComposeDialog(true)}
            >
              Send First Message
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => {
            const student = students.find(s => s.id === message.recipient_id);
            return (
              <Card key={message.id} data-testid={`message-${message.id}`}>
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
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            To: {student?.full_name || 'Unknown'} ({student?.roll_number || '-'})
                          </p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(message.created_at), 'MMM d, yyyy • h:mm a')}
                          </p>
                        </div>
                        {message.is_read ? (
                          <span className="text-xs text-slate-400">Read</span>
                        ) : (
                          <span className="text-xs text-blue-600 font-medium">Unread</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-2">{message.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Compose Dialog */}
      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compose Message</DialogTitle>
            <DialogDescription>
              Send a notification to a student
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger data-testid="student-select">
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
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Enter your message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={4}
                data-testid="message-content-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComposeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendMessage} 
              disabled={sending}
              data-testid="send-message-btn"
            >
              {sending ? (
                <span className="flex items-center gap-2">
                  <span className="spinner w-4 h-4" />
                  Sending...
                </span>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMessages;
