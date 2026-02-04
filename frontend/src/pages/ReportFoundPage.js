import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Package, Upload, MapPin, Clock, ArrowLeft, Tag } from 'lucide-react';

const ITEM_KEYWORDS = [
  'Phone',
  'Laptop',
  'Charger',
  'Wallet',
  'Keys',
  'ID Card',
  'Bag',
  'Watch',
  'Others'
];

const TIME_SLOTS = [
  'Morning (6 AM – 12 PM)',
  'Afternoon (12 PM – 6 PM)',
  'Evening (6 PM – 10 PM)',
  'Night (10 PM – 6 AM)'
];

const ReportFoundPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    item_keyword: '',
    custom_keyword: '',
    description: '',
    location: '',
    approximate_time: '',
    secret_message: ''  // NEW: Secret identification message
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const finalKeyword = formData.item_keyword === 'Others' 
      ? formData.custom_keyword 
      : formData.item_keyword;

    // DESIGN FIX: Image is now OPTIONAL
    if (!finalKeyword || !formData.description || !formData.location || !formData.approximate_time || !formData.secret_message) {
      toast.error('Please fill all required fields including Secret Identification Message');
      return;
    }

    // Validate description quality - penalize vague inputs
    if (formData.description.trim().length < 20) {
      toast.error('Please provide a more detailed description (minimum 20 characters)');
      return;
    }

    if (formData.item_keyword === 'Others' && !formData.custom_keyword.trim()) {
      toast.error('Please specify the item type');
      return;
    }

    if (!formData.secret_message.trim()) {
      toast.error('Secret Identification Message is mandatory');
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('item_type', 'found');
      data.append('item_keyword', finalKeyword);
      data.append('description', formData.description);
      data.append('location', formData.location);
      data.append('approximate_time', formData.approximate_time);
      data.append('secret_message', formData.secret_message);
      // DESIGN FIX: Only append image if provided
      if (image) {
        data.append('image', image);
      }

      await itemsAPI.createItem(data);
      toast.success('Found item reported successfully!');
      navigate('/student/my-items');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to report item';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in" data-testid="report-found-page">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="font-outfit text-xl">Report Found Item</CardTitle>
              <CardDescription>
                Date and time will be automatically recorded when you submit
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Item Keyword */}
            <div className="space-y-2">
              <Label htmlFor="item_keyword">
                <Tag className="w-4 h-4 inline mr-1" />
                Item Type *
              </Label>
              <Select 
                value={formData.item_keyword} 
                onValueChange={(value) => setFormData({...formData, item_keyword: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item type" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_KEYWORDS.map((keyword) => (
                    <SelectItem key={keyword} value={keyword}>
                      {keyword}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Keyword - Show if Others selected */}
            {formData.item_keyword === 'Others' && (
              <div className="space-y-2">
                <Label htmlFor="custom_keyword">Specify Item Type *</Label>
                <Input
                  id="custom_keyword"
                  placeholder="e.g., Headphones, Book, etc."
                  value={formData.custom_keyword}
                  onChange={(e) => setFormData({...formData, custom_keyword: e.target.value})}
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the item in detail (color, brand, any identifying features)"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={4}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">
                <MapPin className="w-4 h-4 inline mr-1" />
                Found Location *
              </Label>
              <Input
                id="location"
                placeholder="e.g., Library, Cafeteria, Parking Lot B"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
              />
            </div>

            {/* Approximate Time */}
            <div className="space-y-2">
              <Label htmlFor="approximate_time">
                <Clock className="w-4 h-4 inline mr-1" />
                Approximate Time *
              </Label>
              <Select 
                value={formData.approximate_time} 
                onValueChange={(value) => setFormData({...formData, approximate_time: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time slot" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Secret Identification Message - MANDATORY */}
            <div className="space-y-2 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <Label htmlFor="secret_message" className="text-yellow-900 font-semibold">
                🔒 Secret Identification Message * (MANDATORY)
              </Label>
              <Textarea
                id="secret_message"
                placeholder="Enter secret details only the owner would know (e.g., 'Right side tear in purse', 'Parents photo inside wallet', 'Scratch on back')"
                value={formData.secret_message}
                onChange={(e) => setFormData({...formData, secret_message: e.target.value})}
                rows={3}
                className="border-yellow-300 focus:border-yellow-500 bg-white"
                required
              />
              <p className="text-xs text-yellow-800">
                ⚠️ This message will NEVER be shown publicly. Only visible to AI and admins for verification.
              </p>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Item Image *</Label>
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  imagePreview ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => document.getElementById('image-upload').click()}
              >
                {imagePreview ? (
                  <div className="space-y-3">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-h-64 mx-auto rounded-lg"
                    />
                    <p className="text-sm text-emerald-600 font-medium">Image uploaded ✓</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 mx-auto text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">Click to upload image</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 5MB</p>
                    </div>
                  </div>
                )}
              </div>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? 'Reporting...' : 'Report Found Item'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportFoundPage;
