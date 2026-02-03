import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Bot, Send, Upload, ArrowLeft, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const steps = [
  {
    id: 'product_type',
    question: '🏷️ What type of product is it?',
    placeholder: 'e.g., Phone, Laptop, Wallet, Keys, etc.',
    type: 'text'
  },
  {
    id: 'description',
    question: '📝 Can you describe the item in detail?',
    placeholder: 'Color, brand, model, size, any specific features...',
    type: 'textarea'
  },
  {
    id: 'identification_marks',
    question: '🔍 What unique identification marks does it have?',
    placeholder: 'Scratches, stickers, custom case, serial number, etc.',
    type: 'textarea'
  },
  {
    id: 'lost_location',
    question: '📍 Where did you lose it?',
    placeholder: 'Library 2nd Floor, Cafeteria, Parking Lot B, etc.',
    type: 'text'
  },
  {
    id: 'approximate_date',
    question: '📅 When did you lose it (approximately)?',
    placeholder: 'Today, Yesterday, Last Week, 3 days ago, etc.',
    type: 'text'
  },
  {
    id: 'proof_image',
    question: '📸 Do you have any proof of ownership? (Optional)',
    placeholder: 'Upload a photo',
    type: 'file'
  }
];

const AIClaimChat = ({ itemId, onClose }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [proofImage, setProofImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const currentQuestion = steps[currentStep];

  const handleNext = () => {
    if (!answers[currentQuestion.id] && currentQuestion.type !== 'file') {
      toast.error('Please answer the question before proceeding');
      return;
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setProofImage(file);
      setAnswers({...answers, proof_image: 'uploaded'});
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      formData.append('item_id', itemId);
      formData.append('product_type', answers.product_type);
      formData.append('description', answers.description);
      formData.append('identification_marks', answers.identification_marks);
      formData.append('lost_location', answers.lost_location);
      formData.append('approximate_date', answers.approximate_date);
      
      if (proofImage) {
        formData.append('proof_image', proofImage);
      }

      const response = await axios.post(`${BACKEND_URL}/api/claims/ai-powered`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setAiResult(response.data.ai_analysis);
      toast.success('Claim submitted successfully!');
      
      // Show AI result before navigating
      setTimeout(() => {
        navigate('/student/my-items');
      }, 3000);
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to submit claim';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (aiResult) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <CardTitle>AI Analysis Complete</CardTitle>
              <p className="text-sm text-slate-600 mt-1">Your claim has been analyzed</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6">
            <div className="text-center mb-4">
              <div className="text-6xl font-bold text-purple-600">
                {aiResult.match_percentage}%
              </div>
              <p className="text-sm text-slate-600 mt-2">Match Confidence</p>
            </div>
            
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">AI Reasoning:</p>
              <p className="text-sm text-slate-600">{aiResult.reasoning}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>What happens next?</strong><br />
              Your claim has been submitted to the admin team. They will review the AI analysis and your details before making a decision. You'll be notified once they respond.
            </p>
          </div>

          <Button onClick={() => navigate('/student/my-items')} className="w-full">
            Go to My Items
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <button 
        onClick={onClose || (() => navigate(-1))}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center animate-pulse">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="font-outfit">AI Student Care Assistant</CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Answer step-by-step questions to claim this item
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Chat Bubble - Question */}
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-none p-4 flex-1">
              <p className="text-slate-800 font-medium">{currentQuestion.question}</p>
            </div>
          </div>

          {/* Answer Input */}
          <div className="space-y-3">
            {currentQuestion.type === 'text' && (
              <Input
                placeholder={currentQuestion.placeholder}
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers({...answers, [currentQuestion.id]: e.target.value})}
                autoFocus
                onKeyPress={(e) => e.key === 'Enter' && handleNext()}
              />
            )}

            {currentQuestion.type === 'textarea' && (
              <Textarea
                placeholder={currentQuestion.placeholder}
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers({...answers, [currentQuestion.id]: e.target.value})}
                rows={4}
                autoFocus
              />
            )}

            {currentQuestion.type === 'file' && (
              <div className="space-y-3">
                <div 
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition"
                  onClick={() => document.getElementById('proof-upload').click()}
                >
                  {proofImage ? (
                    <div>
                      <Upload className="w-8 h-8 mx-auto text-green-600 mb-2" />
                      <p className="text-sm text-green-600 font-medium">{proofImage.name}</p>
                      <p className="text-xs text-slate-500 mt-1">Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-600">Click to upload proof (optional)</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  id="proof-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-4">
            {currentStep > 0 && (
              <Button
                onClick={handleBack}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              {loading ? (
                'Processing...'
              ) : currentStep === steps.length - 1 ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Submit for AI Analysis
                </>
              ) : (
                <>
                  Next
                  <Send className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIClaimChat;
