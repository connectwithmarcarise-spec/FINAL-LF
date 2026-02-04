import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, MapPin, Clock, Send, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * FoundResponsePage - "I Found This Item" for LOST items
 * 
 * SEMANTIC FIX: This is NOT a claim. This is a response to help
 * return a LOST item to its owner.
 * 
 * - Claims are for FOUND items (ownership verification)
 * - Found Responses are for LOST items (someone found it)
 */
const FoundResponsePage = () => {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    message: '',
    found_location: '',
    found_time: ''
  });

  useEffect(() => {
    fetchItem();
  }, [itemId]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      // Get item details from lobby
      const response = await axios.get(`${BACKEND_URL}/api/lobby/items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const foundItem = response.data.find(i => i.id === itemId);
      
      if (!foundItem) {
        toast.error('Item not found');
        navigate('/lobby');
        return;
      }
      
      // Verify it's a LOST item
      if (foundItem.item_type !== 'lost') {
        toast.error('This action is only for LOST items. Use Claim for FOUND items.');
        navigate(`/student/claim/${itemId}`);
        return;
      }
      
      setItem(foundItem);
    } catch (error) {
      console.error('Failed to fetch item:', error);
      toast.error('Failed to load item details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.message.trim()) {
      toast.error('Please provide a message');
      return;
    }
    if (!formData.found_location.trim()) {
      toast.error('Please specify where you found the item');
      return;
    }
    if (!formData.found_time.trim()) {
      toast.error('Please specify when you found the item');
      return;
    }
    
    try {
      setSubmitting(true);
      
      await axios.post(
        `${BACKEND_URL}/api/items/${itemId}/found-response`,
        {
          item_id: itemId,
          message: formData.message,
          found_location: formData.found_location,
          found_time: formData.found_time
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Thank you! Your response has been submitted. The item owner will be notified.');
      navigate('/student');
      
    } catch (error) {
      console.error('Failed to submit response:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to submit response';
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="spinner" />
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">I Found This Item</h1>
          <p className="text-slate-600">
            Help return this lost item to its owner
          </p>
        </div>

        {/* Item Preview */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{item.item_keyword || 'Lost Item'}</CardTitle>
                <CardDescription className="mt-1">{item.description}</CardDescription>
              </div>
              <Badge className="bg-orange-500">Lost</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {item.image_url && (
              <img 
                src={`${BACKEND_URL}${item.image_url}`}
                alt={item.item_keyword}
                className="w-full h-48 object-cover rounded-lg"
              />
            )}
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>Lost at: {item.location}</span>
              </div>
              {item.approximate_time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Time: {item.approximate_time}</span>
                </div>
              )}
            </div>
            <div className="text-sm text-slate-500">
              Reported by: <span className="font-medium">{item.student?.full_name}</span>
              {item.student?.department && ` • ${item.student.department}`}
            </div>
          </CardContent>
        </Card>

        {/* Info Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-800">
              <p className="font-medium mb-1">How this works:</p>
              <ul className="list-disc list-inside space-y-1 text-emerald-700">
                <li>Your response will be sent to the item owner</li>
                <li>The owner or admin will contact you to verify</li>
                <li>You'll arrange the handover securely on campus</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Response Form */}
        <Card>
          <CardHeader>
            <CardTitle>Provide Details</CardTitle>
            <CardDescription>
              Tell us where and when you found this item
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="found_location">Where did you find it? *</Label>
                <Input
                  id="found_location"
                  placeholder="e.g., Library 2nd floor, near the computers"
                  value={formData.found_location}
                  onChange={(e) => setFormData(prev => ({ ...prev, found_location: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="found_time">When did you find it? *</Label>
                <Input
                  id="found_time"
                  placeholder="e.g., Today morning around 10 AM"
                  value={formData.found_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, found_time: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Additional Details *</Label>
                <Textarea
                  id="message"
                  placeholder="Describe the condition of the item, any distinguishing features you noticed, or how you can be contacted..."
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  required
                />
                <p className="text-xs text-slate-500">
                  Please provide enough detail to help verify you actually found the item
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="spinner w-4 h-4 mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Response
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FoundResponsePage;
