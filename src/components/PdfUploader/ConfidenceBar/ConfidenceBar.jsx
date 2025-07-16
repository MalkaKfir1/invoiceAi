import React from "react";
import "./ConfidenceBar.css";

export default function ConfidenceBar({ value }) {
  const percentage = Math.min(Math.max(value, 0), 100);
  const getColor = () => {
    if (percentage >= 85) return "#4caf50"; // ירוק
    if (percentage >= 60) return "#ff9800"; // כתום
    return "#f44336"; // אדום
  };

  return (
    <div className="confidence-container" title={`Confidence: ${percentage.toFixed(1)}%`}>
      <div
        className="confidence-bar"
        style={{ width: `${percentage}%`, backgroundColor: getColor() }}
      ></div>
      <span className="confidence-label">{percentage.toFixed(1)}%</span>
    </div>
  );
}
