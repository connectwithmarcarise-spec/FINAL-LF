import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Search, Upload, MapPin, Calendar, Clock, ArrowLeft } from 'lucide-react';

const ReportLostPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    description: '',
    location: '',
    date: '',
    time: ''
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
    
    if (!formData.description || !formData.location || !formData.date || !formData.time || !image) {
      toast.error('Please fill all fields and upload an image');
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('item_type', 'lost');
      data.append('description', formData.description);
      data.append('location', formData.location);
      data.append('date', formData.date);
      data.append('time', formData.time);
      data.append('image', image);

      await itemsAPI.createItem(data);
      toast.success('Lost item reported successfully!');
      navigate('/student/my-items');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to report item';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in" data-testid="report-lost-page">
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
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Search className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="font-outfit text-xl">Report Lost Item</CardTitle>
              <CardDescription>
                Provide details about the item you lost. The more details, the better chance of finding it.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
                  <div className="relative">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    <p className="text-sm text-slate-500 mt-2">Click to change image</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600">Click to upload an image of the item</p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</p>
                  </>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  data-testid="image-upload-input"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the item in detail (color, brand, any identifying marks, contents...)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                data-testid="description-input"
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">
                <MapPin className="w-4 h-4 inline mr-1" />
                Last Known Location *
              </Label>
              <Input
                id="location"
                placeholder="e.g., Library, Block A, Cafeteria"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                data-testid="location-input"
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date Lost *
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  data-testid="date-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Approximate Time *
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  data-testid="time-input"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-slate-900 hover:bg-slate-800 btn-press"
              disabled={loading}
              data-testid="submit-lost-item"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="spinner w-4 h-4" />
                  Submitting...
                </span>
              ) : (
                'Submit Report'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportLostPage;
