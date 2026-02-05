import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Bot, Send, ArrowLeft, Sparkles, AlertTriangle, Package, MapPin, Clock, User, ImageOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Safe string formatter
 */
const safeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return format(value, 'MMM d, yyyy');
  if (typeof value === 'object') {
    if (value.$date) return format(new Date(value.$date), 'MMM d, yyyy');
    return JSON.stringify(value);
  }
  return String(value);
};

/**
 * AIClaimChat - AI Chatbot for FOUND item claims
 * 
 * Flow:
 * 1. Validates item exists and is FOUND type
 * 2. Asks exactly 3 verification questions
 * 3. Submits answers to admin panel for review
 */
const AIClaimChat = () => {
  const navigate = useNavigate();
  const { itemId } = useParams();
  const { token, user } = useAuth();
  const chatEndRef = useRef(null);
  
  const [item, setItem] = useState(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [itemError, setItemError] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // 3 verification questions based on item
  const getQuestions = (itemData) => [
    {
      id: 'describe_item',
      question: `Can you describe this ${safeString(itemData?.item_keyword || 'item')} in detail? (color, brand, model, distinguishing features)`,
      botMessage: `Hello! I'll help verify your claim for this ${safeString(itemData?.item_keyword || 'item')}. Let's start with some verification questions.\n\n**Question 1 of 3:**\nCan you describe this item in detail? Include color, brand, model, and any distinguishing features.`
    },
    {
      id: 'prove_ownership',
      question: 'What proof can you provide that this item belongs to you?',
      botMessage: `**Question 2 of 3:**\nWhat proof can you provide that this item belongs to you? (e.g., purchase receipt, serial number, photos of you with the item, unique marks only you would know)`
    },
    {
      id: 'loss_details',
      question: 'Where and when did you lose this item?',
      botMessage: `**Question 3 of 3:**\nWhere and approximately when did you lose this item? Please be as specific as possible about the location and date/time.`
    }
  ];

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load and validate item
  useEffect(() => {
    const loadItem = async () => {
      if (!itemId) {
        setItemError('No item ID provided. Please select an item to claim.');
        setItemLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${BACKEND_URL}/api/items/public`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const foundItem = response.data.find(i => i.id === itemId);
        
        if (!foundItem) {
          setItemError('Item not found. It may have been deleted or claimed.');
          setItemLoading(false);
          return;
        }

        if (foundItem.item_type !== 'found') {
          setItemError('This is a LOST item. You cannot claim it. Use "I Found This Item" instead.');
          setItemLoading(false);
          return;
        }

        if (foundItem.status === 'claimed' || foundItem.status === 'returned') {
          setItemError(`This item is already ${foundItem.status}.`);
          setItemLoading(false);
          return;
        }

        // Check if user is the owner
        if (foundItem.is_owner || foundItem.student_id === user?.id) {
          setItemError('You cannot claim your own item.');
          setItemLoading(false);
          return;
        }

        setItem(foundItem);
        
        // Start chat with first question
        const questions = getQuestions(foundItem);
        setMessages([
          { type: 'bot', content: questions[0].botMessage }
        ]);
        
      } catch (error) {
        console.error('Failed to load item:', error);
        setItemError('Failed to load item details. Please try again.');
      } finally {
        setItemLoading(false);
      }
    };

    if (token) {
      loadItem();
    }
  }, [itemId, token, user]);

  const handleSendMessage = () => {
    if (!currentInput.trim() || !item) return;

    const questions = getQuestions(item);
    const answer = currentInput.trim();
    
    // Add user message
    setMessages(prev => [...prev, { type: 'user', content: answer }]);
    
    // Store answer
    const questionId = questions[currentQuestion].id;
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    
    setCurrentInput('');

    // Move to next question or submit
    if (currentQuestion < questions.length - 1) {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: questions[currentQuestion + 1].botMessage 
        }]);
        setCurrentQuestion(prev => prev + 1);
      }, 500);
    } else {
      // All questions answered - submit claim
      handleSubmitClaim({ ...answers, [questionId]: answer });
    }
  };

  const handleSubmitClaim = async (finalAnswers) => {
    setSubmitting(true);
    
    setMessages(prev => [...prev, { 
      type: 'bot', 
      content: '⏳ Processing your claim and verifying with AI... Please wait.' 
    }]);

    try {
      const formData = new FormData();
      formData.append('item_id', itemId);
      formData.append('product_type', safeString(item?.item_keyword) || 'Unknown');
      formData.append('description', finalAnswers.describe_item || '');
      formData.append('identification_marks', finalAnswers.prove_ownership || '');
      formData.append('lost_location', finalAnswers.loss_details?.split(' ')[0] || '');
      formData.append('approximate_date', 'Recently');

      const response = await axios.post(`${BACKEND_URL}/api/claims/ai-powered`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setAiResult(response.data.ai_analysis);
      setSubmitted(true);
      
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: `✅ **Claim Submitted Successfully!**\n\nYour claim has been sent to the Admin for review. The AI analysis shows a **${response.data.ai_analysis?.confidence_band || 'PENDING'}** confidence level.\n\nYou will be notified once the admin makes a decision.`,
        isSuccess: true
      }]);

      toast.success('Claim submitted for admin review!');
      
    } catch (error) {
      console.error('Claim submission error:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to submit claim';
      
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: `❌ **Error:** ${safeString(errorMsg)}\n\nPlease try again or contact support.`,
        isError: true
      }]);
      
      toast.error(safeString(errorMsg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Loading state
  if (itemLoading) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4" />
            <p className="text-slate-600">Loading item details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (itemError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Cannot Submit Claim</h3>
              <p className="text-red-600 mb-6">{itemError}</p>
              <Button onClick={() => navigate('/student/found-items')} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Found Items
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/student/found-items')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-900">AI Claim Verification</h1>
            <p className="text-xs text-slate-500">Answer 3 questions to submit your claim</p>
          </div>
        </div>
      </div>

      {/* Item Preview Card */}
      {item && (
        <Card className="mb-4 border-purple-200 bg-purple-50/50">
          <CardContent className="p-4">
            <div className="flex gap-4">
              {item.image_url ? (
                <img 
                  src={`${BACKEND_URL}${item.image_url}`}
                  alt="Item"
                  className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-20 h-20 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ImageOff className="w-8 h-8 text-slate-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Badge className="status-found mb-2">FOUND ITEM</Badge>
                <p className="text-sm font-medium text-slate-800 line-clamp-2">
                  {safeString(item.description)}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {safeString(item.location)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat Interface */}
      <Card>
        <CardContent className="p-0">
          {/* Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  msg.type === 'user' 
                    ? 'bg-purple-600 text-white' 
                    : msg.isError 
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : msg.isSuccess
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-slate-100 text-slate-800'
                }`}>
                  {msg.type === 'bot' && (
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-medium text-purple-600">AI Assistant</span>
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          {!submitted && (
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your answer..."
                  disabled={submitting}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!currentInput.trim() || submitting}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Question {currentQuestion + 1} of 3
              </p>
            </div>
          )}

          {/* Done - Go back button */}
          {submitted && (
            <div className="border-t p-4">
              <Button 
                onClick={() => navigate('/student/my-items')}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                View My Claims
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AIClaimChat;
