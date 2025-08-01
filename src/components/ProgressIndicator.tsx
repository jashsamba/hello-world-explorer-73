import React from 'react';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentStep, totalSteps, steps }) => {
  return (
    <div className="progress-indicator">
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
      <div className="step-labels">
        {steps.map((step, index) => (
          <div 
            key={index}
            className={`step-label ${index < currentStep ? 'completed' : index === currentStep ? 'active' : 'inactive'}`}
          >
            <div className="step-circle">
              {index < currentStep ? '✓' : index + 1}
            </div>
            <span className="step-text">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressIndicator;