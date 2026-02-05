import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Sparkles, CheckCircle, XCircle, Clock, User, Package, 
  MapPin, Calendar, TrendingUp, Eye, MessageSquare, ArrowLeft,
  ChevronRight, AlertTriangle, Shield, FileText, ThumbsUp, ThumbsDown,
  Info
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Admin Claim Requests - REDESIGNED
 * Phase 2 Item 6: Compact list view with click-to-open detail
 * 
 * - Claims displayed as ONE SINGLE-LINE ROW (compact)
 * - Click to open full chat-style detailed view
 * - Approve/Reject ONLY in detailed view
 * - Mandatory reason for all decisions
 */

// Status Badge Component
const StatusBadge = memo(({ status }) => {
  const config = {
    pending: { bg: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending' },
    under_review: { bg: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Under Review' },
    approved: { bg: 'bg-green-100 text-green-700 border-green-200', label: 'Approved' },
    rejected: { bg: 'bg-red-100 text-red-700 border-red-200', label: 'Rejected' }
  };
  const c = config[status] || config.pending;
  return <Badge className={`${c.bg} border text-xs`}>{c.label}</Badge>;
});

// Confidence Badge Component
const ConfidenceBadge = memo(({ band, percentage }) => {
  const config = {
    HIGH: { bg: 'bg-green-100 text-green-700 border-green-200', icon: '🟢' },
    MEDIUM: { bg: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: '🟡' },
    LOW: { bg: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🟠' },
    INSUFFICIENT: { bg: 'bg-red-100 text-red-700 border-red-200', icon: '🔴' }
  };
  const c = config[band] || config.LOW;
  return (
    <Badge className={`${c.bg} border text-xs font-medium`}>
      {c.icon} {band} {percentage > 0 && `(${percentage}%)`}
    </Badge>
  );
});

// Compact Claim Row - Single line for list view
const ClaimRow = memo(({ claim, onClick }) => {
  const isAIPowered = claim.claim_type === 'ai_powered';
  const matchPercentage = claim.match_percentage || claim.ai_analysis?.internal_score || 0;
  
  return (
    <div 
      onClick={() => onClick(claim)}
      className="flex items-center gap-3 p-3 sm:p-4 bg-white border rounded-lg hover:bg-slate-50 hover:border-purple-200 cursor-pointer transition-all group"
    >
      {/* Status Indicator */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        claim.status === 'approved' ? 'bg-green-500' :
        claim.status === 'rejected' ? 'bg-red-500' :
        claim.status === 'under_review' ? 'bg-blue-500' :
        'bg-amber-500'
      }`} />
      
      {/* Main Info */}
      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
        {/* Claimant Name */}
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="font-medium text-slate-800 truncate text-sm">
            {claim.claimant?.full_name || 'Unknown'}
          </span>
        </div>
        
        {/* Claim Summary - Clean one line */}
        <span className="text-xs sm:text-sm text-slate-600">
          Claim request received – <span className={`font-semibold ${
            matchPercentage >= 70 ? 'text-green-600' :
            matchPercentage >= 40 ? 'text-yellow-600' :
            'text-orange-600'
          }`}>{matchPercentage}% match</span>
        </span>
        
        {/* Timestamp - Hidden on mobile */}
        <span className="hidden lg:block text-xs text-slate-400 flex-shrink-0">
          {format(new Date(claim.created_at), 'MMM d, h:mm a')}
        </span>
      </div>
      
      {/* Badges */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isAIPowered && (
          <Badge className="bg-purple-100 text-purple-700 border-purple-200 border text-xs hidden sm:flex">
            <Sparkles className="w-3 h-3 mr-1" />
            AI
          </Badge>
        )}
        <StatusBadge status={claim.status} />
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 transition-colors" />
      </div>
    </div>
  );
});

// Detailed Claim Dialog - Chat-style view with actions
const ClaimDetailDialog = memo(({ claim, open, onClose, onDecision }) => {
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const isAIPowered = claim?.claim_type === 'ai_powered';
  const aiAnalysis = claim?.ai_analysis || {};
  const canDecide = claim?.status === 'pending' || claim?.status === 'under_review';

  const handleDecision = async (decision) => {
    if (!reason.trim()) {
      toast.error('Reason is mandatory for all decisions');
      return;
    }
    if (reason.trim().length < 10) {
      toast.error('Please provide a meaningful reason (minimum 10 characters)');
      return;
    }

    setProcessing(true);
    try {
      await onDecision(claim.id, decision, reason);
      setReason('');
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  if (!claim) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 border-b bg-gradient-to-r from-purple-50 to-slate-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                Claim Request
                {isAIPowered && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Verified
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Submitted on {format(new Date(claim.created_at), 'MMMM d, yyyy • h:mm a')}
              </DialogDescription>
            </div>
            <StatusBadge status={claim.status} />
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-4 sm:p-6 space-y-6">
            {/* Claimant Info */}
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">
                  {claim.claimant?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{claim.claimant?.full_name}</h3>
                <p className="text-sm text-slate-600">{claim.claimant?.roll_number}</p>
                {claim.claimant?.department && (
                  <p className="text-xs text-slate-500 mt-1">
                    {claim.claimant?.department} • {claim.claimant?.year}
                  </p>
                )}
              </div>
            </div>

            {/* Item Info */}
            <div className="space-y-3">
              <h4 className="font-medium text-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Claimed Item
              </h4>
              <Card>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {claim.item?.image_url && (
                      <img 
                        src={`${BACKEND_URL}${claim.item.image_url}`}
                        alt="Item"
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 space-y-2">
                      <p className="font-medium text-slate-800">
                        {claim.item?.item_keyword || 'Item'}
                      </p>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {claim.item?.description}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {claim.item?.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {claim.item.location}
                          </span>
                        )}
                        {claim.item?.created_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {claim.item.created_date}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Analysis - If available */}
            {isAIPowered && aiAnalysis && (
              <div className="space-y-3">
                <h4 className="font-medium text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  AI Analysis
                </h4>
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardContent className="p-4 space-y-4">
                    {/* Confidence Band */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Confidence Level</span>
                      <ConfidenceBadge 
                        band={aiAnalysis.confidence_band} 
                        percentage={aiAnalysis.match_percentage}
                      />
                    </div>

                    {/* What Matched */}
                    {aiAnalysis.what_matched?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          What Matched
                        </p>
                        <ul className="space-y-1">
                          {aiAnalysis.what_matched.map((item, i) => (
                            <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                              <span className="text-green-500 mt-1">✓</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* What Didn't Match */}
                    {aiAnalysis.what_did_not_match?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          What Didn't Match
                        </p>
                        <ul className="space-y-1">
                          {aiAnalysis.what_did_not_match.map((item, i) => (
                            <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                              <span className="text-red-500 mt-1">✗</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Advisory Note */}
                    {aiAnalysis.advisory_note && (
                      <div className="p-3 bg-white rounded-lg border">
                        <p className="text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          Advisory Note
                        </p>
                        <p className="text-sm text-slate-600">{aiAnalysis.advisory_note}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Claim Details */}
            <div className="space-y-3">
              <h4 className="font-medium text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Claim Details
              </h4>
              <Card>
                <CardContent className="p-4 space-y-3">
                  {claim.claim_details && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Claimant's Statement</p>
                      <p className="text-sm text-slate-700">{claim.claim_details}</p>
                    </div>
                  )}
                  {claim.proof_of_ownership && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Proof Provided</p>
                      <p className="text-sm text-slate-700">{claim.proof_of_ownership}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Decision History */}
            {claim.admin_decision && (
              <div className="space-y-3">
                <h4 className="font-medium text-slate-800 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Admin Decision
                </h4>
                <Card className={claim.status === 'approved' ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-700">{claim.admin_decision}</p>
                    {claim.decided_at && (
                      <p className="text-xs text-slate-500 mt-2">
                        Decision made on {format(new Date(claim.decided_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Decision Input - Only for pending/under_review */}
            {canDecide && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-medium text-slate-800">Make Decision</h4>
                <div className="space-y-2">
                  <Label className="text-sm">
                    Reason for Decision <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide a detailed reason for your decision (minimum 10 characters)..."
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-slate-500">
                    This reason will be visible to the student and stored for accountability.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with Actions - Only for pending/under_review */}
        {canDecide && (
          <DialogFooter className="p-4 sm:p-6 border-t bg-slate-50 gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="destructive"
                onClick={() => handleDecision('rejected')}
                disabled={processing || !reason.trim()}
                className="flex-1 sm:flex-none"
              >
                <ThumbsDown className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={() => handleDecision('approved')}
                disabled={processing || !reason.trim()}
                className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
              >
                <ThumbsUp className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
});

// Main Component
const AdminClaimRequests = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
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

  const handleDecision = useCallback(async (claimId, status, reason) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${BACKEND_URL}/api/claims/${claimId}/decision`,
        { status, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Claim ${status} successfully`);
      fetchClaims();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update claim';
      toast.error(message);
      throw error;
    }
  }, []);

  // Filter and count claims
  const { filteredClaims, counts } = useMemo(() => {
    const counts = {
      all: claims.length,
      pending: claims.filter(c => c.status === 'pending').length,
      under_review: claims.filter(c => c.status === 'under_review').length,
      approved: claims.filter(c => c.status === 'approved').length,
      rejected: claims.filter(c => c.status === 'rejected').length
    };

    const filtered = activeTab === 'all' 
      ? claims 
      : claims.filter(c => c.status === activeTab);

    return { filteredClaims: filtered, counts };
  }, [claims, activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="font-bold text-slate-900 text-sm sm:text-base">Claim Requests</h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Review and manage ownership claims
                </p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                <Clock className="w-3 h-3 mr-1" />
                {counts.pending} Pending
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full max-w-xl">
            <TabsTrigger value="pending" className="text-xs sm:text-sm">
              Pending
              {counts.pending > 0 && (
                <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 rounded-full">
                  {counts.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="under_review" className="text-xs sm:text-sm">
              Review
              {counts.under_review > 0 && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 rounded-full">
                  {counts.under_review}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs sm:text-sm">Approved</TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs sm:text-sm">Rejected</TabsTrigger>
            <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
          </TabsList>

          {/* Claims List */}
          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
              </div>
            ) : filteredClaims.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-700">No claims found</h3>
                  <p className="text-slate-500 mt-2">
                    {activeTab === 'pending' 
                      ? "No pending claims to review" 
                      : `No ${activeTab === 'all' ? '' : activeTab} claims`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {/* Column Headers - Desktop only */}
                <div className="hidden sm:flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <div className="w-2" />
                  <div className="flex-1 flex items-center gap-4">
                    <span className="w-32">Claimant</span>
                    <span className="flex-1">Item</span>
                    <span className="w-28">Date</span>
                  </div>
                  <div className="w-32 text-right">Status</div>
                </div>

                {/* Claims */}
                {filteredClaims.map((claim) => (
                  <ClaimRow 
                    key={claim.id} 
                    claim={claim} 
                    onClick={setSelectedClaim}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Claim Detail Dialog */}
      <ClaimDetailDialog
        claim={selectedClaim}
        open={!!selectedClaim}
        onClose={() => setSelectedClaim(null)}
        onDecision={handleDecision}
      />
    </div>
  );
};

export default AdminClaimRequests;
