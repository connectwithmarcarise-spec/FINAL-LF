import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { studentAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { User, Camera, Mail, Phone, GraduationCap, Calendar, Hash } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const StudentProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await studentAPI.getProfile();
      setProfile(response.data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const response = await studentAPI.uploadProfilePicture(file);
      setProfile({ ...profile, profile_picture: response.data.picture_url });
      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error('Failed to update profile picture');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }

  const data = profile || user;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in" data-testid="student-profile-page">
      <h1 className="font-outfit text-2xl font-bold text-slate-900 mb-6">My Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="font-outfit text-lg">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-slate-200 overflow-hidden">
                {data?.profile_picture ? (
                  <img 
                    src={`${BACKEND_URL}${data.profile_picture}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-slate-400" />
                  </div>
                )}
              </div>
              <label 
                className="absolute bottom-0 right-0 w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors"
              >
                {uploading ? (
                  <div className="spinner w-4 h-4 border-white" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                  data-testid="profile-picture-input"
                />
              </label>
            </div>
            <div>
              <h2 className="font-outfit text-xl font-bold text-slate-900">
                {data?.full_name}
              </h2>
              <p className="text-slate-500">{data?.department} • {data?.year} Year</p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 flex items-center gap-2">
                  <Hash className="w-3 h-3" />
                  Roll Number
                </Label>
                <p className="font-mono text-slate-900" data-testid="roll-number">
                  {data?.roll_number}
                </p>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 flex items-center gap-2">
                  <GraduationCap className="w-3 h-3" />
                  Department
                </Label>
                <p className="text-slate-900" data-testid="department">
                  {data?.department}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-500 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  Year
                </Label>
                <p className="text-slate-900" data-testid="year">
                  {data?.year}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-500 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  Date of Birth
                </Label>
                <p className="text-slate-900" data-testid="dob">
                  {data?.dob}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-500 flex items-center gap-2">
                  <Mail className="w-3 h-3" />
                  Email
                </Label>
                <p className="text-slate-900" data-testid="email">
                  {data?.email}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-500 flex items-center gap-2">
                  <Phone className="w-3 h-3" />
                  Phone Number
                </Label>
                <p className="text-slate-900" data-testid="phone">
                  {data?.phone_number}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
            <p>
              <strong>Note:</strong> Profile information can only be updated by the admin. 
              You can only change your profile picture.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProfilePage;
