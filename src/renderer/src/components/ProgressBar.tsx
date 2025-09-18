/* eslint-disable prettier/prettier */
import React from 'react';

export const ProgressBar = ({ value }: { value: number }) => (
  <div className="progress-bar-container">
    <div className="progress-bar-fill" style={{ width: `${value}%` }} />
  </div>
);