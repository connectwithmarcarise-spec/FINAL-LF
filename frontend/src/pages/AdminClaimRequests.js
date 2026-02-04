import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Sparkles, CheckCircle, XCircle, Clock, User, Package, MapPin, Calendar, TrendingUp, Eye, MessageSquare, ArrowLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AdminClaimRequests = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [decisionDialog, setDecisionDialog] = useState(false);
  const [decisionType, setDecisionType] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/claims`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClaims(response.data);
    } catch (error) {
      console.error('Failed to fetch claims:', error);
      toast.error('Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async () => {
    if (!selectedClaim || !decisionType) return;
    
    // FIX: Reason is mandatory
    if (!adminNotes.trim()) {
      toast.error('Reason is mandatory for claim decisions');
      return;
    }
    if (adminNotes.trim().length < 10) {
      toast.error('Please provide a meaningful reason (minimum 10 characters)');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${BACKEND_URL}/api/claims/${selectedClaim.id}/decision`,
        { status: decisionType, reason: adminNotes },  // Changed from notes to reason
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Claim ${decisionType}`);
      setDecisionDialog(false);
      setSelectedClaim(null);
      setAdminNotes('');
      fetchClaims();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update claim';
      toast.error(message);
    }
  };

  // FIX #5: Use confidence band instead of percentage
  const getConfidenceBandColor = (band) => {
    switch(band) {
      case 'HIGH': return 'text-green-600 bg-green-50 border-green-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'LOW': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'INSUFFICIENT': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getConfidenceLabel = (band) => {
    switch(band) {
      case 'HIGH': return 'High Confidence';
      case 'MEDIUM': return 'Medium Confidence';
      case 'LOW': return 'Low Confidence';
      case 'INSUFFICIENT': return 'Insufficient Evidence';
      default: return 'Unknown';
    }
  };

  const filterClaims = (status) => {
    return claims.filter(claim => {
      if (status === 'all') return true;
      return claim.status === status;
    });
  };

  const ClaimCard = ({ claim }) => {
    const isAIPowered = claim.claim_type === 'ai_powered';
    const matchPercentage = claim.ai_analysis?.match_percentage || 0;

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">{claim.item?.item_keyword || 'Item'}</h3>
                  {isAIPowered && (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Analyzed
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{claim.claimant?.full_name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(claim.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <Badge
                className={
                  claim.status === 'approved' ? 'bg-green-100 text-green-700' :
                  claim.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  claim.status === 'under_review' ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'
                }
              >
                {claim.status === 'under_review' ? 'Under Review' : claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
              </Badge>
            </div>

            {/* AI Match Score */}
            {isAIPowered && (
              <div className={`rounded-lg p-4 ${getConfidenceColor(matchPercentage)} border`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-semibold">AI Match Confidence</span>
                  </div>
                  <Badge variant="outline" className={getConfidenceColor(matchPercentage)}>
                    {getConfidenceLabel(matchPercentage)}
                  </Badge>
                </div>
                <div className="text-3xl font-bold mb-2">{matchPercentage}%</div>
                <p className="text-sm opacity-90">
                  {claim.ai_analysis?.reasoning || 'No reasoning available'}
                </p>
              </div>
            )}

            {/* Item Details */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Found Item Details:</h4>
              <div className="flex items-start gap-2 text-sm">
                <Package className="w-4 h-4 text-slate-500 mt-0.5" />
                <p className="text-slate-600">{claim.item?.description}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4" />
                <span>{claim.item?.location}</span>
              </div>
            </div>

            {/* Claim Details */}
            {isAIPowered && claim.claim_data && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm text-blue-900 mb-2">Student's Claim:</h4>
                <div className="space-y-1 text-sm text-blue-800">
                  <p><strong>Product Type:</strong> {claim.claim_data.product_type}</p>
                  <p><strong>Description:</strong> {claim.claim_data.description}</p>
                  <p><strong>Identification Marks:</strong> {claim.claim_data.identification_marks}</p>
                  <p><strong>Lost Location:</strong> {claim.claim_data.lost_location}</p>
                  <p><strong>Approximate Date:</strong> {claim.claim_data.approximate_date}</p>
                </div>
              </div>
            )}

            {/* Proof Image */}
            {claim.proof_image_url && (
              <div>
                <h4 className="font-semibold text-sm text-slate-700 mb-2">Proof of Ownership:</h4>
                <img 
                  src={`${BACKEND_URL}${claim.proof_image_url}`}
                  alt="Proof"
                  className="w-full max-w-md rounded-lg border"
                />
              </div>
            )}

            {/* Actions */}
            {claim.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    setSelectedClaim(claim);
                    setDecisionType('approved');
                    setDecisionDialog(true);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => {
                    setSelectedClaim(claim);
                    setDecisionType('rejected');
                    setDecisionDialog(true);
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            )}

            {claim.admin_notes && (
              <div className="bg-slate-100 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-slate-600" />
                  <span className="font-semibold text-slate-700">Admin Notes:</span>
                </div>
                <p className="text-slate-600">{claim.admin_notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const pendingClaims = filterClaims('pending');
  const approvedClaims = filterClaims('approved');
  const rejectedClaims = filterClaims('rejected');
  const allClaims = filterClaims('all');

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
            <Sparkles className="w-8 h-8 text-purple-600" />
            Claim Requests
          </h1>
          <p className="text-slate-600 mt-1">AI-powered claim analysis and verification</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
          <span className="text-sm text-purple-700 font-medium">
            {pendingClaims.length} Pending
          </span>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900 mb-2">How AI Analysis Works</h3>
              <p className="text-sm text-purple-800 leading-relaxed">
                When students claim an item, our AI assistant asks step-by-step questions about the item. 
                It then compares their answers with the found item's details to calculate a similarity match percentage. 
                High confidence scores (80%+) indicate strong matches. You can review the AI reasoning and make final decisions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="pending">
            <Clock className="w-4 h-4 mr-2" />
            Pending ({pendingClaims.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle className="w-4 h-4 mr-2" />
            Approved ({approvedClaims.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="w-4 h-4 mr-2" />
            Rejected ({rejectedClaims.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({allClaims.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : pendingClaims.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No pending claims</p>
              </CardContent>
            </Card>
          ) : (
            pendingClaims.map(claim => <ClaimCard key={claim.id} claim={claim} />)
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4 mt-6">
          {approvedClaims.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No approved claims yet</p>
              </CardContent>
            </Card>
          ) : (
            approvedClaims.map(claim => <ClaimCard key={claim.id} claim={claim} />)
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4 mt-6">
          {rejectedClaims.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <XCircle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No rejected claims yet</p>
              </CardContent>
            </Card>
          ) : (
            rejectedClaims.map(claim => <ClaimCard key={claim.id} claim={claim} />)
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4 mt-6">
          {allClaims.map(claim => <ClaimCard key={claim.id} claim={claim} />)}
        </TabsContent>
      </Tabs>

      {/* Decision Dialog */}
      <Dialog open={decisionDialog} onOpenChange={setDecisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionType === 'approved' ? 'Approve Claim' : 'Reject Claim'}
            </DialogTitle>
            <DialogDescription>
              Add optional notes for your decision
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter admin notes (optional)..."
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDecision}
              className={decisionType === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              Confirm {decisionType === 'approved' ? 'Approval' : 'Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminClaimRequests;
