// Comment dialog for adding comments to entities
import { useState, useEffect, useRef } from 'react';
import { useBmfStore } from '../store/bmfStore';
import type { QuestionAnswer } from '../store/bmfStore';

export function CommentDialog() {
  const selectedNodeId = useBmfStore((s) => s.selectedNodeId);
  const commentDialogOpen = useBmfStore((s) => s.commentDialogOpen);
  const closeCommentDialog = useBmfStore((s) => s.closeCommentDialog);
  const addComment = useBmfStore((s) => s.addComment);
  const getComment = useBmfStore((s) => s.getComment);
  const removeComment = useBmfStore((s) => s.removeComment);
  const toggleResolve = useBmfStore((s) => s.toggleResolve);
  const addQuestion = useBmfStore((s) => s.addQuestion);
  const updateQuestionAnswer = useBmfStore((s) => s.updateQuestionAnswer);
  const setResolution = useBmfStore((s) => s.setResolution);

  const existingComment = selectedNodeId ? getComment(selectedNodeId) : undefined;
  const [text, setText] = useState('');
  const [resolution, setResolutionText] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [questions, setQuestions] = useState<QuestionAnswer[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (commentDialogOpen && existingComment) {
      setText(existingComment.text || '');
      setResolutionText(existingComment.resolution || '');
      setQuestions(existingComment.questions || []);
      setNewQuestion('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (commentDialogOpen && !existingComment) {
      setText('');
      setResolutionText('');
      setQuestions([]);
      setNewQuestion('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commentDialogOpen, existingComment]);

  // Global Escape key handler
  useEffect(() => {
    if (!commentDialogOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCommentDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commentDialogOpen, closeCommentDialog]);

  if (!commentDialogOpen || !selectedNodeId) {
    return null;
  }

  const handleSave = () => {
    if (text.trim()) {
      addComment(selectedNodeId, text.trim());
    }
  };

  const handleDelete = () => {
    removeComment(selectedNodeId);
    closeCommentDialog();
  };

  const handleToggleResolve = () => {
    if (!existingComment) return;
    toggleResolve(selectedNodeId, !existingComment.resolved);
  };

  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return;
    addQuestion(selectedNodeId, newQuestion.trim());
    setNewQuestion('');
  };

  const handleAnswerChange = (index: number, answer: string) => {
    updateQuestionAnswer(selectedNodeId, index, answer);
  };

  const handleResolutionSave = () => {
    if (resolution.trim()) {
      setResolution(selectedNodeId, resolution.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeCommentDialog();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  const handleNewQuestionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddQuestion();
    }
  };

  return (
    <div className="comment-dialog-overlay" onClick={closeCommentDialog}>
      <div className="comment-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="comment-dialog-header">
          <h3>Add Comment</h3>
          <span className="comment-dialog-entity">{selectedNodeId}</span>
        </div>

        <textarea
          ref={inputRef}
          className="comment-dialog-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your comment..."
          rows={4}
        />

        {existingComment && (
          <div className="comment-dialog-resolution">
            <label className="comment-dialog-checkbox">
              <input
                type="checkbox"
                checked={existingComment.resolved}
                onChange={handleToggleResolve}
              />
              Resolved
            </label>

            {existingComment.resolved && (
              <div className="comment-dialog-resolution-input">
                <input
                  type="text"
                  className="comment-dialog-text-input"
                  placeholder="Resolution notes..."
                  value={resolution}
                  onChange={(e) => setResolutionText(e.target.value)}
                  onBlur={handleResolutionSave}
                />
              </div>
            )}
          </div>
        )}

        <div className="comment-dialog-questions">
          <div className="comment-dialog-questions-header">
            <span>Questions</span>
            <span className="comment-dialog-hint">Press Enter to add</span>
          </div>

          {questions.map((qa, index) => (
            <div key={index} className="comment-dialog-question">
              <div className="comment-dialog-question-text">{qa.question}</div>
              <input
                type="text"
                className="comment-dialog-text-input"
                placeholder="Answer..."
                value={qa.answer || ''}
                onChange={(e) => handleAnswerChange(index, e.target.value)}
              />
            </div>
          ))}

          <div className="comment-dialog-new-question">
            <input
              type="text"
              className="comment-dialog-text-input"
              placeholder="Add a question..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={handleNewQuestionKeyDown}
            />
          </div>
        </div>

        <div className="comment-dialog-hint">
          Press <kbd>Cmd/Ctrl+Enter</kbd> to save, <kbd>Esc</kbd> to cancel
        </div>

        <div className="comment-dialog-actions">
          {existingComment && (
            <button className="comment-dialog-btn comment-dialog-delete" onClick={handleDelete}>
              Delete
            </button>
          )}
          <div className="comment-dialog-spacer" />
          <button className="comment-dialog-btn comment-dialog-cancel" onClick={closeCommentDialog}>
            Cancel
          </button>
          <button
            className="comment-dialog-btn comment-dialog-save"
            onClick={handleSave}
            disabled={!text.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
