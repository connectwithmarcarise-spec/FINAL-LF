import { useState, useEffect } from 'react';
import { aiAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Sparkles, RefreshCw, ArrowRight, MapPin, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AdminAIMatches = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const response = await aiAPI.getMatches();
      setMatches(response.data.matches || []);
      setMessage(response.data.message || '');
    } catch (error) {
      console.error('Failed to fetch matches:', error);
      toast.error('Failed to load AI matches');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'confidence-high';
    if (confidence >= 60) return 'confidence-medium';
    return 'confidence-low';
  };

  const getConfidenceBg = (confidence) => {
    if (confidence >= 80) return 'bg-emerald-100 text-emerald-700';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="admin-ai-matches">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            AI Match Suggestions
          </h1>
          <p className="text-slate-500">
            AI-powered suggestions to match lost items with found items
          </p>
        </div>
        <Button 
          onClick={fetchMatches} 
          disabled={loading}
          variant="outline"
          data-testid="refresh-matches-btn"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">How AI Matching Works</p>
              <p className="text-sm text-blue-700 mt-1">
                Our AI analyzes item descriptions, locations, and dates to suggest potential matches. 
                <strong> Final decisions should always be made by admin </strong> after verification.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="spinner mb-4" />
          <p className="text-slate-500">Analyzing items...</p>
        </div>
      ) : message && matches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">{message}</p>
          </CardContent>
        </Card>
      ) : matches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No matches found</p>
            <p className="text-sm text-slate-400 mt-1">
              Report more items or wait for AI to find matches
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {matches.map((match, index) => (
            <Card key={index} className="card-hover" data-testid={`match-${index}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge className={getConfidenceBg(match.confidence)}>
                    {match.confidence}% Match
                  </Badge>
                  <p className="text-sm text-slate-500">{match.reason}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                  {/* Lost Item */}
                  <div className="bg-orange-50 rounded-lg p-4">
                    <Badge className="status-lost mb-3">LOST</Badge>
                    <div className="flex gap-3">
                      <img
                        src={match.lost_item?.image_url ? `${BACKEND_URL}${match.lost_item.image_url}` : 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100'}
                        alt=""
                        className="w-20 h-20 rounded-lg object-cover"
                        onError={(e) => {
                          e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">
                          {match.lost_item?.description}
                        </p>
                        <div className="mt-2 space-y-1 text-xs text-slate-500">
                          <p className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {match.lost_item?.location}
                          </p>
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {match.lost_item?.date}
                          </p>
                        </div>
                        {match.lost_item?.student && (
                          <p className="text-xs text-slate-400 mt-2">
                            By: {match.lost_item.student.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="hidden md:flex items-center justify-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                      <ArrowRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>

                  {/* Found Item */}
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <Badge className="status-found mb-3">FOUND</Badge>
                    <div className="flex gap-3">
                      <img
                        src={match.found_item?.image_url ? `${BACKEND_URL}${match.found_item.image_url}` : 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100'}
                        alt=""
                        className="w-20 h-20 rounded-lg object-cover"
                        onError={(e) => {
                          e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">
                          {match.found_item?.description}
                        </p>
                        <div className="mt-2 space-y-1 text-xs text-slate-500">
                          <p className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {match.found_item?.location}
                          </p>
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {match.found_item?.date}
                          </p>
                        </div>
                        {match.found_item?.student && (
                          <p className="text-xs text-slate-400 mt-2">
                            By: {match.found_item.student.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAIMatches;
