// src/renderer/src/components/Textarea.tsx
import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, ...props }) => {
  return (
    <div className="form-group">
      <label>{label}</label>
      <textarea {...props}></textarea>
    </div>
  );
};