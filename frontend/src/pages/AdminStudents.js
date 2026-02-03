import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { studentsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { Users, Upload, Search, Eye, Trash2, FileSpreadsheet, StickyNote, Folder, FolderPlus, FolderOpen, Edit2, ChevronRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminStudents = () => {
  const { isSuperAdmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteStudent, setNoteStudent] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [uploading, setUploading] = useState(false);

  // Folder Management States
  const [folders, setFolders] = useState([]);
  const [folderDetails, setFolderDetails] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [createDeptDialogOpen, setCreateDeptDialogOpen] = useState(false);
  const [createYearDialogOpen, setCreateYearDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [uploadFolderDialogOpen, setUploadFolderDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newYearName, setNewYearName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [parentDeptId, setParentDeptId] = useState('');
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [uploadYearFolderId, setUploadYearFolderId] = useState('');

  useEffect(() => {
    fetchStudents();
    if (isSuperAdmin) {
      fetchFolders();
    }
  }, [isSuperAdmin]);

  const fetchStudents = async () => {
    try {
      const response = await studentsAPI.getStudents();
      setStudents(response.data);
    } catch (error) {
      console.error('Failed to fetch students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/folders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFolders(response.data);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  };

  const fetchFolderDetails = async (folderId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/folders/${folderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFolderDetails(response.data);
      setSelectedFolderId(folderId);
    } catch (error) {
      console.error('Failed to fetch folder details:', error);
      toast.error('Failed to load folder details');
    }
  };

  const createDepartment = async () => {
    if (!newDeptName.trim()) {
      toast.error('Please enter a department name');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/folders`, {
        name: newDeptName,
        type: 'department'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Department folder created');
      setNewDeptName('');
      setCreateDeptDialogOpen(false);
      fetchFolders();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create department';
      toast.error(message);
    }
  };

  const createYearFolder = async () => {
    if (!newYearName.trim() || !parentDeptId) {
      toast.error('Please select a department and enter year');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/folders`, {
        name: newYearName,
        type: 'year',
        parent_id: parentDeptId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Year folder created');
      setNewYearName('');
      setParentDeptId('');
      setCreateYearDialogOpen(false);
      fetchFolders();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create year folder';
      toast.error(message);
    }
  };

  const renameFolder = async () => {
    if (!renameName.trim() || !folderDetails) {
      toast.error('Please enter a new name');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API}/folders/${folderDetails.id}`, {
        name: renameName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.students_updated) {
        toast.success(`Folder renamed and ${response.data.students_updated} students updated`);
      } else {
        toast.success('Folder renamed successfully');
      }
      
      setRenameDialogOpen(false);
      setRenameName('');
      fetchFolders();
      fetchStudents();
      if (folderDetails) {
        fetchFolderDetails(folderDetails.id);
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to rename folder';
      toast.error(message);
    }
  };

  const deleteFolder = async () => {
    if (!folderToDelete) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/folders/${folderToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Folder deleted successfully');
      setDeleteDialogOpen(false);
      setFolderToDelete(null);
      setFolderDetails(null);
      setSelectedFolderId(null);
      fetchFolders();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to delete folder';
      toast.error(message);
    }
  };

  const uploadExcelToFolder = async () => {
    if (!excelFile || !uploadYearFolderId) {
      toast.error('Please select a year folder and Excel file');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', excelFile);

      const response = await axios.post(`${API}/folders/${uploadYearFolderId}/upload-excel`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(response.data.message);
      setExcelFile(null);
      setUploadFolderDialogOpen(false);
      fetchStudents();
      if (selectedFolderId) {
        fetchFolderDetails(selectedFolderId);
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to upload Excel';
      toast.error(message);
    }
  };

  const handleUploadExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setUploading(true);
    try {
      const response = await studentsAPI.uploadExcel(file);
      toast.success(response.data.message);
      fetchStudents();
      setShowUploadDialog(false);
    } catch (error) {
      const message = error.response?.data?.detail || 'Upload failed';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }

    try {
      await studentsAPI.addNote(noteStudent.id, noteText);
      toast.success('Note added successfully');
      setShowNoteDialog(false);
      setNoteText('');
      fetchStudents();
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    
    try {
      await studentsAPI.deleteStudent(studentId);
      toast.success('Student deleted');
      fetchStudents();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to delete student';
      toast.error(message);
    }
  };

  const filteredStudents = students.filter(student =>
    student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.roll_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-outfit">Students Management</h1>
          <p className="text-slate-600 mt-1">Manage student database and Excel uploads</p>
        </div>
        <div className="flex gap-3">
          {!isSuperAdmin && (
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
              <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
                <Upload className="w-4 h-4" />
                Upload Excel (Legacy)
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Students Excel</DialogTitle>
                  <DialogDescription>
                    Upload an Excel file with student data
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleUploadExcel}
                    disabled={uploading}
                  />
                  <p className="text-xs text-slate-500">
                    Required columns: Roll Number, Full Name, Department, Year, DOB, Email, Phone Number
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isSuperAdmin ? (
        <Tabs defaultValue="folders" className="w-full">
          <TabsList>
            <TabsTrigger value="folders">
              <Folder className="w-4 h-4 mr-2" />
              Folder Management
            </TabsTrigger>
            <TabsTrigger value="students">
              <Users className="w-4 h-4 mr-2" />
              All Students ({students.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="folders" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Folders List */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Department Folders</CardTitle>
                      <CardDescription>Organize students by department and year</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setCreateDeptDialogOpen(true)}>
                      <FolderPlus className="w-4 h-4 mr-1" />
                      New Dept
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {folders.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      No departments yet. Create one to get started.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {folders.map((dept) => (
                        <div key={dept.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Folder className="w-5 h-5 text-blue-600" />
                              <span className="font-semibold text-slate-900">{dept.name}</span>
                            </div>
                            <Dialog>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setParentDeptId(dept.id);
                                  setCreateYearDialogOpen(true);
                                }}
                              >
                                <FolderPlus className="w-4 h-4 mr-1" />
                                Add Year
                              </Button>
                            </Dialog>
                          </div>
                          
                          {dept.years && dept.years.length > 0 ? (
                            <div className="space-y-2 pl-4">
                              {dept.years.map((year) => (
                                <div
                                  key={year.id}
                                  className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition ${
                                    selectedFolderId === year.id
                                      ? 'bg-blue-50 border-2 border-blue-200'
                                      : 'bg-slate-50 hover:bg-slate-100'
                                  }`}
                                  onClick={() => fetchFolderDetails(year.id)}
                                >
                                  <div className="flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4 text-slate-600" />
                                    <span className="text-sm font-medium">Year {year.name}</span>
                                    <span className="text-xs text-slate-500">
                                      ({year.student_count || 0} students)
                                    </span>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 pl-4">No year folders yet</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Folder Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Folder Details</CardTitle>
                  <CardDescription>
                    {folderDetails ? `Year ${folderDetails.name}` : 'Select a year folder'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {folderDetails ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setUploadYearFolderId(folderDetails.id);
                            setUploadFolderDialogOpen(true);
                          }}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Upload Excel
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setRenameName(folderDetails.name);
                            setRenameDialogOpen(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Rename
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => {
                            setFolderToDelete(folderDetails);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>

                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-5 h-5 text-blue-600" />
                          <span className="font-semibold">Students: {folderDetails.student_count || 0}</span>
                        </div>
                      </div>

                      {folderDetails.uploads && folderDetails.uploads.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4" />
                            Upload History
                          </h3>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {folderDetails.uploads.map((upload) => (
                              <div key={upload.id} className="bg-slate-50 rounded p-3 text-sm">
                                <div className="font-medium">{upload.filename}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Added: {upload.students_added} | Skipped: {upload.students_skipped}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {new Date(upload.uploaded_at).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <FolderOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      Select a year folder to view details
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Students</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="spinner" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll Number</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-mono text-sm">{student.roll_number}</TableCell>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{student.department}</Badge>
                          </TableCell>
                          <TableCell>{student.year}</TableCell>
                          <TableCell className="text-sm text-slate-600">{student.email}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedStudent(student)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setNoteStudent(student);
                                  setShowNoteDialog(true);
                                }}
                              >
                                <StickyNote className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteStudent(student.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
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
      ) : (
        // Regular admin view - just students table
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Students ({students.length})</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="spinner" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-mono text-sm">{student.roll_number}</TableCell>
                      <TableCell>{student.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.department}</Badge>
                      </TableCell>
                      <TableCell>{student.year}</TableCell>
                      <TableCell className="text-sm text-slate-600">{student.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedStudent(student)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setNoteStudent(student);
                              setShowNoteDialog(true);
                            }}
                          >
                            <StickyNote className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteStudent(student.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <Dialog open={createDeptDialogOpen} onOpenChange={setCreateDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Department Folder</DialogTitle>
            <DialogDescription>Add a new department (e.g., CSE, IT, ECE)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Department Name</Label>
              <Input
                placeholder="e.g., CSE, IT, ECE"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createDepartment}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createYearDialogOpen} onOpenChange={setCreateYearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Year Folder</DialogTitle>
            <DialogDescription>Add a year folder to department</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Year</Label>
              <Input
                placeholder="e.g., 1, 2, 3, 4"
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createYearFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Year Folder</DialogTitle>
            <DialogDescription>
              This will automatically update all students in this folder
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Year</Label>
              <Input
                placeholder="e.g., 2, 3, 4"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={renameFolder}>Rename & Update Students</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadFolderDialogOpen} onOpenChange={setUploadFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Excel to Folder</DialogTitle>
            <DialogDescription>
              Students will automatically be assigned to this folder's department and year
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Excel File</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setExcelFile(e.target.files[0])}
              />
              <p className="text-xs text-slate-500 mt-1">
                Required: Roll Number, Full Name, DOB, Email, Phone Number
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={uploadExcelToFolder}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the folder.
              {folderToDelete?.type === 'year' && folderToDelete?.student_count > 0 && (
                <span className="text-red-600 font-semibold block mt-2">
                  Warning: This folder contains {folderToDelete.student_count} students!
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFolder} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note for {noteStudent?.full_name}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Enter note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button onClick={handleAddNote}>Add Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-3">
              <div>
                <Label>Roll Number</Label>
                <p className="font-mono">{selectedStudent.roll_number}</p>
              </div>
              <div>
                <Label>Full Name</Label>
                <p>{selectedStudent.full_name}</p>
              </div>
              <div>
                <Label>Department</Label>
                <p>{selectedStudent.department}</p>
              </div>
              <div>
                <Label>Year</Label>
                <p>{selectedStudent.year}</p>
              </div>
              <div>
                <Label>DOB</Label>
                <p>{selectedStudent.dob}</p>
              </div>
              <div>
                <Label>Email</Label>
                <p>{selectedStudent.email}</p>
              </div>
              <div>
                <Label>Phone</Label>
                <p>{selectedStudent.phone_number}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStudents;
