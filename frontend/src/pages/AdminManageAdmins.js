import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
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
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { UserCog, Plus, Trash2, Shield, ShieldCheck } from 'lucide-react';

const AdminManageAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', fullName: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const response = await adminAPI.getAdmins();
      setAdmins(response.data);
    } catch (error) {
      console.error('Failed to fetch admins:', error);
      toast.error('Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdmin.username || !newAdmin.password || !newAdmin.fullName) {
      toast.error('Please fill all fields');
      return;
    }

    if (newAdmin.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setAdding(true);
    try {
      await adminAPI.createAdmin(newAdmin.username, newAdmin.password, newAdmin.fullName);
      toast.success('Admin created successfully');
      setShowAddDialog(false);
      setNewAdmin({ username: '', password: '', fullName: '' });
      fetchAdmins();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create admin';
      toast.error(message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!window.confirm('Are you sure you want to delete this admin?')) return;

    try {
      await adminAPI.deleteAdmin(adminId);
      toast.success('Admin deleted');
      fetchAdmins();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to delete admin';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="admin-manage-admins">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-slate-900">Admin Management</h1>
          <p className="text-slate-500">Manage system administrators (Super Admin only)</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} data-testid="add-admin-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Admin
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-12">
              <UserCog className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No admins found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id} className="table-row-hover" data-testid={`admin-row-${admin.id}`}>
                    <TableCell className="font-medium">{admin.username}</TableCell>
                    <TableCell>{admin.full_name}</TableCell>
                    <TableCell>
                      {admin.role === 'super_admin' ? (
                        <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1 w-fit">
                          <ShieldCheck className="w-3 h-3" />
                          Super Admin
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1 w-fit">
                          <Shield className="w-3 h-3" />
                          Admin
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm mono">
                        {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {admin.role !== 'super_admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAdmin(admin.id)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`delete-admin-${admin.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Admin Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Admin</DialogTitle>
            <DialogDescription>
              Create a new administrator account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="Enter full name"
                value={newAdmin.fullName}
                onChange={(e) => setNewAdmin({ ...newAdmin, fullName: e.target.value })}
                data-testid="admin-fullname-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Enter username"
                value={newAdmin.username}
                onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                data-testid="admin-username-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter password (min 8 characters)"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                data-testid="admin-password-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddAdmin} 
              disabled={adding}
              data-testid="create-admin-btn"
            >
              {adding ? 'Creating...' : 'Create Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminManageAdmins;
