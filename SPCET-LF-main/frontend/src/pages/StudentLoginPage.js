import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicHeader } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { GraduationCap, Calendar } from 'lucide-react';

const StudentLoginPage = () => {
  const [rollNumber, setRollNumber] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const { studentLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rollNumber || !dob) {
      toast.error('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      await studentLogin(rollNumber.toUpperCase(), dob);
      toast.success('Login successful!');
      navigate('/student');
    } catch (error) {
      const message = error.response?.data?.detail || 'Invalid credentials';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />
      
      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="font-outfit text-2xl">Student Login</CardTitle>
            <CardDescription>
              Enter your Roll Number and Date of Birth to access the Lost & Found system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="rollNumber">Roll Number</Label>
                <Input
                  id="rollNumber"
                  type="text"
                  placeholder="e.g., 20CS001"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                  className="uppercase"
                  data-testid="roll-number-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <div className="relative">
                  <Input
                    id="dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="pr-10"
                    data-testid="dob-input"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-slate-900 hover:bg-slate-800 btn-press"
                disabled={loading}
                data-testid="student-login-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner w-4 h-4" />
                    Logging in...
                  </span>
                ) : (
                  'Login'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              <p>New student? Contact your department admin to get registered.</p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 text-center">
              <Link 
                to="/admin/login" 
                className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Admin Login →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentLoginPage;
