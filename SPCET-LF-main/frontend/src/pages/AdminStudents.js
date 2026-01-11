import { useState, useEffect } from 'react';
import { studentsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
import { toast } from 'sonner';
import { Users, Upload, Search, Eye, Trash2, FileSpreadsheet, StickyNote } from 'lucide-react';

const AdminStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteStudent, setNoteStudent] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

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
      toast.error('Failed to delete student');
    }
  };

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in" data-testid="admin-students">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-slate-900">Student Management</h1>
          <p className="text-slate-500">{students.length} students registered</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
              data-testid="search-input"
            />
          </div>
          <Button onClick={() => setShowUploadDialog(true)} data-testid="upload-excel-btn">
            <Upload className="w-4 h-4 mr-2" />
            Upload Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No students found</p>
              <p className="text-sm text-slate-400 mt-1">Upload an Excel file to add students</p>
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
                  <TableHead>Phone</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id} className="table-row-hover" data-testid={`student-row-${student.id}`}>
                    <TableCell className="mono font-medium">{student.roll_number}</TableCell>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.department}</TableCell>
                    <TableCell>{student.year}</TableCell>
                    <TableCell className="text-sm">{student.email}</TableCell>
                    <TableCell className="text-sm mono">{student.phone_number}</TableCell>
                    <TableCell>
                      {student.admin_notes?.length > 0 && (
                        <Badge variant="secondary">
                          {student.admin_notes.length} note(s)
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedStudent(student)}
                          data-testid={`view-student-${student.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNoteStudent(student);
                            setShowNoteDialog(true);
                          }}
                          data-testid={`add-note-${student.id}`}
                        >
                          <StickyNote className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStudent(student.id)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`delete-student-${student.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Upload Excel Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Student Data</DialogTitle>
            <DialogDescription>
              Upload an Excel file with student information. Required columns:
              Roll Number, Full Name, Department, Year, DOB, Email, Phone Number
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-8 cursor-pointer hover:border-slate-300 transition-colors">
                <FileSpreadsheet className="w-12 h-12 text-slate-400 mb-3" />
                <p className="text-sm text-slate-600 mb-1">Click to upload Excel file</p>
                <p className="text-xs text-slate-400">.xlsx or .xls files</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUploadExcel}
                className="hidden"
                disabled={uploading}
                data-testid="excel-file-input"
              />
            </label>
            {uploading && (
              <div className="flex items-center justify-center mt-4">
                <div className="spinner mr-2" />
                <span className="text-sm text-slate-500">Uploading...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Detail Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Roll Number</p>
                  <p className="font-mono">{selectedStudent.roll_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Full Name</p>
                  <p>{selectedStudent.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Department</p>
                  <p>{selectedStudent.department}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Year</p>
                  <p>{selectedStudent.year}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">DOB</p>
                  <p className="mono">{selectedStudent.dob}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm">{selectedStudent.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="mono">{selectedStudent.phone_number}</p>
                </div>
              </div>

              {selectedStudent.admin_notes?.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Admin Notes</p>
                  <div className="space-y-2">
                    {selectedStudent.admin_notes.map((note, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-lg text-sm">
                        <p>{note.note}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(note.added_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin Note</DialogTitle>
            <DialogDescription>
              Add a note for {noteStudent?.full_name} ({noteStudent?.roll_number})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter your note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              data-testid="note-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} data-testid="save-note-btn">
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStudents;
