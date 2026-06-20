import { useState, useEffect } from 'react';
import { StickyNote, Plus, Trash2, Pencil, X, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Note {
  id: string;
  user_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

interface AdminNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminId: string;
  adminName: string;
}

export function AdminNotesDialog({ open, onOpenChange, adminId, adminName }: AdminNotesDialogProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && adminId) {
      fetchNotes();
    }
  }, [open, adminId]);

  async function fetchNotes() {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${adminId}/notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotes(data);
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر جلب الملاحظات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function addNote() {
    if (!newContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${adminId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newContent }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setNewContent('');
      fetchNotes();
      toast({ title: 'تمت الإضافة', description: 'تمت إضافة الملاحظة بنجاح' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message || 'حدث خطأ', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(noteId: string) {
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: editContent }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setEditingId(null);
      fetchNotes();
      toast({ title: 'تم التعديل', description: 'تم تعديل الملاحظة بنجاح' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message || 'حدث خطأ', variant: 'destructive' });
    }
  }

  async function deleteNote(noteId: string) {
    setDeletingId(noteId);
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast({ title: 'تم الحذف', description: 'تم حذف الملاحظة' });
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر حذف الملاحظة', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditContent(note.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            ملاحظات — {adminName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden flex-1">
          {/* Add note area */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <p className="text-sm font-medium text-muted-foreground">ملاحظة جديدة</p>
            <Textarea
              placeholder="اكتب ملاحظة خاصة هنا... (غير مرئية للمشرف)"
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="resize-none min-h-[80px] text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote();
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Ctrl+Enter للحفظ السريع</p>
              <Button size="sm" onClick={addNote} disabled={submitting || !newContent.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="mr-1">إضافة</span>
              </Button>
            </div>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-10">
                <StickyNote className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">لا توجد ملاحظات بعد</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{notes.length} ملاحظة</Badge>
                </div>
                {notes.map(note => (
                  <div
                    key={note.id}
                    className="border rounded-lg p-3 bg-background space-y-2 group"
                  >
                    {editingId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="resize-none min-h-[80px] text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5" />
                            إلغاء
                          </Button>
                          <Button size="sm" onClick={() => saveEdit(note.id)} disabled={!editContent.trim()}>
                            <Check className="h-3.5 w-3.5" />
                            حفظ
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(note.created_at), 'd MMM yyyy — HH:mm', { locale: ar })}
                            {note.updated_at && note.updated_at !== note.created_at && (
                              <span className="mr-1 opacity-60">(معدّلة)</span>
                            )}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => startEdit(note)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteNote(note.id)}
                              disabled={deletingId === note.id}
                            >
                              {deletingId === note.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
