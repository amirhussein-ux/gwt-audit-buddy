import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, CheckCircle, X, Upload } from 'lucide-react';

const REPORT_CATEGORIES = [
  { value: 'bug', label: '🐛 Bug Report', description: 'Something is broken or not working' },
  { value: 'feature_request', label: '💡 Feature Request', description: 'Suggest a new feature' },
  {
    value: 'performance_issue',
    label: '⚡ Performance Issue',
    description: 'The app is slow or unresponsive',
  },
  {
    value: 'data_accuracy',
    label: '📊 Data Accuracy Issue',
    description: 'Audit results or data seem incorrect',
  },
  { value: 'other', label: '💬 Other Feedback', description: 'Something else' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', color: 'text-red-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'low', label: 'Low', color: 'text-green-600' },
];

const MAX_FILE_SIZE_MB = 5;

interface ReportProblemFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
  auditLogId?: string | null;
}

export const ReportProblemForm: React.FC<ReportProblemFormProps> = ({
  onClose,
  onSuccess,
  auditLogId = null,
}) => {
  const { token, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [category, setCategory] = useState('bug');
  const [priority, setPriority] = useState('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      setErrorMessage(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedMimes.includes(file.type)) {
      setErrorMessage('File type not allowed. Please use PNG, JPEG, GIF, WebP, or PDF.');
      return;
    }

    setAttachment(file);
    setErrorMessage(null);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSubmissionStatus('idle');

    try {
      // Validate inputs
      if (!title.trim()) {
        setErrorMessage('Please enter a title');
        setIsSubmitting(false);
        return;
      }

      if (!description.trim()) {
        setErrorMessage('Please enter a description');
        setIsSubmitting(false);
        return;
      }

      // Prepare form data
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('priority', priority);
      if (auditLogId) {
        formData.append('auditLogId', auditLogId);
      }
      if (attachment) {
        formData.append('file', attachment);
      }

      // Submit report
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${API_BASE}/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to submit report (${response.status})`
        );
      }

      // Success
      setSubmissionStatus('success');
      setTitle('');
      setDescription('');
      setCategory('bug');
      setPriority('medium');
      setAttachment(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Call success callback after a delay
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error('[ReportForm] Submission error:', error);
      setSubmissionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submissionStatus === 'success') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Report Submitted!</h3>
              <p className="text-sm text-green-700">
                Thank you for your feedback. A confirmation email has been sent to {user?.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Report a Problem</CardTitle>
        <CardDescription>
          Help us improve by reporting bugs, suggesting features, or sharing feedback
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {errorMessage && submissionStatus === 'error' && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3 text-red-900">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          {/* File Size Error */}
          {errorMessage && submissionStatus === 'idle' && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3 text-red-900">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div>
                      <div className="font-medium">{cat.label}</div>
                      <div className="text-xs text-slate-500">{cat.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">Priority</label>
            <div className="flex gap-3">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    priority === opt.value
                      ? `bg-slate-900 text-white`
                      : `bg-slate-100 text-slate-700 hover:bg-slate-200`
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium text-slate-900">
              Title
            </label>
            <Input
              id="title"
              placeholder="Brief summary of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              maxLength={200}
            />
            <p className="text-xs text-slate-500">{title.length}/200 characters</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-slate-900">
              Description
            </label>
            <Textarea
              id="description"
              placeholder="Tell us more about the issue. Include steps to reproduce if applicable."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={4}
              maxLength={5000}
            />
            <p className="text-xs text-slate-500">{description.length}/5000 characters</p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">
              Attachment (Optional)
            </label>
            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4">
              {attachment ? (
                <div className="flex items-center justify-between rounded-lg bg-white p-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-slate-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{attachment.name}</p>
                      <p className="text-xs text-slate-500">
                        {(attachment.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    className="rounded-lg hover:bg-slate-100 p-1"
                  >
                    <X className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer space-y-2 text-center"
                >
                  <Upload className="mx-auto h-8 w-8 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-slate-500">
                      PNG, JPEG, GIF, WebP, or PDF (Max {MAX_FILE_SIZE_MB}MB)
                    </p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </Button>
            {onClose && (
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
          </div>

          <p className="text-xs text-slate-500 text-center">
            Your report will be sent to our team and help us improve the application.
          </p>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReportProblemForm;
