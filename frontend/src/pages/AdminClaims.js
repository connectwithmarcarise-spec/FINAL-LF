import { useState, useEffect } from 'react';
import { claimsAPI, messagesAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { ClipboardList, Eye, CheckCircle, XCircle, MessageSquare, HelpCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AdminClaims = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      const response = await claimsAPI.getClaims();
      setClaims(response.data);
    } catch (error) {
      console.error('Failed to fetch claims:', error);
      toast.error('Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuestion = async () => {
    if (!questionText.trim()) {
      toast.error('Please enter a question');
      return;
    }

    try {
      await claimsAPI.addVerificationQuestion(selectedClaim.id, questionText);
      toast.success('Verification question sent');
      setShowQuestionDialog(false);
      setQuestionText('');
      fetchClaims();
    } catch (error) {
      toast.error('Failed to send question');
    }
  };

  const handleDecision = async (status) => {
    try {
      await claimsAPI.makeDecision(selectedClaim.id, status, decisionNotes);
      toast.success(`Claim ${status}`);
      setShowDecisionDialog(false);
      setDecisionNotes('');
      setSelectedClaim(null);
      fetchClaims();
    } catch (error) {
      toast.error('Failed to update claim');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'under_review': return <Badge className="status-claimed">Under Review</Badge>;
      case 'approved': return <Badge className="status-found">Approved</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredClaims = claims.filter(claim => {
    if (activeTab === 'pending') return claim.status === 'pending' || claim.status === 'under_review';
    if (activeTab === 'resolved') return claim.status === 'approved' || claim.status === 'rejected';
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in" data-testid="admin-claims">
      <div>
        <h1 className="font-outfit text-2xl font-bold text-slate-900">Claims Management</h1>
        <p className="text-slate-500">{claims.length} total claims</p>
      </div>

      <Tabs defaultValue="pending" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({claims.filter(c => c.status === 'pending' || c.status === 'under_review').length})
          </TabsTrigger>
          <TabsTrigger value="resolved" data-testid="tab-resolved">
            Resolved ({claims.filter(c => c.status === 'approved' || c.status === 'rejected').length})
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="spinner" />
                </div>
              ) : filteredClaims.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No claims found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Claimant</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClaims.map((claim) => (
                      <TableRow key={claim.id} className="table-row-hover" data-testid={`claim-row-${claim.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {claim.item?.image_url && (
                              <img
                                src={`${BACKEND_URL}${claim.item.image_url}`}
                                alt=""
                                className="w-10 h-10 rounded-lg object-cover"
                                onError={(e) => {
                                  e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100';
                                }}
                              />
                            )}
                            <p className="text-sm truncate max-w-xs">{claim.item?.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {claim.claimant && (
                            <div>
                              <p className="text-sm font-medium">{claim.claimant.full_name}</p>
                              <p className="text-xs text-slate-500 mono">{claim.claimant.roll_number}</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm truncate">{claim.message || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm mono">
                            {new Date(claim.created_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(claim.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedClaim(claim)}
                              data-testid={`view-claim-${claim.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {(claim.status === 'pending' || claim.status === 'under_review') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedClaim(claim);
                                    setShowQuestionDialog(true);
                                  }}
                                  title="Send verification question"
                                  data-testid={`question-claim-${claim.id}`}
                                >
                                  <HelpCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedClaim(claim);
                                    setShowDecisionDialog(true);
                                  }}
                                  className="text-emerald-600"
                                  title="Make decision"
                                  data-testid={`decide-claim-${claim.id}`}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Claim Detail Dialog */}
      <Dialog open={!!selectedClaim && !showQuestionDialog && !showDecisionDialog} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Claim Details</DialogTitle>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4">
              {/* Item Info */}
              <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
                {selectedClaim.item?.image_url && (
                  <img
                    src={`${BACKEND_URL}${selectedClaim.item.image_url}`}
                    alt=""
                    className="w-24 h-24 rounded-lg object-cover"
                    onError={(e) => {
                      e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100';
                    }}
                  />
                )}
                <div>
                  <p className="font-medium">{selectedClaim.item?.description}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedClaim.item?.location} • {selectedClaim.item?.date}
                  </p>
                </div>
              </div>

              {/* Claimant Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Claimant</p>
                  <p>{selectedClaim.claimant?.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Roll Number</p>
                  <p className="mono">{selectedClaim.claimant?.roll_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Claim Message</p>
                  <p>{selectedClaim.message || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  {getStatusBadge(selectedClaim.status)}
                </div>
              </div>

              {/* Verification Q&A */}
              {selectedClaim.verification_questions?.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Verification Questions</p>
                  <div className="space-y-2">
                    {selectedClaim.verification_questions.map((q, idx) => (
                      <div key={idx} className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">Q: {q.question}</p>
                        {selectedClaim.verification_answers?.[idx] && (
                          <p className="text-sm text-blue-700 mt-1">
                            A: {selectedClaim.verification_answers[idx].answer}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Question Dialog */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Verification Question</DialogTitle>
            <DialogDescription>
              Ask the claimant a question to verify ownership
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="e.g., What specific contents were in the bag?"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              data-testid="question-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuestionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendQuestion} data-testid="send-question-btn">
              Send Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Decision</DialogTitle>
            <DialogDescription>
              Approve or reject this claim
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Add any notes about your decision..."
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              rows={3}
              className="mt-2"
              data-testid="decision-notes-input"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => handleDecision('rejected')}
              data-testid="reject-claim-btn"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleDecision('approved')}
              data-testid="approve-claim-btn"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminClaims;
