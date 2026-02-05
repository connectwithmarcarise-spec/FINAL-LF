import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Bot, Send, ArrowLeft, Sparkles, AlertTriangle, MapPin, ImageOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Safe string formatter - Converts any value to string safely
 */
const safeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return format(value, 'MMM d, yyyy');
  if (typeof value === 'object') {
    if (value.$date) return format(new Date(value.$date), 'MMM d, yyyy');
    if (value.msg) return String(value.msg);
    if (value.detail) return String(value.detail);
    return '';
  }
  return String(value);
};

/**
 * Calculate similarity between answer text and secret message
 */
const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let matches = 0;
  words1.forEach(word => {
    if (words2.has(word)) matches++;
    words2.forEach(w2 => {
      if (w2.includes(word) || word.includes(w2)) matches += 0.5;
    });
  });
  
  const similarity = (matches / Math.max(words1.size, words2.size)) * 100;
  return Math.min(Math.round(similarity), 100);
};

/**
 * AIClaimChat - AI Verification Chatbot for FOUND item claims
 * 
 * FIXED:
 * - Validation only runs on user-typed input string
 * - Added yes/no confirmation before submission
 * - Proper error handling without React object rendering
 */
const AIClaimChat = () => {
  const navigate = useNavigate();
  const { itemId } = useParams();
  const { token, user } = useAuth();
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Item state
  const [item, setItem] = useState(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [itemError, setItemError] = useState(null);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [inputError, setInputError] = useState(null); // Separate error state for input validation
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  
  // Flow state
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate dynamic questions
  const generateDynamicQuestions = async (itemData) => {
    const itemKeyword = safeString(itemData?.item_keyword) || 'item';
    const description = safeString(itemData?.description) || '';
    const location = safeString(itemData?.location) || '';
    const secretMessage = safeString(itemData?.secret_message) || '';
    
    try {
      const authToken = token || localStorage.getItem('token');
      const response = await axios.post(
        `${BACKEND_URL}/api/claims/generate-questions`,
        {
          item_keyword: itemKeyword,
          description: description,
          location: location,
          secret_message: secretMessage
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      if (response.data?.questions?.length === 3) {
        return response.data.questions;
      }
    } catch (error) {
      console.log('Using fallback questions');
    }
    
    // Fallback questions
    return [
      `Describe this ${itemKeyword} in detail - color, brand, model, any unique marks?`,
      `What unique feature or personal mark on this ${itemKeyword} proves it's yours?`,
      `When and where did you lose this ${itemKeyword}? Be specific about the location.`
    ];
  };

  // Load item on mount
  useEffect(() => {
    const loadItem = async () => {
      if (!itemId) {
        setItemError('No item ID provided.');
        setItemLoading(false);
        return;
      }

      try {
        const authToken = token || localStorage.getItem('token');
        const response = await axios.get(`${BACKEND_URL}/api/items/public`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const foundItem = response.data.find(i => i.id === itemId);
        
        if (!foundItem) {
          setItemError('Item not found.');
          setItemLoading(false);
          return;
        }

        if (foundItem.item_type !== 'found') {
          setItemError('This is a LOST item. Use "I Found This Item" instead.');
          setItemLoading(false);
          return;
        }

        if (foundItem.status === 'claimed' || foundItem.status === 'returned') {
          setItemError(`This item is already ${foundItem.status}.`);
          setItemLoading(false);
          return;
        }

        if (foundItem.is_owner || foundItem.student_id === user?.id) {
          setItemError('You cannot claim your own item.');
          setItemLoading(false);
          return;
        }

        setItem(foundItem);
        
        // Generate questions
        const dynamicQuestions = await generateDynamicQuestions(foundItem);
        setQuestions(dynamicQuestions);
        
        // Start chat
        setMessages([
          { 
            type: 'bot', 
            content: `Hi! I'll help verify your claim for this ${safeString(foundItem?.item_keyword || 'item')}. Please answer 3 verification questions.\n\n**Question 1 of 3:**\n${dynamicQuestions[0]}`
          }
        ]);
        
      } catch (error) {
        console.error('Failed to load item:', error);
        setItemError('Failed to load item. Please try again.');
      } finally {
        setItemLoading(false);
      }
    };

    if (token) {
      loadItem();
    }
  }, [itemId, token, user]);

  /**
   * FIXED: Validate ONLY the user-typed input string
   * Returns true if valid, false if invalid
   */
  const validateUserInput = (inputText) => {
    // Clear previous error FIRST
    setInputError(null);
    
    // Ensure we're validating a string
    if (typeof inputText !== 'string') {
      setInputError('Please type a valid response');
      return false;
    }
    
    // Get trimmed length of actual user input
    const trimmedInput = inputText.trim();
    const inputLength = trimmedInput.length;
    
    if (inputLength === 0) {
      setInputError('Please type an answer');
      return false;
    }
    
    // For yes/no confirmation, any response is valid
    if (awaitingConfirmation) {
      return true;
    }
    
    // For questions, minimum 15 characters
    if (inputLength < 15) {
      setInputError(`Please provide more detail (${inputLength}/15 characters minimum)`);
      return false;
    }
    
    return true;
  };

  /**
   * Handle sending a message
   */
  const handleSendMessage = () => {
    // Get the actual input value from state
    const userInputText = currentInput;
    
    // FIXED: Validate ONLY the user input string
    if (!validateUserInput(userInputText)) {
      return;
    }
    
    const trimmedInput = userInputText.trim();
    
    // Clear input immediately
    setCurrentInput('');
    setInputError(null);
    
    // Handle confirmation response
    if (awaitingConfirmation) {
      handleConfirmationResponse(trimmedInput);
      return;
    }
    
    // Handle question answer
    handleQuestionAnswer(trimmedInput);
  };

  /**
   * Handle answer to verification question
   */
  const handleQuestionAnswer = (answer) => {
    // Add user message
    setMessages(prev => [...prev, { type: 'user', content: answer }]);
    
    // Store answer
    const newAnswers = [...answers, { 
      question: questions[currentQuestion], 
      answer: answer 
    }];
    setAnswers(newAnswers);
    
    // Check if more questions
    if (currentQuestion < questions.length - 1) {
      // Next question
      setTimeout(() => {
        const nextQ = currentQuestion + 1;
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: `**Question ${nextQ + 1} of 3:**\n${questions[nextQ]}`
        }]);
        setCurrentQuestion(nextQ);
      }, 500);
    } else {
      // All questions answered - ask for confirmation
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: `Thank you for your answers!\n\n**Do you want to submit this claim to the admin?**\n\nType **yes** to submit or **no** to cancel.`
        }]);
        setAwaitingConfirmation(true);
      }, 500);
    }
  };

  /**
   * Handle yes/no confirmation response
   */
  const handleConfirmationResponse = (response) => {
    const normalizedResponse = response.toLowerCase().trim();
    
    // Add user message
    setMessages(prev => [...prev, { type: 'user', content: response }]);
    
    if (normalizedResponse === 'yes' || normalizedResponse === 'y') {
      // Submit claim
      handleSubmitClaim();
    } else if (normalizedResponse === 'no' || normalizedResponse === 'n') {
      // Cancel
      setCancelled(true);
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: `Claim submission cancelled.\n\nYou can close this page or go back to browse other items.`,
        isCancelled: true
      }]);
    } else {
      // Invalid response
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: `Please type **yes** to submit your claim or **no** to cancel.`
      }]);
    }
  };

  /**
   * Submit claim to admin
   */
  const handleSubmitClaim = async () => {
    setSubmitting(true);
    
    setMessages(prev => [...prev, { 
      type: 'bot', 
      content: '⏳ Submitting your claim... Please wait.' 
    }]);

    try {
      // Calculate match percentage
      const allAnswersText = answers.map(a => a.answer).join(' ');
      const secretMessage = safeString(item?.secret_message) || '';
      const matchPercentage = calculateSimilarity(
        allAnswersText, 
        secretMessage + ' ' + safeString(item?.description)
      );
      
      const authToken = token || localStorage.getItem('token');
      
      const formData = new FormData();
      formData.append('item_id', itemId);
      formData.append('product_type', safeString(item?.item_keyword) || 'Unknown');
      formData.append('description', answers[0]?.answer || '');
      formData.append('identification_marks', answers[1]?.answer || '');
      formData.append('lost_location', answers[2]?.answer || '');
      formData.append('approximate_date', 'Recently');
      formData.append('match_percentage', matchPercentage.toString());
      formData.append('qa_data', JSON.stringify(answers));

      await axios.post(`${BACKEND_URL}/api/claims/ai-powered`, formData, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setSubmitted(true);
      
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: `✅ **Your request has been submitted to the admin.**\n\nThey will review your claim and contact you soon.\n\n**Match Score:** ${matchPercentage}%`,
        isSuccess: true
      }]);

      toast.success('Claim submitted successfully!');
      
    } catch (error) {
      console.error('Claim submission error:', error);
      
      // FIXED: Convert error to string safely
      let errorMsg = 'Failed to submit claim. Please try again.';
      if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else if (typeof errorData.detail === 'string') {
          errorMsg = errorData.detail;
        } else if (errorData.msg) {
          errorMsg = String(errorData.msg);
        }
      }
      
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: `❌ **Error:** ${errorMsg}`,
        isError: true
      }]);
      
      // Allow retry
      setAwaitingConfirmation(true);
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: `Would you like to try again? Type **yes** to retry or **no** to cancel.`
      }]);
      
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle Enter key press
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * Handle input change - clear error on type
   */
  const handleInputChange = (e) => {
    setCurrentInput(e.target.value);
    // Clear error when user starts typing
    if (inputError) {
      setInputError(null);
    }
  };

  // Loading state
  if (itemLoading) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4" />
            <p className="text-slate-600">Loading...</p>
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

  const isFlowComplete = submitted || cancelled;

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/student/found-items')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-900 text-sm sm:text-base">AI Claim Verification</h1>
            <p className="text-xs text-slate-500">Answer questions to verify ownership</p>
          </div>
        </div>
      </div>

      {/* Item Preview */}
      {item && (
        <Card className="mb-4 border-purple-200 bg-purple-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex gap-3 sm:gap-4">
              {item.image_url ? (
                <img 
                  src={`${BACKEND_URL}${item.image_url}`}
                  alt="Item"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ImageOff className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Badge className="status-found mb-1 sm:mb-2 text-xs">FOUND ITEM</Badge>
                <p className="text-xs sm:text-sm font-medium text-slate-800 line-clamp-2">
                  {safeString(item.description)}
                </p>
                <div className="flex items-center gap-2 mt-1 sm:mt-2 text-xs text-slate-500">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{safeString(item.location)}</span>
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
          <div className="h-72 sm:h-96 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[90%] sm:max-w-[85%] rounded-lg p-2.5 sm:p-3 ${
                  msg.type === 'user' 
                    ? 'bg-purple-600 text-white' 
                    : msg.isError 
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : msg.isSuccess
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : msg.isCancelled
                          ? 'bg-slate-100 border border-slate-200 text-slate-700'
                          : 'bg-slate-100 text-slate-800'
                }`}>
                  {msg.type === 'bot' && (
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-medium text-purple-600">AI Assistant</span>
                    </div>
                  )}
                  <div className="text-xs sm:text-sm whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          {!isFlowComplete && (
            <div className="border-t p-3 sm:p-4">
              {/* Input Error Message */}
              {inputError && (
                <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {inputError}
                </p>
              )}
              
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={currentInput}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder={awaitingConfirmation ? "Type yes or no..." : "Type your answer..."}
                  disabled={submitting}
                  className={`flex-1 text-sm ${inputError ? 'border-red-300 focus:border-red-500' : ''}`}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {!awaitingConfirmation && (
                <p className="text-xs text-slate-400 mt-2">
                  Question {Math.min(currentQuestion + 1, questions.length)} of {questions.length}
                </p>
              )}
            </div>
          )}

          {/* Flow Complete Actions */}
          {isFlowComplete && (
            <div className="border-t p-3 sm:p-4">
              <Button 
                onClick={() => navigate(submitted ? '/student/my-items' : '/student/found-items')}
                className={`w-full ${submitted ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-700'}`}
              >
                {submitted ? 'View My Claims' : 'Back to Found Items'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AIClaimChat;
